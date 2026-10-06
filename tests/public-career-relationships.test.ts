import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrain } from "../src/lib/career-brain/repository";
import { loadCanonical } from "../src/lib/ingestion/repository";
import { semanticHash } from "../src/lib/ingestion/diff";

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>) {
  return {
    rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
    from(table: string) {
      let rows = tables[table] || [];
      const query = {
        error: null,
        get data() {
          return rows;
        },
        select: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[key]));
          return query;
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

it("verifies public evidence against complete account-scoped relationships, including private and archived links", async () => {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const common = {
    account_id: "owner",
    is_public: true,
    archived_at: null,
    updated_at: "2026-10-06T00:00:00Z",
    source_quote: "Synthetic fixture: I built checks.",
  };
  const tables: Record<string, Row[]> = {
    projects: [
      {
        ...common,
        id: "project",
        slug: "checks",
        title: "Checks",
        summary: "Built checks",
      },
      { ...common, id: "private-project", slug: "private", is_public: false },
      { ...common, id: "foreign-project", account_id: "other" },
    ],
    skills: [
      {
        ...common,
        id: "private-skill",
        slug: "sql",
        name: "SQL",
        description: "SQL checks",
        category_id: "private-category",
        is_public: false,
      },
      {
        ...common,
        id: "public-skill",
        slug: "testing",
        name: "Testing",
        description: "Tests",
        category_id: "private-category",
      },
      { ...common, id: "foreign-skill", slug: "foreign", account_id: "other" },
    ],
    skill_categories: [
      {
        ...common,
        id: "private-category",
        slug: "engineering",
        title: "Engineering",
        summary: "Engineering",
        is_public: false,
      },
    ],
    achievements: [
      {
        ...common,
        id: "archived-achievement",
        slug: "checks-delivered",
        archived_at: "2026-10-05T00:00:00Z",
      },
    ],
    project_skills: [
      { account_id: "owner", project_id: "project", skill_id: "private-skill" },
      { account_id: "owner", project_id: "project", skill_id: "foreign-skill" },
    ],
    project_achievements: [
      {
        account_id: "owner",
        project_id: "project",
        achievement_id: "archived-achievement",
      },
    ],
    career_sources: [
      { account_id: "owner", id: sourceId, evidence_text: common.source_quote },
    ],
  };
  const db = database(tables);
  const canonical = await loadCanonical(db, "owner");
  for (const table of ["projects", "skills"])
    for (const row of tables[table]) {
      const record = canonical.find((record) => record.id === row.id);
      if (record) row.semantic_hash = semanticHash(record);
    }
  tables.career_record_evidence = canonical.map((record) => ({
    account_id: "owner",
    kind: record.kind,
    entity_id: record.id,
    canonical_hash: semanticHash(record),
    aliases: [],
    claims: [
      {
        attribute: "action",
        value: "Built checks",
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [
          {
            quote: common.source_quote,
            start: 0,
            end: common.source_quote.length,
            source_id: sourceId,
          },
        ],
      },
    ],
  }));
  const records = await loadBrain(db, "owner", true);
  expect(records.map((record) => record.id)).toEqual([
    "project",
    "public-skill",
  ]);
  expect(records[0].skill_keys).toEqual(["sql"]);
  expect(records[0].achievement_keys).toEqual(["checks-delivered"]);
  expect(records[1].category_key).toBe("engineering");
  expect(
    records.every((record) => record.claims[0]?.availability === "CONFIRMED"),
  ).toBe(true);

  // Actual relationship edits must still invalidate old approved evidence.
  tables.project_skills = [];
  expect((await loadBrain(database(tables), "owner", true))[0].claims).toEqual(
    [],
  );
});
