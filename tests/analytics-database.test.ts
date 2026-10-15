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
    country: null,
    device: null,
    browser: null,
    os: null,
    referrer: null,
    action: null,
    min_seconds: null,
    max_seconds: null,
    session: null,
    visitor: null,
    visitor_offset: 0,
    ...patch,
  };
  const r = await db.query<{ value: unknown }>(
    "select owner_analytics_report($1,$2::date,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) value",
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

async function activity(
  session: string,
  view: string,
  patch: Record<string, unknown> = {},
) {
  const values = {
    session,
    view,
    path: "/projects",
    kind: "page_view",
    link: us,
    market: "BG",
    country: "DE",
    device: "mobile",
    browser: "Safari",
    os: "iOS",
    referrer: "linkedin",
    action: null,
    seconds: null,
    scroll: null,
    visitor: null,
    workspace_visitor: null,
    ...patch,
  };
  return (
    await db.query<{ accepted: boolean }>(
      "select record_portfolio_activity($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) accepted",
      Object.values(values),
    )
  ).rows[0].accepted;
}
it("binds telemetry to its signed browser session and page, deduplicates mounts and clamps cumulative time without adding views", async () => {
  await db.exec("reset role");
  const session = randomUUID(),
    view = randomUUID();
  expect(await activity(session, view)).toBe(true);
  expect(await activity(session, view)).toBe(true);
  await expect(
    activity(session, randomUUID(), { path: "/admin" }),
  ).rejects.toThrow("INVALID_PORTFOLIO_EVENT");
  expect(await activity(randomUUID(), view)).toBe(false);
  expect(
    await activity(randomUUID(), view, {
      kind: "engagement",
      seconds: 10,
      scroll: 50,
    }),
  ).toBe(false);
  expect(
    await activity(session, view, {
      kind: "engagement",
      path: "/",
      seconds: 10,
      scroll: 50,
    }),
  ).toBe(false);
  expect(
    await activity(session, randomUUID(), {
      kind: "interaction",
      action: "email",
    }),
  ).toBe(false);
  await db.query(
    "update tracking_events set created_at=now()-interval '120 seconds' where id=$1",
    [view],
  );
  expect(
    await activity(session, view, {
      kind: "engagement",
      seconds: 60,
      scroll: 75,
    }),
  ).toBe(true);
  expect(
    await activity(session, view, {
      kind: "engagement",
      seconds: 30,
      scroll: 25,
    }),
  ).toBe(true);
  expect(
    (
      await db.query(
        "select active_seconds,scroll_depth,contact_market,visitor_country from tracking_events where id=$1",
        [view],
      )
    ).rows[0],
  ).toEqual({
    active_seconds: 60,
    scroll_depth: 75,
    contact_market: "US",
    visitor_country: "DE",
  });
  await expect(
    activity(session, view, {
      kind: "engagement",
      seconds: 14401,
      scroll: 100,
    }),
  ).rejects.toThrow("INVALID_ENGAGEMENT");
  await activity(session, view, {
    kind: "engagement",
    seconds: 14000,
    scroll: 100,
  });
  const time = (
    await db.query<{ active_seconds: number }>(
      "select active_seconds from tracking_events where id=$1",
      [view],
    )
  ).rows[0].active_seconds;
  expect(time).toBeGreaterThanOrEqual(120);
  expect(time).toBeLessThan(125);
  expect(
    await activity(session, view, {
      kind: "interaction",
      action: "email",
      country: "US",
      device: "desktop",
    }),
  ).toBe(true);
  expect(
    await activity(session, view, { kind: "interaction", action: "email" }),
  ).toBe(false);
  const clicks = (
    await db.query(
      "select visitor_country,device from tracking_events where page_view_id=$1",
      [view],
    )
  ).rows;
  expect(clicks).toEqual([{ visitor_country: "DE", device: "mobile" }]);
  expect(
    (
      await db.query("select id from tracking_events where session_id=$1", [
        session,
      ])
    ).rows,
  ).toHaveLength(2);
  await expect(
    activity(session, view, {
      kind: "interaction",
      action: "arbitrary private button text",
    }),
  ).rejects.toThrow();
});
it("applies visitor, action, duration and session filters before aggregation and pagination, preserving unknown history", async () => {
  await db.exec("reset role");
  const session = randomUUID(),
    first = randomUUID(),
    second = randomUUID();
  await activity(session, first);
  await activity(session, first, { kind: "interaction", action: "email" });
  await activity(session, second, { path: "/" });
  await activity(session, second, {
    path: "/",
    kind: "interaction",
    action: "project",
  });
  await db.query(
    "update tracking_events set created_at='2026-10-09T10:00:00Z',active_seconds=60,scroll_depth=75 where id=$1",
    [first],
  );
  await db.query(
    "update tracking_events set created_at='2026-10-09T10:02:00Z',active_seconds=30,scroll_depth=50 where id=$1",
    [second],
  );
  await db.query(
    "update tracking_events set created_at=case when page_view_id=$1 then '2026-10-09T10:01:00Z'::timestamptz else '2026-10-09T10:03:00Z'::timestamptz end where session_id=$2 and event_type='interaction'",
    [first, session],
  );
  const selection = {
    from: "2026-10-09",
    to: "2026-10-09",
    country: "DE",
    device: "mobile",
    browser: "Safari",
    os: "iOS",
    referrer: "linkedin",
    code: "demoLink",
    region: "US",
    hour_from: 10,
    hour_to: 10,
  };
  await member();
  const data = await report(selection);
  expect(data.totals).toMatchObject({
    activities: 4,
    views: 2,
    sessions: 1,
    clicks: 2,
    active_seconds: 90,
    measured_views: 2,
  });
  expect(data.engagement).toEqual({
    avg_visitor_seconds: null,
    avg_session_seconds: 90,
    measured_sessions: 1,
    engaged_sessions: 1,
  });
  expect(data.countries).toEqual([{ label: "DE", count: 4, visitors: 0 }]);
  expect(data.journeys[0]).toMatchObject({
    entry_page: "/projects",
    last_page: "/",
    active_seconds: 90,
  });
  const journey = await report({ ...selection, session });
  expect(journey.events.map((row) => row.event_type)).toEqual([
    "page_view",
    "interaction",
    "page_view",
    "interaction",
  ]);
  expect(
    (await report({ ...selection, action: "email" })).totals,
  ).toMatchObject({ views: 0, clicks: 1, active_seconds: 0 });
  expect(
    (await report({ ...selection, min_seconds: 45, max_seconds: 90 })).totals,
  ).toMatchObject({ views: 1, clicks: 1, active_seconds: 60 });
  expect(
    (await report({ ...selection, country: "BG" })).totals.activities,
  ).toBe(0);
  const historical = await report({
    from: "2026-10-12",
    to: "2026-10-13",
    country: "unknown",
  });
  expect(historical.totals.views).toBe(4);
  expect(historical.engagement.avg_session_seconds).toBeNull();
  expect(historical.events.every((row) => row.visitor_country === null)).toBe(
    true,
  );
  await expect(
    report({ ...selection, min_seconds: 90, max_seconds: 10 }),
  ).rejects.toThrow("INVALID_ANALYTICS_FILTER");
  await expect(
    report({ ...selection, country: "precise-location" }),
  ).rejects.toThrow("INVALID_ANALYTICS_FILTER");
});
it("keeps writes service-only, enforces session event limits, and denies another account's new analytics", async () => {
  await db.exec("reset role");
  const session = randomUUID(),
    view = randomUUID();
  await activity(session, view);
  await db.query(
    "insert into tracking_events(account_id,session_id,event_type,page_path) select $1,$2,'page_view','/' from generate_series(1,499)",
    [account, session],
  );
  expect(await activity(session, randomUUID())).toBe(false);
  expect(
    await activity(session, view, { kind: "interaction", action: "email" }),
  ).toBe(false);
  await member();
  await expect(activity(session, randomUUID())).rejects.toThrow(
    "permission denied",
  );
  await member(other);
  await expect(report({ country: "DE" })).rejects.toThrow("ACCOUNT_FORBIDDEN");
  expect(
    (
      await db.query(
        "select * from owner_analytics_activity where session_id=$1",
        [session],
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role;set role anon");
  await expect(activity(session, randomUUID())).rejects.toThrow(
    "permission denied",
  );
});

it("combines returning visitors across sessions and dates, including verified workspace activity, without guessing historical identities", async () => {
  await db.exec("reset role");
  const visitor = randomUUID(),
    secondVisitor = randomUUID(),
    workspaceOwner = randomUUID();
  const firstSession = randomUUID(),
    secondSession = randomUUID();
  const firstView = randomUUID(),
    repeatView = randomUUID(),
    returnView = randomUUID();
  for (const [session, view] of [
    [firstSession, firstView],
    [firstSession, repeatView],
    [secondSession, returnView],
  ]) {
    await activity(session, view, { visitor });
    await db.query(
      "update tracking_events set created_at=now()-interval '120 seconds' where id=$1",
      [view],
    );
  }
  await activity(firstSession, firstView, {
    kind: "engagement",
    seconds: 30,
    scroll: 50,
    visitor,
  });
  await activity(firstSession, repeatView, {
    kind: "engagement",
    seconds: 60,
    scroll: 100,
    visitor,
  });
  await activity(secondSession, returnView, {
    kind: "engagement",
    seconds: 15,
    scroll: 25,
    visitor,
  });
  // Follow-ups inherit the parent's identity even if the visitor cookie has changed.
  await activity(firstSession, firstView, {
    kind: "interaction",
    action: "email",
    visitor: secondVisitor,
  });
  await activity(secondSession, returnView, {
    kind: "interaction",
    action: "email",
    visitor,
  });
  await db.query(
    "update tracking_events set created_at=case when session_id=$1 then '2026-10-07T10:00:00Z'::timestamptz else '2026-10-08T10:00:00Z'::timestamptz end where session_id in ($1,$2)",
    [firstSession, secondSession],
  );
  const secondView = randomUUID(),
    legacyView = randomUUID();
  await activity(randomUUID(), secondView, { visitor: secondVisitor });
  await activity(randomUUID(), legacyView);
  await db.query(
    "update tracking_events set created_at='2026-10-08T12:00:00Z' where id in ($1,$2)",
    [secondView, legacyView],
  );
  const saved = (
    await db.query<{ id: string }>(
      "select create_workspace_with_analytics($1,'US',$2,$3) id",
      [workspaceOwner, us, visitor],
    )
  ).rows[0].id;
  await db.query(
    "insert into workspace_questions(account_id,workspace_id,question,answer,created_at) values($1,$2,'Explicit fictional question','Explicit fictional answer','2026-10-08T11:01:00Z')",
    [account, saved],
  );
  await db.query(
    "update workspace_events set created_at='2026-10-08T11:00:00Z' where workspace_id=$1",
    [saved],
  );
  await db.query(
    "insert into workspace_events(account_id,workspace_id,event_type,created_at) values($1,$2,'resume_preview','2026-10-08T11:02:00Z'),($1,$2,'workspace_export','2026-10-08T11:03:00Z')",
    [account, saved],
  );
  await member();
  const period = { from: "2026-10-07", to: "2026-10-08" };
  const data = await report(period);
  expect(data.totals).toMatchObject({
    views: 5,
    sessions: 4,
    visitors: 2,
    unidentified_sessions: 1,
  });
  expect(data.daily.map((day) => day.visitors)).toEqual([1, 2]);
  expect(data.daily.map((day) => day.question_visitors)).toEqual([0, 1]);
  expect(data.visitors.find((row) => row.visitor_id === visitor)).toMatchObject(
    {
      views: 3,
      sessions: 2,
      clicks: 2,
      questions: 1,
      workspace_starts: 1,
      previews: 1,
      exports: 1,
      active_seconds: 105,
      scroll_depth: 100,
    },
  );
  expect(data.actions).toEqual([{ label: "email", count: 2, visitors: 1 }]);
  expect(data.pages).toEqual([{ label: "/projects", count: 5, visitors: 2 }]);
  expect(JSON.stringify(data)).not.toContain(workspaceOwner);
  const detail = await report({ ...period, visitor });
  expect(detail.totals).toMatchObject({
    activities: 9,
    visitors: 1,
    views: 3,
    sessions: 2,
    active_seconds: 105,
  });
  expect(
    detail.events.every((row) => row.analytics_visitor_id === visitor),
  ).toBe(true);
  expect(detail.events.map((row) => row.created_at)).toEqual(
    detail.events.map((row) => row.created_at).sort(),
  );
  expect(
    (await report({ ...period, visitor, action: "email" })).totals,
  ).toMatchObject({ visitors: 1, views: 0, clicks: 2 });
  expect((await report({ ...period, visitor_offset: 20 })).visitors).toEqual(
    [],
  );
  expect(
    (await report({ ...period, visitor_offset: 20 })).totals.visitors,
  ).toBe(2);
  await expect(report({ ...period, visitor_offset: -1 })).rejects.toThrow(
    "INVALID_ANALYTICS_FILTER",
  );
  await expect(
    db.query("select create_workspace_with_analytics($1,'US',null,$2)", [
      randomUUID(),
      visitor,
    ]),
  ).rejects.toThrow("permission denied");
  await member(other);
  expect(
    (
      await db.query(
        "select * from analytics_workspace_visitors where analytics_visitor_id=$1",
        [visitor],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select * from owner_analytics_activity where analytics_visitor_id=$1",
        [visitor],
      )
    ).rows,
  ).toEqual([]);
  await db.exec("reset role");
  await expect(
    db.query(
      "insert into analytics_workspace_visitors(account_id,workspace_visitor_id,analytics_visitor_id) values($1,$2,$3)",
      [otherAccount, workspaceOwner, randomUUID()],
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_REFERENCE");
});
