import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearSignalContent } from "../src/lib/resume-design/fixed-content";
import babycat from "./fixtures/owner-approved-babycat.json";
import { HttpError } from "../src/lib/http";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  linked: vi.fn(),
  cases: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/portfolio/case-study-server", () => ({
  loadCaseStudies: mocks.cases,
}));
import { POST } from "../src/app/api/admin/resume-content/route";
beforeEach(() => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue(undefined);
  mocks.cases.mockResolvedValue([]);
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: mocks.eq,
    order: mocks.linked,
  };
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.linked.mockResolvedValue({
    data: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Explicitly fictional owned project",
        archived_at: null,
      },
    ],
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: 5, error: null });
  mocks.account.mockResolvedValue({
    accountId: "verified-account",
    db: { from: mocks.from, rpc: mocks.rpc },
  });
});
afterEach(() => vi.unstubAllEnvs());
function request(
  content = {
    ...clearSignalContent,
    version: 4,
    projects: [...clearSignalContent.projects, babycat],
  },
  extra = {},
  origin = "https://portfolio.test",
) {
  return new Request("https://portfolio.test/api/admin/resume-content", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ content, ...extra }),
  });
}
it("identifies an unavailable evidence UUID without saving or exposing foreign records", async () => {
  const response = await POST(request());
  expect(response.status).toBe(422);
  const result = await response.json();
  expect(result.code).toBe("INVALID_PROJECT");
  expect(result.invalid_bindings).toEqual([
    { id: babycat.id, title: babycat.title, record_id: babycat.record_id },
  ]);
  expect(mocks.eq).toHaveBeenCalledWith("account_id", "verified-account");
  expect(result.project_options).toEqual([
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Explicitly fictional owned project",
    },
  ]);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("allows explicitly unlinked approved text with all six bullets and the original homepage", async () => {
  const content = {
    ...clearSignalContent,
    version: 4,
    projects: [...clearSignalContent.projects, { ...babycat, record_id: null }],
  };
  const response = await POST(request(content));
  expect(response.status).toBe(200);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("save_resume_fixed_content", {
    p_account: "verified-account",
    p_spec: content,
  });
  expect((await response.json()).content.projects[2]).toEqual({
    ...babycat,
    record_id: null,
  });
});
it("retains a valid owned evidence binding", async () => {
  mocks.linked.mockResolvedValue({
    data: [{ id: babycat.record_id }],
    error: null,
  });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.rpc.mock.calls[0][1].p_spec.projects[2]).toEqual(babycat);
});
it("lists the same BabyCat alias as Selected Projects, retaining its actual canonical title and UUID", async () => {
  const id = "937f2379-7dbc-4eae-a12f-5c3dacc13b0c";
  mocks.linked.mockResolvedValue({
    data: [
      {
        id,
        title: "Configurable Excel and VBA Rules Engine",
        archived_at: null,
      },
    ],
    error: null,
  });
  const response = await POST(request());
  const result = await response.json();
  expect(result.project_options).toEqual([
    {
      id,
      title: "BabyCat / Rules Engine — Configurable Excel and VBA Rules Engine",
    },
  ]);
  expect(result.invalid_bindings[0].record_id).toBe(babycat.record_id);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.cases).toHaveBeenCalledWith(
    expect.anything(),
    "verified-account",
  );
});
it("uses the owner's saved showcase title without hiding the underlying project identity or listing archived records", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  mocks.linked.mockResolvedValue({
    data: [
      { id, title: "Fictional original career title", archived_at: null },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "Fictional archived project",
        archived_at: "2026-01-01",
      },
    ],
    error: null,
  });
  mocks.cases.mockResolvedValue([
    { project_id: id, content: { title: "Fictional showcase title" } },
  ]);
  expect((await (await POST(request())).json()).project_options).toEqual([
    { id, title: "Fictional showcase title — Fictional original career title" },
  ]);
});
it("distinguishes a stale revision from content validation and sanitizes unknown database failures", async () => {
  mocks.linked.mockResolvedValue({
    data: [{ id: babycat.record_id }],
    error: null,
  });
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "STALE_CONTENT" },
  });
  const stale = await POST(request());
  expect(stale.status).toBe(409);
  expect((await stale.json()).code).toBe("STALE_CONTENT");
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "private database diagnostic" },
  });
  const failure = await POST(request());
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("private database diagnostic");
});
it("verifies the owner and rejects browser account authority and cross-origin writes before querying", async () => {
  expect(
    (await POST(request(undefined, { account_id: "foreign" }))).status,
  ).toBe(400);
  expect(
    (await POST(request(undefined, {}, "https://foreign.test"))).status,
  ).toBe(403);
  mocks.owner.mockRejectedValue(new HttpError(403, "Owner required"));
  expect((await POST(request())).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
