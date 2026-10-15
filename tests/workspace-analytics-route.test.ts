import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn() }));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/market-server", () => ({
  currentMarket: async () => "US",
}));
vi.mock("../src/lib/workspaces/repository", () => ({
  listWorkspaces: vi.fn(),
}));
import { POST } from "../src/app/api/workspaces/route";
import { createVisitor, visitorCookie } from "../src/lib/workspaces/identity";
import {
  createAnalyticsVisitor,
  analyticsVisitorCookie,
} from "../src/lib/tracking/service";

beforeEach(() => {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "test-model");
  vi.stubEnv("COHERE_API_KEY", "test-key");
  mocks.owner.mockResolvedValue(false);
  mocks.rpc.mockResolvedValue({
    data: "11111111-1111-4111-8111-111111111111",
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("associates only separately verified analytics and workspace cookies in the atomic creation RPC", async () => {
  const workspace = createVisitor(),
    visitor = createAnalyticsVisitor();
  const response = await POST(
    new NextRequest("https://portfolio.test/api/workspaces", {
      method: "POST",
      headers: {
        origin: "https://portfolio.test",
        "content-type": "application/json",
        cookie: `${visitorCookie}=${workspace.cookie}; ${analyticsVisitorCookie}=${visitor.cookie}`,
      },
      body: "{}",
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("create_workspace_with_analytics", {
    p_visitor_id: workspace.id,
    p_market: "US",
    p_tracking_link_id: null,
    p_analytics_visitor_id: visitor.sessionId,
  });
  expect(JSON.stringify(await response.json())).not.toContain(
    visitor.sessionId,
  );
});
it.each(["owner", "dnt", "gpc", "forged"])(
  "does not associate a visitor for %s requests",
  async (mode) => {
    const workspace = createVisitor(),
      visitor = createAnalyticsVisitor();
    mocks.owner.mockResolvedValue(mode === "owner");
    const response = await POST(
      new NextRequest("https://portfolio.test/api/workspaces", {
        method: "POST",
        headers: {
          origin: "https://portfolio.test",
          "content-type": "application/json",
          cookie: `${visitorCookie}=${workspace.cookie}; ${analyticsVisitorCookie}=${visitor.cookie}${mode === "forged" ? "x" : ""}`,
          ...(mode === "dnt" ? { DNT: "1" } : {}),
          ...(mode === "gpc" ? { "Sec-GPC": "1" } : {}),
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_workspace_with_analytics",
      expect.objectContaining({
        p_visitor_id: workspace.id,
        p_analytics_visitor_id: null,
      }),
    );
  },
);
