import { afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), account: vi.fn() }));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
import { loadAnalytics } from "../src/lib/analytics/server";
import { defaultAnalyticsFilters } from "../src/lib/analytics/filters";
import { fictionalAnalytics } from "../src/lib/analytics/demo";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("uses only the verified account's JWT client with bounded filters and pagination, and hides detail answers on overview", async () => {
  vi.stubEnv("OWNER_USER_ID", "configured-owner");
  mocks.owner.mockResolvedValue(undefined);
  const filters = {
    ...defaultAnalyticsFilters(),
    code: "demoLink",
    region: "US" as const,
    hour_from: 9,
    hour_to: 12,
    page_number: 2,
  };
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: fictionalAnalytics(filters), error: null });
  mocks.account.mockResolvedValue({
    userId: "configured-owner",
    accountId: "verified-account",
    db: { rpc },
  });
  const result = await loadAnalytics(filters, false);
  expect(rpc).toHaveBeenCalledWith(
    "owner_analytics_report",
    expect.objectContaining({
      p_account: "verified-account",
      p_code: "demoLink",
      p_region: "US",
      p_hour_from: 9,
      p_hour_to: 12,
      p_offset: 50,
    }),
  );
  expect(result.events).toEqual([]);
  expect(result.visitors).toEqual([]);
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
