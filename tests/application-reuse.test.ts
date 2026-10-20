import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/http";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  rpc: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/applications/generation", () => ({
  startGeneration: mocks.generate,
  advanceGeneration: mocks.generate,
  generationStatus: mocks.generate,
}));
import { POST } from "../src/app/api/admin/applications/route";
const source = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const payload = {
  action: "reuse",
  id: source,
  request_id: request,
  organization: "Fictional employer",
  role: "Fictional role",
  job_description: "",
  learning_demo: "https://example.invalid/new-learner",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  mocks.account.mockResolvedValue({
    accountId: "verified-account",
    db: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({
    data: { id, tracking_code: "newcode1" },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
const send = (extra: Record<string, unknown> = {}) =>
  POST(
    new Request("https://portfolio.test/api/admin/applications", {
      method: "POST",
      headers: {
        origin: "https://portfolio.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, ...extra }),
    }),
  );
it("saves directly through the verified JWT transaction without any generation calls", async () => {
  const response = await send();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ id, tracking_code: "newcode1" });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reuse_saved_resume", {
    p_account: "verified-account",
    p_source: source,
    p_request: request,
    p_organization: payload.organization,
    p_role: payload.role,
    p_job_description: "",
    p_learning_demo: payload.learning_demo,
    p_code: expect.stringMatching(/^[A-Za-z0-9_-]{8}$/),
  });
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("requires the owner and rejects account or resume content supplied by a browser", async () => {
  for (const extra of [
    { account_id: "foreign" },
    { resume_ir: {} },
    { learning_demo: "javascript:alert(1)" },
    { learning_demo: "https://user:pass@example.invalid" },
  ])
    expect((await send(extra)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.owner.mockRejectedValue(new HttpError(403, "Owner required"));
  expect((await send()).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("retries code collisions with the same request identity and keeps internal errors private", async () => {
  mocks.rpc.mockResolvedValueOnce({
    error: { code: "23505", message: "collision" },
  });
  expect((await send()).status).toBe(200);
  expect(mocks.rpc.mock.calls.map((call) => call[1].p_request)).toEqual([
    request,
    request,
  ]);
  expect(mocks.rpc.mock.calls[0][1].p_code).not.toBe(
    mocks.rpc.mock.calls[1][1].p_code,
  );
  mocks.rpc.mockResolvedValue({
    error: { message: "Private database detail" },
  });
  const response = await send();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain(
    "Private database detail",
  );
});
it("does not expose foreign snapshots", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "SOURCE_NOT_FOUND" } });
  expect((await send()).status).toBe(404);
});
