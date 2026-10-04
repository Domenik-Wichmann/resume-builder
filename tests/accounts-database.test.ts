import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { primaryAccountId } from "../src/lib/account-id";
let db: PGlite;
let accountB: string;
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const name of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [userA, userB]);
  await db.query("select bootstrap_account($1,true)", [userA]);
  accountB = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) as id", [
      userB,
    ])
  ).rows[0].id;
  await db.query(
    "insert into projects(account_id,slug,title,summary,is_public) values($1,'same-key','A','A private data',true),($2,'same-key','B','B private data',true)",
    [primaryAccountId, accountB],
  );
});
afterAll(async () => {
  await db?.close();
});
async function asUser<T>(id: string, run: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
it("bootstraps each verified user idempotently without duplicate accounts", async () => {
  expect(
    (
      await db.query<{ id: string }>(
        "select bootstrap_account($1,true) as id",
        [userA],
      )
    ).rows[0].id,
  ).toBe(primaryAccountId);
  expect(
    (
      await db.query<{ id: string }>(
        "select bootstrap_account($1,false) as id",
        [userB],
      )
    ).rows[0].id,
  ).toBe(accountB);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::integer as count from account_members",
      )
    ).rows[0].count,
  ).toBe(2);
  await asUser(userB, async () => {
    await expect(
      db.query("select bootstrap_account($1,true)", [userB]),
    ).rejects.toThrow("permission denied");
  });
});
it("isolates even published records by membership and rejects cross-tenant writes", async () => {
  await asUser(userA, async () => {
    expect(
      (
        await db.query<{ title: string }>("select title from projects")
      ).rows.map((row) => row.title),
    ).toEqual(["A"]);
    await expect(
      db.query(
        "insert into skills(account_id,slug,name) values($1,'sql','SQL')",
        [accountB],
      ),
    ).rejects.toThrow("row-level security");
    expect(
      (
        await db.query(
          "update projects set summary='stolen' where account_id=$1 returning id",
          [accountB],
        )
      ).rows,
    ).toHaveLength(0);
  });
  await db.exec("set role anon");
  try {
    await expect(db.query("select * from projects")).rejects.toThrow(
      "permission denied",
    );
  } finally {
    await db.exec("reset role");
  }
  await db.query(
    "insert into skills(account_id,slug,name) values($1,'sql','SQL')",
    [accountB],
  );
  await expect(
    db.query(
      "insert into project_skills(account_id,project_id,skill_id) select $1,p.id,s.id from projects p,skills s where p.account_id=$1 and s.account_id=$2",
      [primaryAccountId, accountB],
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_REFERENCE");
});
it("scopes semantic search to the requested account and denies public RPC execution", async () => {
  const vectorText = JSON.stringify([1, ...Array(1023).fill(0)]);
  await db.query(
    "insert into career_embeddings(account_id,project_id,content,content_hash,embedding,embedding_model) select account_id,id,title,repeat('a',64),$1::extensions.vector,'embed-v4.0' from projects",
    [vectorText],
  );
  const result = await db.query<{ entity_id: string }>(
    "select * from match_account_embeddings($1,$2::extensions.vector,'embed-v4.0')",
    [primaryAccountId, vectorText],
  );
  expect(result.rows).toHaveLength(1);
  await asUser(userB, async () => {
    await expect(
      db.query(
        "select * from match_account_embeddings($1,$2::extensions.vector,'embed-v4.0')",
        [primaryAccountId, vectorText],
      ),
    ).rejects.toThrow("permission denied");
  });
});
it("applies reviewed facts privately with stable UUIDs, rejects stale drafts and archives instead of deleting", async () => {
  const source = (
    await db.query<{ id: string }>(
      "insert into career_sources(account_id,kind,content,content_hash) values($1,'MASTER','Built a reviewed tool',repeat('b',64)) returning id",
      [accountB],
    )
  ).rows[0].id;
  async function batch() {
    return (
      await db.query<{ id: string }>(
        "insert into career_imports(account_id,source_id,candidates,model) values($1,$2,'[]','test-model') returning id",
        [accountB, source],
      )
    ).rows[0].id;
  }
  const patch = {
    kind: "project",
    key: "reviewed-tool",
    title: "Reviewed tool",
    subtitle: "",
    summary: "Built a reviewed tool",
    source_quote: "Built a reviewed tool",
    hash: "c".repeat(64),
    baseline_hash: null,
    baseline_version: null,
    action: "UPSERT",
    skill_keys: [],
  };
  const id = await batch();
  await asUser(userB, async () => {
    expect(
      (
        await db.query<{ count: number }>(
          "select apply_career_import($1,$2::jsonb) as count",
          [id, JSON.stringify([patch])],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  const first = (
    await db.query<{
      id: string;
      is_public: boolean;
      semantic_hash: string;
      updated_at: string;
    }>("select * from projects where account_id=$1 and slug='reviewed-tool'", [
      accountB,
    ])
  ).rows[0];
  expect(first.is_public).toBe(false);
  const stale = await batch();
  await expect(
    asUser(userB, () =>
      db.query("select apply_career_import($1,$2::jsonb)", [
        stale,
        JSON.stringify([patch]),
      ]),
    ),
  ).rejects.toThrow("STALE_IMPORT");
  const archive = await batch();
  await asUser(userB, () =>
    db.query("select apply_career_import($1,$2::jsonb)", [
      archive,
      JSON.stringify([
        {
          ...patch,
          action: "ARCHIVE",
          baseline_hash: first.semantic_hash,
          baseline_version: first.updated_at,
        },
      ]),
    ]),
  );
  const archived = (
    await db.query<{ id: string; archived_at: string }>(
      "select id,archived_at from projects where account_id=$1 and slug='reviewed-tool'",
      [accountB],
    )
  ).rows[0];
  expect(archived.id).toBe(first.id);
  expect(archived.archived_at).toBeTruthy();
  const foreign = await batch();
  await expect(
    asUser(userA, () =>
      db.query("select apply_career_import($1,'[]'::jsonb)", [foreign]),
    ),
  ).rejects.toThrow("IMPORT_NOT_DRAFT");
});
it("rolls back the entire import when an accepted relation is invalid", async () => {
  const source = (
    await db.query<{ id: string }>(
      "select id from career_sources where account_id=$1 limit 1",
      [accountB],
    )
  ).rows[0].id;
  const batch = (
    await db.query<{ id: string }>(
      "insert into career_imports(account_id,source_id,candidates,model) values($1,$2,'[]','test-model') returning id",
      [accountB, source],
    )
  ).rows[0].id;
  const patch = {
    kind: "project",
    key: "rollback-tool",
    title: "Tool",
    subtitle: "",
    summary: "Fact",
    source_quote: "Fact",
    hash: "d".repeat(64),
    baseline_hash: null,
    baseline_version: null,
    action: "UPSERT",
    skill_keys: ["missing-skill"],
  };
  await expect(
    asUser(userB, () =>
      db.query("select apply_career_import($1,$2::jsonb)", [
        batch,
        JSON.stringify([patch]),
      ]),
    ),
  ).rejects.toThrow("MISSING_SKILL_REFERENCE");
  expect(
    (await db.query("select id from projects where slug='rollback-tool'")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from career_imports where id=$1",
        [batch],
      )
    ).rows[0].status,
  ).toBe("DRAFT");
});
it("resolves accepted skills, categories and achievements within one account transaction", async () => {
  const source = (
    await db.query<{ id: string }>(
      "select id from career_sources where account_id=$1 limit 1",
      [accountB],
    )
  ).rows[0].id;
  const batch = (
    await db.query<{ id: string }>(
      "insert into career_imports(account_id,source_id,candidates,model) values($1,$2,'[]','test-model') returning id",
      [accountB, source],
    )
  ).rows[0].id;
  const base = {
    subtitle: "",
    summary: "Reviewed evidence",
    source_quote: "Reviewed evidence",
    hash: "e".repeat(64),
    baseline_hash: null,
    baseline_version: null,
    action: "UPSERT",
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
  };
  const patches = [
    {
      ...base,
      kind: "project",
      key: "linked-project",
      title: "Linked project",
      skill_keys: ["linked-skill"],
      achievement_keys: ["linked-result"],
    },
    {
      ...base,
      kind: "skill",
      key: "linked-skill",
      title: "Skill",
      category_key: "linked-category",
    },
    { ...base, kind: "achievement", key: "linked-result", title: "Result" },
    { ...base, kind: "category", key: "linked-category", title: "Category" },
  ];
  await asUser(userB, () =>
    db.query("select apply_career_import($1,$2::jsonb)", [
      batch,
      JSON.stringify(patches),
    ]),
  );
  expect(
    (
      await db.query(
        "select s.id from skills s join skill_categories c on c.id=s.category_id where s.account_id=$1 and s.slug='linked-skill' and c.slug='linked-category'",
        [accountB],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select ps.skill_id from project_skills ps join projects p on p.id=ps.project_id where p.account_id=$1 and p.slug='linked-project'",
        [accountB],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select pa.achievement_id from project_achievements pa join projects p on p.id=pa.project_id where p.account_id=$1 and p.slug='linked-project'",
        [accountB],
      )
    ).rows,
  ).toHaveLength(1);
});
