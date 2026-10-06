import { afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), account: vi.fn() }));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
import { loadAnalytics } from "../src/lib/analytics/server";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("verifies configured owner authority before account bootstrap or analytics reads", async () => {
  mocks.owner.mockRejectedValue(new Error("Owner authentication required."));
  await expect(loadAnalytics(30)).rejects.toThrow(
    "Owner authentication required.",
  );
  expect(mocks.account).not.toHaveBeenCalled();
});

it("rejects an account JWT that differs from the verified configured owner", async () => {
  vi.stubEnv("OWNER_USER_ID", "configured-owner");
  mocks.owner.mockResolvedValue(undefined);
  const from = vi.fn();
  mocks.account.mockResolvedValue({
    userId: "another-user",
    accountId: "another-account",
    db: { from },
  });
  await expect(loadAnalytics(30)).rejects.toThrow(
    "Owner authentication required.",
  );
  expect(from).not.toHaveBeenCalled();
});
