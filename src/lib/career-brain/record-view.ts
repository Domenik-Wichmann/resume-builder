import type { BrainRecord } from "./repository";
import type { Candidate } from "../ingestion/model";
import {
  groupingKey,
  isLanguageCategory,
  languagesGroupId,
  sharedLanguages,
} from "../career/grouping";
export const kindLabels: Record<Candidate["kind"], string> = {
  profile: "Profile",
  experience: "Experiences",
  project: "Projects",
  achievement: "Achievements",
  skill: "Skills",
  education: "Education",
  certification: "Certifications",
  language: "Languages",
  category: "Skill categories",
};
export type SourceSummary = { id: string; kind: string; created_at: string };
export type ExplorerData = { records: BrainRecord[]; sources: SourceSummary[] };
export type RecordSelection = Pick<
  BrainRecord,
  "id" | "kind" | "hash" | "updated_at" | "evidence_version"
>;
export type RecordAction = "publish" | "unpublish" | "archive" | "restore";
export type ClaimEdit = {
  index: number | null;
  attribute: BrainRecord["claims"][number]["attribute"];
  value: string;
  attribution: BrainRecord["claims"][number]["attribution"];
  availability: BrainRecord["claims"][number]["availability"];
  conflict: string;
};
export type RecordEdit = Pick<
  Candidate,
  | "title"
  | "subtitle"
  | "summary"
  | "organization"
  | "start_date"
  | "end_date"
  | "skill_keys"
  | "achievement_keys"
  | "category_key"
> & {
  aliases: string[];
  claims: ClaimEdit[];
  note: string;
  confirmed: true;
  description_attribution: ClaimEdit["attribution"];
};
export const selectionFor = (row: BrainRecord): RecordSelection => ({
  id: row.id,
  kind: row.kind,
  hash: row.hash,
  updated_at: row.updated_at,
  evidence_version: row.evidence_version,
});
export function publishable(row: BrainRecord) {
  return (
    !row.archived &&
    row.claims.some(
      (c) =>
        c.availability === "CONFIRMED" &&
        !["NEGATED", "UNCERTAIN"].includes(c.attribution) &&
        c.evidence.length > 0 &&
        c.evidence.every(
          (s) =>
            s.start !== null &&
            s.end !== null &&
            s.start >= 0 &&
            s.quote.length > 0 &&
            s.end - s.start === s.quote.length,
        ),
    )
  );
}
export function connectedRecords(row: BrainRecord, records: BrainRecord[]) {
  const languageSkillKeys =
    row.kind === "language"
      ? new Set(
          records
            .filter(
              (other) =>
                other.kind === "skill" &&
                groupingKey(other.title) === groupingKey(row.title),
            )
            .map((other) => other.key),
        )
      : new Set<string>();
  return records.filter(
    (other) =>
      other.id !== row.id &&
      ((other.kind === "skill" &&
        (row.skill_keys.includes(other.key) ||
          languageSkillKeys.has(other.key))) ||
        other.skill_keys.some((key) => languageSkillKeys.has(key)) ||
        (row.kind === "skill" &&
          other.kind === "language" &&
          groupingKey(row.title) === groupingKey(other.title)) ||
        (other.kind === "achievement" &&
          row.achievement_keys.includes(other.key)) ||
        (other.kind === "category" && row.category_key === other.key) ||
        (row.kind === "skill" && other.skill_keys.includes(row.key)) ||
        (row.kind === "achievement" &&
          other.achievement_keys.includes(row.key)) ||
        (row.kind === "category" && other.category_key === row.key)),
  );
}
export type RecordFilters = {
  query: string;
  kind: string;
  status: string;
  evidence: string;
  connections: string;
  sort: string;
};
export type RecordGroup = { id: string; title: string; recordIds: string[] };
export function recordsForKind(
  rows: BrainRecord[],
  kind: string,
  allRecords = rows,
): BrainRecord[] {
  if (kind === "all") return rows;
  if (kind !== "skill" && kind !== "language")
    return rows.filter((row) => row.kind === kind);
  const categoryKeys = new Set(
    allRecords
      .filter((row) => row.kind === "category" && isLanguageCategory(row.title))
      .map((row) => row.key),
  );
  const skills = rows.filter((row) => row.kind === "skill");
  const languageRows = rows.filter((row) => row.kind === "language");
  const names = new Set(languageRows.map((row) => groupingKey(row.title)));
  const languageSkills = skills.filter(
    (row) =>
      names.has(groupingKey(row.title)) ||
      (row.category_key !== null && categoryKeys.has(row.category_key)),
  );
  const languages = sharedLanguages(languageRows, languageSkills);
  return kind === "language"
    ? languages
    : [...skills.filter((row) => !languageSkills.includes(row)), ...languages];
}
export function recordGroups(
  records: BrainRecord[],
  kind: string,
  allRecords = records,
): RecordGroup[] {
  if (
    ![
      "skill",
      "experience",
      "project",
      "achievement",
      "education",
      "certification",
    ].includes(kind)
  )
    return [];
  const groups = new Map<string, RecordGroup>();
  const languages =
    kind === "skill" ? recordsForKind(records, "language", allRecords) : [];
  if (languages.length)
    groups.set(languagesGroupId, {
      id: languagesGroupId,
      title: "Languages",
      recordIds: languages.map((record) => record.id),
    });
  const languageIds = new Set(languages.map((record) => record.id));
  for (const row of recordsForKind(records, kind, allRecords).filter(
    (row) => !languageIds.has(row.id),
  )) {
    const category =
      kind === "skill"
        ? allRecords.find(
            (record) =>
              record.kind === "category" && record.key === row.category_key,
          )
        : undefined;
    const title = kind === "skill" ? category?.title : row.organization?.trim();
    if (!title) continue;
    // Owner views retain archived category connections so they can be repaired.
    const id = category
      ? `category:${category.id}`
      : `organization:${groupingKey(title)}`;
    const group = groups.get(id) || {
      id,
      title: category?.archived ? `${title} (in Trash)` : title,
      recordIds: [],
    };
    group.recordIds.push(row.id);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
export function filterRecords(
  records: BrainRecord[],
  filters: RecordFilters,
  relationshipRecords = records,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return records
    .filter((row) => {
      const connections = connectedRecords(row, relationshipRecords).length;
      return (
        (filters.kind === "all" || row.kind === filters.kind) &&
        (filters.status === "trash"
          ? row.archived
          : !row.archived &&
            (filters.status === "all" ||
              (filters.status === "published"
                ? row.published
                : !row.published))) &&
        (filters.evidence === "all" ||
          (filters.evidence === "ready"
            ? publishable(row)
            : !publishable(row) ||
              row.claims.some((c) =>
                ["PENDING_REVIEW", "DISPUTED"].includes(c.availability),
              ))) &&
        (filters.connections === "all" ||
          (filters.connections === "connected"
            ? connections > 0
            : connections === 0)) &&
        (!query ||
          [
            row.title,
            row.subtitle,
            row.organization || "",
            row.summary,
            ...row.aliases,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query))
      );
    })
    .sort((a, b) =>
      filters.sort === "recent"
        ? b.updated_at.localeCompare(a.updated_at)
        : filters.sort === "connections"
          ? connectedRecords(b, relationshipRecords).length -
              connectedRecords(a, relationshipRecords).length ||
            a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
    );
}
