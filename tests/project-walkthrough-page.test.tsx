import React from "react";
import { expect, it, vi, afterEach } from "vitest";
import { demoProject, demoCaseContent } from "../src/lib/portfolio/demo";
import { fixture } from "../src/lib/career/fixture";
import { portfolioStory } from "../src/lib/portfolio/story";
const mocks = vi.hoisted(() => ({ details: vi.fn(), story: vi.fn() }));
vi.mock("../src/lib/portfolio/showcase-server", () => ({
  publicProjectDetails: mocks.details,
}));
vi.mock("../src/lib/portfolio/story-server", () => ({
  getPortfolioStory: mocks.story,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import ProjectPage from "../src/app/projects/[slug]/page";
import { PortfolioStoryHero } from "../src/components/portfolio-story";
function contains(element: React.ReactNode, type: React.ElementType): boolean {
  if (!React.isValidElement<{ children?: React.ReactNode }>(element))
    return false;
  return (
    element.type === type ||
    React.Children.toArray(element.props.children).some((child) =>
      contains(child, type),
    )
  );
}
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("attaches the walkthrough to the published Resume Builder record without changing other project pages", async () => {
  vi.stubEnv("APP_MODE", "live");
  mocks.story.mockResolvedValue(portfolioStory(fixture));
  const item = {
    project: {
      ...demoProject,
      id: "2cf5bf4e-7fc1-4616-a8cd-8c014710392b",
      slug: "owner-chosen-slug",
    },
    content: demoCaseContent,
    skills: [],
    media: [],
  };
  mocks.details.mockResolvedValue([item]);
  const result = await ProjectPage({
    params: Promise.resolve({ slug: "owner-chosen-slug" }),
  });
  expect(contains(result, PortfolioStoryHero)).toBe(true);
  expect(mocks.details).toHaveBeenCalledWith({ slug: "owner-chosen-slug" });
  mocks.story.mockClear();
  mocks.details.mockResolvedValue([
    {
      ...item,
      project: {
        ...item.project,
        id: demoProject.id,
        title: "A different project",
      },
    },
  ]);
  expect(
    contains(
      await ProjectPage({ params: Promise.resolve({ slug: "other" }) }),
      PortfolioStoryHero,
    ),
  ).toBe(false);
  expect(mocks.story).not.toHaveBeenCalled();
});
it("never renders a walkthrough for an unavailable or unpublished project", async () => {
  mocks.details.mockResolvedValue([]);
  await expect(
    ProjectPage({ params: Promise.resolve({ slug: "unpublished" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.story).not.toHaveBeenCalled();
});
