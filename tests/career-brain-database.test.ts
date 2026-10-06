import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { contentHash } from "../src/lib/embeddings/content";
import { publicSnapshot } from "../src/lib/career-brain/public-snapshot";
let db: PGlite;
const user = randomUUID(),
  otherUser = randomUUID();
let account: string, otherAccount: string;
let preservedSource: string;
it("serves one fresh service-only snapshot scoped to published, active account records and their sources", async () => {
  const visible = await createRecord();
  const hidden = await createRecord();
  await db.exec("reset role");
  await db.query("update projects set is_public=true where id=$1", [
    visible.row.id,
  ]);
  const read = async (tenant = account) =>
    publicSnapshot.parse(
      (
        await db.query<{ snapshot: unknown }>(
          "select read_public_career_snapshot($1) snapshot",
          [tenant],
        )
      ).rows[0].snapshot,
    );
  await db.exec("set role service_role");
  const snapshot = await read();
  expect(snapshot.canonical.some((r) => r.id === visible.row.id)).toBe(true);
  expect(snapshot.canonical.some((r) => r.id === hidden.row.id)).toBe(false);
  expect(snapshot.evidence.some((r) => r.entity_id === hidden.row.id)).toBe(
    false,
  );
  expect(snapshot.sources.some((s) => s.id === visible.source)).toBe(true);
  expect(snapshot.sources.some((s) => s.id === hidden.source)).toBe(false);
  expect(
    (await read(otherAccount)).canonical.some((r) => r.id === visible.row.id),
  ).toBe(false);
  await db.query("update projects set archived_at=now() where id=$1", [
    visible.row.id,
  ]);
  const archived = await read();
  expect(archived.canonical.some((r) => r.id === visible.row.id)).toBe(false);
  expect(archived.sources.some((s) => s.id === visible.source)).toBe(false);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await expect(read()).rejects.toThrow("permission denied");
  }
  await db.exec("reset role");
});
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (file === "202610050010_career_source_capacity.sql") {
      preservedSource = (
        await db.query<{ id: string }>(
          "insert into career_sources(account_id,kind,content,evidence_text,content_hash) values('00000000-0000-4000-8000-000000000001','MASTER','Existing source evidence','Existing source evidence',$1) returning id",
          [contentHash("Existing source evidence")],
        )
      ).rows[0].id;
    }
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.query("insert into auth.users values($1),($2)", [user, otherUser]);
  account = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      user,
    ])
  ).rows[0].id;
  otherAccount = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      otherUser,
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
async function draft(tenant = account, text = "I wrote SQL checks.") {
  const source = (
    await db.query<{ id: string }>(
      "insert into career_sources(account_id,kind,content,evidence_text,content_hash) values($1,'MASTER',$2,$2,repeat('a',64)) returning id",
      [tenant, text],
    )
  ).rows[0].id;
  const batch = (
    await db.query<{ id: string }>(
      "insert into career_imports(account_id,source_id,candidates,model) values($1,$2,'[]','test-source-reviewed') returning id",
      [tenant, source],
    )
  ).rows[0].id;
  return { source, batch };
}
function claim(source: string, availability = "CONFIRMED") {
  return {
    attribute: "action",
    value: "Wrote SQL checks",
    attribution: "PERSONAL",
    availability,
    evidence: [
      { quote: "I wrote SQL checks.", start: 0, end: 19, source_id: source },
    ],
  };
}
async function createRecord() {
  await member();
  const d = await draft();
  const key = `checks-${randomUUID().slice(0, 8)}`;
  const patch = {
    kind: "project",
    key,
    title: "Checks",
    subtitle: "",
    summary: "Wrote SQL checks",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: "I wrote SQL checks.",
    hash: "b".repeat(64),
    action: "UPSERT",
    baseline_hash: null,
    baseline_version: null,
  };
  const state = {
    kind: "project",
    key,
    aliases: [],
    claims: [claim(d.source)],
    baseline_hash: null,
    baseline_version: null,
    evidence_version: null,
  };
  await db.query("select apply_career_brain_import($1,$2::jsonb,$3::jsonb)", [
    d.batch,
    JSON.stringify([patch]),
    JSON.stringify([state]),
  ]);
  const row = (
    await db.query<{
      id: string;
      updated_at: string;
      source_id: string;
      semantic_hash: string;
    }>(
      "select id,updated_at::text,source_id,semantic_hash from projects where account_id=$1 and slug=$2",
      [account, key],
    )
  ).rows[0];
  const evidence = (
    await db.query<{ updated_at: string }>(
      "select updated_at::text from career_record_evidence where entity_id=$1",
      [row.id],
    )
  ).rows[0];
  return { ...d, key, row, evidence };
}
it("capacity migration preserves existing source identity, content and hash", async () => {
  await db.exec("reset role");
  const row = (
    await db.query<{
      id: string;
      content: string;
      evidence_text: string;
      content_hash: string;
    }>(
      "select id,content,evidence_text,content_hash from career_sources where id=$1",
      [preservedSource],
    )
  ).rows[0];
  expect(row).toEqual({
    id: preservedSource,
    content: "Existing source evidence",
    evidence_text: "Existing source evidence",
    content_hash: contentHash("Existing source evidence"),
  });
});
it.each([39999, 50543, 99999, 100000])(
  "stores intact %i-character source text, hashes and late proof transactionally",
  async (size) => {
    await member();
    const quote = "I wrote SQL checks.";
    const text =
      "Synthetic capacity fixture.\n".padEnd(size - quote.length, " ") + quote;
    const d = await draft(account, text);
    await db.query("update career_sources set content_hash=$1 where id=$2", [
      contentHash(text),
      d.source,
    ]);
    const key = `capacity-${size}`;
    const patch = {
      kind: "project",
      key,
      title: "Synthetic checks",
      subtitle: "",
      summary: "Wrote SQL checks",
      organization: null,
      start_date: null,
      end_date: null,
      skill_keys: [],
      achievement_keys: [],
      category_key: null,
      source_quote: quote,
      hash: "b".repeat(64),
      action: "UPSERT",
      baseline_hash: null,
      baseline_version: null,
    };
    const state = {
      kind: "project",
      key,
      aliases: [],
      claims: [
        {
          ...claim(d.source),
          evidence: [
            {
              quote,
              start: size - quote.length,
              end: size,
              source_id: d.source,
            },
          ],
        },
      ],
      baseline_hash: null,
      baseline_version: null,
      evidence_version: null,
    };
    await db.query("select apply_career_brain_import($1,$2::jsonb,$3::jsonb)", [
      d.batch,
      JSON.stringify([patch]),
      JSON.stringify([state]),
    ]);
    const stored = (
      await db.query<{
        content: string;
        evidence_text: string;
        content_hash: string;
      }>(
        "select content,evidence_text,content_hash from career_sources where id=$1",
        [d.source],
      )
    ).rows[0];
    expect(stored).toEqual({
      content: text,
      evidence_text: text,
      content_hash: contentHash(text),
    });
    const evidence = (
      await db.query<{ claims: typeof state.claims }>(
        "select claims from career_record_evidence where account_id=$1 and entity_id=(select id from projects where account_id=$1 and slug=$2)",
        [account, key],
      )
    ).rows[0].claims[0].evidence[0];
    expect(stored.evidence_text.slice(evidence.start, evidence.end)).toBe(
      quote,
    );
    expect(evidence.source_id).toBe(d.source);
  },
);
it("rejects either source column above 100,000 without writing a row", async () => {
  await member();
  for (const column of ["content", "evidence_text"]) {
    await expect(
      db.query(
        `insert into career_sources(account_id,kind,content,evidence_text,content_hash) values($1,'MANUAL',${column === "content" ? "$2" : "'short text'"},${column === "evidence_text" ? "$2" : "'short text'"},repeat('a',64))`,
        [account, "x".repeat(100001)],
      ),
    ).rejects.toThrow(/check constraint/);
  }
});
it("commits claim availability alone without rewriting a historical primary source or UUID", async () => {
  const first = await createRecord();
  const next = await draft(account, "A later revision needs review.");
  const state = {
    kind: "project",
    key: first.key,
    aliases: [],
    claims: [claim(first.source, "PENDING_REVIEW")],
    baseline_hash: first.row.semantic_hash,
    baseline_version: first.row.updated_at,
    evidence_version: first.evidence.updated_at,
  };
  await db.query("select apply_career_brain_import($1,'[]',$2::jsonb)", [
    next.batch,
    JSON.stringify([state]),
  ]);
  const row = (
    await db.query<{ id: string; source_id: string; updated_at: string }>(
      "select id,source_id,updated_at::text from projects where id=$1",
      [first.row.id],
    )
  ).rows[0];
  expect(row).toEqual({
    id: first.row.id,
    source_id: first.source,
    updated_at: first.row.updated_at,
  });
  expect(
    (
      await db.query<{ claims: { availability: string }[] }>(
        "select claims from career_record_evidence where entity_id=$1",
        [row.id],
      )
    ).rows[0].claims[0].availability,
  ).toBe("PENDING_REVIEW");
});
it("rolls back canonical changes and import status when evidence belongs to another tenant", async () => {
  await member(otherUser);
  const foreign = await draft(otherAccount);
  await member();
  const d = await draft();
  const key = `invalid-${randomUUID().slice(0, 8)}`;
  const patch = {
    kind: "project",
    key,
    title: "Invalid",
    subtitle: "",
    summary: "Wrote SQL checks",
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: "I wrote SQL checks.",
    hash: "b".repeat(64),
    action: "UPSERT",
    baseline_hash: null,
    baseline_version: null,
  };
  const state = {
    kind: "project",
    key,
    aliases: [],
    claims: [claim(foreign.source)],
    baseline_hash: null,
    baseline_version: null,
    evidence_version: null,
  };
  await expect(
    db.query("select apply_career_brain_import($1,$2::jsonb,$3::jsonb)", [
      d.batch,
      JSON.stringify([patch]),
      JSON.stringify([state]),
    ]),
  ).rejects.toThrow("INVALID_CLAIM_PROVENANCE");
  expect(
    (
      await db.query<{ status: string }>(
        "select status from career_imports where id=$1",
        [d.batch],
      )
    ).rows[0].status,
  ).toBe("DRAFT");
  expect(
    (await db.query("select id from projects where slug=$1", [key])).rows,
  ).toHaveLength(0);
});
it("rejects a stale metadata-only review without weakening canonical optimistic checks", async () => {
  const first = await createRecord();
  const one = await draft(),
    two = await draft();
  const state = {
    kind: "project",
    key: first.key,
    aliases: [],
    claims: [claim(first.source, "DISPUTED")],
    baseline_hash: first.row.semantic_hash,
    baseline_version: first.row.updated_at,
    evidence_version: first.evidence.updated_at,
  };
  await db.query("select apply_career_brain_import($1,'[]',$2::jsonb)", [
    one.batch,
    JSON.stringify([state]),
  ]);
  await expect(
    db.query("select apply_career_brain_import($1,'[]',$2::jsonb)", [
      two.batch,
      JSON.stringify([state]),
    ]),
  ).rejects.toThrow("STALE_EVIDENCE");
});
it("denies cross-tenant mutation, anonymous metadata reads and direct member writes", async () => {
  const first = await createRecord();
  const d = await draft();
  await member(otherUser);
  await expect(
    db.query("select apply_career_brain_import($1,'[]','[]')", [d.batch]),
  ).rejects.toThrow("NOT_ACCOUNT_MEMBER");
  expect(
    (
      await db.query(
        "select entity_id from career_record_evidence where entity_id=$1",
        [first.row.id],
      )
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query("delete from career_record_evidence where entity_id=$1", [
      first.row.id,
    ]),
  ).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select * from career_record_evidence"),
  ).rejects.toThrow();
  await db.exec("reset role");
});
