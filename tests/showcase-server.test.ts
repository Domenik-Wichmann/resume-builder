import { beforeEach, expect, it, vi } from "vitest";
import type { Project } from "../src/lib/portfolio/model";
const reads = vi.hoisted(() => ({
  projects: vi.fn(),
  media: vi.fn(),
  brain: vi.fn(),
  cases: vi.fn(),
}));
vi.mock("../src/lib/portfolio/repository", () => ({
  publicProjects: reads.projects,
  projectMedia: reads.media,
}));
vi.mock("../src/lib/db", () => ({ database: () => "server-client" }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: reads.brain,
}));
vi.mock("../src/lib/portfolio/case-study-server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/lib/portfolio/case-study-server")
  >()),
  loadCaseStudies: reads.cases,
}));
import {
  publicShowcase,
  publicProjectContext,
} from "../src/lib/portfolio/showcase-server";
import { fillCaseStudy } from "../src/lib/portfolio/case-study-server";
import {
  projectFixture,
  brainFixture,
  claimFixture,
} from "./fixtures/project-case";
import { primaryAccountId } from "../src/lib/account-id";
import {
  selectedProjectNames,
  showcaseSchema,
} from "../src/lib/portfolio/selection";
function project(id: string, patch: Partial<Project> = {}): Project {
  return {
    id,
    title: "Fictional fixture",
    slug: "fictional-fixture",
    subtitle: "Published subtitle",
    summary: "Published summary",
    description: "Private fields must not enter the card contract",
    organization: null,
    start_date: null,
    end_date: null,
    status: "ACTIVE",
    featured: false,
    is_public: true,
    archived: false,
    display_order: 0,
    skill_ids: [],
    achievement_ids: [],
    links: [],
    updated_at: "2026-01-01",
    ...patch,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  reads.projects.mockResolvedValue([projectFixture()]);
  reads.brain.mockResolvedValue([brainFixture()]);
  reads.cases.mockResolvedValue([]);
  reads.media.mockResolvedValue([]);
});
it("reads media only for selected public parents in the primary account and projects a minimal card", async () => {
  const ids = Object.keys(selectedProjectNames);
  reads.brain.mockResolvedValue([brainFixture({ id: ids[0] })]);
  reads.projects.mockResolvedValue([
    project(ids[0]),
    project(ids[1], { is_public: false }),
    project(ids[2], { archived: true }),
    project("unselected"),
  ]);
  reads.media.mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000001",
      project_id: ids[0],
      alt: "Published cover",
      is_cover: true,
      is_public: true,
    },
  ]);
  const cards = await publicShowcase();
  expect(reads.media).toHaveBeenCalledExactlyOnceWith(
    "server-client",
    primaryAccountId,
    ids[0],
    true,
  );
  expect(showcaseSchema.safeParse({ projects: cards }).success).toBe(true);
  expect(cards[0].summary).toBe("Built a fictional graph-review interface.");
  expect(JSON.stringify(cards)).not.toContain("Private fields");
  expect(JSON.stringify(cards)).not.toContain(ids[0]);
});
it("serves saved presentation text only while it is explicitly published and its claim fingerprint remains current", async () => {
  const draft = fillCaseStudy(projectFixture(), brainFixture());
  draft.content.summary = "Private case-study text";
  draft.content.links = [
    {
      label: "Private repo",
      url: "https://github.com/example/private",
      is_public: false,
      link_type: "GITHUB",
      display_order: 0,
    },
  ];
  reads.cases.mockResolvedValue([draft]);
  expect(JSON.stringify(await publicShowcase())).not.toContain(
    "Private case-study text",
  );
  draft.is_public = true;
  reads.cases.mockResolvedValue([draft]);
  expect(JSON.stringify(await publicShowcase())).toContain(
    "Private case-study text",
  );
  reads.brain.mockResolvedValue([
    brainFixture({ claims: [claimFixture("Different current fact.")] }),
  ]);
  expect(JSON.stringify(await publicShowcase())).not.toContain(
    "Private case-study text",
  );
});
it("honors an explicit manager selection override and refuses unpublished or ungrounded parents", async () => {
  reads.cases.mockResolvedValue([
    { ...fillCaseStudy(projectFixture(), brainFixture()), selected: false },
  ]);
  expect(await publicShowcase()).toEqual([]);
  reads.cases.mockResolvedValue([]);
  reads.brain.mockResolvedValue([brainFixture({ published: false })]);
  expect(await publicShowcase()).toEqual([]);
  reads.brain.mockResolvedValue([
    brainFixture({
      claims: [claimFixture("Disputed", { availability: "DISPUTED" })],
    }),
  ]);
  expect(await publicShowcase()).toEqual([]);
  expect(reads.media).not.toHaveBeenCalled();
});
it("returns real project URLs and only relevant published screenshots for cited projects", async () => {
  const mediaId = "22222222-2222-4222-8222-222222222222";
  reads.media.mockResolvedValue([
    {
      id: mediaId,
      project_id: projectFixture().id,
      alt: "Graph review",
      caption: "Approval controls",
      is_cover: false,
      is_public: true,
      display_order: 0,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      project_id: projectFixture().id,
      alt: "Private graph",
      caption: "Secret approval",
      is_cover: false,
      is_public: false,
      display_order: 0,
    },
  ]);
  const result = await publicProjectContext(
    [projectFixture().id],
    "graph approval",
    false,
  );
  expect(result.projects[0].url).toBe("/projects/fictional-workspace");
  expect(result.projects[0].images.map((image) => image.id)).toEqual([mediaId]);
  expect(JSON.stringify(result)).not.toContain("Secret");
  reads.media.mockClear();
  expect(
    await publicProjectContext(
      ["44444444-4444-4444-8444-444444444444"],
      "graph approval",
      false,
    ),
  ).toEqual({ projects: [] });
  expect(reads.media).not.toHaveBeenCalled();
});
