import type { Candidate } from "../../../src/lib/ingestion/model";
import { identity } from "../../../src/lib/ingestion/diff";
import type { Fixture, GoldRecord } from "../fixtures";
import { normalize, type RichCandidate } from "./evidence";
// Exact titles first, then longest whole aliases. PostgreSQL must not match SQL
// merely because the latter occurs as a suffix. Historical metrics stay frozen.
export function matchGold(row: Candidate, gold: GoldRecord[]) {
  const direct = gold.filter(
    (g) =>
      g.kind === row.kind &&
      (g.key === row.key || normalize(g.title) === normalize(row.title)),
  );
  if (direct.length === 1) return direct[0];
  const text = " " + normalize(row.title + " " + row.key) + " ";
  const matches = gold
    .filter((g) => g.kind === row.kind)
    .flatMap((g) => g.aliases.map((a) => ({ g, alias: normalize(a) })))
    .filter(
      ({ alias }) =>
        text.includes(" " + alias + " ") ||
        (alias === "supervis" && /\bsupervis(?:ion|ed|or|ing)\b/.test(text)),
    )
    .sort((a, b) => b.alias.length - a.alias.length);
  return matches[0]?.g;
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

export function claimInclusiveRecall(fixture: Fixture, rows: RichCandidate[]) {
  return evaluate(
    fixture,
    rows.map((r) => ({
      ...r,
      summary: [r.summary, ...r.claims.map((c) => c.value)].join(" "),
    })),
  ).factRecall;
}
