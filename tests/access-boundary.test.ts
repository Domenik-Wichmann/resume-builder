import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  resolveLink: vi.fn(),
  analyze: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  database: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
      update: mocks.update,
    }),
  }),
}));
vi.mock("../src/lib/tracking/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/tracking/service")>()),
  resolveLink: mocks.resolveLink,
}));
vi.mock("../src/lib/ai/service", () => ({ analyze: mocks.analyze }));
import { handleAI } from "../src/lib/api";
import { createVisitor, visitorCookie } from "../src/lib/workspaces/identity";
import { createSession } from "../src/lib/tracking/service";
const site = "https://resume-builder.test";
beforeEach(() => {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-test-secret");
  vi.stubEnv("OPENROUTER_API_KEY", "synthetic-key");
  vi.stubEnv("OPENROUTER_MODEL", "synthetic-model");
  vi.stubEnv("COHERE_API_KEY", "synthetic-cohere");
  vi.stubEnv("TURNSTILE_SITE_KEY", "synthetic-site");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "synthetic-secret");
  mocks.rpc.mockReset().mockImplementation((name: string) =>
    Promise.resolve({
      data: name === "consume_ai_quota" ? true : "OK",
      error: null,
    }),
  );
  mocks.maybeSingle
    .mockReset()
    .mockResolvedValue({ data: { verified_until: null }, error: null });
  mocks.update.mockReset().mockReturnValue({
    eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
  });
  mocks.resolveLink.mockReset().mockResolvedValue(null);
  mocks.analyze
    .mockReset()
    .mockResolvedValue({ result: { answer: "No evidence" } });
});
afterEach(() => vi.unstubAllEnvs());
function request(cookie = "") {
  return new NextRequest(`${site}/api/ask`, {
    method: "POST",
    headers: { origin: site, "Content-Type": "application/json", cookie },
    body: JSON.stringify({ input: "What supports SQL?" }),
  });
}
it("requires a necessary visitor session before direct paid API calls", async () => {
  expect((await handleAI(request(), "ask")).status).toBe(428);
  expect(mocks.analyze).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires untracked human verification when configured", async () => {
  expect(
    (
      await handleAI(
        request(`${visitorCookie}=${createVisitor().cookie}`),
        "ask",
      )
    ).status,
  ).toBe(403);
  expect(mocks.analyze).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("validates tracked access and still enforces visitor quota before providers", async () => {
  const visitor = createVisitor(),
    tracked = createSession("valid888");
  mocks.resolveLink.mockResolvedValue("valid-link");
  mocks.rpc.mockResolvedValue({ data: "SPACING", error: null });
  expect(
    (
      await handleAI(
        request(
          `${visitorCookie}=${visitor.cookie}; rb_ai_access=${tracked.cookie}`,
        ),
        "ask",
      )
    ).status,
  ).toBe(429);
  expect(mocks.resolveLink).toHaveBeenCalledWith("valid888");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "reserve_visitor_ai",
    expect.objectContaining({
      p_visitor: visitor.id,
      p_daily: 25,
      p_weekly: 50,
      p_spacing: 5,
    }),
  );
  expect(mocks.analyze).not.toHaveBeenCalled();
});
it("rejects forged or revoked access cookies", async () => {
  const visitor = createVisitor(),
    tracked = createSession("valid888");
  expect(
    (
      await handleAI(
        request(
          `${visitorCookie}=${visitor.cookie}; rb_ai_access=${tracked.cookie}tampered`,
        ),
        "ask",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handleAI(
        request(
          `${visitorCookie}=${visitor.cookie}; rb_ai_access=${tracked.cookie}`,
        ),
        "ask",
      )
    ).status,
  ).toBe(403);
  expect(mocks.analyze).not.toHaveBeenCalled();
});
it("preserves limited access without keys, retains global fuse, and releases leases", async () => {
  vi.stubEnv("TURNSTILE_SITE_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  const visitor = createVisitor();
  expect(
    (await handleAI(request(`${visitorCookie}=${visitor.cookie}`), "ask"))
      .status,
  ).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_quota");
  expect(mocks.update).toHaveBeenCalledWith({ ai_lease_until: null });
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve({
      data: name === "consume_ai_quota" ? false : "OK",
      error: null,
    }),
  );
  expect(
    (await handleAI(request(`${visitorCookie}=${visitor.cookie}`), "ask"))
      .status,
  ).toBe(429);
});
