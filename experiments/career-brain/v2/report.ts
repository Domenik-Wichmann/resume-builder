import { readFile, writeFile } from "node:fs/promises";
import type { Candidate, Change } from "../../../src/lib/ingestion/model";
import type { RichCandidate } from "./evidence";
import { annotated as revised, annotationHash } from "./annotations";
import { matchGold, evaluate } from "./metrics";
type Run = {
  fixture: string;
  variant: string;
  repetition: number;
  rows: Candidate[];
  rich?: RichCandidate[];
  metrics: ReturnType<typeof evaluate>;
  latencyMs: number;
  error?: string;
  decisions?: {
    identity?: { outcome: string; id: string | null }[];
    audit?: { verdict: string; reason: string }[];
  };
  changes?: Change[];
};
type Result = {
  runs: Run[];
  ledger: {
    provider: string;
    label: string;
    latencyMs: number;
    reservedUsd: number;
    outcome: string;
  }[];
  usage: {
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    provider_cost_micro: number | null;
    status: string;
  }[];
  cleanup: unknown[];
  budget: unknown;
  budgetAmendments?: unknown[];
};
const root = "experiments/career-brain/v2/results";
const results: Result = JSON.parse(
  await readFile(root + "/results.json", "utf8"),
);
const sourceCatalog = new Map<string, string>();
for (const run of results.runs.filter((r) => r.variant === "R4"))
  for (const change of run.changes || [])
    for (const span of (change.before as RichCandidate | null)?.claims.flatMap(
      (c) => c.evidence,
    ) || []) {
      const id = (span as typeof span & { source_id?: string }).source_id;
      if (id)
        sourceCatalog.set(id, revised.find((f) => f.id === "B-messy")!.source);
    }
try {
  const sequence: { applied: { sourceId: string; fixture: string }[] } =
    JSON.parse(await readFile(root + "/database-revisions.json", "utf8"));
  for (const item of sequence.applied)
    sourceCatalog.set(
      item.sourceId,
      revised.find((f) => f.id === item.fixture)!.source,
    );
} catch {}
const rawMetrics = results.runs.map((r) => ({
  fixture: r.fixture,
  variant: r.variant,
  repetition: r.repetition,
  metrics: r.metrics,
}));
for (const run of results.runs)
  run.metrics = evaluate(
    revised.find((f) => f.id === run.fixture)!,
    run.rows,
  );
const mean = (xs: (number | null)[]) => {
  const values = xs.filter((x): x is number => x !== null);
  return values.length
    ? values.reduce((s, n) => s + n, 0) / values.length
    : null;
};
const percentile = (xs: number[], q: number) => {
  const ordered = [...xs].sort((a, b) => a - b);
  return ordered.length ? ordered[Math.floor((ordered.length - 1) * q)] : null;
};
const variants = [...new Set(results.runs.map((r) => r.variant))].map(
  (variant) => {
    const runs = results.runs.filter((r) => r.variant === variant),
      rows = runs.flatMap((r) => r.rows);
    const claims = runs.flatMap((r) => r.rich?.flatMap((c) => c.claims) || []);
    const spans = claims.flatMap((c) => c.evidence);
    return {
      variant,
      runs: runs.length,
      failed: runs.filter((r) => r.error).length,
      records: rows.length,
      criticalRecall: mean(runs.map((r) => r.metrics.factRecall.critical)),
      importantRecall: mean(runs.map((r) => r.metrics.factRecall.important)),
      relationRecall: mean(runs.map((r) => r.metrics.relationRecall)),
      rawClosedSetRelationPrecision: mean(
        runs.map((r) => r.metrics.relationPrecision),
      ),
      exactQuotes: runs.reduce((s, r) => s + r.metrics.exactQuotes, 0),
      review: rows.filter((r) => r.uncertainties.length).length,
      claims: claims.length,
      spans: spans.length,
      validSpans: runs.reduce(
        (n, run) =>
          n +
          (run.rich || [])
            .flatMap((r) => r.claims)
            .flatMap((c) => c.evidence)
            .filter((s) => {
              const id = (s as typeof s & { source_id?: string }).source_id;
              const source = id
                ? sourceCatalog.get(id)
                : revised.find((f) => f.id === run.fixture)!.source;
              return (
                source !== undefined &&
                s.start !== null &&
                s.end !== null &&
                source.slice(s.start, s.end) === s.quote
              );
            }).length,
        0,
      ),
      multiSpanClaims: claims.filter((c) => c.evidence.length > 1).length,
      medianLatencyMs: percentile(
        runs.map((r) => r.latencyMs),
        0.5,
      ),
    };
  },
);
const repeats = ["A0", "A1", "B0", "B1", "R1", "R2", "R3", "R4"].map(
  (variant) => {
    const runs = results.runs.filter(
      (r) => r.variant === variant && r.fixture === "B-messy",
    );
    const sets = runs.map(
      (r) => new Set(r.rows.map((c) => `${c.kind}:${c.key}`)),
    );
    const union = new Set(sets.flatMap((s) => [...s]));
    const intersection = sets.length
      ? [...sets[0]].filter((k) => sets.every((s) => s.has(k)))
      : [];
    const decisions = runs
      .filter((r) => r.repetition > 1)
      .flatMap((r) => r.decisions?.identity || []);
    return {
      variant,
      runs: runs.length,
      recordCounts: runs.map((r) => r.rows.length),
      keyIntersection: intersection.length,
      keyUnion: union.size,
      keyConsistency: union.size ? intersection.length / union.size : null,
      matchedExisting: decisions.filter((d) => d.outcome === "MATCH_EXISTING")
        .length,
      identityDecisions: decisions.length,
      ambiguous: decisions.filter((d) => d.outcome === "AMBIGUOUS").length,
      review: runs.map(
        (r) => r.rows.filter((c) => c.uncertainties.length).length,
      ),
    };
  },
);
const revisions = results.runs
  .filter((r) => r.variant === "SEQ2" && r.fixture !== "A-clean-v1")
  .map((r) => {
    const fixture = revised.find((f) => f.id === r.fixture)!;
    const scored = Object.entries(fixture.expectedDiff || {}).map(
      ([key, expected]) => {
        const matched =
          r.changes?.filter((c) => {
            const row = c.after || c.before;
            const gold =
              row &&
              matchGold(row, [
                ...fixture.gold,
                ...revised[0].gold.filter(
                  (g) =>
                    !fixture.gold.some(
                      (n) => n.kind === g.kind && n.key === g.key,
                    ),
                ),
              ]);
            return row && `${gold?.kind}:${gold?.key}` === key;
          }) || [];
        const actual =
          matched.length === 1
            ? matched[0].status
            : matched.length
              ? "MULTIPLE"
              : "MISSING";
        return { key, expected, actual, correct: actual === expected };
      },
    );
    return {
      fixture: r.fixture,
      accuracy: scored.filter((s) => s.correct).length / scored.length,
      scored,
      matchedUuids: r.decisions?.identity?.filter(
        (d) => d.outcome === "MATCH_EXISTING",
      ).length,
    };
  });
const usage = [...new Set(results.usage.map((u) => u.model))].map((model) => {
  const events = results.usage.filter((u) => u.model === model);
  return {
    model,
    events: events.length,
    inputTokens: events.reduce((s, u) => s + (u.input_tokens || 0), 0),
    outputTokens: events.reduce((s, u) => s + (u.output_tokens || 0), 0),
    knownUsd:
      events.reduce((s, u) => s + (u.provider_cost_micro || 0), 0) / 1e6,
    unknownCostEvents: events.filter((u) => u.provider_cost_micro === null)
      .length,
    failed: events.filter((u) => u.status !== "SUCCESS").length,
  };
});
const summary = {
  annotationHash,
  measurementNotes:
    "Supplement 2.1 and exact-title/whole-alias evaluator; original per-run metrics and provider outputs stay unchanged. Recall screens are not semantic precision.",
  rawMetrics,
  variants,
  repeats,
  revisions,
  budget: results.budget,
  budgetAmendments: results.budgetAmendments,
  calls: results.ledger.length,
  reservedUsd: results.ledger.reduce((s, l) => s + l.reservedUsd, 0),
  usage,
  accounting: {
    knownUsdSubtotal: usage.reduce((n, u) => n + u.knownUsd, 0),
    unknownCostEvents: usage.reduce((n, u) => n + u.unknownCostEvents, 0),
    attemptsWithoutUsageEvent: results.ledger.length - results.usage.length,
    providerAttempts: results.ledger.reduce<Record<string, number>>(
      (counts, l) => {
        counts[l.provider] = (counts[l.provider] || 0) + 1;
        return counts;
      },
      {},
    ),
    note: "Native usage SUCCESS means a reported HTTP response, not necessarily a valid complete experimental result. Unknown billed cost is not zero.",
  },
  latency: {
    p50Ms: percentile(
      results.ledger.filter((l) => l.latencyMs > 0).map((l) => l.latencyMs),
      0.5,
    ),
    p95Ms: percentile(
      results.ledger.map((l) => l.latencyMs),
      0.95,
    ),
  },
  cleanup: results.cleanup,
};
await writeFile(
  root + "/summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
const lines = [
  "# Career Brain repair measurements, benchmark revision 2",
  "",
  "Historical results are preserved. See the repair assessment for interpretation, human audit and rollout decision.",
  "",
  "## Architecture cases",
  "",
  "| Variant | Cases | Failed | Records | Critical recall screen | Relationship recall | Exact primary quotes | Review | Median end-to-end seconds |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...variants.map(
    (v) =>
      `| ${v.variant} | ${v.runs} | ${v.failed} | ${v.records} | ${v.criticalRecall === null ? "n/a" : (v.criticalRecall * 100).toFixed(1) + "%"} | ${v.relationRecall === null ? "n/a" : (v.relationRecall * 100).toFixed(1) + "%"} | ${v.exactQuotes}/${v.records} | ${v.review} | ${((v.medianLatencyMs || 0) / 1000).toFixed(1)} |`,
  ),
  "",
  "Recall screens use title/content criteria rather than an automated semantic judge. Optional supported frames and allowed V3 decomposition require human interpretation; closed-set precision is not factual precision.",
  "",
  "## Identity repetitions",
  "",
  "```json",
  JSON.stringify(repeats, null, 2),
  "```",
  "",
  "## Sequential factual diffs against real approved database state",
  "",
  "SEQ2 used real member-JWT database state with manually source-reviewed gold applied between proposals. Earlier SEQ stopped on incomplete audit and remains preserved. UUID reconciliation and generated state accuracy are different metrics.",
  "",
  "```json",
  JSON.stringify(revisions, null, 2),
  "```",
  "",
  "## Provenance",
  "",
  "```json",
  JSON.stringify(
    variants
      .filter((v) => v.claims)
      .map((v) => ({
        variant: v.variant,
        claims: v.claims,
        spans: v.spans,
        validSpans: v.validSpans,
        multiSpanClaims: v.multiSpanClaims,
      })),
    null,
    2,
  ),
  "```",
  "",
  "Exact quotation/offset validity does not establish entailment. Separate audit decisions remain in raw results.",
  "",
  "## Usage, latency and cleanup",
  "",
  "```json",
  JSON.stringify(
    {
      calls: summary.calls,
      reservedUsd: summary.reservedUsd,
      usage,
      latency: summary.latency,
      cleanup: summary.cleanup,
    },
    null,
    2,
  ),
  "```",
  "",
];
try {
  const retrieval = JSON.parse(
    await readFile(root + "/retrieval.json", "utf8"),
  );
  lines.push(
    "## Retrieval and downstream safety",
    "",
    "```json",
    JSON.stringify(
      {
        metrics: retrieval.metrics,
        classification: retrieval.classification,
        answers: retrieval.answers,
      },
      null,
      2,
    ),
    "```",
    "",
  );
} catch {}
await writeFile(
  "docs/qualification/career-brain-repair-results.md",
  lines.join("\n"),
);
console.log(
  JSON.stringify({
    variants,
    repeats,
    calls: summary.calls,
    reservedUsd: summary.reservedUsd,
  }),
);
