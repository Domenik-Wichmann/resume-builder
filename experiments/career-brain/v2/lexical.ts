import type { Career, CareerRecord } from "../../../src/lib/career/model";
const stop = new Set(
  "a an the is are was were has have had did does do this that those these person candidate personally built build system project projects experience experiences work worked working with for from at in on of to and or it what how when where who can could would me tell about show explain practical internal tool tools used use using software new role career".split(
    " ",
  ),
);
const terms = (s: string) => [
  ...new Set(
    (s.toLowerCase().match(/[a-z0-9+#]+/g) || []).filter(
      (t) => t.length > 1 && !stop.has(t),
    ),
  ),
];
export function lexical(career: Career, query: string): CareerRecord[] {
  const records = [
    ...career.experiences,
    ...career.projects,
    ...career.achievements,
    ...career.skill_records,
    ...career.education,
    ...career.certifications,
    ...(career.languages || []),
  ];
  const nameTokens = new Set(terms(career.profile.name));
  const wanted = terms(query).filter((t) => !nameTokens.has(t));
  const documents = records.map((r) => ({
    r,
    tokens: new Set(
      terms(
        `${r.title} ${r.summary} ${r.organization || ""} ${r.skills.join(" ")}`,
      ),
    ),
  }));
  return documents
    .map(({ r, tokens }) => ({
      r,
      score: wanted.reduce((sum, t) => {
        if (!tokens.has(t)) return sum;
        const frequency = documents.filter((d) => d.tokens.has(t)).length;
        const weight = Math.log(1 + documents.length / (1 + frequency));
        return (
          sum +
          weight *
            (terms(`${r.title} ${r.skills.join(" ")}`).includes(t) ? 2 : 1)
        );
      }, 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id))
    .slice(0, 8)
    .map((x) => x.r);
}
