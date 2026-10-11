import { expect, it, vi } from "vitest";
import type { Project } from "../src/lib/portfolio/model";
const reads = vi.hoisted(() => ({ projects: vi.fn(), media: vi.fn() }));
vi.mock("../src/lib/portfolio/repository", () => ({
  publicProjects: reads.projects,
  projectMedia: reads.media,
}));
vi.mock("../src/lib/db", () => ({ database: () => "server-client" }));
import { publicShowcase } from "../src/lib/portfolio/showcase-server";
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
it("reads media only for selected public parents in the primary account and projects a minimal card", async () => {
  const ids = Object.keys(selectedProjectNames);
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
    },
  ]);
  const cards = await publicShowcase();
  expect(reads.media).toHaveBeenCalledExactlyOnceWith(
    "server-client",
    primaryAccountId,
    ids[0],
  );
  expect(showcaseSchema.safeParse({ projects: cards }).success).toBe(true);
  expect(cards[0].summary).toBe("Published summary");
  expect(JSON.stringify(cards)).not.toContain("Private fields");
  expect(JSON.stringify(cards)).not.toContain(ids[0]);
});
