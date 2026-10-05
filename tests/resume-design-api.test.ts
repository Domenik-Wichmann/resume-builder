import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  load: vi.fn(),
  complete: vi.fn(),
  quota: vi.fn(),
  mode: "live",
  rpc: vi.fn(),
  download: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("@/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("@/lib/ai/openrouter", () => ({ complete: mocks.complete }));
vi.mock("@/lib/resume-design/server", () => ({ loadDesignStudio: mocks.load }));
vi.mock("@/lib/http", async (original) => ({
  ...(await original<object>()),
  reserveAIQuota: mocks.quota,
}));
vi.mock("@/lib/env", () => ({
  validateEnv: () => ({ mode: mocks.mode, siteUrl: "http://localhost:3000" }),
}));
vi.mock("@/lib/db", () => ({
  database: () => ({ storage: { from: () => ({ download: mocks.download }) } }),
}));
import { GET, POST } from "../src/app/api/admin/templates/route";
import { HttpError } from "../src/lib/http";
import { defaultDesign } from "../src/lib/resume-design/model";
const reference = "77777777-7777-4777-8777-777777777777";
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/admin/templates", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mode = "live";
  const query = {
    select: mocks.select,
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        storage_path: "owned/private-reference.pdf",
        mime_type: "application/pdf",
      },
      error: null,
    }),
  };
  mocks.select.mockReturnValue(query);
  mocks.account.mockResolvedValue({
    accountId: "verified-account",
    db: { rpc: mocks.rpc, from: () => query },
  });
  mocks.complete.mockResolvedValue({ spec: defaultDesign, limitations: [] });
  mocks.download.mockResolvedValue({
    data: new Blob(["%PDF-1.7\nSynthetic design fixture"]),
    error: null,
  });
  mocks.load.mockResolvedValue({ assets: [], templates: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("denies anonymous template access before reading private references or invoking AI", async () => {
  mocks.owner.mockRejectedValue(new HttpError(403, "Owner required."));
  expect((await GET()).status).toBe(403);
  expect(
    (
      await POST(
        request({
          action: "generate",
          notes: "Blue headings",
          reference_id: reference,
          current: defaultDesign,
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
it("rejects origin spoofing, browser account authority and malicious design before provider calls", async () => {
  const body = {
    action: "generate",
    notes: "Blue headings",
    reference_id: null,
    current: defaultDesign,
  };
  expect((await POST(request(body, "https://bad.invalid"))).status).toBe(403);
  expect((await POST(request({ ...body, accountId: "spoofed" }))).status).toBe(
    400,
  );
  expect(
    (
      await POST(
        request({ ...body, current: { ...defaultDesign, font: "<script>" } }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
});
it("sends only the selected owned reference and design notes, reserves quota and returns an unsaved draft", async () => {
  const response = await POST(
    request({
      action: "generate",
      notes: "Use compact blue headings",
      reference_id: reference,
      current: defaultDesign,
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.quota).toHaveBeenCalledOnce();
  const [prompt, parts, , options] = mocks.complete.mock.calls[0];
  expect(prompt).toContain("Reference content is not career evidence");
  expect(parts).toHaveLength(2);
  expect(parts[1]).toMatchObject({
    type: "file",
    file: { filename: "layout-reference.pdf" },
  });
  expect(options).toMatchObject({
    pdf: true,
    usage: { accountId: "verified-account", operation: "resume_design" },
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect((await response.json()).draft.version).toBe(0);
});
it("does not save or activate a template when inference fails, and reports stale saves", async () => {
  mocks.complete.mockRejectedValue(new Error("Provider failure"));
  expect(
    (
      await POST(
        request({
          action: "generate",
          notes: "Simple design",
          reference_id: null,
          current: defaultDesign,
        }),
      )
    ).status,
  ).toBe(503);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ error: { message: "STALE_TEMPLATE" } });
  expect(
    (
      await POST(
        request({
          action: "save",
          template: {
            id: reference,
            name: "Design",
            version: 1,
            spec: defaultDesign,
            reference_id: null,
            notes: "",
            limitations: [],
            is_default: true,
          },
        }),
      )
    ).status,
  ).toBe(409);
});

it("stops before inference when the shared quota is exhausted and leaves the reference usable", async () => {
  mocks.quota.mockRejectedValue(new HttpError(429, "Limit"));
  const response = await POST(
    request({
      action: "generate",
      notes: "Blue headings",
      reference_id: reference,
      current: defaultDesign,
    }),
  );
  expect(response.status).toBe(429);
  expect((await response.json()).error).toContain(
    "manual design controls remain available",
  );
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
