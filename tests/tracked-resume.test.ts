import { beforeEach, expect, it, vi } from "vitest";
import { designPreview } from "../src/lib/resume-design/preview";
import { primaryAccountId } from "../src/lib/account-id";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  mode: "live",
}));
vi.mock("../src/lib/tracking/service", () => ({ readSession: mocks.session }));
vi.mock("../src/lib/db", () => ({ database: () => ({ from: mocks.from }) }));
vi.mock("../src/lib/env", () => ({
  validateEnv: () => ({ mode: mocks.mode }),
}));
import { trackedResume } from "../src/lib/resume-design/tracked-resume";
function query(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode = "live";
  mocks.session.mockReturnValue({ code: "testLink", sessionId: "verified" });
});
it("serves only the exact assigned snapshot from an active link in the primary account", async () => {
  const link = query({ application_id: "application-one" });
  const snapshot = query({
    resume_ir: {
      ...designPreview,
      summary: "The original sent résumé.",
      owner_notes: "Must not escape.",
    },
  });
  mocks.from.mockReturnValueOnce(link).mockReturnValueOnce(snapshot);
  const ir = await trackedResume("signed-cookie");
  expect(mocks.session).toHaveBeenCalledWith("signed-cookie");
  expect(link.eq.mock.calls).toEqual([
    ["account_id", primaryAccountId],
    ["code", "testLink"],
    ["active", true],
  ]);
  expect(snapshot.select).toHaveBeenCalledWith("resume_ir");
  expect(snapshot.eq.mock.calls).toEqual([
    ["account_id", primaryAccountId],
    ["application_id", "application-one"],
    ["tracking_code", "testLink"],
  ]);
  expect(ir?.summary).toBe("The original sent résumé.");
  expect(ir?.portfolio_url).toMatch(/\/r\/testLink$/);
  expect(JSON.stringify(ir)).not.toContain("Must not escape");
});
it("uses the public default for missing or invalid sessions without reading private tables", async () => {
  mocks.session.mockReturnValue(null);
  expect(await trackedResume(undefined)).toBeNull();
  expect(await trackedResume("tampered-or-expired")).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});
it.each([null, { application_id: null }])(
  "does not read snapshots for revoked, foreign or legacy links: %s",
  async (data) => {
    mocks.from.mockReturnValue(query(data));
    expect(await trackedResume("signed-cookie")).toBeNull();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("tracking_links");
  },
);
it("does not substitute a different saved application when the exact snapshot is absent", async () => {
  mocks.from
    .mockReturnValueOnce(query({ application_id: "application-one" }))
    .mockReturnValueOnce(query(null));
  expect(await trackedResume("signed-cookie")).toBeNull();
});
it("fails safely on a database error or invalid stored résumé instead of presenting the wrong version", async () => {
  mocks.from.mockReturnValueOnce(query(null, { message: "offline" }));
  await expect(trackedResume("signed-cookie")).rejects.toThrow();
  mocks.from
    .mockReturnValueOnce(query({ application_id: "application-one" }))
    .mockReturnValueOnce(query({ resume_ir: { summary: "invalid" } }));
  await expect(trackedResume("signed-cookie")).rejects.toThrow();
});
