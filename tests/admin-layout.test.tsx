import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/http";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
import AdminLayout from "../src/app/admin/layout";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_MODE", "live");
  mocks.owner.mockResolvedValue(false);
  mocks.account.mockRejectedValue(
    new HttpError(403, "Account authentication required."),
  );
  mocks.headers.mockResolvedValue(
    new Headers({
      "x-admin-path": "/admin/interviews?session=fictional-saved-session",
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());
it("redirects an unverified session to one sign-in page with the saved interview location", async () => {
  await expect(AdminLayout({ children: "private" })).rejects.toThrow(
    "REDIRECT:/auth/login?next=%2Fadmin%2Finterviews%3Fsession%3Dfictional-saved-session",
  );
});
it("does not hide an account-scoped tool from an existing verified account member", async () => {
  mocks.account.mockResolvedValue({ accountId: "verified-member-account" });
  await expect(
    AdminLayout({ children: "account-scoped tool" }),
  ).resolves.toBeDefined();
});
it("shows the common navigation only after owner verification", async () => {
  mocks.owner.mockResolvedValue(true);
  await expect(AdminLayout({ children: "private" })).resolves.toBeDefined();
  expect(mocks.account).not.toHaveBeenCalled();
});
it("does not disguise data-service failures as an expired session", async () => {
  mocks.account.mockRejectedValue(
    new HttpError(503, "Account service unavailable."),
  );
  await expect(AdminLayout({ children: "private" })).rejects.toMatchObject({
    status: 503,
  });
});
