import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { database } from "../../src/lib/db";
import { reserveAIQuota } from "../../src/lib/http";
import { primaryAccountId } from "../../src/lib/account-id";
import { fixtures, candidate, type Fixture } from "./fixtures";
import { queries, jobs } from "./queries";
import { runVariant, type Variant, type Gate } from "./variants";
import { evaluate, canonical, diffScore, rankMetrics } from "./metrics";
import {
  identity,
  semanticHash,
  diffCareer,
} from "../../src/lib/ingestion/diff";
import { tableFor, kinds, type Candidate } from "../../src/lib/ingestion/model";
import { loadCanonical } from "../../src/lib/ingestion/repository";
import { getCareer } from "../../src/lib/career/repository";
import { reindexCareer } from "../../src/lib/embeddings/indexer";
import { retrieveCareerEvidence } from "../../src/lib/embeddings/retrieval";
import { embed } from "../../src/lib/embeddings/cohere";
import {
  semanticEntities,
  expandMatches,
  jobQueries,
  deduplicate,
  contentHash,
} from "../../src/lib/embeddings/content";
import { retrieve } from "../../src/lib/career/retrieval";
import { interviewQuestions } from "../../src/lib/interview/questions";
import { compileResumeIR } from "../../src/lib/resume-ir";
import { newWorkspace } from "../../src/lib/workspaces/model";
import { complete } from "../../src/lib/ai/openrouter";
import { groundedPrompt } from "../../src/lib/ai/prompts";
import { answerSchema, validateEvidence } from "../../src/lib/ai/contracts";
const root = "experiments/career-brain/results";
type Ledger = {
  label: string;
  provider: "OPENROUTER" | "COHERE";
  reservedUsd: number;
  latencyMs: number;
  outcome: string;
};
type Run = {
  fixture: string;
  variant: Variant;
  repetition: number;
  rows: Candidate[];
  metrics: ReturnType<typeof evaluate>;
  error?: string;
  latencyMs: number;
};
type Usage = {
  provider: string;
  model: string;
  operation_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  units: number | null;
  provider_cost_micro: number | null;
  status: string;
};
type Results = {
  ledger: Ledger[];
  runs: Run[];
  usage: Usage[];
  cleanup: {
    stage: string;
    accountRemoved: boolean;
    authRemoved: boolean;
    primaryRecordsBefore: number;
    primaryRecordsAfter: number;
  }[];
  retrieval?: unknown;
  versions?: unknown;
  endToEnd?: unknown;
  productionSmoke?: unknown;
};
await mkdir(root, { recursive: true });
let results: Results;
try {
  results = JSON.parse(await readFile(`${root}/results.json`, "utf8"));
} catch {
  results = { ledger: [], runs: [], usage: [], cleanup: [] };
}
const save = () =>
  writeFile(`${root}/results.json`, JSON.stringify(results, null, 2) + "\n");
const stage =
  process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1] ||
  "offline";
if (stage === "offline") {
  const a = fixtures.find((f) => f.id === "A-clean-v1")!;
  const b = fixtures.find((f) => f.id === "A-clean-v2")!;
  const c = fixtures.find((f) => f.id === "A-clean-v3")!;
  const versions = {
    v2: diffScore(b, b.gold.map(candidate), canonical(a.gold.map(candidate))),
    v3: diffScore(
      c,
      c.gold.map(candidate),
      canonical(
        [
          ...b.gold.map(candidate),
          candidate(a.gold.find((r) => r.kind === "certification")!),
        ],
        ["certification:cedar-sql"],
      ),
    ),
  };
  await writeFile(
    `${root}/offline.json`,
    JSON.stringify(
      {
        versions,
        fixtures: fixtures.map((f) => ({
          id: f.id,
          characters: f.source.length,
          gold: f.gold.length,
          invalidQuotes: f.gold
            .filter((r) => !f.source.includes(r.source_quote))
            .map(identity),
        })),
        queries: queries.length,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      stage,
      queries: queries.length,
      v2Accuracy: versions.v2.accuracy,
      v3Accuracy: versions.v3.accuracy,
    }),
  );
  process.exit(0);
}
if (!process.argv.includes("--live"))
  throw new Error(
    "Paid remote experiments require --live; default is offline.",
  );
if (process.env.APP_MODE !== "live")
  throw new Error("Live qualification needs existing live environment.");
if (
  (process.env.OPENROUTER_INGEST_MODEL || "openai/gpt-6-luna-pro") !==
    "openai/gpt-6-luna-pro" ||
  process.env.OPENROUTER_MODEL !== "openai/gpt-6-luna"
)
  throw new Error(
    "The frozen budget supports Luna Pro ingest and Luna answers only; define a new bounded experiment before using another model.",
  );
const db = database();
let accountId: string | undefined,
  userId: string | undefined,
  owner: SupabaseClient;
const primaryBefore = (await loadCanonical(db, primaryAccountId)).length;
const gate: Gate = async (label, provider, fn) => {
  const cap = provider === "OPENROUTER" ? 40 : 20;
  const reservation = provider === "OPENROUTER" ? 0.1 : 0.05;
  if (
    results.ledger.filter((l) => l.provider === provider).length >= cap ||
    results.ledger.reduce((s, l) => s + l.reservedUsd, 0) + reservation >
      5.000001
  )
    throw new Error("Qualification budget exhausted; no call made.");
  const item: Ledger = {
    label: `${stage}:${label}`,
    provider,
    reservedUsd: reservation,
    latencyMs: 0,
    outcome: "RESERVED",
  };
  results.ledger.push(item);
  await save();
  if (provider === "OPENROUTER") await reserveAIQuota();
  const start = performance.now();
  try {
    const value = await fn();
    item.outcome = "SUCCESS";
    return value;
  } catch (error) {
    item.outcome = "FAILED";
    throw error;
  } finally {
    item.latencyMs = Math.round(performance.now() - start);
    await save();
  }
};
async function checked<
  R extends { data: unknown; error: { message: string } | null },
>(result: R): Promise<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function ingest(
  fixture: Fixture,
  variant: Variant,
  repetition = 1,
  keys: string[] = [],
) {
  if (
    results.runs.some(
      (r) =>
        r.fixture === fixture.id &&
        r.variant === variant &&
        r.repetition === repetition,
    )
  )
    return;
  const start = performance.now();
  let rows: Candidate[] = [],
    error: string | undefined;
  try {
    rows = await runVariant(variant, fixture.source, keys, accountId!, gate);
  } catch (e) {
    error = e instanceof Error ? e.message : "Provider experiment failed";
  }
  const run: Run = {
    fixture: fixture.id,
    variant,
    repetition,
    rows,
    metrics: evaluate(fixture, rows),
    error,
    latencyMs: Math.round(performance.now() - start),
  };
  results.runs.push(run);
  await save();
  console.log(
    JSON.stringify({
      fixture: run.fixture,
      variant,
      repetition,
      records: rows.length,
      error,
      factRecall: run.metrics.factRecall,
      relations: run.metrics.relationRecall,
    }),
  );
}
async function apply(fixture: Fixture) {
  const current = await loadCanonical(owner, accountId!);
  const changes = diffCareer(fixture.gold.map(candidate), current, true);
  const source = await checked(
    await owner
      .from("career_sources")
      .insert({
        account_id: accountId,
        kind: "MASTER",
        content: fixture.source,
        evidence_text: fixture.source,
        content_hash: semanticEntitiesHash(fixture.source),
      })
      .select("id")
      .single(),
  );
  const batch = await checked(
    await owner
      .from("career_imports")
      .insert({
        account_id: accountId,
        source_id: source!.id,
        model: "manually-reviewed-synthetic-gold",
        candidates: changes,
      })
      .select("id")
      .single(),
  );
  const patches = changes
    .filter((c) => !["UNCHANGED", "REVIEW"].includes(c.status))
    .map((c) => ({
      ...(c.after || c.before),
      action: c.status === "REMOVED" ? "ARCHIVE" : "UPSERT",
      baseline_hash: c.before?.hash || null,
      baseline_version: c.before?.updated_at || null,
      hash: c.after ? semanticHash(c.after) : c.before!.hash,
    }));
  await checked(
    await owner.rpc("apply_career_import", {
      p_import: batch!.id,
      p_changes: patches,
    }),
  );
  // Retrieval eligibility within the isolated tenant. Public routes only read the primary account.
  for (const kind of kinds)
    await checked(
      await owner
        .from(tableFor[kind])
        .update({ is_public: true })
        .eq("account_id", accountId!)
        .is("archived_at", null),
    );
  return changes.map((c) => ({ identity: c.identity, status: c.status }));
}
function semanticEntitiesHash(source: string) {
  // Keep source content hashing identical to production without importing provider code.
  return contentHash(source);
}
try {
  const email = `qualification-${randomUUID()}@example.invalid`;
  const created = await checked(
    await db.auth.admin.createUser({ email, email_confirm: true }),
  );
  userId = created.user!.id;
  accountId = await checked(
    await db.rpc("bootstrap_account", { p_user: userId, p_primary: false }),
  );
  if (!accountId || accountId === primaryAccountId)
    throw new Error("Disposable tenant guard failed");
  await checked(
    await db.from("accounts").update({ kind: "DEMO" }).eq("id", accountId),
  );
  const link = await checked(
    await db.auth.admin.generateLink({ type: "magiclink", email }),
  );
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const session = await checked(
    await auth.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties!.hashed_token,
    }),
  );
  owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${session.session!.access_token}` },
      },
    },
  );
  if (stage === "baseline") {
    for (const f of fixtures)
      await ingest(
        f,
        "A",
        1,
        f.id.endsWith("v2") || f.id.endsWith("v3")
          ? fixtures[0].gold.map(identity)
          : [],
      );
    for (let i = 2; i <= 5; i++) await ingest(fixtures[1], "A", i);
  } else if (stage === "candidates") {
    for (const variant of ["B", "C", "D"] as const)
      await ingest(fixtures[1], variant);
  } else if (stage === "confirm-B") {
    for (let i = 2; i <= 5; i++) await ingest(fixtures[1], "B", i);
    for (const f of [fixtures[5], fixtures[4], fixtures[6]])
      await ingest(f, "B");
  } else if (stage === "confirm-E") {
    for (const f of fixtures) {
      const previous = f.id.endsWith("v2")
        ? "A-clean-v1"
        : f.id.endsWith("v3")
          ? "A-clean-v2"
          : undefined;
      await ingest(
        f,
        "E",
        1,
        previous
          ? results.runs
              .find((r) => r.variant === "E" && r.fixture === previous)!
              .rows.map(identity)
          : [],
      );
    }
    for (let i = 2; i <= 5; i++) await ingest(fixtures[1], "E", i);
  } else if (stage === "production-smoke") {
    await checked(
      await owner.from("projects").insert({
        account_id: accountId,
        slug: "qualification-department-01",
        title: "Synthetic qualification department 01",
        summary: "Built a checker for department 01. No measured result.",
        is_public: false,
      }),
    );
    const site = process.env.NEXT_PUBLIC_SITE_URL!;
    const interview = async (asked: string[]) => {
      const response = await fetch(`${site}/api/admin/career`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: site,
          Cookie: `rb_account=${session.session!.access_token}`,
        },
        body: JSON.stringify({
          action: "interview",
          mode: "record",
          job: "",
          key: "project:qualification-department-01",
          asked,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw new Error(`Deployed interview failed: ${response.status}`);
      return (await response.json()) as { questions: { id: string }[] };
    };
    const initial = await interview([]);
    const followup = await interview(initial.questions.map((q) => q.id));
    const anonymous = await fetch(`${site}/api/admin/career`, {
      signal: AbortSignal.timeout(20000),
    });
    const publicPage = await fetch(site, {
      signal: AbortSignal.timeout(20000),
    });
    const smoke = {
      outcomeProbe: initial.questions.some((q) => q.id.endsWith(":outcome")),
      questions: initial.questions.length,
      noRepeat: !followup.questions.some((q) =>
        initial.questions.some((old) => old.id === q.id),
      ),
      anonymousStatus: anonymous.status,
      publicTenantInvisible: !(await publicPage.text()).includes(
        "Synthetic qualification department 01",
      ),
    };
    if (
      !smoke.outcomeProbe ||
      !smoke.noRepeat ||
      anonymous.status !== 403 ||
      !smoke.publicTenantInvisible
    )
      throw new Error("Deployed qualification smoke failed");
    results.productionSmoke = smoke;
    await save();
    console.log(JSON.stringify({ stage, ...smoke }));
  } else if (stage === "end-to-end") {
    await apply(fixtures[0]);
    await gate("index-end-to-end", "COHERE", () => reindexCareer(accountId));
    const career = await getCareer(accountId);
    const question = "Has Ada managed 100 employees?";
    const evidence = await gate("actual-retrieval", "COHERE", () =>
      retrieveCareerEvidence([question], career, {
        accountId,
        operation: "qualification_e2e",
      }),
    );
    const answer = await gate("negative-grounded-answer", "OPENROUTER", () =>
      complete(groundedPrompt("ask", evidence), question, answerSchema, {
        usage: { accountId, operation: "qualification_negative_answer" },
      }),
    );
    validateEvidence(
      answer.evidence_ids,
      evidence.map((r) => r.id),
    );
    results.endToEnd = {
      ...(results.endToEnd as object),
      negative: {
        question,
        retrieved: evidence.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
        })),
        answer,
        noEvidenceCorrect: /no relevant evidence is currently stored/i.test(
          answer.answer,
        ),
        outsideCitations: 0,
      },
    };
    await save();
    console.log(JSON.stringify({ stage, records: evidence.length, answer }));
  } else if (stage === "retrieval") {
    const v1 = fixtures[0];
    await apply(v1);
    const initial = await gate("index-v1", "COHERE", () =>
      reindexCareer(accountId),
    );
    const unchanged = await reindexCareer(accountId);
    const career = await getCareer(accountId);
    const entities = semanticEntities(career);
    const map = new Map(
      entities.map((e) => [e.record.id, `${e.type}:${e.record.slug}`]),
    );
    type Match = {
      entity_type:
        | "experience"
        | "project"
        | "achievement"
        | "skill"
        | "education"
        | "certification";
      entity_id: string;
      content_hash: string;
      similarity: number;
    };
    const queryVectors: number[][] = [];
    for (let i = 0; i < queries.length; i += 32)
      queryVectors.push(
        ...(await gate(`queries-${i}`, "COHERE", () =>
          embed(
            queries.slice(i, i + 32).map((q) => q.text),
            "search_query",
            { accountId, operation: "qualification_queries" },
          ),
        )),
      );
    const rankings: ((typeof queries)[number] & {
      matches: Match[];
      lexical: string[];
      semantic: string[];
      hybrid: string[];
    })[] = [];
    for (const [i, q] of queries.entries()) {
      const matches: Match[] = await checked(
        await db.rpc("match_account_embeddings", {
          p_account_id: accountId,
          query_embedding: JSON.stringify(queryVectors[i]),
          requested_model: "embed-v4.0",
          match_count: 8,
          min_similarity: -1,
          entity_types: null,
        }),
      );
      const lexical = retrieve(career, q.text).map((r) => map.get(r.id)!);
      rankings.push({
        ...q,
        matches,
        lexical,
        semantic: matches
          .filter((m) => m.similarity >= 0.25)
          .map((m) => map.get(m.entity_id)!),
        hybrid: [
          ...new Set([
            ...matches
              .filter((m) => m.similarity >= 0.25)
              .map((m) => map.get(m.entity_id)!),
            ...lexical,
          ]),
        ],
      });
    }
    const sweep = [0.25, 0.4, 0.5, 0.6, 0.7, 0.8].map((threshold) => ({
      threshold,
      semantic: rankMetrics(
        rankings.map((r) => ({
          relevant: r.relevant,
          ranking: r.matches
            .filter((m) => m.similarity >= threshold)
            .map((m) => map.get(m.entity_id)!),
        })),
      ),
      hybrid: rankMetrics(
        rankings.map((r) => ({
          relevant: r.relevant,
          ranking: [
            ...new Set([
              ...r.matches
                .filter((m) => m.similarity >= threshold)
                .map((m) => map.get(m.entity_id)!),
              ...r.lexical,
            ]),
          ],
        })),
      ),
    }));
    const approved = await loadCanonical(owner, accountId!);
    const alternativeText = entities.map((e) => {
      const context = approved
        .filter((r) => r.achievement_keys.includes(e.record.slug))
        .map(
          (r) =>
            `${r.title} at ${r.organization || "organization not recorded"}`,
        )
        .join("; ");
      return `${e.content}${context ? `\nAssociated work: ${context}` : ""}`;
    });
    const alternativeVectors = await gate("projection-context", "COHERE", () =>
      embed(alternativeText, "search_document", {
        accountId,
        operation: "qualification_projection",
      }),
    );
    const cosine = (a: number[], b: number[]) =>
      a.reduce((s, v, i) => s + v * b[i], 0) /
      Math.sqrt(
        a.reduce((s, v) => s + v * v, 0) * b.reduce((s, v) => s + v * v, 0),
      );
    const alternativeRankings = queries.map((q, i) => ({
      relevant: q.relevant,
      ranking: alternativeVectors
        .map((v, n) => ({
          identity: map.get(entities[n].record.id)!,
          similarity: cosine(v, queryVectors[i]),
        }))
        .filter((r) => r.similarity >= 0.25)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8)
        .map((r) => r.identity),
    }));
    const fusion = rankMetrics(
      rankings.map((r) => {
        const semantic = r.matches
          .filter((m) => m.similarity >= 0.25)
          .map((m) => map.get(m.entity_id)!);
        const ids = [...new Set([...semantic, ...r.lexical])];
        return {
          relevant: r.relevant,
          ranking: ids.sort((a, b) => {
            const score = (id: string) =>
              [semantic, r.lexical].reduce((s, list) => {
                const i = list.indexOf(id);
                return s + (i < 0 ? 0 : 1 / (60 + i + 1));
              }, 0);
            return score(b) - score(a);
          }),
        };
      }),
    );
    const jobVectors = await gate("jobs", "COHERE", () =>
      embed(
        jobs.flatMap((j) => jobQueries(j.text)),
        "search_query",
        { accountId, operation: "qualification_jobs" },
      ),
    );
    let offset = 0;
    const jobResults = [];
    for (const job of jobs) {
      const texts = jobQueries(job.text),
        semantic: Match[] = [];
      for (const vector of jobVectors.slice(offset, offset + texts.length))
        semantic.push(
          ...(await checked(
            await db.rpc("match_account_embeddings", {
              p_account_id: accountId,
              query_embedding: JSON.stringify(vector),
              requested_model: "embed-v4.0",
              match_count: 8,
              min_similarity: 0.25,
              entity_types: null,
            }),
          )),
        );
      offset += texts.length;
      const evidence = deduplicate([
        ...expandMatches(
          semantic.sort((a, b) => b.similarity - a.similarity),
          entities,
        ),
        ...texts.flatMap((t) => retrieve(career, t)),
      ]);
      const ranking = evidence.map((r) => map.get(r.id)!);
      const workspace = newWorkspace(randomUUID(), "US", false);
      workspace.evidence = evidence;
      workspace.job_description = job.text;
      const ir = compileResumeIR(career, workspace, {
        market: "US",
        location: "",
        contact_email: "",
        phone: "",
        work_authorization: "",
      });
      const bullets = [
        ...ir.projects,
        ...ir.experiences,
        ...ir.supporting_sections,
        ...ir.education,
        ...ir.certifications,
      ].flatMap((r) => r.bullets);
      jobResults.push({
        id: job.id,
        queries: texts,
        relevant: job.relevant,
        ranking,
        coverage: job.relevant.length
          ? job.relevant.filter((r) => ranking.includes(r)).length /
            job.relevant.length
          : null,
        irBullets: bullets,
        allBulletsCanonical: bullets.every((b) =>
          entities.some((e) => e.record.summary === b),
        ),
      });
    }
    const sparse = canonical([
      candidate(fixtures[4].gold.find((r) => r.kind === "project")!),
    ]);
    const questions = interviewQuestions(
      sparse,
      "record",
      "SQL automation",
      "project:sql-checking",
    );
    const followup = interviewQuestions(
      sparse,
      "record",
      "SQL automation",
      "project:sql-checking",
      questions.map((q) => q.id),
    );
    results.retrieval = {
      initial,
      unchanged,
      semanticText: entities.map((e) => ({
        identity: map.get(e.record.id),
        content: e.content,
      })),
      rankings,
      sweep,
      lexical: rankMetrics(
        rankings.map((r) => ({ relevant: r.relevant, ranking: r.lexical })),
      ),
      fusion,
      alternativeProjection: {
        texts: alternativeText,
        metrics: rankMetrics(alternativeRankings),
      },
      jobResults,
      interview: {
        questions,
        followup,
        repeated: followup.filter((q) =>
          questions.some((old) => old.id === q.id),
        ).length,
      },
    };
    await save();
    const v2Changes = await apply(fixtures[7]);
    const v2index = await gate("index-v2", "COHERE", () =>
      reindexCareer(accountId),
    );
    const before = await db
      .from("career_embeddings")
      .select("entity_type,entity_id,content_hash")
      .eq("account_id", accountId);
    await apply(fixtures[8]);
    const v3Career = await getCareer(accountId),
      v3Entities = semanticEntities(v3Career);
    const oldMatches = (before.data || []) as Match[];
    const staleRejected = oldMatches.filter(
      (m) => !expandMatches([m], v3Entities).length,
    ).length;
    const v3index = await gate("index-v3", "COHERE", () =>
      reindexCareer(accountId),
    );
    results.versions = { v2Changes, v2index, staleRejected, v3index };
    // Same production grounded prompt/schema, scoped usage; inspect answer facts separately.
    const answer = await gate("grounded-answer", "OPENROUTER", () =>
      complete(
        groundedPrompt(
          "ask",
          entities.map((e) => e.record),
        ),
        "What did Ada personally build, and what results and training are supported?",
        answerSchema,
        { usage: { accountId, operation: "qualification_answer" } },
      ),
    );
    validateEvidence(
      answer.evidence_ids,
      entities.map((e) => e.record.id),
    );
    results.endToEnd = {
      review:
        "Synthetic gold manually reconciles source facts before transactional apply; no automatic acceptance of model output.",
      answer,
      resumeBulletsCanonical: jobResults.every((j) => j.allBulletsCanonical),
    };
    // Independent sparse-career holdout: depth-limited Docker must not imply deployment.
    await apply(fixtures[4]);
    await gate("index-sparse-holdout", "COHERE", () =>
      reindexCareer(accountId),
    );
    const holdoutCareer = await getCareer(accountId),
      holdoutEntities = semanticEntities(holdoutCareer);
    const holdoutQueries = [
      {
        text: "Has Ada used SQL in production?",
        relevant: ["skill:sql", "project:sql-checking"],
      },
      { text: "Has Ada tried Docker locally?", relevant: ["skill:docker"] },
      { text: "Has Ada deployed containers professionally?", relevant: [] },
      { text: "Has Ada used AWS?", relevant: [] },
      { text: "What Kubernetes experience is recorded?", relevant: [] },
    ];
    const holdoutVectors = await gate("sparse-holdout-queries", "COHERE", () =>
      embed(
        holdoutQueries.map((q) => q.text),
        "search_query",
        { accountId, operation: "qualification_holdout" },
      ),
    );
    const holdout: ((typeof holdoutQueries)[number] & {
      matches: (Match & { identity: string })[];
      lexical: string[];
    })[] = [];
    for (const [i, q] of holdoutQueries.entries()) {
      const matches: Match[] = await checked(
        await db.rpc("match_account_embeddings", {
          p_account_id: accountId,
          query_embedding: JSON.stringify(holdoutVectors[i]),
          requested_model: "embed-v4.0",
          match_count: 8,
          min_similarity: -1,
          entity_types: null,
        }),
      );
      holdout.push({
        ...q,
        matches: matches.map((m) => ({
          ...m,
          identity: `${m.entity_type}:${holdoutEntities.find((e) => e.record.id === m.entity_id)!.record.slug}`,
        })),
        lexical: retrieve(holdoutCareer, q.text).map(
          (r) =>
            `${holdoutEntities.find((e) => e.record.id === r.id)!.type}:${r.slug}`,
        ),
      });
    }
    results.retrieval = {
      ...(results.retrieval as object),
      holdout,
      holdoutSweep: [0.25, 0.4, 0.5, 0.6, 0.7, 0.8].map((threshold) => ({
        threshold,
        semantic: rankMetrics(
          holdout.map((r) => ({
            relevant: r.relevant,
            ranking: r.matches
              .filter((m) => m.similarity >= threshold)
              .map((m) => m.identity),
          })),
        ),
        hybrid: rankMetrics(
          holdout.map((r) => ({
            relevant: r.relevant,
            ranking: [
              ...new Set([
                ...r.matches
                  .filter((m) => m.similarity >= threshold)
                  .map((m) => m.identity),
                ...r.lexical,
              ]),
            ],
          })),
        ),
      })),
    };
    await save();
    console.log(
      JSON.stringify({
        stage,
        initial,
        unchanged,
        sweep,
        lexical: (results.retrieval as { lexical: unknown }).lexical,
        versions: results.versions,
      }),
    );
  } else throw new Error("Unknown stage");
} finally {
  if (accountId && accountId !== primaryAccountId) {
    const usage = await checked(
      await db
        .from("provider_usage_events")
        .select(
          "provider,model,operation_type,input_tokens,output_tokens,units,provider_cost_micro,status",
        )
        .eq("account_id", accountId),
    );
    results.usage.push(...(usage || []));
    for (const table of [
      "career_embeddings",
      "project_achievements",
      "experience_achievements",
      "project_skills",
      "experience_skills",
      "achievement_skills",
      "career_imports",
      ...kinds.map((k) => tableFor[k]),
      "career_sources",
      "provider_usage_events",
      "account_members",
    ])
      await checked(await db.from(table).delete().eq("account_id", accountId));
    await checked(await db.from("accounts").delete().eq("id", accountId));
  }
  if (userId) await checked(await db.auth.admin.deleteUser(userId));
  const primaryAfter = (await loadCanonical(db, primaryAccountId)).length;
  const absent = accountId
    ? await db.from("accounts").select("id").eq("id", accountId)
    : { data: [] };
  results.cleanup.push({
    stage,
    accountRemoved: !absent.data?.length,
    authRemoved: !!userId,
    primaryRecordsBefore: primaryBefore,
    primaryRecordsAfter: primaryAfter,
  });
  await save();
  console.log(
    JSON.stringify({
      stage,
      cleanup: results.cleanup.at(-1),
      reservedUsd: results.ledger.reduce((s, l) => s + l.reservedUsd, 0),
      calls: results.ledger.length,
    }),
  );
}
