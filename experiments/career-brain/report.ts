import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Candidate } from "../../src/lib/ingestion/model";
import { identity, diffCareer } from "../../src/lib/ingestion/diff";
import { canonical, diffScore, rankMetrics } from "./metrics";
import { fixtures } from "./fixtures";
type Metrics = ReturnType<typeof rankMetrics>;
type Run = {
  fixture: string;
  variant: string;
  repetition: number;
  rows: Candidate[];
  error?: string;
  latencyMs: number;
  metrics: {
    identityRecall: number;
    factRecall: Record<string, number | null>;
    relationRecall: number | null;
    relationPrecision: number | null;
    exactQuotes: number;
    quoteCount: number;
    reviewCount: number;
    missingFacts: unknown[];
    relationshipMissing: string[];
    missingIdentities: string[];
    unmatched: string[];
    duplicateUnits: string[];
  };
};
type Retrieval = {
  initial: unknown;
  unchanged: unknown;
  sweep: { threshold: number; semantic: Metrics; hybrid: Metrics }[];
  lexical: Metrics;
  fusion: Metrics;
  alternativeProjection: { metrics: Metrics };
  jobResults: {
    id: string;
    coverage: number | null;
    ranking: string[];
    allBulletsCanonical: boolean;
  }[];
  holdoutSweep: { threshold: number; semantic: Metrics; hybrid: Metrics }[];
  interview: { repeated: number; questions: unknown[] };
};
const results = JSON.parse(
  await readFile("experiments/career-brain/results/results.json", "utf8"),
) as {
  runs: Run[];
  retrieval?: Retrieval;
  versions?: unknown;
  endToEnd?: unknown;
  cleanup: unknown[];
  productionSmoke?: unknown;
  ledger: {
    label: string;
    provider: string;
    reservedUsd: number;
    latencyMs: number;
    outcome: string;
  }[];
  usage: {
    provider: string;
    model: string;
    operation_type: string;
    input_tokens: number | null;
    output_tokens: number | null;
    provider_cost_micro: number | null;
    status: string;
  }[];
};
const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(1)}%`;
const quantile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] || 0;
const aggregate = (runs: Run[]) => ({
  runs: runs.length,
  records: runs.reduce((s, r) => s + r.rows.length, 0),
  exactQuotes: runs.reduce((s, r) => s + r.metrics.exactQuotes, 0),
  criticalRecall:
    runs.reduce((s, r) => s + (r.metrics.factRecall.critical || 0), 0) /
    runs.filter((r) => r.metrics.factRecall.critical !== null).length,
  review: runs.reduce((s, r) => s + r.metrics.reviewCount, 0),
  missingFacts: runs.reduce((s, r) => s + r.metrics.missingFacts.length, 0),
  relationshipMisses: runs.reduce(
    (s, r) => s + r.metrics.relationshipMissing.length,
    0,
  ),
});
const variants = [...new Set(results.runs.map((r) => r.variant))].map(
  (variant) => ({
    variant,
    ...aggregate(results.runs.filter((r) => r.variant === variant)),
  }),
);
const repeatability = ["A", "E"].map((variant) => {
  const runs = results.runs.filter(
    (r) => r.variant === variant && r.fixture === "B-messy",
  );
  const sets = runs.map((r) => new Set(r.rows.map(identity)));
  const union = new Set(sets.flatMap((s) => [...s]));
  const intersection = [...union].filter((k) => sets.every((s) => s.has(k)));
  const counts = runs.map((r) => r.rows.length),
    mean = counts.reduce((s, n) => s + n, 0) / counts.length;
  return {
    variant,
    runs: runs.length,
    counts,
    variance: counts.reduce((s, n) => s + (n - mean) ** 2, 0) / counts.length,
    keyIntersection: intersection.length,
    keyUnion: union.size,
    keyConsistency: intersection.length / union.size,
    keys: [...union],
    changedOnIdenticalInput: runs.slice(1).map((r) =>
      diffCareer(r.rows, canonical(runs[0].rows), true).reduce(
        (counts, c) => ({
          ...counts,
          [c.status]: (counts[c.status] || 0) + 1,
        }),
        {} as Record<string, number>,
      ),
    ),
  };
});
const versions = ["A", "E"].map((variant) => {
  const v1 = results.runs.find(
      (r) => r.variant === variant && r.fixture === "A-clean-v1",
    ),
    v2 = results.runs.find(
      (r) => r.variant === variant && r.fixture === "A-clean-v2",
    ),
    v3 = results.runs.find(
      (r) => r.variant === variant && r.fixture === "A-clean-v3",
    );
  if (!v1 || !v2 || !v3) return { variant };
  if (v1.error || v2.error || v3.error)
    return {
      variant,
      unavailable:
        "Cannot score a sequential import after failed extraction. Failed outputs do not imply removals.",
    };
  const current1 = canonical(v1.rows),
    current2 = canonical(
      [...v2.rows, ...v1.rows.filter((r) => r.kind === "certification")],
      v1.rows.filter((r) => r.kind === "certification").map(identity),
    );
  return {
    variant,
    v2: diffScore(fixtures[7], v2.rows, current1),
    v3: diffScore(fixtures[8], v3.rows, current2),
  };
});
const usage = [
  ...new Set(results.usage.map((u) => `${u.provider}:${u.model}`)),
].map((key) => {
  const entries = results.usage.filter(
    (u) => `${u.provider}:${u.model}` === key,
  );
  return {
    model: key,
    calls: entries.length,
    inputTokens: entries.reduce((s, u) => s + (u.input_tokens || 0), 0),
    outputTokens: entries.reduce((s, u) => s + (u.output_tokens || 0), 0),
    reportedUsd:
      entries.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
    unknownCostCalls: entries.filter((u) => u.provider_cost_micro === null)
      .length,
    failed: entries.filter((u) => u.status !== "SUCCESS").length,
  };
});
const summary = {
  variants,
  repeatability,
  versions,
  usage,
  latency: {
    p50Ms: quantile(
      results.ledger.map((l) => l.latencyMs),
      0.5,
    ),
    p95Ms: quantile(
      results.ledger.map((l) => l.latencyMs),
      0.95,
    ),
  },
  reservedUsd: results.ledger.reduce((s, l) => s + l.reservedUsd, 0),
  calls: results.ledger.length,
  callsByProvider: Object.fromEntries(
    ["OPENROUTER", "COHERE"].map((provider) => [
      provider,
      results.ledger.filter((l) => l.provider === provider).length,
    ]),
  ),
  missingUsageEvents: results.ledger.length - results.usage.length,
  unknownCostCalls:
    results.usage.filter((u) => u.provider_cost_micro === null).length +
    results.ledger.length -
    results.usage.length,
  providerLatency: Object.fromEntries(
    ["OPENROUTER", "COHERE"].map((provider) => {
      const values = results.ledger
        .filter((l) => l.provider === provider)
        .map((l) => l.latencyMs);
      return [
        provider,
        { p50Ms: quantile(values, 0.5), p95Ms: quantile(values, 0.95) },
      ];
    }),
  ),
  cleanup: results.cleanup,
};
await writeFile(
  "experiments/career-brain/results/summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
await mkdir("docs/qualification", { recursive: true });
const lines = [
  "# Career Brain qualification — measured results",
  "",
  "Date: 2026-10-05. Frozen baseline: `56a286e6750be96dccfa35f378862f1d7d33507a`.",
  "",
  "This is a synthetic qualification corpus, not proof across real careers. Read the companion assessment for semantic audit, gold errata, selection and release decision.",
  "",
  "## Extraction cases",
  "",
  "| Fixture | Variant/run | Records | Critical recall screen | Relationship recall | Exact quotes | Review | Latency |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...results.runs.map(
    (r) =>
      `| ${r.fixture} | ${r.variant}/${r.repetition} | ${r.rows.length} | ${pct(r.metrics.factRecall.critical)} | ${pct(r.metrics.relationRecall)} | ${r.metrics.exactQuotes}/${r.metrics.quoteCount} | ${r.metrics.reviewCount} | ${(r.latencyMs / 1000).toFixed(1)}s |`,
  ),
  "",
  "Regex recall is an aid to manual review, not semantic precision. D's inherited relationship labels and E's omitted activity-role label contain gold errors; their raw relation scores are not valid architecture evidence.",
  "",
  "## Repeatability",
  "",
  "| Variant | Runs | Counts | Key intersection/union | Count variance |",
  "| --- | ---: | --- | ---: | ---: |",
  ...repeatability.map(
    (r) =>
      `| ${r.variant} | ${r.runs} | ${r.counts.join(", ")} | ${r.keyIntersection}/${r.keyUnion} | ${r.variance.toFixed(2)} |`,
  ),
  "",
  "Key consistency is intersection/union of literal kind:key across identical-source runs, with no identity context. It does not reward alias normalization. Per-run diffs, all changed keys and revision scoring are in summary.json.",
  "",
  "## Retrieval",
  "",
  "| Strategy/threshold | Recall@1 | Recall@3 | Recall@5 | MRR | Negative false positives | No-evidence correctness |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
const architectureCosts = ["A", "B", "C", "D", "E"].map((variant) => {
  const events = results.usage.filter((u, i) =>
    variant === "A"
      ? i < 14
      : variant === "D"
        ? u.operation_type === "qualification_D" ||
          (u.operation_type === "career_ingest" && i >= 14)
        : u.operation_type === `qualification_${variant}`,
  );
  const runs = results.runs.filter((r) => r.variant === variant);
  return {
    variant,
    events: events.length,
    reportedUsd:
      events.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
    failedRuns: runs.filter((r) => r.error).length,
    latencyMs: runs.reduce((s, r) => s + r.latencyMs, 0),
  };
});
lines.push(
  "",
  "## Architecture cost and latency",
  "",
  "| Variant | Inference calls | Returned usage events | Reported USD subtotal | Failed extraction cases | Total extraction latency |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...architectureCosts.map(
    (a) =>
      `| ${a.variant} | ${a.variant === "A" ? 14 : a.variant === "B" ? 2 : a.variant === "C" || a.variant === "D" ? 4 : 14} | ${a.events} | $${a.reportedUsd.toFixed(6)} | ${a.failedRuns} | ${(a.latencyMs / 1000).toFixed(1)}s |`,
  ),
  "",
  "Five E response bodies timed out before baseline accounting could save an event. Their billing is unknown and reservations remain consumed. The production repair covers this path; regression tests verify one failed event rather than fabricated zero cost.",
);
const row = (label: string, m: Metrics) =>
  `| ${label} | ${pct(m.recall1)} | ${pct(m.recall3)} | ${pct(m.recall5)} | ${m.mrr.toFixed(3)} | ${pct(m.negativeFalsePositiveRate)} | ${pct(m.noEvidenceCorrectness)} |`;
if (results.retrieval) {
  lines.push(row("Lexical", results.retrieval.lexical));
  for (const r of results.retrieval.sweep)
    lines.push(
      row(`Semantic ${r.threshold}`, r.semantic),
      row(`Hybrid ${r.threshold}`, r.hybrid),
    );
  lines.push(
    row("RRF fusion / 0.25", results.retrieval.fusion),
    row(
      "Associated-work projection / 0.25",
      results.retrieval.alternativeProjection.metrics,
    ),
    "",
    "## Sparse holdout",
    "",
    "| Strategy/threshold | Recall@1 | Recall@3 | Recall@5 | MRR | Negative false positives | No-evidence correctness |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const r of results.retrieval.holdoutSweep)
    lines.push(
      row(`Semantic ${r.threshold}`, r.semantic),
      row(`Hybrid ${r.threshold}`, r.hybrid),
    );
  lines.push(
    "",
    "## Index, revisions, interviews and end to end",
    "",
    "```json",
    JSON.stringify(
      {
        index: results.retrieval.initial,
        noChangeIndex: results.retrieval.unchanged,
        versions: results.versions,
        jobs: results.retrieval.jobResults,
        interview: results.retrieval.interview,
        endToEnd: results.endToEnd,
        productionSmoke: results.productionSmoke,
      },
      null,
      2,
    ),
    "```",
  );
}
lines.push(
  "",
  "## Provider accounting",
  "",
  "| Provider/model | Calls | Input tokens | Output tokens | Reported USD | Unknown-cost calls |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...usage.map(
    (u) =>
      `| ${u.model} | ${u.calls} | ${u.inputTokens} | ${u.outputTokens} | ${u.unknownCostCalls === u.calls ? "unknown" : `$${u.reportedUsd.toFixed(6)}`} | ${u.unknownCostCalls} |`,
  ),
  "",
  `Conservative reservations: $${summary.reservedUsd.toFixed(2)} of $5. Actual total cost is incomplete where provider billing is unavailable. Per-call latency p50 ${(summary.latency.p50Ms / 1000).toFixed(1)}s; p95 ${(summary.latency.p95Ms / 1000).toFixed(1)}s. Multi-call architecture latency is measured separately in the extraction-case table.`,
  `Total attempted provider calls: ${summary.calls}; ${JSON.stringify(summary.callsByProvider)}. Returned usage events: ${results.usage.length}; missing events from observed body timeouts: ${summary.missingUsageEvents}. Unknown-cost calls: ${summary.unknownCostCalls}. Per-provider latency: ${JSON.stringify(summary.providerLatency)}.`,
  "",
  "OpenRouter published Luna token prices were checked before runs at [the official model catalog](https://openrouter.ai/api/v1/models). The committed ledger stores reservations before calls; usage events preserve returned token counts and cost without prompt logs.",
  "",
  "## Cleanup",
  "",
  "```json",
  JSON.stringify(results.cleanup, null, 2),
  "```",
  "",
  "Raw synthetic outputs and detailed gold labels are under `experiments/career-brain/`. No owner sources, credentials, sessions or embeddings are included.",
  "",
);
await writeFile("docs/qualification/career-brain-results.md", lines.join("\n"));
console.log(
  JSON.stringify({
    variants,
    repeatability: repeatability.map(
      ({ keys, changedOnIdenticalInput, ...r }) => {
        void keys;
        void changedOnIdenticalInput;
        return r;
      },
    ),
    usage,
    latency: summary.latency,
  }),
);
