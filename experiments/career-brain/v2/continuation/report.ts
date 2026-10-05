import { readFile, writeFile, readdir } from "node:fs/promises";
import { root, fixture, stableId } from "./fixtures";
import {
  compileAdmission,
  resumeChecks,
  warningCompilerCanary,
} from "./resume";
import type { RichCandidate, RichCanonical } from "../evidence";
import type { Change } from "../../../../src/lib/ingestion/model";
import type { SupportCase } from "./fixtures";
import type { EvidencePacket } from "../packets";
import { adjudicate, packets } from "../packets";

const read = async (name: string) =>
  JSON.parse(await readFile(`${root}/${name}.json`, "utf8"));
const files = await readdir(root);
const exists = (name: string) => files.includes(`${name}.json`);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
};
type Native = {
  records: RichCandidate[];
  before?: RichCanonical[];
  changes: Change[];
  decisions: { identity: { outcome: string; id: string | null }[] };
  latencyMs: number;
};

function provenance(
  records: RichCandidate[],
  source: string,
  historical: Record<string, string>,
) {
  const spans = records.flatMap((r) => r.claims.flatMap((c) => c.evidence));
  const checked = spans.map((s) => {
    const referenced =
      "source_id" in s ? historical[String(s.source_id)] : source;
    return {
      referenceKnown: Boolean(referenced),
      valid: Boolean(
        referenced &&
        s.start !== null &&
        s.end !== null &&
        referenced.slice(s.start, s.end) === s.quote,
      ),
    };
  });
  return {
    claims: records.reduce((n, r) => n + r.claims.length, 0),
    spans: spans.length,
    exactReferencedSpans: checked.filter((c) => c.valid).length,
    unknownSourceReferences: checked.filter((c) => !c.referenceKnown).length,
    multiSpanClaims: records
      .flatMap((r) => r.claims)
      .filter((c) => c.evidence.length > 1).length,
  };
}
function correctedDiff(native: Native, revision: "V2" | "V3") {
  const rows = native.changes.map((c) => {
    const r = (c.after || c.before)! as RichCandidate;
    let expected: Change["status"] = "UNCHANGED";
    const allowed: Change["status"][] = [];
    if (revision === "V2") {
      if (
        r.kind === "experience" ||
        (r.kind === "achievement" && /training/i.test(r.title))
      )
        expected = "UPDATED";
      if (r.kind === "project" && /roster/i.test(r.title)) expected = "ADDED";
      if (r.kind === "certification") expected = "REVIEW";
      if (
        r.kind === "project" &&
        /dispatch|loom/i.test(r.title) &&
        r.claims?.some((f) => /five worked examples/i.test(f.value))
      )
        allowed.push("UPDATED");
    } else {
      if (
        (r.kind === "achievement" && /training/i.test(r.title)) ||
        r.kind === "experience"
      )
        expected = "REVIEW";
      if (r.kind === "skill" && r.title === "SQL") expected = "UPDATED";
      if (r.kind === "skill" && r.title === "Docker") expected = "ADDED";
      if (r.kind === "project" && /roster/i.test(r.title)) expected = "UPDATED";
      if (r.kind === "achievement" && /handover/i.test(r.title))
        expected = "ADDED";
      if (
        r.kind === "project" &&
        /dispatch|loom/i.test(r.title) &&
        /\b(?:12|14)\b/.test(
          r.summary + " " + r.claims.map((f) => f.value).join(" "),
        ) &&
        /train|workshop/i.test(
          r.summary + " " + r.claims.map((f) => f.value).join(" "),
        )
      )
        allowed.push("REVIEW");
    }
    return {
      kind: r.kind,
      title: r.title,
      status: c.status,
      expected,
      allowed,
      correct: c.status === expected || allowed.includes(c.status),
      reason: c.reason,
    };
  });
  return {
    scope:
      "Source-corrected record-status score against previous reviewed rich state. Supported contextual propagation allowances are explicit. Extra decompositions remain visible; no free relabeling based on model outcomes.",
    correct: rows.filter((r) => r.correct).length,
    total: rows.length,
    accuracy: rows.filter((r) => r.correct).length / rows.length,
    rows,
  };
}
const summary: Record<string, unknown> = {};
if (exists("grounding-baseline")) {
  const baseline = await read("grounding-baseline"),
    assertion = await read("grounding-assertions"),
    warning = await read("observed-warning");
  const score = (run: typeof baseline, granular: boolean) => {
    const rows = run.inputs.cases.map(
      (c: { id: string; expected: string }, index: number) => ({
        id: c.id,
        expected: c.expected,
        verdict: granular
          ? run.decisions
              .filter((d: { id: string }) => d.id.startsWith(`${index}:`))
              .every((d: { verdict: string }) => d.verdict === "SUPPORTED")
            ? "SUPPORTED"
            : "UNSUPPORTED"
          : run.decisions.find((d: { index: number }) => d.index === index)
              .verdict,
        withheld: run.records[index].uncertainties.length > 0,
      }),
    );
    return {
      modelVerdictsCorrect: rows.filter(
        (r: { expected: string; verdict: string }) => r.expected === r.verdict,
      ).length,
      total: rows.length,
      unsafeMisses: rows.filter(
        (r: { expected: string; withheld: boolean }) =>
          r.expected === "UNSUPPORTED" && !r.withheld,
      ).length,
      safeReviewFalsePositives: rows.filter(
        (r: { expected: string; withheld: boolean }) =>
          r.expected === "SUPPORTED" && r.withheld,
      ).length,
      rows,
    };
  };
  summary.grounding = {
    baseline: score(baseline, false),
    assertions: score(assertion, true),
    observedWarningCaught: warning.records[0].uncertainties.length > 0,
    observedWarningDisplayVerdict: warning.decisions.find(
      (d: { id: string }) => d.id === "0:display",
    ),
  };
  if (exists("observed-warning-sol"))
    summary.targetedSol = (await read("observed-warning-sol")).decisions;
  const canonical: RichCanonical = {
    ...warning.original,
    id: stableId("observed-warning-compiler"),
    hash: "diagnostic",
    published: true,
    archived: false,
    updated_at: "2026-10-05T00:00:00Z",
  };
  const context = adjudicate(
    "What SQL checks did Ada implement?",
    packets([canonical], [canonical.id]),
  );
  const compiled = compileAdmission(
    context,
    "What SQL checks did Ada implement?",
  );
  summary.observedWarningCompiler = {
    scope:
      "Deterministic actual ResumeIR replay of the retained unmodified R4 G proposal, not an accepted owner record or new generated answer",
    packet: context,
    ...compiled,
    unsupportedWarningCompiled: compiled.ir.projects.some((s) =>
      s.bullets.some((b) =>
        b.includes("late-arriving source files prompted a visible warning"),
      ),
    ),
  };
}
if (exists("repeat-state")) {
  const seed = await read("repeat-state");
  const repeats = [];
  for (let n = 1; n <= 5; n++)
    if (exists(`repeat-${n}`)) {
      const run: Native = await read(`repeat-${n}`);
      repeats.push({
        repetition: n,
        records: run.records.length,
        existingMatches: run.decisions.identity.filter(
          (d) => d.outcome === "MATCH_EXISTING",
        ).length,
        uniqueExistingIds: new Set(
          run.decisions.identity
            .filter((d) => d.outcome === "MATCH_EXISTING")
            .map((d) => d.id),
        ).size,
        unchanged: run.changes.filter((c) => c.status === "UNCHANGED").length,
        coreChanges: run.changes.filter((c) => c.before !== null).length,
        newCandidates: run.changes.filter((c) => c.before === null).length,
        totalChanges: run.changes.length,
        statuses: Object.fromEntries(
          ["UNCHANGED", "UPDATED", "REVIEW", "ADDED", "REMOVED"].map((s) => [
            s,
            run.changes.filter((c) => c.status === s).length,
          ]),
        ),
        provenance: provenance(run.records, fixture("B-messy").source, {
          [seed.applied.sourceId]: fixture("B-messy").source,
        }),
        latencyMs: run.latencyMs,
      });
    }
  summary.richRepeats = {
    repeats,
    existingMatches: repeats.reduce((n, r) => n + r.existingMatches, 0),
    unchanged: repeats.reduce((n, r) => n + r.unchanged, 0),
    totalChanges: repeats.reduce((n, r) => n + r.totalChanges, 0),
    medianLatencyMs: median(repeats.map((r) => r.latencyMs)),
  };
}
if (exists("sequence-v3-reviewed")) {
  const v1 = await read("sequence-v1"),
    v2 = await read("sequence-v2-reviewed"),
    v3 = await read("sequence-v3-reviewed");
  const references = {
    [v1.applied.sourceId]: fixture("A-clean-v1").source,
    [v2.applied.sourceId]: fixture("A-clean-v2").source,
    [v3.applied.sourceId]: fixture("A-clean-v3").source,
  };
  const n2: Native = await read("sequence-v2-native"),
    n3: Native = await read("sequence-v3-native");
  summary.sequence = {
    v2: correctedDiff(n2, "V2"),
    v3: correctedDiff(n3, "V3"),
    preservedV2: v2.applied.preserved,
    preservedV3: v3.applied.preserved,
    stateCounts: [v1.state.length, v2.state.length, v3.state.length],
    provenanceV2: provenance(
      n2.records,
      fixture("A-clean-v2").source,
      references,
    ),
    provenanceV3: provenance(
      n3.records,
      fixture("A-clean-v3").source,
      references,
    ),
    latencyMs: [n2.latencyMs, n3.latencyMs],
    unresolvedCanonicalQuantity: v3.state
      .filter(
        (r: RichCanonical) =>
          /\b12\b/.test(
            r.summary + " " + r.claims.map((c) => c.value).join(" "),
          ) && /train|workshop/i.test(r.summary + r.title),
      )
      .map((r: RichCanonical) => ({
        id: r.id,
        title: r.title,
        uncertaintyCount: r.uncertainties.length,
      })),
    scope:
      "Real V1 rich seed → reviewed rich V2 → reviewed rich V3. Pending review entries are not silently applied; archived certificate never recreated.",
  };
  if (exists("sequence-v3-post-equivalence"))
    summary.postEquivalenceAudit = (
      await read("sequence-v3-post-equivalence")
    ).decisions;
}
if (exists("cached-100")) {
  const cached = await read("cached-100");
  const positive = cached.rows.filter(
      (q: { relevant: string[] }) => q.relevant.length,
    ),
    negative = cached.rows.filter(
      (q: { relevant: string[] }) => !q.relevant.length,
    );
  const covered = positive.filter((q: { packets: EvidencePacket[] }) =>
    q.packets.some((p) =>
      ["SUPPORTS", "PARTIALLY_SUPPORTS"].includes(p.support || ""),
    ),
  );
  summary.cached100 = {
    positives: positive.length,
    covered: covered.length,
    evidenceCoverage: covered.length / positive.length,
    negatives: negative.length,
    unsupportedDirectSupport: negative
      .filter((q: { packets: EvidencePacket[] }) =>
        q.packets.some((p) => p.support === "SUPPORTS"),
      )
      .map((q: { id: string }) => q.id),
    falseAbstentionCandidateGaps: positive
      .filter(
        (q: { packets: EvidencePacket[] }) =>
          !q.packets.some((p) =>
            ["SUPPORTS", "PARTIALLY_SUPPORTS"].includes(p.support || ""),
          ),
      )
      .map((q: { id: string }) => q.id),
    scope: cached.scope,
  };
  const compiled = cached.rows.map(
    (q: {
      id: string;
      text: string;
      relevant: string[];
      packets: EvidencePacket[];
    }) => {
      const result = compileAdmission(q.packets, q.text);
      return {
        id: q.id,
        negative: !q.relevant.length,
        ...result,
        escapedIds: result.compiledIds.filter(
          (id) => !result.admittedIds.includes(id),
        ),
      };
    },
  );
  await writeFile(
    `${root}/cached-100-resume.json`,
    JSON.stringify(
      {
        scope:
          "Actual ResumeIR compiler over the cached packets, including supported skill groups. Constant source-supported name/title and blank introduction isolate admission; malformed-canonical field safety is a separate canary.",
        rows: compiled,
      },
      null,
      2,
    ) + "\n",
  );
  summary.cached100Resume = {
    checks: compiled.length,
    negativeCases: compiled.filter((c: { negative: boolean }) => c.negative)
      .length,
    unsupportedNegativeAdmissions: compiled
      .filter(
        (c: { negative: boolean; admittedIds: string[] }) =>
          c.negative && c.admittedIds.length,
      )
      .map((c: { id: string }) => c.id),
    escapedIds: compiled
      .filter((c: { escapedIds: string[] }) => c.escapedIds.length)
      .map((c: { id: string }) => c.id),
  };
}
if (exists("support-five-way")) {
  const cases: SupportCase[] = (await read("support-five-way")).cases;
  const comparisons = cases.flatMap((q) =>
    q.expected.map((e) => ({
      queryId: q.id,
      expected: e.support,
      actual: q.packets.find((p) => p.id === e.id)?.support,
    })),
  );
  const checks = resumeChecks(cases);
  summary.support = {
    correct: comparisons.filter((c) => c.expected === c.actual).length,
    total: comparisons.length,
    accuracy:
      comparisons.filter((c) => c.expected === c.actual).length /
      comparisons.length,
    confusion: comparisons,
    directFalsePositiveQueries: comparisons
      .filter((c) => c.actual === "SUPPORTS" && c.expected !== "SUPPORTS")
      .map((c) => c.queryId),
  };
  summary.resume = {
    checks: checks.length,
    nonDirectCases: cases.filter((q) => q.answerGroup !== "DIRECT").length,
    unsupportedAdmissions: checks
      .filter((c) => c.unsupportedAdmissionIds.length)
      .map((c) => c.id),
    escapedIds: checks.filter((c) => c.escapedIds.length).map((c) => c.id),
    compiledDirectCases: checks.filter(
      (c) => c.answerGroup === "DIRECT" && c.admittedIds.length,
    ).length,
    warningCanary: warningCompilerCanary(),
  };
  await writeFile(
    `${root}/resume-checks.json`,
    JSON.stringify(
      { checks, warningCanary: warningCompilerCanary() },
      null,
      2,
    ) + "\n",
  );
}
if (exists("ledger")) {
  const ledger = await read("ledger");
  const known = ledger.usage.filter(
    (u: { provider_cost_micro: number | null }) =>
      u.provider_cost_micro !== null,
  );
  summary.accounting = {
    attempts: ledger.ledger.length,
    usageEvents: ledger.usage.length,
    knownCostUsd:
      known.reduce(
        (s: number, u: { provider_cost_micro: number }) =>
          s + u.provider_cost_micro,
        0,
      ) / 1000000,
    unknownCostEvents: ledger.usage.length - known.length,
    attemptsWithoutUsageEvent: ledger.ledger.length - ledger.usage.length,
    reservedUsd: ledger.ledger.reduce(
      (s: number, l: { reservedUsd: number }) => s + l.reservedUsd,
      0,
    ),
    ceilingUsd: ledger.budget.maxUsd,
    stages: ledger.stages,
    cleanup: ledger.cleanup,
  };
}
if (exists("human-audit")) {
  const human = await read("human-audit");
  const audits = (
    await Promise.all(
      [0, 10, 20]
        .filter((n) => exists(`answer-audit-${n}`))
        .map((n) => read(`answer-audit-${n}`)),
    )
  ).flatMap((r) => r.audits);
  summary.answers = {
    ...human.answerMetrics,
    scope:
      "All thirty texts inspected; model citation audit and conservative source/presentation findings reported separately. Useful scoped answers are not treated as blanket refusals.",
    nativeAuditUnsupportedIds: audits
      .filter((a) => a.unsupportedAssertions.length)
      .map((a) => a.id),
    nativeAuditUnfaithfulCitationIds: audits
      .filter((a) => a.unfaithfulCitations.length)
      .map((a) => a.id),
    nativeAuditFalseAbstentionIds: audits
      .filter((a) => a.falseAbstention)
      .map((a) => a.id),
  };
}
await writeFile(
  `${root}/summary.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    summarized: Object.keys(summary),
    file: `${root}/summary.json`,
  }),
);
