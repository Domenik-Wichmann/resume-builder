import { beforeEach, expect, it, vi } from "vitest";
import { projectFixture, brainFixture } from "./fixtures/project-case";
import { priorityProjectIds } from "../src/lib/portfolio/selection";
import { projectContextSchema } from "../src/lib/portfolio/project-context";

const mocks = vi.hoisted(() => ({
  projects: vi.fn(),
  brain: vi.fn(),
  cases: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ database: () => ({}) }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
vi.mock("../src/lib/portfolio/repository", () => ({
  publicProjects: mocks.projects,
  projectMedia: async () => [],
}));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.brain,
}));
vi.mock("../src/lib/portfolio/case-study-server", async (original) => ({
  ...(await original<
    typeof import("../src/lib/portfolio/case-study-server")
  >()),
  loadCaseStudies: mocks.cases,
}));
import { publicProjectContext } from "../src/lib/portfolio/showcase-server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cases.mockResolvedValue([]);
});

it("adds the three public priorities ahead of cited supporting projects and exposes only published links", async () => {
  const supporting = projectFixture();
  const priority = priorityProjectIds.map((id, index) =>
    projectFixture({
      id,
      slug: `fictional-priority-${index}`,
      links: [
        {
          label: "Live fixture",
          url: "https://fictional.example",
          link_type: "LIVE",
          is_public: true,
          display_order: 0,
        },
        {
          label: "Private fixture",
          url: "https://private.example",
          link_type: "OTHER",
          is_public: false,
          display_order: 1,
        },
      ],
    }),
  );
  mocks.projects.mockResolvedValue([supporting, ...priority].reverse());
  mocks.brain.mockResolvedValue(
    [supporting, ...priority].map(({ id }) => brainFixture({ id })),
  );
  const result = await publicProjectContext(
    [supporting.id],
    "What projects has he built?",
    false,
  );
  expect(result.projects.map((project) => project.url)).toEqual(
    [...priority, supporting].map((p) => `/projects/${p.slug}`),
  );
  expect(JSON.stringify(result)).not.toContain("private.example");
  expect(result.projects[1].links).toContainEqual({
    label: "Live fixture",
    url: "https://fictional.example",
  });
  expect(projectContextSchema.safeParse(result).success).toBe(true);
});

it("does not expose priority projects when their canonical evidence is unpublished or archived", async () => {
  mocks.projects.mockResolvedValue(
    priorityProjectIds.map((id) => projectFixture({ id })),
  );
  mocks.brain.mockResolvedValue([
    brainFixture({ id: priorityProjectIds[0], published: false }),
    brainFixture({ id: priorityProjectIds[1], archived: true }),
  ]);
  expect(
    (await publicProjectContext([], "Show his projects", false)).projects,
  ).toEqual([]);
});
