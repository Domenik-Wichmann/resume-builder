import { readFile, writeFile } from "node:fs/promises";
import { actor, root, fixture } from "./fixtures";
import { actorValue, type StateRecord } from "../claim-repair/claims";
import type { RichCandidate } from "../evidence";
import type { Change } from "../../../../src/lib/ingestion/model";
import type { Component, OmissionDecision } from "./reconcile";
const read = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(`${root}/${name}.json`, "utf8"));
type Run = {
  records: RichCandidate[];
  components: Component[];
  changes: Change[];
  decisions: {
    identity: { outcome: string; id: string | null }[];
    omissions: OmissionDecision[];
    equivalence: { key: string; verdict: string; reason: string }[];
  };
  latencyMs: number;
};
const claimKey = (c: RichCandidate["claims"][number]) =>
  `${c.attribute}:${c.attribution}:${actorValue(c.value, actor)}`;
function continuity(before: StateRecord[], after: RichCandidate[]) {
  return before
    .filter((r) => !r.archived)
    .flatMap((old) => {
      const r = after.find((r) => r.kind === old.kind && r.key === old.key);
      if (!r)
        return [
          { record: `${old.kind}:${old.key}`, component: "entire record" },
        ];
      const lost = old.claims
        .filter((c) => !r.claims.some((d) => claimKey(c) === claimKey(d)))
        .map((c) => ({
          record: `${old.kind}:${old.key}`,
          component: `claim:${c.value}`,
        }));
      for (const field of ["skill_keys", "achievement_keys"] as const)
        for (const value of old[field].filter((v) => !r[field].includes(v)))
          lost.push({
            record: `${old.kind}:${old.key}`,
            component: `${field}:${value}`,
          });
      if (old.category_key && old.category_key !== r.category_key)
        lost.push({
          record: `${old.kind}:${old.key}`,
          component: `category:${old.category_key}`,
        });
      for (const field of ["start_date", "end_date", "organization"] as const)
        if (old[field] && old[field] !== r[field])
          lost.push({
            record: `${old.kind}:${old.key}`,
            component: `${field}:${old[field]}`,
          });
      return lost;
    });
}
const baseline = await read<{ current: StateRecord[] }>("repeat-state");
const repeats = await Promise.all(
  [1, 2, 3, 4, 5].map((i) => read<Run>(`repeat-${i}`)),
);
const byRepeat = repeats.map((r, i) => ({
  repeat: i + 1,
  counts: Object.fromEntries(
    ["UNCHANGED", "UPDATED", "REVIEW", "ADDED", "REMOVED"].map((s) => [
      s,
      r.changes.filter((c) => c.status === s).length,
    ]),
  ),
  omittedComponents: r.components.length,
  preservedComponents: r.decisions.omissions.filter(
    (d) => d.action === "PRESERVED_SOURCE_STILL_SUPPORTS",
  ).length,
  losses: continuity(baseline.current, r.records),
  latencyMs: r.latencyMs,
}));
const versions = await Promise.all(
  ["v2", "v3"].map((r) =>
    read<Run & { before: StateRecord[]; conflictMasked: StateRecord[] }>(
      `sequence-${r}-native`,
    ),
  ),
);
const reviewed = await Promise.all(
  ["v1", "v2", "v3"].map((r) =>
    read<{
      state: StateRecord[];
      after: number;
      preserved: number;
      provenance?: {
        total: number;
        valid: number;
        primaryTotal: number;
        primaryValid: number;
      };
      sourceId: string;
    }>(`sequence-${r}${r === "v1" ? "" : "-reviewed"}`),
  ),
);
const ledger = await read<{
  calls: {
    label: string;
    latencyMs: number;
    outcome: string;
    reservedUsd: number;
  }[];
  usage: {
    provider_cost_micro: number | null;
    model: string;
    status: string;
  }[];
  stages: Record<string, { outcome: string }>;
  cleanup: {
    primaryBefore: number;
    primaryAfter: number;
    accountRemoved: boolean;
    authRemoved: boolean;
  }[];
}>("ledger");
const costs = ledger.usage.reduce(
  (s, u) => s + (u.provider_cost_micro ?? 0) / 1e6,
  0,
);
const native = [...repeats, ...versions];
const spans = native.flatMap((r) =>
  r.records.flatMap((r) => r.claims.flatMap((c) => c.evidence)),
);
const sourceById = new Map<string, string>();
for (const span of baseline.current.flatMap((r) =>
  r.claims.flatMap((c) => c.evidence),
)) {
  const id = (span as typeof span & { source_id?: string }).source_id;
  if (id) sourceById.set(id, fixture("B-messy").source);
}
reviewed.forEach((r, i) =>
  sourceById.set(
    r.sourceId,
    fixture(["A-clean-v1", "A-clean-v2", "A-clean-v3"][i]).source,
  ),
);
const exactNative = native.flatMap((r) =>
  r.records.flatMap((r) => r.claims.flatMap((c) => c.evidence)),
).length;
const exactNativeValid = native
  .flatMap((r, i) =>
    r.records.flatMap((r) =>
      r.claims.flatMap((c) =>
        c.evidence.map((s) => {
          const id = (s as typeof s & { source_id?: string }).source_id;
          const source = id
            ? sourceById.get(id)
            : fixture(i < 5 ? "B-messy" : i === 5 ? "A-clean-v2" : "A-clean-v3")
                .source;
          return source?.slice(s.start!, s.end!) === s.quote;
        }),
      ),
    ),
  )
  .filter(Boolean).length;
const resume = await read<{
  admission: { label: string }[];
  generated: { bullet: string }[];
  audits: { verdict: string }[];
  unsafeAudits: { verdict: string }[];
  compiled: { compiledIds: string[] }[];
}>("resume-safety");
const qa = await read<{
  answers: { id: string; answer: { answer: string; evidence_ids: string[] } }[];
  audit: { decisions: { id: string; verdict: string; reason: string }[] };
}>("qa-safety");
const correctedAudit = await read<{ audit: typeof qa.audit }>(
  "qa-known-actor-audit",
);
const originalAudit = qa.audit;
qa.audit = correctedAudit.audit;
const relationships = byRepeat.flatMap((r) =>
  r.losses.filter((l) => /keys:|category:/.test(l.component)),
);
const median = [...repeats].sort((a, b) => a.latencyMs - b.latencyMs)[2]
  .latencyMs;
const summary = {
  lineage: "3c355444219edc4d0f375b3aaa6a9946c13011a7",
  repeat: {
    byRepeat,
    existingOpportunities: 75,
    unchanged: byRepeat.reduce((s, r) => s + r.counts.UNCHANGED, 0),
    reviews: byRepeat.reduce((s, r) => s + r.counts.REVIEW, 0),
    updated: byRepeat.reduce((s, r) => s + r.counts.UPDATED, 0),
    omittedComponents: byRepeat.reduce((s, r) => s + r.omittedComponents, 0),
    preservedComponents: byRepeat.reduce(
      (s, r) => s + r.preservedComponents,
      0,
    ),
    unsupportedComponentLosses: byRepeat.flatMap((r) => r.losses),
    relationshipLosses: relationships.length,
    identityMatched: native
      .slice(0, 5)
      .flatMap((r) => r.decisions.identity)
      .filter((d) => d.outcome === "MATCH_EXISTING" && d.id).length,
  },
  sequence: versions.map((r, i) => ({
    revision: i === 0 ? "V2" : "V3",
    changes: r.changes.map((c) => ({
      identity: c.identity,
      status: c.status,
      reason: c.reason,
    })),
    omissions: r.decisions.omissions,
    after: reviewed[i + 1].after,
    preserved: reviewed[i + 1].preserved,
    provenance: reviewed[i + 1].provenance,
  })),
  evidence: {
    exactNative,
    exactNativeValid,
    nativeSpanCount: spans.length,
    spansWithOffsets: spans.filter(
      (s) =>
        s.start !== null &&
        s.end !== null &&
        s.end - s.start === s.quote.length,
    ).length,
    multiSpanClaims: native
      .flatMap((r) => r.records.flatMap((r) => r.claims))
      .filter((c) => c.evidence.length > 1).length,
  },
  safety: {
    originalQaAuditPasses: originalAudit.decisions.filter(
      (d) => d.verdict === "PASS",
    ).length,
    resumeGenerated: resume.generated.length,
    resumeVerified: resume.audits.filter((a) => a.verdict === "PASS").length,
    unsafeBulletApprovals: resume.unsafeAudits.filter(
      (a) => a.verdict === "PASS",
    ).length,
    unsafeBulletTests: resume.unsafeAudits.length,
    qaTests: qa.answers.length,
    qaAuditPasses: qa.audit.decisions.filter((d) => d.verdict === "PASS")
      .length,
  },
  accounting: {
    newKnownUsd: costs,
    newUnknownEvents: ledger.usage.filter((u) => u.provider_cost_micro === null)
      .length,
    calls: ledger.calls.length,
    usageEvents: ledger.usage.length,
    reservedUsd: ledger.calls.reduce((s, c) => s + c.reservedUsd, 0),
    byModel: [...new Set(ledger.usage.map((u) => u.model))].map((model) => ({
      model,
      calls: ledger.usage.filter((u) => u.model === model).length,
      knownUsd: ledger.usage
        .filter((u) => u.model === model)
        .reduce((s, u) => s + (u.provider_cost_micro ?? 0) / 1e6, 0),
    })),
    medianRepeatMs: median,
    sequenceMs: versions.map((r) => r.latencyMs),
  },
  cleanup: ledger.cleanup,
  automatedGates: {
    zeroSameSourceComponentLosses: byRepeat.every((r) => !r.losses.length),
    identity75:
      native
        .slice(0, 5)
        .flatMap((r) => r.decisions.identity)
        .filter((d) => d.outcome === "MATCH_EXISTING" && d.id).length === 75,
    zeroUnsafeBulletApprovals: resume.unsafeAudits.every(
      (a) => a.verdict !== "PASS",
    ),
    allTargetedAnswerAuditsPass:
      qa.audit.decisions.length === qa.answers.length &&
      qa.audit.decisions.every((d) => d.verdict === "PASS"),
    cleanup: ledger.cleanup.every(
      (c) =>
        c.accountRemoved && c.authRemoved && c.primaryBefore === c.primaryAfter,
    ),
  },
  note: "Native automated counts are not adjudication accuracy. Final promotion requires separate current-source human adjudication, correction/availability checks and complete production integration verification. No old gold or accounting replaced.",
};
await writeFile(
  `${root}/summary.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    repeat: summary.repeat,
    safety: summary.safety,
    accounting: summary.accounting,
    automatedGates: summary.automatedGates,
  }),
);
