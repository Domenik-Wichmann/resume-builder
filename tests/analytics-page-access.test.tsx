import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  load: vi.fn(),
  account: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/analytics/server", () => ({ loadAnalytics: mocks.load }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
import Analytics from "../src/app/admin/analytics/page";
import Overview from "../src/app/admin/page";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("does not let the fictional preview parameter expose live analytics or overview data", async () => {
  vi.stubEnv("APP_MODE", "live");
  mocks.owner.mockResolvedValue(false);
  await Analytics({
    searchParams: Promise.resolve({ preview: "1", code: "demoLink" }),
  });
  await Overview({ searchParams: Promise.resolve({ preview: "1" }) });
  expect(mocks.owner).toHaveBeenCalledTimes(2);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.account).not.toHaveBeenCalled();
});
it("does not query private data for invalid owner filter input", async () => {
  vi.stubEnv("APP_MODE", "live");
  mocks.owner.mockResolvedValue(true);
  await Analytics({
    searchParams: Promise.resolve({ from: "2026-02-30", hour_from: "24" }),
  });
  expect(mocks.load).not.toHaveBeenCalled();
});
