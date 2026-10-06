import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  owner: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ isOwner: mocks.owner }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
vi.mock("../src/lib/db", () => ({
  database: () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  }),
}));
import { errorResponse, reserveAIQuota } from "../src/lib/http";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue(false);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T23:30:00Z"));
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  mocks.single.mockResolvedValue({
    data: { day: "2026-10-06", daily_count: 100 },
    error: null,
  });
});
afterEach(() => vi.useRealTimers());
async function denied() {
  try {
    await reserveAIQuota();
  } catch (error) {
    return errorResponse(error);
  }
  throw new Error("Expected quota denial");
}
it("reports shared daily exhaustion and the UTC reset without leaking counters", async () => {
  const response = await denied();
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("1800");
  expect((await response.json()).error).toContain("resets at 00:00 UTC");
});
it.each([
  { day: "2026-10-06", daily_count: 30 },
  { day: "2026-10-05", daily_count: 100 },
])("does not report minute exhaustion as a daily lockout: %j", async (data) => {
  mocks.single.mockResolvedValue({ data, error: null });
  const response = await denied();
  expect(response.headers.get("Retry-After")).toBe("60");
  expect((await response.json()).error).toContain("one minute");
});
it("fails closed when the reservation fails and avoids inventing a reset when status is unavailable", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: {} });
  expect((await denied()).status).toBe(503);
  expect(mocks.single).not.toHaveBeenCalled();
  mocks.single.mockResolvedValueOnce({ data: null, error: {} });
  const response = await denied();
  expect(response.status).toBe(429);
  expect(response.headers.has("Retry-After")).toBe(false);
});
it("uses the atomic shared reservation without a second read when allowed", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  await reserveAIQuota();
  expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_quota");
  expect(mocks.single).not.toHaveBeenCalled();
});
it("exempts the verified owner at every nested provider reservation", async () => {
  mocks.owner.mockResolvedValue(true);
  await reserveAIQuota();
  await reserveAIQuota();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.single).not.toHaveBeenCalled();
});
