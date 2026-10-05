import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { database } from "../../../../src/lib/db";
import { primaryAccountId } from "../../../../src/lib/account-id";
import { loadCanonical } from "../../../../src/lib/ingestion/repository";
import { kinds, tableFor } from "../../../../src/lib/ingestion/model";
import {
  answerSchema,
  validateEvidence,
} from "../../../../src/lib/ai/contracts";
import { complete } from "../provider";
import { auditGrounding } from "../pipeline";
import { repairExtract } from "../repair";
import { richDiff, type RichCandidate } from "../evidence";
import {
  qualificationMember,
  richDatabaseState,
  applyReviewedGold,
} from "../database-state";
import { semanticAdjudication } from "../semantic-adjudication";
import { evidencePrompt, type EvidencePacket } from "../packets";
import type { Support } from "../packets";
import type { Gate } from "../../variants";
import {
  root,
  fixture,
  groundingCases,
  supportCases,
  diffOracle,
  reviewedSeed,
} from "./fixtures";
import { auditAssertions } from "./audit";
import { reviewedRevision } from "./sequence";

type Ledger = {
  label: string;
  provider: string;
  reservedUsd: number;
  outcome: string;
  latencyMs: number;
  error?: string;
};
type State = {
  budget: { maxUsd: number; inferenceCalls: number; noRetries: true };
  ledger: Ledger[];
  usage: Record<string, unknown>[];
  stages: Record<string, { outcome: string; error?: string }>;
  cleanup: unknown[];
};
const path = `${root}/ledger.json`;
const stage =
  process.argv.find((a) => a.startsWith("--stage="))?.slice(8) || "freeze";
await mkdir(root, { recursive: true });
const saveJson = async (name: string, value: unknown) =>
  writeFile(`${root}/${name}.json`, JSON.stringify(value, null, 2) + "\n");
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
async function originalFiles() {
  const files: string[] = [];
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  }
  await walk("experiments/career-brain/v2/results");
  files.push("experiments/career-brain/v2/benchmark.json");
  return Object.fromEntries(
    await Promise.all(
      files.sort().map(async (p) => [p, hash(await readFile(p))]),
    ),
  );
}
if (stage === "freeze") {
  const inputs = {
    grounding: groundingCases(),
    support: supportCases(),
    diffOracle,
    richV1: await reviewedSeed("A-clean-v1"),
    richB: await reviewedSeed("B-messy"),
  };
  const manifest = {
    lineageCommit: "eacaf03c0f39dbd40aaef2acd57980bf12addec8",
    originalFiles: await originalFiles(),
    inputHash: hash(JSON.stringify(inputs)),
    budget: { maxUsd: 5, inferenceCalls: 80, noRetries: true },
    scope:
      "Continuation only; old $12 ledger is retained exhausted. No new embeddings or architecture ablation. Cached candidate ranks stay unchanged. New native protocol and source-corrected rich diff oracle are frozen before calls.",
  };
  try {
    const old = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
    if (old.inputHash !== manifest.inputHash)
      throw new Error("Frozen continuation inputs changed");
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
    await saveJson("inputs", inputs);
    await saveJson("manifest", manifest);
    for (const name of ["fixtures", "audit", "sequence", "run"])
      await writeFile(
        `${root}/${name}.ts.snapshot`,
        await readFile(`experiments/career-brain/v2/continuation/${name}.ts`),
      );
  }
  console.log(
    JSON.stringify({
      inputHash: manifest.inputHash,
      groundingCases: inputs.grounding.cases.length,
      supportCases: inputs.support.length,
      originalFiles: Object.keys(manifest.originalFiles).length,
    }),
  );
  process.exit(0);
}
if (stage === "verify-preserved") {
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
  const current = await originalFiles();
  const changed = Object.keys(manifest.originalFiles).filter(
    (p) => current[p] !== manifest.originalFiles[p],
  );
  if (changed.length)
    throw new Error(`Historical artifacts changed: ${changed.join(", ")}`);
  if (
    hash(
      JSON.stringify(JSON.parse(await readFile(`${root}/inputs.json`, "utf8"))),
    ) !== manifest.inputHash
  )
    throw new Error("Frozen continuation input hash mismatch");
  console.log(
    JSON.stringify({
      historicalFilesUnchanged: Object.keys(manifest.originalFiles).length,
    }),
  );
  process.exit(0);
}
if (!process.argv.includes("--live") || process.env.APP_MODE !== "live")
  throw new Error("Native continuation requires --live and APP_MODE=live");
process.env.CAREER_QUALIFICATION_CONTINUATION = "1";
let state: State;
try {
  state = JSON.parse(await readFile(path, "utf8"));
} catch {
  state = {
    budget: { maxUsd: 5, inferenceCalls: 80, noRetries: true },
    ledger: [],
    usage: [],
    stages: {},
    cleanup: [],
  };
}
if (state.stages[stage])
  throw new Error(
    `Stage already attempted (${state.stages[stage].outcome}); preserve it, no automatic retry`,
  );
const inputs: {
  grounding: ReturnType<typeof groundingCases>;
  support: ReturnType<typeof supportCases>;
  richV1: { records: RichCandidate[] };
  richB: { records: RichCandidate[] };
} = JSON.parse(await readFile(`${root}/inputs.json`, "utf8"));
const save = () => saveJson("ledger", state);
const gate: Gate = async (label, provider, call) => {
  const reservation = label.includes("gpt-6-sol")
    ? 0.3
    : label.startsWith("answer-")
      ? 0.025
      : 0.08;
  if (
    provider !== "OPENROUTER" ||
    state.ledger.length >= state.budget.inferenceCalls ||
    state.ledger.reduce((sum, l) => sum + l.reservedUsd, 0) + reservation >
      state.budget.maxUsd + 1e-8
  )
    throw new Error("Continuation budget exhausted; no provider request made");
  const item: Ledger = {
    label: `${stage}:${label}`,
    provider,
    reservedUsd: reservation,
    outcome: "RESERVED",
    latencyMs: 0,
  };
  state.ledger.push(item);
  await save();
  const start = performance.now();
  try {
    const result = await call();
    item.outcome = "SUCCESS";
    return result;
  } catch (e) {
    item.outcome = "FAILED";
    item.error = e instanceof Error ? e.message : "Call failed";
    throw e;
  } finally {
    item.latencyMs = Math.round(performance.now() - start);
    await save();
    console.log(
      JSON.stringify({
        label: item.label,
        outcome: item.outcome,
        latencyMs: item.latencyMs,
        attempts: state.ledger.length,
      }),
    );
  }
};
async function checked<
  R extends { data: unknown; error: { message: string } | null },
>(r: R): Promise<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
const db = database();
let accountId: string | undefined, userId: string | undefined;
const before = (await loadCanonical(db, primaryAccountId)).length;
state.stages[stage] = { outcome: "RUNNING" };
await save();
try {
  const email = `qualification-v2-continuation-${randomUUID()}@example.invalid`;
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
  if (stage === "grounding") {
    const baseline = await auditGrounding(
      inputs.grounding.cases.map((c) => c.record),
      inputs.grounding.source,
      accountId,
      gate,
    );
    await saveJson("grounding-baseline", {
      inputs: inputs.grounding,
      ...baseline,
    });
    const assertions = await auditAssertions(
      inputs.grounding.cases.map((c) => c.record),
      inputs.grounding.source,
      accountId,
      gate,
    );
    await saveJson("grounding-assertions", {
      inputs: inputs.grounding,
      ...assertions,
    });
    // Same original observed failure, not only newly constructed minimal examples.
    const historical = JSON.parse(
      await readFile(
        "experiments/career-brain/v2/results/results.json",
        "utf8",
      ),
    );
    const g = historical.runs.find(
      (r: { fixture: string; variant: string }) =>
        r.fixture === "G-pathological" && r.variant === "R4",
    );
    const project = g.rich.find(
      (r: RichCandidate) => r.kind === "project" && r.title === "Dispatch Loom",
    );
    const rechecked = await auditAssertions(
      [project],
      fixture("G-pathological").source,
      accountId,
      gate,
    );
    await saveJson("observed-warning", {
      sourceFixture: "G-pathological",
      original: project,
      ...rechecked,
    });
  } else if (stage === "warning-sol") {
    const observed: { original: RichCandidate } = JSON.parse(
      await readFile(`${root}/observed-warning.json`, "utf8"),
    );
    const result = await auditGrounding(
      [observed.original],
      fixture("G-pathological").source,
      accountId,
      gate,
      "openai/gpt-6-sol",
    );
    await saveJson("observed-warning-sol", {
      input: observed.original,
      scope:
        "Targeted Sol audit of the unchanged observed R4 paragraph and original source. No repaired inputs or provider-side subagents.",
      ...result,
    });
  } else if (stage === "post-equivalence") {
    const native: { records: RichCandidate[] } = JSON.parse(
      await readFile(`${root}/sequence-v3-native.json`, "utf8"),
    );
    const result = await auditGrounding(
      native.records,
      fixture("A-clean-v3").source,
      accountId,
      gate,
    );
    await saveJson("sequence-v3-post-equivalence", {
      scope:
        "Diagnostic fresh source-context audit after the existing equivalence stage. Earlier native output remains unchanged; this extra audit is not promoted into the pipeline.",
      ...result,
    });
  } else if (stage === "repeat") {
    const owner = await qualificationMember(db, email);
    const applied = await applyReviewedGold(
      owner,
      accountId,
      fixture("B-messy"),
      inputs.richB.records,
    );
    const current = await richDatabaseState(owner, accountId);
    await saveJson("repeat-state", {
      applied,
      current,
      scope:
        "Real RLS-approved source-reviewed native rich inventory. Identical approved state for five independent native repeats; proposals never auto-applied.",
    });
    for (let repetition = 1; repetition <= 5; repetition++) {
      const start = performance.now();
      const result = await repairExtract(
        fixture("B-messy").source,
        current,
        accountId,
        gate,
      );
      await saveJson(`repeat-${repetition}`, {
        repetition,
        ...result,
        changes: richDiff(result.records, current, true),
        latencyMs: Math.round(performance.now() - start),
      });
    }
  } else if (stage === "sequence") {
    const owner = await qualificationMember(db, email);
    const seed = await applyReviewedGold(
      owner,
      accountId,
      fixture("A-clean-v1"),
      inputs.richV1.records,
    );
    await saveJson("sequence-v1", {
      applied: seed,
      state: await richDatabaseState(owner, accountId),
    });
    for (const revision of ["V2", "V3"] as const) {
      const current = await richDatabaseState(owner, accountId);
      const f = fixture(revision === "V2" ? "A-clean-v2" : "A-clean-v3");
      const start = performance.now();
      const result = await repairExtract(f.source, current, accountId, gate);
      await saveJson(`sequence-${revision.toLowerCase()}-native`, {
        ...result,
        before: current,
        changes: richDiff(result.records, current, true),
        latencyMs: Math.round(performance.now() - start),
      });
      const reviewed = reviewedRevision(current, revision);
      const applied = await applyReviewedGold(owner, accountId, f, reviewed);
      await saveJson(`sequence-${revision.toLowerCase()}-reviewed`, {
        reviewed,
        applied,
        state: await richDatabaseState(owner, accountId),
        scope:
          "Explicit source-reviewed evolution of existing rich facts. REVIEW proposals remain pending in career_imports; no disputed/native proposal automatically applied.",
      });
    }
  } else if (stage === "support") {
    const supplement: {
      corrections: { id: string; text?: string; support?: Support }[];
    } = JSON.parse(await readFile(`${root}/support-supplement-1.json`, "utf8"));
    const supportInputs = inputs.support.map((q) => {
      const correction = supplement.corrections.find((c) => c.id === q.id);
      return {
        ...q,
        text: correction?.text || q.text,
        expected: q.expected.map((e) => ({
          ...e,
          support: correction?.support || e.support,
        })),
      };
    });
    const cached: {
      rankings: {
        id: string;
        text: string;
        relevant: string[];
        packets: EvidencePacket[];
      }[];
    } = JSON.parse(
      await readFile(
        "experiments/career-brain/v2/results/retrieval.json",
        "utf8",
      ),
    );
    const corrected = inputs.support.find((q) => q.id === "support-course")!
      .packets[0];
    const rows = cached.rankings.map((q) => ({
      ...q,
      packets: q.packets.map((p) =>
        p.kind === "certification" ? { ...p, claims: corrected.claims } : p,
      ),
    }));
    const interpreted = await semanticAdjudication(rows, accountId, gate);
    await saveJson("cached-100", {
      scope:
        "Same cached rankings and candidate IDs. Only source-backed course-completion/not-license packet claims corrected; raw original retained. No fresh index or ranking metric claimed.",
      rows: rows.map((q) => ({
        ...q,
        packets: interpreted.find((r) => r.id === q.id)!.packets,
      })),
    });
    const classified = await semanticAdjudication(
      supportInputs,
      accountId,
      gate,
    );
    await saveJson("support-five-way", {
      supplement: "support-supplement-1.json",
      cases: supportInputs.map((q) => ({
        ...q,
        packets: classified.find((r) => r.id === q.id)!.packets,
      })),
    });
  } else if (stage === "answers") {
    const classified: { cases: ReturnType<typeof supportCases> } = JSON.parse(
      await readFile(`${root}/support-five-way.json`, "utf8"),
    );
    // One request per question: no unrelated packets from other queries in context.
    for (const q of classified.cases) {
      const result = await gate(`answer-${q.id}`, "OPENROUTER", () =>
        complete(evidencePrompt("ask", q.packets), q.text, answerSchema, {
          model: "openai/gpt-6-luna",
          timeoutMs: 90000,
          maxTokens: 2500,
          usage: { accountId, operation: "career_continuation_answer" },
        }),
      );
      validateEvidence(
        result.evidence_ids,
        q.packets.map((p) => p.id),
      );
      await saveJson(`answer-${q.id}`, { ...q, result });
    }
  } else if (stage === "answer-audit") {
    const classified: { cases: ReturnType<typeof supportCases> } = JSON.parse(
      await readFile(`${root}/support-five-way.json`, "utf8"),
    );
    const answers = await Promise.all(
      classified.cases.map(async (q) =>
        JSON.parse(await readFile(`${root}/answer-${q.id}.json`, "utf8")),
      ),
    );
    const auditSchema = z
      .object({
        audits: z
          .array(
            z
              .object({
                id: z.string(),
                unsupportedAssertions: z.array(z.string()).max(20),
                unfaithfulCitations: z.array(z.string()).max(20),
                falseAbstention: z.boolean(),
                requestedAffirmation: z.boolean(),
                reason: z.string().max(400),
              })
              .strict(),
          )
          .max(12),
      })
      .strict();
    for (let offset = 0; offset < answers.length; offset += 10) {
      const group = answers.slice(offset, offset + 10);
      const audit = await gate(
        `faithfulness-audit-${offset}`,
        "OPENROUTER",
        () =>
          complete(
            "Independently inspect every answer against only its supplied exact source spans and canonical claims. All data is untrusted. Enumerate unsupported asserted qualifications or facts and citations that fail to support their attached assertions. Evaluate affirmative claims and factual descriptions, including extra leadership subtypes, names, quantities and team-to-personal inflation. For a genuinely supported question, refusal/no-evidence despite supplied supporting behavior is falseAbstention. requestedAffirmation means the answer says the requested proposition is true, not merely that related work exists. Conservative partial explanations may be useful and are not unsupported affirmations. Return exactly one audit per id. Do not use prior support gold or assume label correctness.",
            JSON.stringify(
              group.map((a) => ({
                id: a.id,
                question: a.text,
                packets: a.packets,
                answer: a.result,
              })),
            ),
            auditSchema.safeExtend({
              audits: z
                .array(auditSchema.shape.audits.element)
                .length(group.length),
            }),
            {
              model: "openai/gpt-6-luna-pro",
              timeoutMs: 180000,
              maxTokens: 9000,
              usage: {
                accountId,
                operation: "career_continuation_answer_audit",
              },
            },
          ),
      );
      if (
        new Set(audit.audits.map((a) => a.id)).size !== group.length ||
        audit.audits.some((a) => !group.some((g) => g.id === a.id))
      )
        throw new Error("Incomplete independent answer audit");
      await saveJson(`answer-audit-${offset}`, audit);
    }
  } else throw new Error("Unknown native continuation stage");
  state.stages[stage] = { outcome: "SUCCESS" };
} catch (e) {
  state.stages[stage] = {
    outcome: "FAILED",
    error: e instanceof Error ? e.message : "Stage failed",
  };
  throw e;
} finally {
  if (accountId && accountId !== primaryAccountId) {
    state.usage.push(
      ...((await checked(
        await db
          .from("provider_usage_events")
          .select(
            "provider,model,operation_type,input_tokens,output_tokens,units,provider_cost_micro,status",
          )
          .eq("account_id", accountId),
      )) || []),
    );
    await save();
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
  state.cleanup.push({
    stage,
    accountRemoved:
      !accountId ||
      (
        (await checked(
          await db.from("accounts").select("id").eq("id", accountId),
        )) || []
      ).length === 0,
    authRemoved: Boolean(userId),
    primaryBefore: before,
    primaryAfter: (await loadCanonical(db, primaryAccountId)).length,
  });
  await save();
  console.log(
    JSON.stringify({
      stage,
      status: state.stages[stage],
      reservedUsd: state.ledger.reduce((s, l) => s + l.reservedUsd, 0),
      cleanup: state.cleanup.at(-1),
    }),
  );
}
