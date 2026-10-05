import type { Candidate, Canonical } from "../../src/lib/ingestion/model";
import {
  identity,
  semanticHash,
  diffCareer,
} from "../../src/lib/ingestion/diff";
import type { Fixture, GoldRecord } from "./fixtures";
export function matchGold(row: Candidate, gold: GoldRecord[]) {
  const normalized = `${row.title} ${row.key}`
    .toLowerCase()
    .replaceAll("-", " ");
  return (
    gold.find((g) => g.kind === row.kind && g.key === row.key) ||
    gold.find(
      (g) =>
        g.kind === row.kind &&
        g.aliases.some((a) => normalized.includes(a.toLowerCase())),
    )
  );
}
export function evaluate(fixture: Fixture, rows: Candidate[]) {
  const assigned = rows.map((row) => ({
    row,
    gold: matchGold(row, fixture.gold),
  }));
  const found = new Set(
    assigned.flatMap((r) => (r.gold ? [identity(r.gold)] : [])),
  );
  const facts = fixture.gold.flatMap((g) =>
    g.essential.map((pattern) => {
      const texts = assigned
        .filter((r) => r.gold === g)
        .map(
          (r) =>
            `${r.row.title} ${r.row.subtitle} ${r.row.summary} ${r.row.organization || ""}`,
        )
        .join(" ");
      return {
        identity: identity(g),
        pattern,
        importance: g.importance,
        found: new RegExp(pattern, "i").test(texts),
      };
    }),
  );
  const mapKey = (kind: Candidate["kind"], key: string) => {
    const row = rows.find((r) => r.kind === kind && r.key === key);
    return row
      ? identity(matchGold(row, fixture.gold) || row)
      : `${kind}:${key}`;
  };
  const relations = (r: Candidate, mapped = false) => [
    ...r.skill_keys.map(
      (k) =>
        `${mapped ? identity(matchGold(r, fixture.gold) || r) : identity(r)}->${mapped ? mapKey("skill", k) : `skill:${k}`}`,
    ),
    ...r.achievement_keys.map(
      (k) =>
        `${mapped ? identity(matchGold(r, fixture.gold) || r) : identity(r)}->${mapped ? mapKey("achievement", k) : `achievement:${k}`}`,
    ),
    ...(r.category_key
      ? [
          `${mapped ? identity(matchGold(r, fixture.gold) || r) : identity(r)}->${mapped ? mapKey("category", r.category_key) : `category:${r.category_key}`}`,
        ]
      : []),
  ];
  const wanted = new Set(fixture.gold.flatMap((r) => relations(r)));
  const actual = new Set(rows.flatMap((r) => relations(r, true)));
  const correct = [...actual].filter((r) => wanted.has(r)).length;
  return {
    recordCount: rows.length,
    goldCount: fixture.gold.length,
    identityRecall: found.size / fixture.gold.length,
    factRecall: Object.fromEntries(
      ["critical", "important", "optional"].map((t) => {
        const f = facts.filter((f) => f.importance === t);
        return [
          t,
          f.length ? f.filter((f) => f.found).length / f.length : null,
        ];
      }),
    ),
    relationPrecision: actual.size ? correct / actual.size : null,
    relationRecall: wanted.size ? correct / wanted.size : null,
    missingIdentities: fixture.gold
      .filter((g) => !found.has(identity(g)))
      .map(identity),
    missingFacts: facts.filter((f) => !f.found),
    unmatched: assigned.filter((r) => !r.gold).map((r) => identity(r.row)),
    duplicateUnits: [...found].filter(
      (key) =>
        assigned.filter((r) => r.gold && identity(r.gold) === key).length > 1,
    ),
    exactQuotes: rows.filter((r) => fixture.source.includes(r.source_quote))
      .length,
    quoteCount: rows.length,
    reviewCount: rows.filter((r) => r.uncertainties.length).length,
    // These are flags for human review, not a claim of measured semantic precision.
    forbiddenFlags: rows.flatMap((r) =>
      fixture.forbidden
        .filter((p) => new RegExp(p, "i").test(`${r.title} ${r.summary}`))
        .map((pattern) => ({ identity: identity(r), pattern })),
    ),
    relationshipMissing: [...wanted].filter((r) => !actual.has(r)),
    relationshipUnexpected: [...actual].filter((r) => !wanted.has(r)),
  };
}
export function canonical(
  rows: Candidate[],
  archived: string[] = [],
): Canonical[] {
  return rows.map((r, i) => ({
    ...r,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    hash: semanticHash(r),
    updated_at: "2026-10-05T00:00:00Z",
    published: true,
    archived: archived.includes(identity(r)),
  }));
}
export function diffScore(
  fixture: Fixture,
  rows: Candidate[],
  current: Canonical[],
) {
  const changes = diffCareer(rows, current, true);
  const expected = fixture.expectedDiff || {};
  const scored = Object.entries(expected).map(([key, status]) => {
    const change = changes.find((c) => c.identity === key);
    return {
      key,
      expected: status,
      actual: change?.status || "MISSING",
      correct: change?.status === status,
    };
  });
  return {
    accuracy: scored.filter((s) => s.correct).length / scored.length,
    scored,
    changes,
  };
}
export function rankMetrics(
  results: { relevant: string[]; ranking: string[] }[],
) {
  const positive = results.filter((r) => r.relevant.length);
  const negative = results.filter((r) => !r.relevant.length);
  const recall = (k: number) =>
    positive.reduce(
      (sum, r) =>
        sum +
        r.relevant.filter((id) => r.ranking.slice(0, k).includes(id)).length /
          r.relevant.length,
      0,
    ) / positive.length;
  return {
    queries: results.length,
    positives: positive.length,
    negatives: negative.length,
    recall1: recall(1),
    recall3: recall(3),
    recall5: recall(5),
    mrr:
      positive.reduce((sum, r) => {
        const at = r.ranking.findIndex((id) => r.relevant.includes(id));
        return sum + (at < 0 ? 0 : 1 / (at + 1));
      }, 0) / positive.length,
    negativeFalsePositiveRate:
      negative.filter((r) => r.ranking.length).length / negative.length,
    noEvidenceCorrectness:
      negative.filter((r) => !r.ranking.length).length / negative.length,
  };
}
