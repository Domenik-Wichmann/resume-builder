import { createHash } from "node:crypto";
import type { Career, CareerRecord } from "../career/model";
import { deduplicate } from "../career/utils";
export { deduplicate } from "../career/utils";
export const entityTypes = [
  "experience",
  "project",
  "achievement",
  "skill",
  "education",
  "certification",
] as const;
export type EntityType = (typeof entityTypes)[number];
export type SemanticEntity = {
  type: EntityType;
  record: CareerRecord;
  content: string;
  hash: string;
};
export function semanticText(type: EntityType, record: CareerRecord) {
  return [
    `Type: ${type}`,
    `Title: ${record.title}`,
    record.organization && `Organization: ${record.organization}`,
    record.start_date &&
      `Dates: ${record.start_date} – ${record.end_date || "end date not recorded"}`,
    record.subtitle && `Context: ${record.subtitle}`,
    record.summary && `Evidence: ${record.summary}`,
    record.description && `Description: ${record.description}`,
    record.outcomes?.length && `Outcomes: ${record.outcomes.join("; ")}`,
    record.skills.length &&
      `Skills: ${[...new Set(record.skills)].sort().join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
export function contentHash(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
export function semanticEntities(career: Career): SemanticEntity[] {
  const groups: [EntityType, CareerRecord[]][] = [
    ["experience", career.experiences],
    ["project", career.projects],
    ["achievement", career.achievements],
    ["skill", career.skill_records],
    ["education", career.education],
    ["certification", career.certifications],
  ];
  return groups.flatMap(([type, records]) =>
    records.map((record) => {
      const content = semanticText(type, record);
      return { type, record, content, hash: contentHash(content) };
    }),
  );
}
export function needsEmbedding(
  entity: SemanticEntity,
  stored: { content_hash: string; embedding_model: string } | undefined,
  model: string,
) {
  return (
    !stored ||
    stored.content_hash !== entity.hash ||
    stored.embedding_model !== model
  );
}
export type SemanticMatch = {
  entity_type: EntityType;
  entity_id: string;
  content_hash: string;
};
/** Stale vectors may select a candidate but never supply career truth to the prompt. */
export function expandMatches(
  matches: SemanticMatch[],
  entities: SemanticEntity[],
) {
  const lookup = new Map(
    entities.map((entity) => [`${entity.type}:${entity.record.id}`, entity]),
  );
  return deduplicate(
    matches.flatMap((match) => {
      const entity = lookup.get(`${match.entity_type}:${match.entity_id}`);
      return entity && entity.hash === match.content_hash
        ? [entity.record]
        : [];
    }),
  );
}
export function jobQueries(input: string) {
  const lines = input
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 15);
  // Bounded requirement queries avoid one long job description drowning out individual needs.
  return [
    ...new Set([
      input.slice(0, 1500),
      ...lines.map((line) => line.slice(0, 700)),
    ]),
  ].slice(0, 5);
}
