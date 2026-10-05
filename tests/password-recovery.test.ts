import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  exchange: vi.fn(),
  getUser: vi.fn(),
  setSession: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  cookie: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.cookie,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}));
import { POST as requestReset } from "../src/app/api/auth/recovery/route";
import { GET as callback } from "../src/app/auth/recovery/route";
import { POST as updatePassword } from "../src/app/api/auth/password/route";
import {
  recoveryAccessCookie,
  recoveryRefreshCookie,
  recoveryVerifierCookie,
} from "../src/lib/password-recovery";
import { oauthClient } from "../src/lib/oauth";
const site = "https://resume.example";
function post(path: string, body: unknown, cookie = "", origin = site) {
  return new NextRequest(site + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({
    APP_MODE: "live",
    NEXT_PUBLIC_SITE_URL: site,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-placeholder",
    SUPABASE_SECRET_KEY: "secret-placeholder",
    OWNER_USER_ID: "77777777-7777-4777-8777-777777777777",
    OPENROUTER_API_KEY: "placeholder",
    OPENROUTER_MODEL: "test",
    COHERE_API_KEY: "placeholder",
  }))
    vi.stubEnv(key, value);
  mocks.create.mockReturnValue({
    auth: {
      resetPasswordForEmail: mocks.reset,
      exchangeCodeForSession: mocks.exchange,
      getUser: mocks.getUser,
      setSession: mocks.setSession,
      updateUser: mocks.update,
      signOut: mocks.signOut,
    },
  });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.exchange.mockResolvedValue({
    error: null,
    data: {
      redirectType: "recovery",
      session: {
        access_token: "recovery-access",
        refresh_token: "recovery-refresh",
        expires_in: 3600,
      },
    },
  });
  mocks.getUser.mockResolvedValue({
    error: null,
    data: { user: { id: "verified-user" } },
  });
  mocks.setSession.mockResolvedValue({
    error: null,
    data: { user: { id: "verified-user" } },
  });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("password recovery security", () => {
  it("completes the installed SDK's actual PKCE recovery request and callback without sending email", async () => {
    const actual = await vi.importActual<
      typeof import("@supabase/supabase-js")
    >("@supabase/supabase-js");
    const jar = new Map<string, string>();
    mocks.cookie.mockImplementation((name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    );
    mocks.cookieSet.mockImplementation((name: string, value: string) =>
      jar.set(name, value),
    );
    mocks.cookieDelete.mockImplementation((name: string) => jar.delete(name));
    const token = [
      Buffer.from('{"alg":"HS256"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({
          sub: "77777777-7777-4777-8777-777777777777",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "signature",
    ].join(".");
    let challenge = "";
    const transport = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        const body = JSON.parse(
          typeof options?.body === "string" ? options.body : "{}",
        );
        if (url.includes("/recover")) {
          challenge = body.code_challenge;
          expect(body.code_challenge_method).toBe("s256");
          expect(new URL(url).searchParams.get("redirect_to")).toContain(
            site + "/auth/recovery",
          );
          return Response.json({});
        }
        if (url.includes("grant_type=pkce")) {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(body.code_verifier),
          );
          expect(Buffer.from(digest).toString("base64url")).toBe(challenge);
          expect(body.auth_code).toBe("synthetic-code");
          return Response.json({
            access_token: token,
            refresh_token: "synthetic-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: "77777777-7777-4777-8777-777777777777" },
          });
        }
        throw new Error("Unexpected auth transport request");
      },
    );
    mocks.create.mockImplementation((url, key, options) =>
      actual.createClient(url, key, {
        ...options,
        global: { fetch: transport },
      }),
    );
    expect(
      (
        await requestReset(
          post("/api/auth/recovery", { email: "synthetic@example.invalid" }),
        )
      ).status,
    ).toBe(200);
    const verifier = jar.get(recoveryVerifierCookie)!;
    expect(verifier).toContain("/recovery");
    const response = await callback(
      new NextRequest(site + "/auth/recovery?code=synthetic-code", {
        headers: {
          cookie: recoveryVerifierCookie + "=" + encodeURIComponent(verifier),
        },
      }),
    );
    expect(response.headers.get("location")).toBe(
      site + "/auth/reset-password",
    );
    expect(response.cookies.get(recoveryAccessCookie)?.value).toBe(token);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("rejects cross-origin and oversized requests before sending mail", async () => {
    expect(
      (
        await requestReset(
          post(
            "/api/auth/recovery",
            { email: "owner@example.com" },
            "",
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await requestReset(
          post("/api/auth/recovery", { email: "x".repeat(2500) }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it("uses a fixed callback and generic account-neutral confirmation", async () => {
    const response = await requestReset(
      post("/api/auth/recovery", { email: "owner@example.com" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.reset).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: site + "/auth/recovery",
    });
    expect(await response.text()).not.toContain("owner@example.com");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("reports provider throttling without exposing provider details", async () => {
    mocks.reset.mockResolvedValue({
      error: { status: 429, message: "private detail" },
    });
    const response = await requestReset(
      post("/api/auth/recovery", { email: "owner@example.com" }),
    );
    expect(response.status).toBe(429);
    expect(await response.text()).not.toContain("private detail");
  });
  it("isolates recovery PKCE storage from OAuth login", async () => {
    await oauthClient(recoveryVerifierCookie, 3600);
    const options = mocks.create.mock.calls[0][2];
    options.auth.storage.setItem(
      "auth-code-verifier",
      "private-verifier/recovery",
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      recoveryVerifierCookie,
      "private-verifier/recovery",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 3600,
      }),
    );
    options.auth.storage.setItem("auth-session", "must-not-persist");
    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
  });
  it("rejects missing browser proof and non-recovery authorization codes", async () => {
    const missing = await callback(
      new NextRequest(site + "/auth/recovery?code=untrusted"),
    );
    expect(missing.headers.get("location")).toBe(
      site + "/auth/reset-password?error=expired",
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.exchange.mockResolvedValue({
      error: null,
      data: {
        redirectType: null,
        session: {
          access_token: "oauth-token",
          refresh_token: "oauth-refresh",
          expires_in: 3600,
        },
      },
    });
    const wrong = await callback(
      new NextRequest(site + "/auth/recovery?code=oauth", {
        headers: { cookie: recoveryVerifierCookie + "=proof" },
      }),
    );
    expect(wrong.headers.get("location")).toContain("error=expired");
    expect(wrong.headers.get("set-cookie")).not.toContain("oauth-token");
  });
  it("keeps recovery tokens in short-lived HttpOnly cookies, never an admin session or URL", async () => {
    const response = await callback(
      new NextRequest(
        site + "/auth/recovery?code=one-time&next=https://evil.example",
        { headers: { cookie: recoveryVerifierCookie + "=proof" } },
      ),
    );
    expect(response.headers.get("location")).toBe(
      site + "/auth/reset-password",
    );
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).not.toContain("rb_owner");
    expect(cookie).not.toContain("rb_account");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("rejects absent, forged, mismatched, and short-password requests without updating", async () => {
    const credentials = { password: "a long new passphrase" };
    const cookie = `${recoveryAccessCookie}=access; ${recoveryRefreshCookie}=refresh`;
    expect(
      (await updatePassword(post("/api/auth/password", credentials))).status,
    ).toBe(401);
    expect(
      (
        await updatePassword(
          post("/api/auth/password", { password: "short" }, cookie),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await updatePassword(
          post(
            "/api/auth/password",
            credentials,
            cookie,
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    mocks.getUser.mockResolvedValue({
      error: { message: "invalid" },
      data: { user: null },
    });
    expect(
      (await updatePassword(post("/api/auth/password", credentials, cookie)))
        .status,
    ).toBe(401);
    mocks.getUser.mockResolvedValue({
      error: null,
      data: { user: { id: "verified-user" } },
    });
    mocks.setSession.mockResolvedValue({
      error: null,
      data: { user: { id: "different-user" } },
    });
    expect(
      (await updatePassword(post("/api/auth/password", credentials, cookie)))
        .status,
    ).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("updates only a verified recovery session and clears credentials on success", async () => {
    const response = await updatePassword(
      post(
        "/api/auth/password",
        { password: "a long new passphrase" },
        `${recoveryAccessCookie}=access; ${recoveryRefreshCookie}=refresh`,
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledWith("access");
    expect(mocks.update).toHaveBeenCalledWith({
      password: "a long new passphrase",
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
    expect(await response.text()).toBe('{"updated":true}');
  });
});
