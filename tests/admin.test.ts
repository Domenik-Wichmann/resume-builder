import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signIn: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser, signInWithPassword: mocks.signIn },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie }),
}));
import { isOwner } from "../src/lib/admin";
import { POST as login } from "../src/app/api/admin/login/route";
import { POST as createLink } from "../src/app/api/admin/tracking/route";
import { POST as savePresentation } from "../src/app/api/admin/presentations/route";
const owner = "77777777-7777-4777-8777-777777777777";
beforeEach(() => {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-placeholder");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server-test-placeholder");
  vi.stubEnv("OPENROUTER_API_KEY", "test-placeholder");
  vi.stubEnv("OPENROUTER_MODEL", "test-model");
  vi.stubEnv("COHERE_API_KEY", "test-placeholder");
  vi.stubEnv("OWNER_USER_ID", owner);
  mocks.getUser.mockReset();
  mocks.signIn.mockReset();
  mocks.cookie.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("owner authorization", () => {
  it("denies contact management to anonymous visitors and non-owner users", async () => {
    const request = () =>
      new Request("http://localhost:3000/api/admin/presentations", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    expect((await savePresentation(request())).status).toBe(403);
    mocks.cookie.mockReturnValue({ value: "other-user-jwt" });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "88888888-8888-4888-8888-888888888888" } },
      error: null,
    });
    expect((await savePresentation(request())).status).toBe(403);
  });
  it("checks Supabase user authority and exact owner ID, never trusting a browser token alone", async () => {
    mocks.cookie.mockReturnValue({ value: "untrusted-jwt" });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "88888888-8888-4888-8888-888888888888" } },
      error: null,
    });
    expect(await isOwner()).toBe(false);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: owner } },
      error: null,
    });
    expect(await isOwner()).toBe(true);
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid" },
    });
    expect(await isOwner()).toBe(false);
  });
  it("denies anonymous tracking management without touching privileged records", async () => {
    mocks.cookie.mockReturnValue(undefined);
    const response = await createLink(
      new NextRequest("http://localhost:3000/api/admin/tracking", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("does not issue an owner cookie for another valid Supabase user", async () => {
    mocks.signIn.mockResolvedValue({
      data: {
        user: { id: "88888888-8888-4888-8888-888888888888" },
        session: { access_token: "token", expires_in: 3600 },
      },
      error: null,
    });
    const response = await login(
      new NextRequest("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "test-placeholder",
        }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("issues only a bounded HttpOnly same-site owner session", async () => {
    mocks.signIn.mockResolvedValue({
      data: {
        user: { id: owner },
        session: { access_token: "test-access-token", expires_in: 7200 },
      },
      error: null,
    });
    const response = await login(
      new NextRequest("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "test-placeholder",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Max-Age=3600");
    expect(await response.text()).not.toContain("test-access-token");
  });
});
