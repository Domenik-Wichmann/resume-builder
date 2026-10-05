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
import { qualificationMember } from "../database-state";
import { complete } from "../provider";
import { reviewedRevision } from "../continuation/sequence";
import { fixture } from "../continuation/fixtures";
import type { Gate } from "../../variants";
import { packets } from "../packets";
import { reconcile } from "../evidence";
import { actor, frozenInputs, root, sourceClaim } from "./fixtures";
import {
  compact,
  selectClaims,
  detectConflicts,
  applyConflicts,
  hydrateClaims,
  type StateRecord,
  type StatePacket,
  type AdmissionInput,
} from "./claims";
import {
  compose,
  verify,
  fallback,
  compileVerified,
  type BulletInput,
} from "./bullets";
import { repairedExtract, stateDiff } from "./equivalence";
import { checked, readState, applyState, provenance } from "./database";

const stage =
  process.argv.find((a) => a.startsWith("--stage="))?.slice(8) || "freeze";
await mkdir(root, { recursive: true });
const saveJson = (name: string, value: unknown) =>
  writeFile(
    `${root}/${stage.startsWith("sequence-repair-") && name.startsWith("sequence-") ? stage + name.slice("sequence".length) : name}.json`,
    JSON.stringify(value, null, 2) + "\n",
  );
const hash = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
async function historical() {
  const files: string[] = [];
  const walk = async (dir: string) => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${item.name}`;
      if (item.isDirectory()) await walk(p);
      else files.push(p);
    }
  };
  await walk("experiments/career-brain/v2/results");
  await walk("experiments/career-brain/v2/continuation/results");
  files.push("experiments/career-brain/v2/benchmark.json");
  return Object.fromEntries(
    await Promise.all(
      files.sort().map(async (p) => [p, hash(await readFile(p))]),
    ),
  );
}
const budget = { maxUsd: 5, inferenceCalls: 70, noAutomaticRetries: true };
if (stage === "freeze") {
  try {
    await readFile(`${root}/manifest.json`);
    throw new Error("Namespace already frozen; preserve it");
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
  }
  const inputs = await frozenInputs();
  await saveJson("inputs", inputs);
  await saveJson("manifest", {
    lineage: "03650f2fc0b4ebd128f1257550f2848b4d422680",
    budget,
    historicalFiles: await historical(),
    inputHash: hash(JSON.stringify(inputs)),
    protocol:
      "Individual source-grounded claim admission; Luna composition; independent Luna Pro whole-bullet coverage audit; Sol only FAIL/REVIEW; one exact-admitted-claim fallback and recheck. Five rich approved identical imports; real reviewed sequential V1/V2/V3; cross-record availability; four targeted Q&A. Production remains unchanged unless all promotion gates pass.",
  });
  console.log(
    JSON.stringify({ frozen: true, budget, cases: inputs.cases.length }),
  );
  process.exit(0);
}
if (stage === "verify-preserved") {
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
  const current = await historical();
  const changed = Object.keys(manifest.historicalFiles).filter(
    (p) => current[p] !== manifest.historicalFiles[p],
  );
  if (changed.length)
    throw new Error(`Historical artifacts changed: ${changed.join(", ")}`);
  if (
    hash(
      JSON.stringify(JSON.parse(await readFile(`${root}/inputs.json`, "utf8"))),
    ) !== manifest.inputHash
  )
    throw new Error("Frozen input hash differs");
  console.log(
    JSON.stringify({ preserved: Object.keys(manifest.historicalFiles).length }),
  );
  process.exit(0);
}
if (!process.argv.includes("--live") || process.env.APP_MODE !== "live")
  throw new Error("Native stage requires --live and APP_MODE=live");
process.env.CAREER_QUALIFICATION_CLAIM_REPAIR = "1";
type Ledger = {
  label: string;
  reservedUsd: number;
  outcome: string;
  latencyMs: number;
  error?: string;
};
type State = {
  budget: typeof budget;
  ledger: Ledger[];
  usage: Record<string, unknown>[];
  stages: Record<string, { outcome: string; error?: string }>;
  cleanup: unknown[];
};
let state: State;
try {
  state = JSON.parse(await readFile(`${root}/ledger.json`, "utf8"));
} catch {
  state = { budget, ledger: [], usage: [], stages: {}, cleanup: [] };
}
if (state.stages[stage])
  throw new Error(
    "Stage already attempted; do not overwrite or retry native calls",
  );
const save = () => saveJson("ledger", state);
const gate: Gate = async (label, provider, call) => {
  const reserve = label.includes("gpt-6-sol")
    ? 0.35
    : label.startsWith("answer-")
      ? 0.03
      : label === "rich-extract"
        ? 0.12
        : 0.08;
  if (
    provider !== "OPENROUTER" ||
    state.ledger.length >= budget.inferenceCalls ||
    state.ledger.reduce((s, l) => s + l.reservedUsd, 0) + reserve >
      budget.maxUsd + 1e-8
  )
    throw new Error("Bounded claim repair budget exhausted before request");
  const item: Ledger = {
    label: `${stage}:${label}`,
    reservedUsd: reserve,
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
    item.error = e instanceof Error ? e.message : "Failure";
    throw e;
  } finally {
    item.latencyMs = Math.round(performance.now() - start);
    await save();
    console.log(JSON.stringify({ ...item, attempts: state.ledger.length }));
  }
};
const inputs: Awaited<ReturnType<typeof frozenInputs>> = JSON.parse(
  await readFile(`${root}/inputs.json`, "utf8"),
);
const db = database();
const primaryBefore = (await loadCanonical(db, primaryAccountId)).length;
let accountId: string | undefined, userId: string | undefined;
state.stages[stage] = { outcome: "RUNNING" };
await save();
try {
  const email = `claim-repair-${randomUUID()}@example.invalid`;
  const user = await checked(
    await db.auth.admin.createUser({ email, email_confirm: true }),
  );
  userId = user.user!.id;
  accountId = await checked(
    await db.rpc("bootstrap_account", { p_user: userId, p_primary: false }),
  );
  if (!accountId || accountId === primaryAccountId)
    throw new Error("Disposable tenant guard failed");
  await checked(
    await db.from("accounts").update({ kind: "DEMO" }).eq("id", accountId),
  );
  if (stage === "resume") {
    const decisions = await selectClaims(inputs.cases, accountId, gate);
    await saveJson("claim-selection", { inputs: inputs.cases, decisions });
    const selected = inputs.cases.map((q) => compact(q, decisions));
    const generated = await compose(selected, accountId, gate);
    await saveJson("generated", generated);
    const generatedVerdicts = await verify(generated, accountId, gate);
    await saveJson("generated-verdicts", generatedVerdicts);
    // Independent canary gold supplies only supported first-clause claims. Neither
    // model sees expected labels. Historical long paragraph is retained verbatim.
    const canaries: BulletInput[] = inputs.cases.flatMap((q) => {
      const c = compact(
        q,
        q.packet.claims.map((_, i) => ({
          ref: `${q.id}:${i}`,
          label: q.expectedDirect.includes(i)
            ? "DIRECT_SUPPORT"
            : "RELATED_ONLY",
          reason: "Frozen independent source review",
        })),
      );
      return [
        { ...c, id: `${q.id}-safe`, bullet: q.goodBullet },
        ...(q.badBullet
          ? [{ ...c, id: `${q.id}-unsafe`, bullet: q.badBullet }]
          : []),
      ];
    });
    const pro = await verify(canaries, accountId, gate);
    await saveJson("whole-bullet-pro", { inputs: canaries, decisions: pro });
    const escalate = [
      ...canaries.filter(
        (c) => pro.find((d) => d.id === c.id)?.verdict !== "PASS",
      ),
      ...generated.filter(
        (c) => generatedVerdicts.find((d) => d.id === c.id)?.verdict !== "PASS",
      ),
    ];
    const sol = await verify(escalate, accountId, gate, "openai/gpt-6-sol");
    await saveJson("whole-bullet-targeted-sol", {
      inputs: escalate,
      decisions: sol,
      policy:
        "Only Pro FAIL/REVIEW; Sol cannot authorize assertion excluded at claim admission.",
    });
    const needsFallback = generated.filter(
      (g) => generatedVerdicts.find((d) => d.id === g.id)?.verdict !== "PASS",
    );
    const fallbacks = needsFallback.map(fallback);
    const fallbackVerdicts = await verify(fallbacks, accountId, gate);
    await saveJson("fallback", {
      inputs: fallbacks,
      decisions: fallbackVerdicts,
    });
    const compiled = inputs.cases.map((q) => {
      const g = generated.find((g) => g.id === q.id);
      if (!g) return { id: q.id, omitted: true };
      const retry = fallbacks.find((f) => f.id === q.id);
      const chosen = retry || g;
      const verdict = (retry ? fallbackVerdicts : generatedVerdicts).find(
        (d) => d.id === q.id,
      )!;
      return {
        id: q.id,
        selected: selected.find((s) => s.id === q.id),
        bullet: chosen.bullet,
        verdict,
        ...compileVerified(q, decisions, chosen, verdict),
      };
    });
    await saveJson("compiled", compiled);
  } else if (stage === "persistence-repair") {
    const owner = await qualificationMember(db, email);
    const seed = reconcile(inputs.richV1.records, []).records.map((r) => ({
      ...r,
      claims: r.claims.map((c) => ({
        ...c,
        availability: "CONFIRMED" as const,
      })),
    }));
    const v1 = await applyState(
      owner,
      accountId,
      fixture("A-clean-v1").source,
      seed,
    );
    await saveJson("persistence-v1", {
      ...v1,
      provenance: await provenance(owner, accountId, v1.state),
    });
    for (const revision of ["V2", "V3"] as const) {
      const current = await readState(owner, accountId);
      const f = fixture(revision === "V2" ? "A-clean-v2" : "A-clean-v3");
      let reviewed = reviewedRevision(current, revision).map((r) => ({
        ...r,
        claims: r.claims.map((c) => ({
          ...c,
          availability:
            (c as StateRecord["claims"][number]).availability ||
            ("CONFIRMED" as const),
        })),
      }));
      const cert = reviewed.find((r) => r.kind === "certification")!;
      if (revision === "V2")
        cert.claims = current
          .find((r) => r.kind === "certification")!
          .claims.map((c) => ({ ...c, availability: "PENDING_REVIEW" }));
      else
        cert.claims = cert.claims.map((c) => ({
          ...c,
          availability: "CONFIRMED",
        }));
      const conflicts = JSON.parse(
        await readFile(
          `${root}/sequence-repair-1-${revision.toLowerCase()}-conflicts.json`,
          "utf8",
        ),
      );
      reviewed = applyConflicts(
        reviewed.map((r) =>
          hydrateClaims(
            {
              ...r,
              id:
                current.find((c) => c.kind === r.kind && c.key === r.key)?.id ||
                "",
              hash: "",
              updated_at: "",
              published: false,
              archived: false,
            },
            "CONFIRMED",
          ),
        ),
        conflicts,
        f.source,
      );
      if (revision === "V3")
        for (const r of reviewed.filter(
          (r) =>
            r.kind === "experience" ||
            (r.kind === "achievement" && /training/i.test(r.title)),
        ))
          r.claims.push(
            sourceClaim(
              "Trained dispatch coworkers through workshops and wrote a plain-language handbook",
              "For Dispatch Loom I personally trained 12 dispatch coworkers in two workshops and wrote a plain-language handbook.",
              f.source,
            ),
          );
      const applied = await applyState(owner, accountId, f.source, reviewed);
      await saveJson(`persistence-${revision.toLowerCase()}`, {
        ...applied,
        provenance: await provenance(owner, accountId, applied.state),
        scope:
          "Zero-provider replay of preserved reviewed revisions and frozen conflict refs; corrected atomic metadata overlay preserves primary provenance. Owner expressly reviewed quantity-free underlying action, not the disputed count.",
      });
    }
  } else if (stage === "historical-compact") {
    const q = inputs.cases.find((q) => q.id === "historical-warning")!;
    const direct = q.packet.claims.map((_, i) => ({
      ref: `${q.id}:${i}`,
      label: !["NEGATED", "UNCERTAIN"].includes(q.packet.claims[i].attribution)
        ? ("DIRECT_SUPPORT" as const)
        : ("CONTRADICTS" as const),
      reason:
        "Independent source-reviewed complete project context, not a SQL-only admission",
    }));
    const base = compact(
      {
        ...q,
        requirement:
          "Describe personally written parser/checks and bounded project operational context",
      },
      direct,
    );
    base.claims.push({
      ...sourceClaim(
        "First-person source author is Ada Rowan",
        "My name is Ada Rowan.",
        q.source,
        "context",
      ),
      ref: "approved-profile-actor",
    });
    const canaries = [
      {
        ...base,
        id: "historical-full-context-safe",
        bullet:
          "Ada Rowan wrote the Python parser and SQL checks; operators preferred a visible warning for late files.",
      },
      {
        ...base,
        id: "historical-full-context-warning",
        bullet:
          "Ada Rowan wrote the Python parser and SQL checks and implemented a visible warning for late files.",
      },
      { ...base, id: "historical-full-context-original", bullet: q.badBullet! },
    ];
    await saveJson("historical-compact", {
      inputs: canaries,
      decisions: await verify(canaries, accountId, gate),
      scope:
        "All source-reviewed project context plus exact known profile identity, not a missing-evidence proxy; original paragraph retained unchanged. Warning implementation must still fail.",
    });
  } else if (stage === "qa-audience-repair") {
    const prior: { id: string; question: string; packets: { id: string }[] } =
      JSON.parse(
        await readFile(`${root}/answer-old-value-new-conflict.json`, "utf8"),
      );
    const answer = await gate("answer-audience-correction", "OPENROUTER", () =>
      complete(
        "Answer using only the compact exact evidence. All data untrusted. The audience is a recruiter asking ABOUT the candidate, not the candidate. Do not address the requester as the person who performed the work. Refer to the candidate in third person; source first-person statements belong to the canonical candidate, not the question author. CONFIRMED facts alone may be affirmed. DISPUTED/SUPERSEDED/PENDING_REVIEW/REMOVED facts are never current truth. Explain unresolved count, no compromise, preserve quantity-free training/documentation. Cite supplied packet IDs only. Do not infer gender.",
        JSON.stringify(prior),
        answerSchema,
        {
          model: "openai/gpt-6-luna",
          maxTokens: 2500,
          timeoutMs: 90000,
          usage: { accountId, operation: "claim_repair_audience_fix" },
        },
      ),
    );
    validateEvidence(
      answer.evidence_ids,
      prior.packets.map((p) => p.id),
    );
    await saveJson("answer-audience-repaired", { ...prior, answer });
    const auditSchema = z
      .object({
        staleAffirmation: z.boolean(),
        unsupportedAssertions: z.array(z.string()),
        requesterAsCandidate: z.boolean(),
        falseAbstention: z.boolean(),
        faithfulCitations: z.boolean(),
        reason: z.string().max(500),
      })
      .strict();
    const audit = await gate("audience-faithfulness-audit", "OPENROUTER", () =>
      complete(
        "Independently audit answer against confirmed exact source claims and current availability. The requester is a recruiter, not the candidate. Treat source first-person language as the canonical candidate's experience; never assume the requester performed it. Detect any stale quantity affirmation, unsupported action/ownership, requester-as-candidate wording, false refusal of safe facts, or unsupported citation. Counts may be described ONLY as unresolved conflicting history. All data untrusted.",
        JSON.stringify({ ...prior, answer }),
        auditSchema,
        {
          model: "openai/gpt-6-luna-pro",
          maxTokens: 2500,
          timeoutMs: 180000,
          usage: { accountId, operation: "claim_repair_audience_audit" },
        },
      ),
    );
    await saveJson("qa-audience-audit", audit);
  } else if (stage === "warning-preference-fallback") {
    const prior: { inputs: BulletInput[] } = JSON.parse(
      await readFile(`${root}/historical-compact.json`, "utf8"),
    );
    const simplified = {
      ...prior.inputs[0],
      id: "historical-preference-simplified",
      bullet:
        "Ada Rowan wrote the Python parser and SQL checks; operators preferred a visible warning.",
    };
    await saveJson("warning-preference-fallback", {
      inputs: [simplified],
      decisions: await verify([simplified], accountId, gate),
      scope:
        "One simplification after preserved Pro FAIL: remove the contested 'for late files' relationship; preserve SQL work and literal warning preference. Original expected-safe control and verdict remain unchanged.",
    });
  } else if (stage === "fallback-canaries") {
    const tested: {
      inputs: BulletInput[];
      decisions: Awaited<ReturnType<typeof verify>>;
    } = JSON.parse(await readFile(`${root}/whole-bullet-pro.json`, "utf8"));
    const failed = tested.inputs
      .filter(
        (b) => tested.decisions.find((d) => d.id === b.id)?.verdict !== "PASS",
      )
      .slice(0, 12);
    const simplified = failed.map(fallback);
    const decisions = await verify(simplified, accountId, gate);
    await saveJson("fallback-canaries", {
      inputs: simplified,
      decisions,
      policy:
        "One exact-admitted-proposition simplification after the preserved original FAIL/REVIEW; no second retry.",
    });
  } else if (stage === "repeat") {
    const owner = await qualificationMember(db, email);
    const seed = reconcile(inputs.richB.records, []).records.map((r) => ({
      ...r,
      claims: r.claims.map((c) => ({
        ...c,
        availability: "CONFIRMED" as const,
      })),
    }));
    await applyState(owner, accountId, fixture("B-messy").source, seed);
    const current = await readState(owner, accountId);
    await saveJson("repeat-state", {
      current,
      provenance: await provenance(owner, accountId, current),
    });
    for (let i = 1; i <= 5; i++) {
      const start = performance.now();
      const result = await repairedExtract(
        fixture("B-messy").source,
        current,
        actor,
        accountId,
        gate,
      );
      await saveJson(`repeat-${i}`, {
        ...result,
        changes: stateDiff(result.records, current, actor),
        latencyMs: Math.round(performance.now() - start),
      });
    }
  } else if (stage === "sequence" || stage === "sequence-repair-1") {
    const owner = await qualificationMember(db, email);
    const seed = reconcile(inputs.richV1.records, []).records.map((r) => ({
      ...r,
      claims: r.claims.map((c) => ({
        ...c,
        availability: "CONFIRMED" as const,
      })),
    }));
    await saveJson(
      "sequence-v1",
      await applyState(owner, accountId, fixture("A-clean-v1").source, seed),
    );
    for (const revision of ["V2", "V3"] as const) {
      const current = await readState(owner, accountId);
      const f = fixture(revision === "V2" ? "A-clean-v2" : "A-clean-v3");
      const start = performance.now();
      const conflicts = await detectConflicts(
        current,
        f.source,
        accountId,
        gate,
      );
      await saveJson(`sequence-${revision.toLowerCase()}-conflicts`, conflicts);
      const masked = applyConflicts(current, conflicts, f.source);
      const extracted = await repairedExtract(
        f.source,
        masked,
        actor,
        accountId,
        gate,
      );
      const proposalConflicts = conflicts.conflicts.length
        ? await detectConflicts(
            extracted.records.map((r) =>
              hydrateClaims(
                {
                  ...r,
                  id: "",
                  hash: "",
                  updated_at: "",
                  published: false,
                  archived: false,
                },
                "PENDING_REVIEW",
              ),
            ),
            f.source,
            accountId,
            gate,
          )
        : { conflicts: [] };
      const result = {
        ...extracted,
        records: applyConflicts(
          extracted.records.map((r) =>
            hydrateClaims(
              {
                ...r,
                id: "",
                hash: "",
                updated_at: "",
                published: false,
                archived: false,
              },
              "PENDING_REVIEW",
            ),
          ),
          proposalConflicts,
          f.source,
        ),
      };
      await saveJson(`sequence-${revision.toLowerCase()}-native`, {
        ...result,
        proposalConflicts,
        before: current,
        conflictMasked: masked,
        changes: stateDiff(result.records, masked, actor),
        availabilityChanges: stateDiff(masked, current, actor),
        latencyMs: Math.round(performance.now() - start),
      });
      let reviewed = reviewedRevision(current, revision).map((r) => ({
        ...r,
        claims: r.claims.map((c) => ({
          ...c,
          availability:
            (c as StateRecord["claims"][number]).availability ||
            ("CONFIRMED" as const),
        })),
      }));
      const cert = reviewed.find((r) => r.kind === "certification")!;
      if (revision === "V2")
        cert.claims = current
          .find((r) => r.kind === "certification")!
          .claims.map((c) => ({ ...c, availability: "PENDING_REVIEW" }));
      else
        cert.claims = cert.claims.map((c) => ({
          ...c,
          availability: "CONFIRMED",
        }));
      reviewed = applyConflicts(
        reviewed.map((r) =>
          hydrateClaims(
            {
              ...r,
              id:
                current.find((c) => c.kind === r.kind && c.key === r.key)?.id ||
                "",
              hash: "",
              updated_at: "",
              published: false,
              archived: false,
            },
            "CONFIRMED",
          ),
        ),
        conflicts,
        f.source,
      );
      const applied = await applyState(owner, accountId, f.source, reviewed);
      await saveJson(`sequence-${revision.toLowerCase()}-reviewed`, {
        ...applied,
        provenance: await provenance(owner, accountId, applied.state),
        reviewedScope:
          "Actual verified member JWT / optimistic RPC. Owner explicitly reviewed safe underlying propositions; disputed historical claims retained with DISPUTED availability. No auto-publication.",
      });
    }
  } else if (stage === "qa") {
    const sequential: { state: StateRecord[] } = JSON.parse(
      await readFile(`${root}/persistence-v3.json`, "utf8"),
    );
    const relevant = sequential.state.filter(
      (r) =>
        r.kind === "experience" ||
        (r.kind === "achievement" && /training/i.test(r.title)),
    );
    const packetList = packets(
      relevant.map((r) => ({ ...r, published: true })),
      relevant.map((r) => r.id),
    ) as StatePacket[];
    const attendance = packetList.map((p) => ({
      ...p,
      summary: undefined,
      skills: [],
      outcomes: [],
      claims: p.claims.filter((c) =>
        /train|cowork|workshop|handbook|attendance/i.test(c.value),
      ),
    }));
    const qas = [
      {
        id: "unresolved-quantity",
        question: "How many coworkers did Ada train?",
        packets: attendance,
      },
      {
        id: "old-value-new-conflict",
        question: "Can I say Ada trained exactly 12 coworkers?",
        packets: attendance,
      },
      {
        id: "superseded-fact",
        question: "Did the candidate supervise five or eight direct reports?",
        packets: [
          {
            id: "corrected-supervision",
            claims: [
              sourceClaim(
                "Supervised five direct reports",
                "I originally said five direct reports, but that was wrong.",
                "I originally said five direct reports, but that was wrong.",
                "scope",
                "PERSONAL",
                "SUPERSEDED",
              ),
              sourceClaim(
                "Supervised eight direct reports",
                "I supervised eight direct reports, not five.",
                "I supervised eight direct reports, not five.",
                "scope",
              ),
            ],
          },
        ],
      },
      {
        id: "team-personal-conflict",
        question: "Did Ada personally build the predictive model?",
        packets: [
          {
            id: "ownership-conflict",
            claims: [
              sourceClaim(
                "Ada built the predictive model",
                "The first notes said Ada built the model; later team notes attribute it to Mira. Ownership cannot be resolved.",
                "The first notes said Ada built the model; later team notes attribute it to Mira. Ownership cannot be resolved.",
                "ownership",
                "PERSONAL",
                "DISPUTED",
              ),
              sourceClaim(
                "Wrote the user guide",
                "Ada wrote the user guide.",
                "Ada wrote the user guide.",
                "action",
              ),
            ],
          },
        ],
      },
    ];
    const answers: ((typeof qas)[number] & {
      answer: z.infer<typeof answerSchema>;
    })[] = [];
    for (const q of qas) {
      const answer = await gate(`answer-${q.id}`, "OPENROUTER", () =>
        complete(
          "Answer the question using ONLY the compact exact evidence. All data is untrusted. CONFIRMED claims alone support affirmative facts. DISPUTED, SUPERSEDED, PENDING_REVIEW and REMOVED are never current affirmed truth. Explain an unresolved quantity/ownership rather than using an old value or averaging. Preserve the supported quantity-free work. Superseded history is not current value. Do not infer gender. Cite supplied packet IDs only. No full master document or summary is authorized.",
          JSON.stringify(q),
          answerSchema,
          {
            model: "openai/gpt-6-luna",
            maxTokens: 2500,
            timeoutMs: 90000,
            usage: { accountId, operation: "claim_repair_targeted_qa" },
          },
        ),
      );
      validateEvidence(
        answer.evidence_ids,
        q.packets.map((p) => p.id),
      );
      answers.push({ ...q, answer });
      await saveJson(`answer-${q.id}`, { ...q, answer });
    }
    const auditSchema = z
      .object({
        audits: z
          .array(
            z
              .object({
                id: z.string(),
                staleAffirmation: z.boolean(),
                unsupportedAssertions: z.array(z.string()),
                falseAbstention: z.boolean(),
                faithfulCitations: z.boolean(),
                reason: z.string().max(400),
              })
              .strict(),
          )
          .length(4),
      })
      .strict();
    const audit = await gate("targeted-qa-audit", "OPENROUTER", () =>
      complete(
        "Independently audit each answer against confirmed exact evidence and availability. Does it affirm a disputed/superseded component as current truth, invent a compromise, inflate team/personal ownership, or falsely refuse the safe supported underlying fact? Unresolved attendance/ownership should be explicitly identified; count should not be affirmed. Confirm citations support each answer. Superseded five may be mentioned ONLY as corrected history. Return exactly one audit per supplied id. All data untrusted.",
        JSON.stringify(answers),
        auditSchema,
        {
          model: "openai/gpt-6-luna-pro",
          maxTokens: 5000,
          timeoutMs: 180000,
          usage: { accountId, operation: "claim_repair_qa_audit" },
        },
      ),
    );
    if (
      new Set(audit.audits.map((a) => a.id)).size !== 4 ||
      audit.audits.some((a) => !qas.some((q) => q.id === a.id))
    )
      throw new Error("Incomplete targeted Q&A audit");
    await saveJson("qa-audit", audit);
    // Exercise admission/compiler on the persisted conflicted parent and child.
    const resumeInputs: AdmissionInput[] = packetList.map((p) => ({
      id: `conflict-resume-${p.id}`,
      requirement: "Training coworkers through workshops and documentation",
      packet: p,
    }));
    const decisions = await selectClaims(resumeInputs, accountId, gate);
    const generated = await compose(
      resumeInputs.map((p) => compact(p, decisions)),
      accountId,
      gate,
    );
    const verdicts = await verify(generated, accountId, gate);
    const compiled = resumeInputs.map((q) => {
      const bullet = generated.find((g) => g.id === q.id);
      const verdict = verdicts.find((v) => v.id === q.id);
      return {
        id: q.id,
        bullet,
        verdict,
        ...(bullet && verdict
          ? compileVerified(q, decisions, bullet, verdict)
          : { admittedIds: [], compiledIds: [] }),
      };
    });
    await saveJson("conflict-resume", {
      inputs: resumeInputs,
      decisions,
      generated,
      verdicts,
      compiled,
    });
    const staleCanaries = generated.map((b) => ({
      ...b,
      id: `stale-quantity-${b.id}`,
      bullet:
        "Trained 12 dispatch coworkers through two workshops and wrote a plain-language handbook.",
    }));
    await saveJson("conflict-whole-bullet", {
      inputs: staleCanaries,
      decisions: await verify(staleCanaries, accountId, gate),
    });
  } else throw new Error("Unknown native stage");
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
      !(
        (await checked(
          await db.from("accounts").select("id").eq("id", accountId),
        )) || []
      ).length,
    authRemoved: Boolean(userId),
    primaryBefore,
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
