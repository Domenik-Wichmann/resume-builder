import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { semanticHash } from "../src/lib/ingestion/diff";
import { contentHash } from "../src/lib/embeddings/content";
import { prepareManualEdit } from "../src/lib/career-brain/record-management";
import {
  selectionFor,
  type RecordAction,
  type RecordEdit,
} from "../src/lib/career-brain/record-view";
import type { BrainRecord } from "../src/lib/career-brain/repository";
let db: PGlite, account: string, otherAccount: string;
const user = randomUUID(),
  other = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [user, other]);
  account = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      user,
    ])
  ).rows[0].id;
  otherAccount = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      other,
    ])
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
async function member(id = user) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function reload(row: BrainRecord) {
  const table = row.kind === "skill" ? "skills" : "projects";
  const current = (
    await db.query<{
      id: string;
      hash: string;
      updated_at: string;
      archived: boolean;
      published: boolean;
    }>(
      `select id,semantic_hash hash,updated_at::text,archived_at is not null archived,is_public published from ${table} where id=$1`,
      [row.id],
    )
  ).rows[0];
  const evidence = (
    await db.query<{ evidence_version: string }>(
      "select updated_at::text evidence_version from career_record_evidence where entity_id=$1",
      [row.id],
    )
  ).rows[0];
  return { ...row, ...current, ...evidence };
}
async function seed(
  kind: "project" | "skill" = "project",
  review: "CONFIRMED" | "PENDING_REVIEW" = "CONFIRMED",
  skillKeys: string[] = [],
) {
  await member();
  const text = "I wrote SQL checks.";
  const source = (
    await db.query<{ id: string }>(
      "insert into career_sources(account_id,kind,content,evidence_text,content_hash) values($1,'MANUAL',$2,$2,$3) returning id",
      [account, text, contentHash(text)],
    )
  ).rows[0].id;
  const batch = (
    await db.query<{ id: string }>(
      "insert into career_imports(account_id,source_id,candidates,model) values($1,$2,'[]','synthetic-test') returning id",
      [account, source],
    )
  ).rows[0].id;
  const candidate = {
    kind,
    key: `synthetic-${randomUUID().slice(0, 8)}`,
    title: "Synthetic SQL checks",
    subtitle: "",
    summary: "Wrote SQL checks",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: skillKeys,
    achievement_keys: [],
    category_key: null,
    source_quote: text,
    uncertainties: [],
  };
  const claim = {
    attribute: "action" as const,
    value: "Wrote SQL checks",
    attribution: "PERSONAL" as const,
    availability: review,
    evidence: [{ quote: text, start: 0, end: text.length, source_id: source }],
  };
  const hash = semanticHash(candidate);
  await db.query("select apply_career_brain_import($1,$2::jsonb,$3::jsonb)", [
    batch,
    JSON.stringify([
      {
        ...candidate,
        hash,
        action: "UPSERT",
        baseline_hash: null,
        baseline_version: null,
      },
    ]),
    JSON.stringify([
      {
        kind,
        key: candidate.key,
        aliases: [],
        claims: [claim],
        baseline_hash: null,
        baseline_version: null,
        evidence_version: null,
      },
    ]),
  ]);
  const table = kind === "skill" ? "skills" : "projects";
  const id = (
    await db.query<{ id: string }>(
      `select id from ${table} where account_id=$1 and slug=$2`,
      [account, candidate.key],
    )
  ).rows[0].id;
  return reload({
    ...candidate,
    id,
    hash,
    published: false,
    archived: false,
    updated_at: "",
    evidence_version: null,
    aliases: [],
    claims: [claim],
  });
}
async function batch(
  action: RecordAction,
  rows: BrainRecord[],
  tenant = account,
) {
  return db.query("select change_career_records($1,$2,$3::jsonb)", [
    tenant,
    action,
    JSON.stringify(rows.map(selectionFor)),
  ]);
}
function edit(row: BrainRecord): RecordEdit {
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
    note: "Owner confirms this explicit factual correction.",
    confirmed: true,
    description_attribution: "PERSONAL",
  };
}
async function save(
  row: BrainRecord,
  prepared: ReturnType<typeof prepareManualEdit>,
) {
  return db.query(
    "select save_career_record($1,$2::jsonb,$3,$4,$5,$6::jsonb,$7::jsonb)",
    [
      account,
      JSON.stringify(selectionFor(row)),
      prepared.sourceId,
      prepared.source,
      prepared.sourceHash,
      JSON.stringify(prepared.patch),
      JSON.stringify(prepared.state),
    ],
  );
}
it("publishes an approved multi-record selection atomically and keeps UUIDs and proof", async () => {
  const a = await seed(),
    b = await seed();
  await batch("publish", [a, b]);
  expect((await reload(a)).published).toBe(true);
  expect((await reload(b)).published).toBe(true);
  expect((await reload(a)).id).toBe(a.id);
  const evidence = (
    await db.query<{ claims: unknown }>(
      "select claims from career_record_evidence where entity_id=$1",
      [a.id],
    )
  ).rows[0].claims;
  expect(evidence).toEqual(a.claims);
});
it("rolls back every selected publication on a stale version or unreviewed record", async () => {
  const a = await seed(),
    b = await seed(),
    pending = await seed("project", "PENDING_REVIEW");
  await expect(
    batch("publish", [a, { ...b, updated_at: "2000-01-01T00:00:00Z" }]),
  ).rejects.toThrow("STALE_RECORD");
  expect((await reload(a)).published).toBe(false);
  await expect(batch("publish", [a, pending])).rejects.toThrow(
    "UNREVIEWED_RECORD",
  );
  expect((await reload(a)).published).toBe(false);
});
it("rejects a different account and anonymous function execution", async () => {
  const a = await seed();
  await expect(batch("publish", [a], otherAccount)).rejects.toThrow(
    "NOT_ACCOUNT_MEMBER",
  );
  await member(other);
  await expect(batch("publish", [a])).rejects.toThrow("NOT_ACCOUNT_MEMBER");
  await db.exec("reset role;set role anon");
  await expect(batch("publish", [a])).rejects.toThrow("permission denied");
  await member();
});
it("moves records to Trash, removes their vector, preserves links and source history, and restores privately", async () => {
  const skill = await seed("skill"),
    project = await seed("project", "CONFIRMED", [skill.key]);
  await batch("publish", [project]);
  const published = await reload(project);
  await db.exec("reset role");
  await db.query(
    "insert into career_embeddings(account_id,project_id,content,content_hash,embedding,embedding_model) values($1,$2,'synthetic',repeat('a',64),$3::extensions.vector,'synthetic')",
    [account, project.id, JSON.stringify(Array(1024).fill(0))],
  );
  await member();
  await batch("archive", [published]);
  const trashed = await reload(project);
  expect(trashed.archived).toBe(true);
  expect(trashed.published).toBe(false);
  expect(
    (
      await db.query("select * from project_skills where project_id=$1", [
        project.id,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select * from career_record_evidence where entity_id=$1",
        [project.id],
      )
    ).rows,
  ).toHaveLength(1);
  await db.exec("reset role");
  expect(
    (
      await db.query("select * from career_embeddings where entity_id=$1", [
        project.id,
      ])
    ).rows,
  ).toHaveLength(0);
  await member();
  await batch("restore", [trashed]);
  const restored = await reload(project);
  expect(restored.id).toBe(project.id);
  expect(restored.archived).toBe(false);
  expect(restored.published).toBe(false);
});
it("saves an owner correction with one atomic manual source/import while preserving historical claim spans and identity", async () => {
  const row = await seed();
  await batch("publish", [row]);
  const current = await reload(row);
  const changes = edit(current);
  changes.title = "Renamed validation checks";
  changes.claims[0].value = "Designed and wrote SQL validation checks";
  const prepared = prepareManualEdit(current, changes, [current]);
  await save(current, prepared);
  const canonical = (
    await db.query<{
      id: string;
      title: string;
      is_public: boolean;
      source_id: string;
    }>("select id,title,is_public,source_id from projects where id=$1", [
      row.id,
    ])
  ).rows[0];
  expect(canonical).toEqual({
    id: row.id,
    title: changes.title,
    is_public: false,
    source_id: prepared.sourceId,
  });
  const evidence = (
    await db.query<{ claims: BrainRecord["claims"] }>(
      "select claims from career_record_evidence where entity_id=$1",
      [row.id],
    )
  ).rows[0].claims;
  expect(evidence[0].availability).toBe("SUPERSEDED");
  expect(evidence[0].evidence).toEqual(row.claims[0].evidence);
  expect(
    prepared.source.slice(
      evidence[1].evidence[0].start!,
      evidence[1].evidence[0].end!,
    ),
  ).toBe(evidence[1].value);
  expect(
    (
      await db.query<{ status: string; reviewed_by: string }>(
        "select status,reviewed_by from career_imports where source_id=$1",
        [prepared.sourceId],
      )
    ).rows[0],
  ).toEqual({ status: "APPLIED", reviewed_by: user });
});
it("rolls back source and import creation if a relationship or optimistic evidence version fails", async () => {
  const row = await seed();
  const prepared = prepareManualEdit(row, edit(row), [row]);
  prepared.patch.skill_keys = ["missing-skill"];
  await expect(save(row, prepared)).rejects.toThrow("MISSING_SKILL_REFERENCE");
  expect(
    (
      await db.query("select * from career_sources where id=$1", [
        prepared.sourceId,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query("select * from career_imports where source_id=$1", [
        prepared.sourceId,
      ])
    ).rows,
  ).toHaveLength(0);
  const next = prepareManualEdit(row, edit(row), [row]);
  await expect(
    save({ ...row, evidence_version: "2000-01-01T00:00:00Z" }, next),
  ).rejects.toThrow("STALE_RECORD");
  expect(
    (
      await db.query("select * from career_sources where id=$1", [
        next.sourceId,
      ])
    ).rows,
  ).toHaveLength(0);
});
