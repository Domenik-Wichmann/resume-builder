import type { BrainRecord } from "./repository";
import type { Candidate } from "../ingestion/model";
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
  return records.filter(
    (other) =>
      other.id !== row.id &&
      ((other.kind === "skill" && row.skill_keys.includes(other.key)) ||
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
export function filterRecords(records: BrainRecord[], filters: RecordFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return records
    .filter((row) => {
      const connections = connectedRecords(row, records).length;
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
          ? connectedRecords(b, records).length -
              connectedRecords(a, records).length ||
            a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
    );
}
