import { readFile, writeFile } from "node:fs/promises";
import { root, type AdmissionCase } from "./fixtures";
import { fixture } from "../continuation/fixtures";
import type { ClaimDecision, StateRecord } from "./claims";
import type { BulletInput, Verification } from "./bullets";
import type { RichCandidate } from "../evidence";
import type { Change } from "../../../../src/lib/ingestion/model";

const read = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(`${root}/${name}.json`, "utf8"));
type Native = {
  records: RichCandidate[];
  changes: Change[];
  decisions: {
    identity: { outcome: string; id: string | null }[];
    equivalence: { key: string; verdict: string; reason: string }[];
  };
  latencyMs: number;
};
type Matrix = { inputs: BulletInput[]; decisions: Verification[] };
type Persisted = {
  sourceId: string;
  state: StateRecord[];
  preserved: number;
  before: number;
  after: number;
  metadataOnly?: string[];
  provenance?: {
    total: number;
    valid: number;
    primaryTotal: number;
    primaryValid: number;
  };
};
const repeats = await Promise.all(
  [1, 2, 3, 4, 5].map((i) => read<Native>(`repeat-${i}`)),
);
const selection = await read<{
  inputs: AdmissionCase[];
  decisions: ClaimDecision[];
}>("claim-selection");
const pro = await read<Matrix>("whole-bullet-pro");
const historical = await read<Matrix>("historical-compact");
const sol = await read<Matrix>("whole-bullet-targeted-sol");
const fallback = await read<Matrix>("fallback-canaries");
const generated = await read<BulletInput[]>("generated");
const compiled = await read<
  {
    id: string;
    compiledIds?: string[];
    bullet?: string;
    verdict?: Verification;
  }[]
>("compiled");
const conflict = await read<{
  decisions: ClaimDecision[];
  inputs: {
    id: string;
    packet: { claims: { value: string; availability: string }[] };
  }[];
  generated: BulletInput[];
  verdicts: Verification[];
  compiled: { id: string; compiledIds: string[] }[];
}>("conflict-resume");
const conflictWhole = await read<Matrix>("conflict-whole-bullet");
const persisted = await Promise.all(
  ["v1", "v2", "v3"].map((r) => read<Persisted>(`persistence-${r}`)),
);
const nativeSequence = await Promise.all(
  ["v2", "v3"].map((r) => read<Native>(`sequence-repair-1-${r}-native`)),
);
const auditedQa = await read<{
  audits: {
    id: string;
    staleAffirmation: boolean;
    unsupportedAssertions: string[];
    falseAbstention: boolean;
    faithfulCitations: boolean;
  }[];
}>("qa-audit");
const audience = await read<{
  staleAffirmation: boolean;
  unsupportedAssertions: string[];
  requesterAsCandidate: boolean;
  falseAbstention: boolean;
  faithfulCitations: boolean;
}>("qa-audience-audit");
const ledger = await read<{
  budget: unknown;
  ledger: {
    label: string;
    outcome: string;
    reservedUsd: number;
    latencyMs: number;
  }[];
  usage: {
    model: string;
    provider_cost_micro: number | null;
    input_tokens: number;
    output_tokens: number;
    status: string;
  }[];
  stages: unknown;
  cleanup: unknown[];
}>("ledger");
const direct = selection.inputs.flatMap((q) =>
  q.expectedDirect.map((i) => `${q.id}:${i}`),
);
const unsafe = selection.inputs.slice(0, 12).map((q) => `${q.id}:1`);
const decision = (ref: string) =>
  selection.decisions.find((d) => d.ref === ref)?.label;
const med = (v: number[]) =>
  [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const matrix = (m: Matrix, isUnsafe: (id: string) => boolean) => ({
  total: m.inputs.length,
  correct: m.inputs.filter((i) =>
    isUnsafe(i.id)
      ? m.decisions.find((d) => d.id === i.id)?.verdict !== "PASS"
      : m.decisions.find((d) => d.id === i.id)?.verdict === "PASS",
  ).length,
  unsupportedPasses: m.inputs.filter(
    (i) =>
      isUnsafe(i.id) &&
      m.decisions.find((d) => d.id === i.id)?.verdict === "PASS",
  ).length,
  safeWithheld: m.inputs
    .filter(
      (i) =>
        !isUnsafe(i.id) &&
        m.decisions.find((d) => d.id === i.id)?.verdict !== "PASS",
    )
    .map((i) => i.id),
});
const sourceMap: Record<string, string> = {};
for (const r of [
  await read<Persisted>("sequence-repair-1-v1"),
  await read<Persisted>("sequence-repair-1-v2-reviewed"),
  await read<Persisted>("sequence-repair-1-v3-reviewed"),
])
  sourceMap[r.sourceId] = fixture(
    r.state.length === 15
      ? "A-clean-v1"
      : r.state.length === 16
        ? "A-clean-v2"
        : "A-clean-v3",
  ).source;
for (let i = 0; i < persisted.length; i++)
  sourceMap[persisted[i].sourceId] = fixture(
    ["A-clean-v1", "A-clean-v2", "A-clean-v3"][i],
  ).source;
const repeatState = await read<{ current: StateRecord[] }>("repeat-state");
for (const r of repeatState.current)
  for (const c of r.claims)
    for (const s of c.evidence)
      if ("source_id" in s)
        sourceMap[String(s.source_id)] = fixture("B-messy").source;
const exact = (records: RichCandidate[], current: string) => {
  const spans = records.flatMap((r) => r.claims.flatMap((c) => c.evidence));
  return {
    total: spans.length,
    valid: spans.filter(
      (s) =>
        ("source_id" in s ? sourceMap[String(s.source_id)] : current)?.slice(
          s.start!,
          s.end!,
        ) === s.quote,
    ).length,
  };
};
const older = JSON.parse(
  await readFile(
    "experiments/career-brain/v2/continuation/results/ledger.json",
    "utf8",
  ),
);
const historicalKnown =
  0.752126 +
  older.usage.reduce(
    (s: number, u: { provider_cost_micro: number | null }) =>
      s + (u.provider_cost_micro || 0),
    0,
  ) /
    1e6;
const summary = {
  admission: {
    expectedSupportedClaims: direct.length,
    supportedAdmitted: direct.filter(
      (ref) => decision(ref) === "DIRECT_SUPPORT",
    ).length,
    falseOmissionRefs: direct.filter(
      (ref) => decision(ref) !== "DIRECT_SUPPORT",
    ),
    unsupportedSiblingClaims: unsafe.length,
    unsupportedAdmitted: unsafe.filter(
      (ref) => decision(ref) === "DIRECT_SUPPORT",
    ).length,
    unavailableCanaryClaims: 2,
    unavailableCanaryAdmitted: [
      "superseded-count:1",
      "disputed-count:1",
    ].filter((ref) => decision(ref) === "DIRECT_SUPPORT").length,
  },
  bullets: {
    generated: generated.length,
    compiled: compiled.filter((c) => c.compiledIds?.length).length,
    generatedWithheld: compiled
      .filter((c) => !c.compiledIds?.length)
      .map((c) => c.id),
    pro: matrix(pro, (id) => id.endsWith("-unsafe")),
    historicalContext: matrix(
      historical,
      (id) => id !== "historical-full-context-safe",
    ),
    sol: {
      escalated: sol.inputs.length,
      passed: sol.decisions.filter((d) => d.verdict === "PASS").length,
      agreementWithPro: sol.decisions.filter(
        (d) => d.verdict === pro.decisions.find((p) => p.id === d.id)?.verdict,
      ).length,
    },
    fallback: {
      tested: fallback.inputs.length,
      passed: fallback.decisions.filter((d) => d.verdict === "PASS").length,
    },
  },
  conflict: {
    persistedUnavailableQuantityClaims: persisted[2].state
      .flatMap((r) => r.claims)
      .filter((c) => c.availability === "DISPUTED").length,
    admittedUnavailableRefs: conflict.decisions
      .filter(
        (d) =>
          d.label === "DIRECT_SUPPORT" &&
          conflict.inputs.some((q) =>
            q.packet.claims.some(
              (c, i) =>
                `${q.id}:${i}` === d.ref && c.availability !== "CONFIRMED",
            ),
          ),
      )
      .map((d) => d.ref),
    quantityFreeCompiled: conflict.compiled.filter((c) => c.compiledIds.length)
      .length,
    generated: conflict.generated.map((b) => ({ id: b.id, bullet: b.bullet })),
    staleWholeBullets: matrix(conflictWhole, () => true),
  },
  repeated: {
    baselineRecords: repeatState.current.length,
    existingMatches: repeats
      .flatMap((r) => r.decisions.identity)
      .filter((d) => d.outcome === "MATCH_EXISTING").length,
    existingOpportunities: 75,
    counts: repeats.map((r) =>
      r.changes.reduce<Record<string, number>>(
        (s, c) => ((s[c.status] = (s[c.status] || 0) + 1), s),
        {},
      ),
    ),
    totalUnchanged: repeats
      .flatMap((r) => r.changes)
      .filter((c) => c.status === "UNCHANGED").length,
    representationComparisonsResolved: repeats
      .flatMap((r) => r.decisions.equivalence)
      .filter((d) => d.verdict === "EQUIVALENT").length,
    medianLatencyMs: med(repeats.map((r) => r.latencyMs)),
    allNonUnchanged: repeats.flatMap((r, i) =>
      r.changes
        .filter((c) => c.status !== "UNCHANGED")
        .map((c) => ({
          repeat: i + 1,
          identity: c.identity,
          status: c.status,
          reason: c.reason,
          equivalence: r.decisions.equivalence.find(
            (d) => d.key === c.identity,
          ),
        })),
    ),
  },
  sequence: {
    native: nativeSequence.map((r, i) => ({
      revision: i === 0 ? "V2" : "V3",
      latencyMs: r.latencyMs,
      changes: r.changes.map((c) => ({
        identity: c.identity,
        status: c.status,
        reason: c.reason,
      })),
    })),
    reviewed: persisted.map((p, i) => ({
      revision: ["V1", "V2", "V3"][i],
      before: p.before,
      after: p.after,
      preserved: p.preserved,
      metadataOnly: p.metadataOnly,
      provenance: p.provenance,
    })),
  },
  provenance: {
    repeats: repeats.map((r) => exact(r.records, fixture("B-messy").source)),
    nativeSequence: nativeSequence.map((r, i) =>
      exact(r.records, fixture(i === 0 ? "A-clean-v2" : "A-clean-v3").source),
    ),
    reviewed: persisted.map((r) => r.provenance),
  },
  qa: {
    total: auditedQa.audits.length,
    staleAffirmations: auditedQa.audits.filter((a) => a.staleAffirmation)
      .length,
    unsupportedAnswers: auditedQa.audits.filter(
      (a) => a.unsupportedAssertions.length,
    ).length,
    falseAbstentions: auditedQa.audits.filter((a) => a.falseAbstention).length,
    faithfulCitations: auditedQa.audits.filter((a) => a.faithfulCitations)
      .length,
    originalAudienceAssumptions: 1,
    targetedAudienceRepair: audience,
  },
  costs: {
    budget: ledger.budget,
    attempts: ledger.ledger.length,
    knownUsd:
      ledger.usage.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
    unknownUsage: ledger.usage.filter((u) => u.provider_cost_micro === null)
      .length,
    accountedUsage: ledger.usage.length,
    reservedUsd: ledger.ledger.reduce((s, l) => s + l.reservedUsd, 0),
    byModel: Object.fromEntries(
      [...new Set(ledger.usage.map((u) => u.model))].map((model) => {
        const rows = ledger.usage.filter((u) => u.model === model);
        return [
          model,
          {
            calls: rows.length,
            costUsd:
              rows.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
            input: rows.reduce((s, u) => s + u.input_tokens, 0),
            output: rows.reduce((s, u) => s + u.output_tokens, 0),
          },
        ];
      }),
    ),
    historicalKnownUsd: historicalKnown,
    cumulativeKnownUsd:
      historicalKnown +
      ledger.usage.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
    historicalUnknownAttempts: 17,
  },
  stages: ledger.stages,
  cleanup: ledger.cleanup,
  scope:
    "Machine calculations only. Final source-based human assessment separately classifies enrichments, representation-only updates, semantic disagreements, and the promotion gate; no historic labels or provider outputs changed.",
};
await writeFile(
  `${root}/summary.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    admission: summary.admission,
    bullets: summary.bullets,
    qa: summary.qa,
    costs: summary.costs,
  }),
);
