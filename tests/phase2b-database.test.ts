import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { primaryAccountId as a } from "../src/lib/account-id";
let db: PGlite, b: string, projectA: string, projectB: string, skillB: string;
const userA = randomUUID(),
  userB = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const name of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [userA, userB]);
  await db.query("select bootstrap_account($1,true)", [userA]);
  b = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      userB,
    ])
  ).rows[0].id;
  projectA = (
    await db.query<{ id: string }>(
      "insert into projects(account_id,slug,title,summary,is_public) values($1,'qa-a','A','Private A',true) returning id",
      [a],
    )
  ).rows[0].id;
  projectB = (
    await db.query<{ id: string }>(
      "insert into projects(account_id,slug,title,summary,is_public) values($1,'qa-b','B','Private B',true) returning id",
      [b],
    )
  ).rows[0].id;
  skillB = (
    await db.query<{ id: string }>(
      "insert into skills(account_id,slug,name) values($1,'qa-skill','Skill B') returning id",
      [b],
    )
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
async function asUser<T>(user: string, fn: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
it("saves projects atomically, checks versions and prevents cross-account canonical links", async () => {
  const version = (
    await db.query<{ updated_at: string }>(
      "select updated_at from projects where id=$1",
      [projectA],
    )
  ).rows[0].updated_at;
  const input = {
    id: projectA,
    baseline_version: version,
    title: "A edited",
    slug: "qa-a",
    subtitle: "",
    summary: "Owner summary",
    description: "# Reviewed description",
    organization: null,
    start_date: null,
    end_date: null,
    status: "ACTIVE",
    featured: true,
    is_public: true,
    archived: false,
    display_order: 1,
    skill_ids: [skillB],
    achievement_ids: [],
    links: [],
  };
  await expect(
    asUser(userA, () =>
      db.query("select save_project($1,$2::jsonb,$3)", [
        a,
        JSON.stringify(input),
        "f".repeat(64),
      ]),
    ),
  ).rejects.toThrow("INVALID_SKILL");
  expect(
    (
      await db.query<{ title: string }>(
        "select title from projects where id=$1",
        [projectA],
      )
    ).rows[0].title,
  ).toBe("A");
  input.skill_ids = [];
  await asUser(userA, () =>
    db.query("select save_project($1,$2::jsonb,$3)", [
      a,
      JSON.stringify(input),
      "f".repeat(64),
    ]),
  );
  await expect(
    asUser(userA, () =>
      db.query("select save_project($1,$2::jsonb,$3)", [
        a,
        JSON.stringify({ ...input, title: "stale" }),
        "a".repeat(64),
      ]),
    ),
  ).rejects.toThrow("STALE_PROJECT");
  await expect(
    asUser(userB, () =>
      db.query("select save_project($1,$2::jsonb,$3)", [
        a,
        JSON.stringify(input),
        "f".repeat(64),
      ]),
    ),
  ).rejects.toThrow("ACCOUNT_FORBIDDEN");
});
it("isolates media/links and enforces tenant storage prefixes and one cover", async () => {
  await expect(
    db.query(
      "insert into project_links(account_id,project_id,label,link_type,url) values($1,$2,'Link','OTHER','https://example.com')",
      [a, projectB],
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_REFERENCE");
  await expect(
    db.query(
      "insert into project_media(account_id,project_id,storage_path,mime_type,alt) values($1,$2,'other/path','image/png','Alt')",
      [a, projectA],
    ),
  ).rejects.toThrow("check constraint");
  await db.query(
    "insert into project_media(account_id,project_id,storage_path,mime_type,alt,is_cover) values($1,$2,$3,'image/png','Alt',true)",
    [a, projectA, `${a}/${projectA}/cover.png`],
  );
  await expect(
    db.query(
      "insert into project_media(account_id,project_id,storage_path,mime_type,alt,is_cover) values($1,$2,$3,'image/png','Other',true)",
      [a, projectA, `${a}/${projectA}/other.png`],
    ),
  ).rejects.toThrow("unique constraint");
  await asUser(userB, async () =>
    expect((await db.query("select * from project_media")).rows).toHaveLength(
      0,
    ),
  );
});
it("marks direct-source cards stale on content, publication and relationship changes", async () => {
  const card = (
    await db.query<{ id: string }>(
      "insert into answer_cards(account_id,slug,question,answer,is_public) values($1,'qa-answer','What was built?','Owner answer',true) returning id",
      [a],
    )
  ).rows[0].id;
  await db.query(
    "insert into answer_card_sources(account_id,card_id,project_id) values($1,$2,$3)",
    [a, card, projectA],
  );
  const stale = async () =>
    expect(
      (
        await db.query<{ stale: boolean }>(
          "select stale from answer_cards where id=$1",
          [card],
        )
      ).rows[0].stale,
    ).toBe(true);
  await db.query(
    "update projects set description='Changed evidence' where id=$1",
    [projectA],
  );
  await stale();
  await db.query("update answer_cards set stale=false where id=$1", [card]);
  await db.query("update projects set is_public=false where id=$1", [projectA]);
  await stale();
  await db.query("update answer_cards set stale=false where id=$1", [card]);
  const skill = (
    await db.query<{ id: string }>(
      "insert into skills(account_id,slug,name) values($1,'qa-a-skill','A skill') returning id",
      [a],
    )
  ).rows[0].id;
  await db.query(
    "insert into project_skills(account_id,project_id,skill_id) values($1,$2,$3)",
    [a, projectA, skill],
  );
  await stale();
  await expect(
    db.query(
      "insert into answer_card_sources(account_id,card_id,project_id) values($1,$2,$3)",
      [a, card, projectB],
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_REFERENCE");
  await asUser(userB, async () =>
    expect((await db.query("select * from answer_cards")).rows).toHaveLength(0),
  );
});
it("saves reviewed answers privately and rolls back foreign sources", async () => {
  const card = {
    id: null,
    slug: "manual",
    question: "Question?",
    answer: "Reviewed answer",
    display_priority: 0,
    review_days: 90,
    generated: false,
  };
  const saved = await asUser(userB, () =>
    db.query<{ id: string }>(
      "select save_answer_card($1,$2::jsonb,$3::jsonb) id",
      [
        b,
        JSON.stringify(card),
        JSON.stringify([{ kind: "project", id: projectB }]),
      ],
    ),
  );
  expect(
    (
      await db.query<{ is_public: boolean }>(
        "select is_public from answer_cards where id=$1",
        [saved.rows[0].id],
      )
    ).rows[0].is_public,
  ).toBe(false);
  await expect(
    asUser(userB, () =>
      db.query("select save_answer_card($1,$2::jsonb,$3::jsonb)", [
        b,
        JSON.stringify({ ...card, slug: "foreign" }),
        JSON.stringify([{ kind: "project", id: projectA }]),
      ]),
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_REFERENCE");
  expect(
    (await db.query("select id from answer_cards where slug='foreign'")).rows,
  ).toHaveLength(0);
});
it("balances A/B/C assignments and preserves immutable snapshots and manual outcomes", async () => {
  const exp = (
    await asUser(userB, () =>
      db.query<{ id: string }>(
        "select create_resume_experiment($1,'QA experiment','DATA','US') id",
        [b],
      ),
    )
  ).rows[0].id;
  await db.query("update resume_experiments set status='RUNNING' where id=$1", [
    exp,
  ]);
  const options = {
    TRADITIONAL: { summary: "Historical A" },
    PROJECT_FORWARD: { summary: "Historical B" },
    OUTCOME_FORWARD: { summary: "Historical C" },
  };
  const apps: string[] = [];
  for (let i = 0; i < 7; i++) {
    const preview = (
      await db.query<{ id: string }>(
        "insert into application_previews(account_id,organization,role,job_description,metadata,resume_options) values($1,'Synthetic','Role','QA job', $2::jsonb,$3::jsonb) returning id",
        [
          b,
          JSON.stringify({ job_family: "DATA", market: "US" }),
          JSON.stringify(options),
        ],
      )
    ).rows[0].id;
    const app = (
      await asUser(userB, () =>
        db.query<{ id: string }>("select finalize_application($1,$2,$3) id", [
          b,
          preview,
          `qaCode0${i}`,
        ]),
      )
    ).rows[0].id;
    apps.push(app);
    expect(
      (
        await asUser(userB, () =>
          db.query<{ id: string }>("select finalize_application($1,$2,$3) id", [
            b,
            preview,
            `other00${i}`,
          ]),
        )
      ).rows[0].id,
    ).toBe(app);
  }
  const counts = (
    await db.query<{ count: number }>(
      "select count(*)::integer count from application_snapshots where experiment_id=$1 group by variant_id order by count",
      [exp],
    )
  ).rows.map((r) => r.count);
  expect(counts).toEqual([2, 2, 3]);
  await expect(
    db.query(
      "update application_snapshots set resume_ir='{}' where application_id=$1",
      [apps[0]],
    ),
  ).rejects.toThrow("IMMUTABLE_SNAPSHOT");
  await expect(
    db.query(
      "update experiment_variants set strategy='OTHER' where experiment_id=$1",
      [exp],
    ),
  ).rejects.toThrow("VARIANT_HAS_SNAPSHOTS");
  await expect(
    asUser(userB, () =>
      db.query("select record_application_outcome($1,'OFFER')", [apps[0]]),
    ),
  ).rejects.toThrow("INVALID_OUTCOME_TRANSITION");
  await asUser(userB, () =>
    db.query("select record_application_outcome($1,'SENT')", [apps[0]]),
  );
  await asUser(userB, () =>
    db.query("select record_application_outcome($1,'INTERVIEW')", [apps[0]]),
  );
  expect(
    (
      await db.query<{ status: string }>(
        "select status from application_outcomes where application_id=$1 order by created_at,id",
        [apps[0]],
      )
    ).rows
      .map((r) => r.status)
      .sort(),
  ).toEqual(["DRAFT", "INTERVIEW", "SENT"]);
  await asUser(userA, async () =>
    expect(
      (await db.query("select * from application_snapshots")).rows,
    ).toHaveLength(0),
  );
});
it("enforces visitor spacing, concurrency, daily and rolling-week limits in the database", async () => {
  const visitor = randomUUID();
  await db.query(
    "insert into anonymous_visitors(id,account_id) values($1,$2)",
    [visitor, a],
  );
  const reserve = async () =>
    (
      await db.query<{ result: string }>(
        "select reserve_visitor_ai($1,$2,null,'ask',5,25,50) result",
        [a, visitor],
      )
    ).rows[0].result;
  expect(await reserve()).toBe("OK");
  expect(await reserve()).toBe("CONCURRENT");
  await db.query(
    "update anonymous_visitors set ai_lease_until=null where id=$1",
    [visitor],
  );
  expect(await reserve()).toBe("SPACING");
  await db.query(
    "update visitor_ai_operations set created_at=now()-interval '5 seconds' where visitor_id=$1",
    [visitor],
  );
  expect(await reserve()).toBe("OK");
  await db.query(
    "update anonymous_visitors set ai_lease_until=null where id=$1",
    [visitor],
  );
  await db.query("delete from visitor_ai_operations where visitor_id=$1", [
    visitor,
  ]);
  await db.query(
    "insert into visitor_ai_operations(account_id,visitor_id,operation,created_at) select $1,$2,'ask',now()-interval '10 seconds' from generate_series(1,25)",
    [a, visitor],
  );
  expect(await reserve()).toBe("DAILY");
  await db.query("delete from visitor_ai_operations where visitor_id=$1", [
    visitor,
  ]);
  await db.query(
    "insert into visitor_ai_operations(account_id,visitor_id,operation,created_at) select $1,$2,'ask',now()-interval '2 days' from generate_series(1,50)",
    [a, visitor],
  );
  expect(await reserve()).toBe("WEEKLY");
  await db.query(
    "update visitor_ai_operations set created_at=now()-interval '8 days' where visitor_id=$1",
    [visitor],
  );
  expect(await reserve()).toBe("OK");
  expect(
    (
      await db.query<{ result: string }>(
        "select reserve_visitor_ai($1,$2,null,'ask') result",
        [b, visitor],
      )
    ).rows[0].result,
  ).toBe("VISITOR_REQUIRED");
  await asUser(userA, async () => {
    await expect(
      db.query("select reserve_visitor_ai($1,$2,null,'ask')", [a, visitor]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "update anonymous_visitors set verified_until=now()+interval '1 year'",
      ),
    ).rejects.toThrow("permission denied");
  });
});
it("keeps credits auditable, integer, idempotent, service-only and non-overdrawn", async () => {
  const grant = await db.query<{ id: string }>(
    "select append_credit($1,1000000,'TRIAL_GRANT','one-trial',null,now()+interval '30 days') id",
    [b],
  );
  expect(
    (
      await db.query<{ id: string }>(
        "select append_credit($1,1000000,'TRIAL_GRANT','one-trial') id",
        [b],
      )
    ).rows[0].id,
  ).toBe(grant.rows[0].id);
  await expect(
    db.query("select append_credit($1,100,'TRIAL_GRANT','another-trial')", [b]),
  ).rejects.toThrow("unique constraint");
  const usage = (
    await db.query<{ id: string }>(
      "insert into provider_usage_events(account_id,provider,model,operation_type,status) values($1,'COHERE','embed-v4.0','QA','SUCCESS') returning id",
      [b],
    )
  ).rows[0].id;
  await db.query("select append_credit($1,-123456,'AI_USAGE','usage',$2)", [
    b,
    usage,
  ]);
  expect(
    (
      await db.query<{ balance: bigint }>("select credit_balance($1) balance", [
        b,
      ])
    ).rows[0].balance.toString(),
  ).toBe("876544");
  await expect(
    db.query(
      "select append_credit($1,-900000,'ADMIN_ADJUSTMENT','overdraft')",
      [b],
    ),
  ).rejects.toThrow("INSUFFICIENT_CREDIT");
  await expect(
    db.query("update credit_transactions set amount_micro=5"),
  ).rejects.toThrow("IMMUTABLE_SNAPSHOT");
  await asUser(userB, async () => {
    await expect(
      db.query("select append_credit($1,100,'PROMOTIONAL_GRANT','fake')", [b]),
    ).rejects.toThrow("permission denied");
  });
  await asUser(userA, async () => {
    expect(
      (await db.query("select * from credit_transactions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from provider_usage_events")).rows,
    ).toHaveLength(0);
  });
});
it("denies anonymous direct access to every new account-owned table", async () => {
  await db.exec("set role anon");
  try {
    for (const table of [
      "project_links",
      "project_media",
      "answer_cards",
      "answer_card_sources",
      "explorer_events",
      "resume_experiments",
      "experiment_variants",
      "application_previews",
      "application_snapshots",
      "application_outcomes",
      "visitor_ai_operations",
      "provider_usage_events",
      "credit_transactions",
    ])
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        "permission denied",
      );
  } finally {
    await db.exec("reset role");
  }
});
