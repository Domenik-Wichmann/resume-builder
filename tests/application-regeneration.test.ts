import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/http";
import { suggestedMetadata } from "../src/lib/applications/model";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  start: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/applications/generation", () => ({
  startGeneration: mocks.start,
  advanceGeneration: vi.fn(),
  generationStatus: vi.fn(),
}));
import { POST } from "../src/app/api/admin/applications/route";
const applicationId = "00000000-0000-4000-8000-000000000010";
const previewId = "00000000-0000-4000-8000-000000000011";
const original = {
  organization: "Fictional employer",
  role: "Fictional data engineer",
  job_description: "Fictional vacancy: automate product data transformations.",
  metadata: suggestedMetadata("data engineer", "BG"),
};
let job: { data: unknown; error: unknown };
let preview: { data: unknown; error: unknown };
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  job = { data: original, error: null };
  preview = {
    data: { learning_demo: "https://example.invalid/learning" },
    error: null,
  };
  mocks.owner.mockResolvedValue({});
  mocks.account.mockResolvedValue({
    accountId: "verified-account",
    userId: "verified-owner",
    db: { from: mocks.from },
  });
  mocks.start.mockResolvedValue({
    preview_id: previewId,
    stage: 0,
    label: "Understanding the job",
  });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: () => chain,
      eq: (key: string, value: string) => {
        mocks.eq(table, key, value);
        return chain;
      },
      maybeSingle: async () => (table === "job_applications" ? job : preview),
    };
    return chain;
  });
});
async function regenerate(extra: Record<string, unknown> = {}) {
  return POST(
    new Request("https://portfolio.test/api/admin/applications", {
      method: "POST",
      headers: {
        origin: "https://portfolio.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "regenerate",
        id: applicationId,
        ...extra,
      }),
    }),
  );
}
it("starts a new staged draft with original job details using only the verified account", async () => {
  const response = await regenerate();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    preview_id: previewId,
    stage: 0,
  });
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: "verified-account" }),
    { ...original, learning_demo: "https://example.invalid/learning" },
  );
  expect(mocks.eq.mock.calls).toEqual([
    ["job_applications", "account_id", "verified-account"],
    ["job_applications", "id", applicationId],
    ["application_previews", "account_id", "verified-account"],
    ["application_previews", "saved_application_id", applicationId],
  ]);
  expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
    "job_applications",
    "application_previews",
  ]);
});
it("uses current template defaults when an original preview is no longer available", async () => {
  preview = { data: null, error: null };
  expect((await regenerate()).status).toBe(200);
  expect(mocks.start).toHaveBeenCalledWith(expect.anything(), {
    ...original,
    learning_demo: null,
  });
});
it("does not reveal or regenerate a foreign or missing application", async () => {
  job = { data: null, error: null };
  expect((await regenerate()).status).toBe(404);
  expect(mocks.start).not.toHaveBeenCalled();
});
it("requires the exact owner before reading private job details", async () => {
  mocks.owner.mockRejectedValue(new HttpError(403, "Owner access required."));
  expect((await regenerate()).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("rejects browser-supplied account authority and substituted job text", async () => {
  for (const extra of [
    { account_id: "foreign-account" },
    { application: original },
  ]) {
    expect((await regenerate(extra)).status).toBe(400);
  }
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("reports missing legacy job details without starting an incomplete generation", async () => {
  job = { data: { ...original, job_description: "" }, error: null };
  expect((await regenerate()).status).toBe(409);
  expect(mocks.start).not.toHaveBeenCalled();
});
it("fails closed when original details cannot be read", async () => {
  preview = { data: null, error: { message: "Private database detail" } };
  const response = await regenerate();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain(
    "Private database detail",
  );
  expect(mocks.start).not.toHaveBeenCalled();
});
