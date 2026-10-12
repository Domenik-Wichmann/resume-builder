import { beforeEach, expect, it, vi } from "vitest";
import { projectFixture, brainFixture } from "./fixtures/project-case";
import { fillCaseStudy } from "../src/lib/portfolio/case-study-server";
import { HttpError } from "../src/lib/http";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  projects: vi.fn(),
  brain: vi.fn(),
  cases: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/portfolio/repository", () => ({
  loadProjects: mocks.projects,
}));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.brain,
}));
vi.mock("../src/lib/portfolio/case-study-server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/lib/portfolio/case-study-server")
  >()),
  loadCaseStudies: mocks.cases,
}));
vi.mock("../src/lib/env", () => ({
  validateEnv: () => ({ siteUrl: "https://portfolio.example", mode: "demo" }),
}));
import { POST } from "../src/app/api/admin/project-case-studies/route";
const request = (body: unknown) =>
  new Request("https://portfolio.example/api/admin/project-case-studies", {
    method: "POST",
    headers: {
      origin: "https://portfolio.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue({});
  mocks.account.mockResolvedValue({
    db: { rpc: mocks.rpc },
    accountId: "verified-membership-account",
  });
  mocks.projects.mockResolvedValue([projectFixture()]);
  mocks.brain.mockResolvedValue([brainFixture()]);
  mocks.cases.mockResolvedValue([]);
  mocks.rpc.mockResolvedValue({ data: "2026-02-01T00:00:00Z", error: null });
});
it("fills a private draft without persisting or changing canonical career records", async () => {
  const response = await POST(
    request({ action: "fill", project_id: projectFixture().id }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).draft.is_public).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires configured owner auth before private reads and rejects browser account authority", async () => {
  mocks.owner.mockRejectedValueOnce(new HttpError(403, "Owner required"));
  expect(
    (await POST(request({ action: "fill", project_id: projectFixture().id })))
      .status,
  ).toBe(403);
  expect(mocks.account).not.toHaveBeenCalled();
  expect(mocks.brain).not.toHaveBeenCalled();
  expect(
    (
      await POST(
        request({
          action: "fill",
          project_id: projectFixture().id,
          account_id: "forged",
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.brain).not.toHaveBeenCalled();
});
it("uses the verified JWT account and refuses a stale evidence fingerprint before writing", async () => {
  const draft = fillCaseStudy(projectFixture(), brainFixture());
  draft.source_hash = "f".repeat(64);
  expect((await POST(request({ action: "save", draft }))).status).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
  const fresh = fillCaseStudy(projectFixture(), brainFixture());
  expect((await POST(request({ action: "save", draft: fresh }))).status).toBe(
    200,
  );
  expect(mocks.rpc).toHaveBeenCalledWith(
    "save_project_case_study",
    expect.objectContaining({
      p_account: "verified-membership-account",
      p_project: projectFixture().id,
      p_public: false,
    }),
  );
});
