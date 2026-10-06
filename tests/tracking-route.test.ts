import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  owner: vi.fn(),
  link: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/tracking/service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/tracking/service")>();
  return { ...original, resolveLink: mocks.link };
});
import { POST } from "../src/app/api/tracking/route";
import { createSession, readSession } from "../src/lib/tracking/service";
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
  expect(mocks.rpc).toHaveBeenCalledWith("record_portfolio_page_view", {
    p_session: readSession(cookie)!.sessionId,
    p_path: "/",
    p_link: null,
  });
});
it("reuses a signed session and verifies attribution on the server", async () => {
  const session = createSession("demoLink");
  await POST(request(undefined, { cookie: "rb_visit=" + session.cookie }));
  expect(mocks.link).toHaveBeenCalledWith("demoLink");
  expect(mocks.rpc).toHaveBeenCalledWith("record_portfolio_page_view", {
    p_session: session.sessionId,
    p_path: "/",
    p_link: "verified-link",
  });
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
