import type { Career } from "./model";
export function retrieve(career: Career, query: string) {
  const tokens = query.toLowerCase().match(/[a-z0-9+#.]+/g) || [];
  return [
    ...career.experiences,
    ...career.projects,
    ...career.achievements,
    ...career.education,
    ...career.certifications,
  ]
    .map((record) => ({
      record,
      score: tokens.filter(
        (token) =>
          token.length > 2 &&
          `${record.title} ${record.summary} ${record.skills.join(" ")}`
            .toLowerCase()
            .includes(token),
      ).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ record }) => record);
}
