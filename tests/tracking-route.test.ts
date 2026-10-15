import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  owner: vi.fn(),
  link: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/market-server", () => ({
  currentMarket: async () => "US",
}));
vi.mock("../src/lib/tracking/service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/tracking/service")>();
  return { ...original, resolveLink: mocks.link };
});
import { POST } from "../src/app/api/tracking/route";
import {
  createSession,
  readSession,
  createAnalyticsVisitor,
  readAnalyticsVisitor,
  analyticsVisitorCookie,
} from "../src/lib/tracking/service";
import { createVisitor, visitorCookie } from "../src/lib/workspaces/identity";
beforeEach(() => {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "test-model");
  vi.stubEnv("COHERE_API_KEY", "test-key");
  mocks.owner.mockResolvedValue(false);
  mocks.rpc.mockResolvedValue({ error: null, data: true });
  mocks.link.mockResolvedValue("verified-link");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function request(body = '{"path":"/"}', headers: Record<string, string> = {}) {
  return new NextRequest("https://portfolio.test/api/tracking", {
    method: "POST",
    headers: {
      origin: "https://portfolio.test",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}
it("sets an HttpOnly signed session and writes only server-resolved fields", async () => {
  const response = await POST(request());
  expect(response.status).toBe(204);
  expect(response).toBeInstanceOf(NextResponse);
  if (!(response instanceof NextResponse))
    throw new Error("Expected cookie response");
  const cookie = response.cookies.get("rb_site_visit")!.value;
  expect(readSession(cookie)?.code).toBe("siteView");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "record_portfolio_activity",
    expect.objectContaining({
      p_session: readSession(cookie)!.sessionId,
      p_path: "/",
      p_link: null,
      p_market: "US",
      p_kind: "page_view",
    }),
  );
  expect(response.headers.get("X-Analytics-Recorded")).toBe("1");
});
it("recognizes repeat sessions using a separate 90-day signed visitor cookie without exposing workspace ownership", async () => {
  const first = await POST(request());
  if (!(first instanceof NextResponse))
    throw new Error("Expected cookie response");
  const value = first.cookies.get(analyticsVisitorCookie)!.value;
  const visitor = readAnalyticsVisitor(value);
  expect(visitor).not.toBeNull();
  expect(mocks.rpc.mock.calls[0][1].p_visitor).toBe(visitor);
  expect(first.headers.get("set-cookie")).toContain("Max-Age=7776000");
  const session = createSession("demoLink"),
    workspace = createVisitor();
  await POST(
    request(undefined, {
      cookie: `${analyticsVisitorCookie}=${value}; rb_visit=${session.cookie}; ${visitorCookie}=${workspace.cookie}`,
    }),
  );
  expect(mocks.rpc.mock.calls[1][1]).toMatchObject({
    p_visitor: visitor,
    p_session: session.sessionId,
    p_workspace_visitor: workspace.id,
  });
  const duplicate = await POST(
    request(undefined, { cookie: `${analyticsVisitorCookie}=${value}` }),
  );
  if (!(duplicate instanceof NextResponse))
    throw new Error("Expected cookie response");
  expect(duplicate.cookies.has(analyticsVisitorCookie)).toBe(false);
  expect(readAnalyticsVisitor(createSession("siteView").cookie)).toBeNull();
  expect(readAnalyticsVisitor(value + "forged")).toBeNull();
  const expired = createAnalyticsVisitor();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 91 * 86400000);
  expect(readAnalyticsVisitor(expired.cookie)).toBeNull();
  vi.restoreAllMocks();
});
it("never accepts client visitor identities or uses forged ownership cookies, and deletes optional identity on opt-out", async () => {
  const visitor = createAnalyticsVisitor(),
    workspace = createVisitor();
  await POST(
    request(undefined, {
      cookie: `${analyticsVisitorCookie}=${visitor.cookie}x; ${visitorCookie}=${workspace.cookie}x`,
    }),
  );
  expect(mocks.rpc.mock.calls[0][1].p_visitor).not.toBe(visitor.sessionId);
  expect(mocks.rpc.mock.calls[0][1].p_workspace_visitor).toBeNull();
  expect(
    (
      await POST(
        request(JSON.stringify({ path: "/", visitor_id: visitor.sessionId })),
      )
    ).status,
  ).toBe(400);
  const response = await POST(
    request(undefined, {
      DNT: "1",
      cookie: `${analyticsVisitorCookie}=${visitor.cookie}`,
    }),
  );
  expect(response.headers.get("set-cookie")).toContain(
    `${analyticsVisitorCookie}=;`,
  );
});
it("reuses a signed session and verifies attribution on the server", async () => {
  const session = createSession("demoLink");
  await POST(request(undefined, { cookie: "rb_visit=" + session.cookie }));
  expect(mocks.link).toHaveBeenCalledWith("demoLink");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "record_portfolio_activity",
    expect.objectContaining({
      p_session: session.sessionId,
      p_path: "/",
      p_link: "verified-link",
      p_market: "US",
    }),
  );
});
it("suppresses writes for privacy signals, owner sessions and demo mode", async () => {
  const privacyHeaders: Record<string, string>[] = [
    { dnt: "1" },
    { "sec-gpc": "1" },
  ];
  for (const headers of privacyHeaders) {
    expect((await POST(request(undefined, headers))).status).toBe(204);
  }
  mocks.owner.mockResolvedValue(true);
  await POST(request());
  vi.stubEnv("APP_MODE", "demo");
  await POST(request());
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects cross-origin, oversized and unapproved fields before persistence", async () => {
  expect(
    (await POST(request(undefined, { origin: "https://evil.test" }))).status,
  ).toBe(403);
  expect(
    (await POST(request(JSON.stringify({ path: "/", extra: "x".repeat(300) }))))
      .status,
  ).toBe(413);
  expect((await POST(request('{"path":"/admin"}'))).status).toBe(400);
  expect((await POST(request('{"path":"/","account_id":"x"}'))).status).toBe(
    400,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("forged session cookies do not supply authoritative identifiers", async () => {
  const forged = createSession("demoLink");
  await POST(request(undefined, { cookie: "rb_visit=" + forged.cookie + "x" }));
  expect(mocks.link).not.toHaveBeenCalled();
  expect(mocks.rpc.mock.calls[0][1].p_link).toBeNull();
  expect(mocks.rpc.mock.calls[0][1].p_session).not.toBe(forged.sessionId);
});

const viewId = "11111111-1111-4111-8111-111111111111";
it("stores only coarse server-derived browser context and trusted hosting country", async () => {
  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36",
    "x-vercel-ip-country": "DE",
    "x-forwarded-for": "192.0.2.10",
  };
  const body = JSON.stringify({
    kind: "page_view",
    path: "/",
    view_id: viewId,
    referrer: "linkedin",
  });
  vi.stubEnv("VERCEL", "0");
  await POST(request(body, headers));
  expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
    p_country: null,
    p_device: "desktop",
    p_browser: "Chrome",
    p_os: "Windows",
    p_referrer: "linkedin",
    p_view: viewId,
  });
  vi.stubEnv("VERCEL", "1");
  await POST(request(body, headers));
  expect(mocks.rpc.mock.calls[1][1].p_country).toBe("DE");
  expect(JSON.stringify(mocks.rpc.mock.calls)).not.toMatch(
    /Mozilla|192\.0\.2\.10/,
  );
});
it.each(["engagement", "interaction"])(
  "requires a signed existing session for %s and never accepts browser ownership fields",
  async (kind) => {
    const event = {
      kind,
      path: "/projects",
      view_id: viewId,
      ...(kind === "engagement"
        ? { active_seconds: 30, scroll_depth: 75 }
        : { action: "email" }),
    };
    const body = JSON.stringify(event);
    expect((await POST(request(body))).status).toBe(204);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const session = createSession("siteView");
    await POST(
      request(body, { cookie: "rb_site_visit=" + session.cookie + "forged" }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    const headers = { cookie: "rb_site_visit=" + session.cookie };
    const result = await POST(request(body, headers));
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_portfolio_activity",
      expect.objectContaining({
        p_session: session.sessionId,
        p_view: viewId,
        p_kind: kind,
      }),
    );
    mocks.rpc.mockClear();
    for (const extra of [
      { session_id: session.sessionId },
      { country: "US" },
      { href: "https://private.test/secret" },
    ]) {
      expect(
        (await POST(request(JSON.stringify({ ...event, ...extra }), headers)))
          .status,
      ).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("suppresses all telemetry for owners, privacy signals and recognizable bots", async () => {
  const session = createSession("siteView");
  const events = [
    { kind: "page_view", path: "/", view_id: viewId },
    {
      kind: "engagement",
      path: "/",
      view_id: viewId,
      active_seconds: 10,
      scroll_depth: 25,
    },
    { kind: "interaction", path: "/", view_id: viewId, action: "email" },
  ];
  for (const event of events) {
    mocks.owner.mockResolvedValue(true);
    expect(
      (
        await POST(
          request(JSON.stringify(event), {
            cookie: "rb_site_visit=" + session.cookie,
          }),
        )
      ).headers.get("X-Analytics-Recorded"),
    ).toBeNull();
    mocks.owner.mockResolvedValue(false);
    const excluded: Record<string, string>[] = [
      { dnt: "1" },
      { "sec-gpc": "1" },
      { "user-agent": "Googlebot/2.1" },
    ];
    for (const headers of excluded) {
      await POST(
        request(JSON.stringify(event), {
          ...headers,
          cookie: "rb_site_visit=" + session.cookie,
        }),
      );
    }
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each(["/admin", "/admin/analytics", "/auth/login", "/account"])(
  "never accepts the private path %s for any telemetry kind",
  async (path) => {
    for (const event of [
      { kind: "page_view" },
      { kind: "engagement", active_seconds: 10, scroll_depth: 50 },
      { kind: "interaction", action: "email" },
    ]) {
      expect(
        (
          await POST(
            request(JSON.stringify({ ...event, path, view_id: viewId })),
          )
        ).status,
      ).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("rejects arbitrary actions, URL sources, invalid views and unbounded engagement", async () => {
  for (const event of [
    { kind: "interaction", action: "text from a private message" },
    { kind: "page_view", referrer: "https://example.test/private" },
    { kind: "engagement", active_seconds: 14401, scroll_depth: 100 },
    { kind: "engagement", active_seconds: 10, scroll_depth: 101 },
    { kind: "page_view", view_id: "forged" },
  ])
    expect(
      (
        await POST(
          request(JSON.stringify({ path: "/", view_id: viewId, ...event })),
        )
      ).status,
    ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
