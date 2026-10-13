import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({
  refresh: vi.fn(),
  user: vi.fn(),
  signIn: vi.fn(),
  cookie: vi.fn(),
  exchange: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      refreshSession: auth.refresh,
      getUser: auth.user,
      signInWithPassword: auth.signIn,
    },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: auth.cookie }),
}));
vi.mock("../src/lib/oauth", () => ({
  oauthClient: async () => ({
    auth: { exchangeCodeForSession: auth.exchange },
  }),
}));
import { proxy } from "../src/proxy";
import { renewSession, sessionLifetime } from "../src/lib/auth-session";
import { adminReturnPath, adminSignInPath } from "../src/lib/auth-navigation";
import {
  POST as login,
  DELETE as logout,
} from "../src/app/api/auth/login/route";
import {
  POST as ownerLogin,
  DELETE as ownerLogout,
} from "../src/app/api/admin/login/route";
import { POST as heartbeat } from "../src/app/api/auth/session/route";
import { GET as callback } from "../src/app/auth/callback/route";
const owner = "77777777-7777-4777-8777-777777777777";
const other = "88888888-8888-4888-8888-888888888888";
const base = "https://resume-builder.test";
const token = (seconds: number) =>
  "test." +
  Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + seconds })).toString(
    "base64url",
  ) +
  ".fixture";
const session = () => ({
  access_token: token(3600),
  refresh_token: "rotated-test-refresh",
  expires_in: 3600,
});
const request = (path: string, cookie = "", method = "GET", origin = base) =>
  new NextRequest(base + path, {
    method,
    headers: { cookie, origin, "Content-Type": "application/json" },
    ...(method === "POST" && path.endsWith("login")
      ? {
          body: JSON.stringify({
            email: "fixture@example.test",
            password: "fictional-password",
          }),
        }
      : {}),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", base);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fictional-public-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "fictional-secret");
  vi.stubEnv("OPENROUTER_API_KEY", "fixture");
  vi.stubEnv("OPENROUTER_MODEL", "fixture");
  vi.stubEnv("COHERE_API_KEY", "fixture");
  vi.stubEnv("OWNER_USER_ID", owner);
  auth.user.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  auth.refresh.mockImplementation(async () => ({
    data: { session: session() },
    error: null,
  }));
  auth.signIn.mockImplementation(async () => ({
    data: { user: { id: owner }, session: session() },
    error: null,
  }));
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  "/admin/projects",
  "/admin/applications/fixture?tab=activity",
  "/admin/interviews?session=fixture",
  "/admin/career?import=fixture",
])(
  "returns a signed-out visitor to the exact page after login: %s",
  async (path) => {
    const response = await proxy(request(path));
    expect(response.headers.get("location")).toBe(base + adminSignInPath(path));
    expect(auth.refresh).not.toHaveBeenCalled();
  },
);
it.each([
  "https://evil.test/admin",
  "//evil.test/admin",
  "/\\evil.test/admin",
  "/auth/login",
  "/admin/../../auth/callback",
  "javascript:alert(1)",
  "/administrator",
  "/admin\n/evil",
])("rejects unsafe return URLs: %s", (value) =>
  expect(adminReturnPath(value)).toBe("/admin"),
);
it("preserves a local application deep link, search and fragment", () =>
  expect(adminReturnPath("/admin/applications/fixture?tab=review#draft")).toBe(
    "/admin/applications/fixture?tab=review#draft",
  ));
it.each([login, ownerLogin])(
  "issues a persistent renewable owner session without exposing tokens in JSON",
  async (handler) => {
    const response = await handler(request("/api/admin/login", "", "POST"));
    expect(response.status).toBe(200);
    const cookies = response.headers.get("set-cookie")!;
    expect(cookies).toContain("rb_refresh=rotated-test-refresh");
    expect(cookies).toContain("Max-Age=" + sessionLifetime);
    expect(cookies).toContain("Max-Age=3600");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("Secure");
    expect(cookies).toContain("SameSite=strict");
    expect(await response.text()).not.toContain("rotated-test-refresh");
  },
);
it("preserves existing non-owner account sign-in without issuing an owner refresh cookie", async () => {
  auth.signIn.mockResolvedValue({
    data: { user: { id: other }, session: session() },
    error: null,
  });
  const response = await login(request("/api/auth/login", "", "POST"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    authenticated: true,
    owner: false,
  });
  expect(response.headers.get("set-cookie")).not.toContain(
    "rb_refresh=rotated",
  );
});
it("refreshes an expired owner access token, rotates the refresh cookie and supplies the verified JWT to server reads", async () => {
  const response = await proxy(
    request(
      "/admin/projects?edit=fixture",
      `rb_account=${token(-1)}; rb_owner=expired-legacy; rb_refresh=old-test-refresh`,
    ),
  );
  expect(response.status).toBe(200);
  expect(auth.refresh).toHaveBeenCalledWith({
    refresh_token: "old-test-refresh",
  });
  expect(auth.user).toHaveBeenCalledWith(expect.stringContaining("test."));
  expect(response.headers.get("x-middleware-request-cookie")).toContain(
    "rb_account=test.",
  );
  expect(response.headers.get("x-middleware-request-cookie")).not.toContain(
    "rb_owner=",
  );
  expect(response.headers.get("x-middleware-request-x-admin-path")).toBe(
    "/admin/projects?edit=fixture",
  );
  expect(response.headers.get("set-cookie")).toContain(
    "rb_refresh=rotated-test-refresh",
  );
});
it("restores a returning owner when the one-hour access cookie has expired entirely", async () => {
  const response = await proxy(
    request("/admin/interviews", "rb_refresh=old-test-refresh"),
  );
  expect(response.headers.get("location")).toBeNull();
  expect(auth.refresh).toHaveBeenCalledOnce();
});
it("does not refresh on every navigation or authorize a forged future expiry", async () => {
  const response = await proxy(
    request(
      "/admin/projects",
      `rb_account=${token(3600)}; rb_refresh=old-test-refresh`,
    ),
  );
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(auth.refresh).not.toHaveBeenCalled();
  // This path proceeds to the layout and endpoint's Supabase verification, never grants authority itself.
  expect(response.headers.get("x-middleware-request-x-admin-path")).toBe(
    "/admin/projects",
  );
});
it("does not renew cookies for a different verified user", async () => {
  auth.user.mockResolvedValue({ data: { user: { id: other } }, error: null });
  const response = await proxy(
    request("/admin/projects", "rb_refresh=other-user-refresh"),
  );
  expect(response.headers.get("location")).toBe(
    base + adminSignInPath("/admin/projects"),
  );
  expect(response.headers.get("set-cookie")).not.toContain(
    "rotated-test-refresh",
  );
});
it("clears rejected credentials and returns an API auth error without replaying the write", async () => {
  auth.refresh.mockResolvedValue({
    data: { session: null },
    error: { status: 400 },
  });
  const response = await proxy(
    request("/api/admin/projects", "rb_refresh=revoked-test-refresh", "POST"),
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toContain("rb_refresh=;");
});
it("keeps refresh cookies during a temporary authentication outage", async () => {
  auth.refresh.mockResolvedValue({
    data: { session: null },
    error: { status: 503 },
  });
  const response = await proxy(
    request("/admin/projects", "rb_refresh=valid-test-refresh"),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
  auth.refresh.mockImplementation(async () => ({
    data: { session: session() },
    error: null,
  }));
  auth.user.mockResolvedValue({ data: { user: null }, error: { status: 0 } });
  await expect(
    renewSession(request("/admin", "rb_refresh=valid-test-refresh")),
  ).rejects.toMatchObject({ status: 503 });
});
it("rejects cross-origin heartbeats and avoids rotation for cross-origin API writes", async () => {
  const response = await heartbeat(
    request(
      "/api/auth/session",
      "rb_refresh=test-refresh",
      "POST",
      "https://evil.test",
    ),
  );
  expect(response.status).toBe(403);
  await proxy(
    request(
      "/api/admin/projects",
      "rb_refresh=test-refresh",
      "POST",
      "https://evil.test",
    ),
  );
  expect(auth.refresh).not.toHaveBeenCalled();
});
it("renews an idle editor's access token through a same-origin heartbeat", async () => {
  const renewed = await proxy(
    request("/api/auth/session", "rb_refresh=test-refresh", "POST"),
  );
  const response = await heartbeat(
    request(
      "/api/auth/session",
      renewed.headers.get("x-middleware-request-cookie")!,
      "POST",
    ),
  );
  expect(response.status).toBe(200);
  expect(renewed.headers.get("set-cookie")).toContain(
    "rb_refresh=rotated-test-refresh",
  );
  expect(renewed.headers.get("x-middleware-request-cookie")).toContain(
    "rb_refresh=rotated-test-refresh",
  );
  expect(auth.refresh).toHaveBeenCalledOnce();
});
it("renews before a short-lived access token can expire during editing", async () => {
  await proxy(
    request(
      "/api/auth/session",
      `rb_account=${token(90)}; rb_refresh=test-refresh`,
      "POST",
    ),
  );
  expect(auth.refresh).toHaveBeenCalledOnce();
});
it("keeps a valid session during provider verification failures without claiming it expired", async () => {
  auth.user.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
  const response = await heartbeat(
    request("/api/auth/session", `rb_account=${token(3600)}`, "POST"),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
  auth.user.mockRejectedValue(new Error("Network unavailable"));
  expect(
    (
      await heartbeat(
        request("/api/auth/session", `rb_account=${token(3600)}`, "POST"),
      )
    ).status,
  ).toBe(503);
});
it("verifies the exact owner on heartbeat even with a forged future expiry", async () => {
  auth.user.mockResolvedValue({ data: { user: { id: other } }, error: null });
  const response = await heartbeat(
    request("/api/auth/session", `rb_account=${token(3600)}`, "POST"),
  );
  expect(response.status).toBe(401);
  expect(auth.refresh).not.toHaveBeenCalled();
});
it.each([logout, ownerLogout])(
  "clears both legacy and current sessions on sign out",
  async (handler) => {
    const response = await handler(
      request(
        "/api/admin/login",
        "rb_owner=fixture; rb_account=fixture; rb_refresh=fixture",
        "DELETE",
      ),
    );
    for (const name of ["rb_owner", "rb_account", "rb_refresh"])
      expect(response.headers.get("set-cookie")).toContain(name + "=;");
  },
);
it("preserves the owner's OAuth destination and renewable session", async () => {
  auth.exchange.mockResolvedValue({
    data: { user: { id: owner }, session: session() },
    error: null,
  });
  const response = await callback(
    request("/auth/callback?code=fixture", "rb_auth_next=/admin/projects"),
  );
  expect(response.headers.get("location")).toBe(base + "/admin/projects");
  expect(response.headers.get("set-cookie")).toContain(
    "rb_refresh=rotated-test-refresh",
  );
});
it("keeps a non-owner OAuth account on its existing account landing page", async () => {
  auth.exchange.mockResolvedValue({
    data: { user: { id: other }, session: session() },
    error: null,
  });
  const response = await callback(
    request("/auth/callback?code=fixture", "rb_auth_next=/admin/projects"),
  );
  expect(response.headers.get("location")).toBe(base + "/account");
  expect(response.headers.get("set-cookie")).not.toContain(
    "rb_refresh=rotated-test-refresh",
  );
});
