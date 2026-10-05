import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { semanticHash } from "../src/lib/ingestion/diff";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import {
  checkSelection,
  managementSchema,
  prepareManualEdit,
} from "../src/lib/career-brain/record-management";
import {
  connectedRecords,
  filterRecords,
  publishable,
  selectionFor,
  type RecordEdit,
} from "../src/lib/career-brain/record-view";
function record(
  kind: BrainRecord["kind"] = "project",
  title = "SQL checks",
): BrainRecord {
  const proof = {
    attribute: "action" as const,
    value: "Wrote SQL checks",
    attribution: "PERSONAL" as const,
    availability: "CONFIRMED" as const,
    evidence: [
      {
        quote: "I wrote SQL checks.",
        start: 0,
        end: 19,
        source_id: randomUUID(),
      },
    ],
  };
  const row = {
    id: randomUUID(),
    kind,
    key: "checks",
    title,
    subtitle: "",
    summary: "Wrote SQL checks",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [] as string[],
    achievement_keys: [] as string[],
    category_key: null,
    source_quote: "I wrote SQL checks.",
    uncertainties: [],
    aliases: [],
    claims: [proof],
    published: false,
    archived: false,
    hash: "",
    updated_at: "2026-10-05T00:00:00.000Z",
    evidence_version: "2026-10-05T00:00:00.000Z",
  };
  return { ...row, hash: semanticHash(row) };
}
function editFor(row: BrainRecord): RecordEdit {
  return {
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    organization: row.organization,
    start_date: row.start_date,
    end_date: row.end_date,
    skill_keys: row.skill_keys,
    achievement_keys: row.achievement_keys,
    category_key: row.category_key,
    aliases: row.aliases,
    claims: row.claims.map((c, index) => ({
      index,
      attribute: c.attribute,
      value: c.value,
      attribution: c.attribution,
      availability: c.availability,
      conflict: c.conflict || "",
    })),
    confirmed: true,
    note: "Correcting the owner-confirmed project details.",
    description_attribution: "PERSONAL",
  };
}
it("finds both directions of skill/category/achievement connections and filters actual record types", () => {
  const skill = { ...record("skill", "SQL"), key: "sql", category_key: "data" };
  const category = { ...record("category", "Data"), key: "data" };
  const project = {
    ...record(),
    skill_keys: ["sql"],
    organization: "Synthetic company",
  };
  const rows = [skill, category, project];
  expect(connectedRecords(skill, rows).map((r) => r.id)).toEqual([
    category.id,
    project.id,
  ]);
  expect(connectedRecords(category, rows).map((r) => r.id)).toEqual([skill.id]);
  const filters = {
    query: "synthetic company",
    kind: "project",
    status: "all",
    evidence: "ready",
    connections: "connected",
    sort: "name",
  };
  expect(filterRecords(rows, filters).map((r) => r.id)).toEqual([project.id]);
  expect(
    filterRecords([{ ...skill, archived: true }], {
      ...filters,
      query: "",
      kind: "skill",
      status: "trash",
      evidence: "all",
      connections: "all",
    }),
  ).toHaveLength(1);
});
it("keeps identity and original exact proof when only the name is corrected", () => {
  const row = record();
  const edit = { ...editFor(row), title: "SQL validation checks" };
  const result = prepareManualEdit(row, edit, [row]);
  expect(result.patch.key).toBe(row.key);
  expect(result.patch.hash).not.toBe(row.hash);
  expect(result.state.claims).toEqual(row.claims);
  expect(result.source).toContain(edit.note);
  expect(result.patch.source_quote).toBe("project: SQL validation checks");
});
it("preserves superseded historical proof and uses exact owner-source spans for corrected facts", () => {
  const row = record();
  const edit = editFor(row);
  edit.claims[0].value = "Designed and wrote SQL validation checks";
  const result = prepareManualEdit(row, edit, [row]);
  expect(result.state.claims[0].availability).toBe("SUPERSEDED");
  expect(result.state.claims[0].evidence).toEqual(row.claims[0].evidence);
  const proof = result.state.claims[1].evidence[0];
  expect(result.source.slice(proof.start!, proof.end!)).toBe(proof.quote);
  expect(proof.quote).toBe(edit.claims[0].value);
});
it("preserves pending credentials and cannot confirm an uncertain claim", () => {
  const row = record("certification", "Reported certificate");
  row.claims[0].attribution = "UNCERTAIN";
  row.claims[0].availability = "PENDING_REVIEW";
  const edit = editFor(row);
  expect(prepareManualEdit(row, edit, [row]).state.claims[0].availability).toBe(
    "PENDING_REVIEW",
  );
  expect(publishable(row)).toBe(false);
  edit.claims[0].availability = "CONFIRMED";
  expect(() => prepareManualEdit(row, edit, [row])).toThrow("uncertain");
});
it("requires explicit removal instead of silently dropping old evidence, and rejects duplicate claim references", () => {
  const row = record();
  expect(() =>
    prepareManualEdit(row, { ...editFor(row), claims: [] }, [row]),
  ).toThrow("historical");
  const edit = editFor(row);
  edit.claims.push(edit.claims[0]);
  expect(() => prepareManualEdit(row, edit, [row])).toThrow("more than once");
  edit.claims = [{ ...edit.claims[0], availability: "REMOVED" }];
  expect(prepareManualEdit(row, edit, [row]).state.claims[0].evidence).toEqual(
    row.claims[0].evidence,
  );
});
it("keeps UTF-16 evidence offsets exact without splitting emoji surrogate pairs", () => {
  const row = record();
  const edit = { ...editFor(row), summary: "x".repeat(499) + "🌱".repeat(260) };
  const result = prepareManualEdit(row, edit, [row]);
  const description = result.state.claims.filter(
    (c) => c.attribute === "context",
  );
  expect(description.map((c) => c.value).join("")).toBe(edit.summary);
  for (const claim of description) {
    expect(claim.value.length).toBeLessThanOrEqual(500);
    const proof = claim.evidence[0];
    expect(result.source.slice(proof.start!, proof.end!)).toBe(proof.quote);
    expect(claim.value).not.toMatch(/[\uD800-\uDBFF]$/);
  }
});
it("checks canonical and evidence versions and bounds selections; browser account IDs and keys are rejected", () => {
  const row = record();
  expect(() =>
    checkSelection([row], { ...selectionFor(row), evidence_version: null }),
  ).toThrow("another view");
  expect(
    managementSchema.safeParse({
      action: "publish",
      accountId: randomUUID(),
      records: [selectionFor(row)],
    }).success,
  ).toBe(false);
  expect(
    managementSchema.safeParse({
      action: "publish",
      records: Array.from({ length: 151 }, () => selectionFor(row)),
    }).success,
  ).toBe(false);
  expect(
    managementSchema.safeParse({
      action: "edit",
      record: { ...selectionFor(row), key: "forged-key" },
      edit: editFor(row),
    }).success,
  ).toBe(false);
});
it("rejects dangling connections and a personal description over a confirmed team result", () => {
  const row = record();
  expect(() =>
    prepareManualEdit(row, { ...editFor(row), skill_keys: ["missing"] }, [row]),
  ).toThrow("unavailable");
  row.claims[0].attribution = "TEAM";
  expect(() =>
    prepareManualEdit(
      row,
      { ...editFor(row), summary: "I achieved the whole result" },
      [row],
    ),
  ).toThrow("team attribution");
});

it("never considers empty or malformed evidence ready for publication", () => {
  const row = record();
  row.claims[0].evidence = [];
  expect(publishable(row)).toBe(false);
  row.claims[0].evidence = [{ quote: "", start: 0, end: 0 }];
  expect(publishable(row)).toBe(false);
  row.claims[0].evidence = [{ quote: "proof", start: -1, end: 4 }];
  expect(publishable(row)).toBe(false);
});
