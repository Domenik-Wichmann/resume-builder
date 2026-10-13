import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  analyticsReportSchema,
  type AnalyticsReport,
} from "../src/lib/analytics/report";
const account = "00000000-0000-4000-8000-000000000001",
  owner = randomUUID(),
  other = randomUUID();
let db: PGlite, otherAccount: string, us: string, bg: string, workspace: string;
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("select bootstrap_account($1,true)", [owner]);
  otherAccount = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      other,
    ])
  ).rows[0].id;
  const app = (
    await db.query<{ id: string }>(
      "insert into job_applications(account_id,organization,role,job_description,metadata) values($1,'Fictional employer','Fictional AI role','Explicit fictional fixture','{}') returning id",
      [account],
    )
  ).rows[0].id;
  us = (
    await db.query<{ id: string }>(
      "insert into tracking_links(account_id,application_id,code,label,market) values($1,$2,'demoLink','Fictional US application','US') returning id",
      [account, app],
    )
  ).rows[0].id;
  bg = (
    await db.query<{ id: string }>(
      "insert into tracking_links(account_id,code,label,market,active) values($1,'demoBGbg','Fictional BG application','BG',false) returning id",
      [account],
    )
  ).rows[0].id;
  const session = randomUUID();
  await db.query(
    "insert into tracking_events(account_id,link_id,session_id,event_type,page_path,contact_market,created_at) values($1,$2,$3,'page_view','/projects','US','2026-10-12T09:10:00Z'),($1,$2,$3,'page_view','/','US','2026-10-12T09:20:00Z'),($1,$4,$5,'page_view','/resume','BG','2026-10-12T22:00:00Z'),($1,null,$6,'page_view','/',null,'2026-10-13T02:00:00Z'),($1,$2,$3,'page_view','/','US','2026-10-10T09:00:00Z')",
    [account, us, session, bg, randomUUID(), randomUUID()],
  );
  const visitor = randomUUID();
  await db.query(
    "insert into anonymous_visitors(id,account_id) values($1,$2)",
    [visitor, account],
  );
  workspace = (
    await db.query<{ id: string }>(
      "insert into workspaces(account_id,visitor_id,tracking_link_id,market,title) values($1,$2,$3,'US','Fictional workspace') returning id",
      [account, visitor, us],
    )
  ).rows[0].id;
  const question = (
    await db.query<{ id: string }>(
      "insert into workspace_questions(account_id,workspace_id,question,answer,created_at) values($1,$2,'What supports RAG work?','Fictional answer, not owner evidence.','2026-10-12T09:30:00Z') returning id",
      [account, workspace],
    )
  ).rows[0].id;
  await db.query(
    "insert into question_topics(account_id,question_id,topic,evidence_strength) values($1,$2,'Embeddings','PARTIAL')",
    [account, question],
  );
  await db.query(
    "insert into workspace_events(account_id,workspace_id,event_type,created_at) values($1,$2,'created','2026-10-12T09:25:00Z'),($1,$2,'workspace_export','2026-10-12T10:00:00Z')",
    [account, workspace],
  );
});
afterAll(async () => {
  await db?.close();
});
async function member(user = owner) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function report(
  patch: Record<string, unknown> = {},
): Promise<AnalyticsReport> {
  const value = {
    from: "2026-10-12",
    to: "2026-10-13",
    hour_from: 0,
    hour_to: 23,
    code: null,
    region: null,
    source: null,
    event: null,
    page: null,
    status: null,
    active: null,
    search: null,
    offset: 0,
    ...patch,
  };
  const r = await db.query<{ value: unknown }>(
    "select owner_analytics_report($1,$2::date,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) value",
    [account, ...Object.values(value)],
  );
  return analyticsReportSchema.parse(r.rows[0].value);
}
it("aggregates exact counts across sources, joins question attribution, and does not count repeated page views as new sessions", async () => {
  await member();
  const data = await report();
  expect(data.totals).toMatchObject({
    activities: 7,
    views: 4,
    sessions: 3,
    questions: 1,
    workspace_starts: 1,
    exports: 1,
    tracked_views: 3,
  });
  expect(data.previous.views).toBe(1);
  expect(data.daily.map((day) => day.views)).toEqual([3, 1]);
  expect(data.hourly.find((hour) => hour.hour === 9)?.count).toBe(4);
  expect(data.tracking.find((link) => link.code === "demoLink")).toMatchObject({
    views: 2,
    sessions: 1,
    questions: 1,
    workspace_starts: 1,
    exports: 1,
  });
  expect(data.topics[0]).toMatchObject({ label: "Embeddings", partial: 1 });
});
it("combines date, hour, code, region, source, activity and literal search before counting", async () => {
  await member();
  const data = await report({
    hour_from: 9,
    hour_to: 9,
    code: "demoLink",
    region: "US",
    source: "tracked",
  });
  expect(data.totals.activities).toBe(4);
  expect(data.events.every((row) => row.code === "demoLink")).toBe(true);
  expect(
    (await report({ search: "Embeddings", event: "question" })).totals
      .questions,
  ).toBe(1);
  expect((await report({ search: "%" })).totals.activities).toBe(0);
  expect(
    (await report({ region: "unknown", source: "untracked" })).totals,
  ).toMatchObject({ views: 1, questions: 0 });
  expect((await report({ page: "/projects" })).totals.views).toBe(1);
  expect((await report({ active: false })).totals.views).toBe(1);
  expect((await report({ hour_from: 22, hour_to: 2 })).totals.views).toBe(2);
});
it("paginates the detail log without capping aggregate totals and preserves midnight boundaries", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into tracking_events(account_id,session_id,event_type,page_path,created_at) select $1,gen_random_uuid(),'page_view','/answers','2026-10-11T23:59:59Z' from generate_series(1,55)",
    [account],
  );
  await member();
  const data = await report({ from: "2026-10-11", to: "2026-10-11" });
  expect(data.totals.views).toBe(55);
  expect(data.events).toHaveLength(50);
  expect(
    (await report({ from: "2026-10-11", to: "2026-10-11", offset: 50 })).events,
  ).toHaveLength(5);
  expect((await report()).totals.views).toBe(4);
});
it("denies anonymous and cross-account reads of private questions and analytics", async () => {
  await member(other);
  await expect(report()).rejects.toThrow("ACCOUNT_FORBIDDEN");
  expect(
    (
      await db.query(
        "select * from owner_analytics_activity where account_id=$1",
        [account],
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role;set role anon");
  await expect(report()).rejects.toThrow("permission denied");
  await expect(
    db.query("select * from owner_analytics_activity"),
  ).rejects.toThrow("permission denied");
  await member();
  await expect(report({ hour_from: 24 })).rejects.toThrow(
    "INVALID_ANALYTICS_FILTER",
  );
  await expect(report({ from: "2026-01-01" })).rejects.toThrow(
    "INVALID_ANALYTICS_FILTER",
  );
});
it("records contact presentation while letting verified tracking context win, and leaves unknown history unknown", async () => {
  await db.exec("reset role");
  const session = randomUUID();
  await db.query("select record_portfolio_page_view($1,'/projects',$2,'BG')", [
    session,
    us,
  ]);
  const rows = await db.query<{ contact_market: string | null }>(
    "select contact_market from tracking_events where session_id=$1",
    [session],
  );
  expect(rows.rows[0].contact_market).toBe("US");
  const plain = randomUUID();
  await db.query("select record_portfolio_page_view($1,'/',null,'BG')", [
    plain,
  ]);
  expect(
    (
      await db.query<{ contact_market: string }>(
        "select contact_market from tracking_events where session_id=$1",
        [plain],
      )
    ).rows[0].contact_market,
  ).toBe("BG");
  expect(
    (
      await db.query(
        "select id from tracking_events where contact_market is null and created_at='2026-10-13T02:00:00Z'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(otherAccount).not.toBe(account);
});
