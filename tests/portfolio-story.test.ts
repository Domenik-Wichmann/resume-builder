import { describe, expect, it } from "vitest";
import { fixture } from "../src/lib/career/fixture";
import {
  deliberateStoryExit,
  portfolioStory,
  storyStep,
} from "../src/lib/portfolio/story";

describe("public story projection", () => {
  it("uses exact published passages and skill links without sending record identifiers", () => {
    const story = portfolioStory(fixture);
    expect(story.evidence?.passage).toBe(fixture.projects[0].summary);
    expect(story.evidence?.skills).toEqual(
      fixture.projects[0].skills.slice(0, 2),
    );
    expect(JSON.stringify(story)).not.toContain(fixture.projects[0].id);
    expect(story.demo).toBe(true);
  });
  it("uses the portfolio application when published and only selects its existing skill links", () => {
    const project = {
      ...fixture.projects[1],
      id: "published-app",
      title: "Resume Builder and Career Brain",
      skills: [
        "Database Concurrency and Transactions",
        "Vector Search and HNSW",
        "Supabase and PostgreSQL",
      ],
    };
    const story = portfolioStory({
      ...fixture,
      projects: [...fixture.projects, project],
    });
    expect(story.evidence?.title).toBe(project.title);
    expect(story.evidence?.passage).toBe(project.summary);
    expect(story.evidence?.skills).toEqual([
      "Vector Search and HNSW",
      "Supabase and PostgreSQL",
    ]);
    expect(JSON.stringify(story)).not.toContain(project.id);
  });
  it("does not manufacture evidence for an empty profile", () => {
    const story = portfolioStory({
      ...fixture,
      projects: [],
      experiences: [],
      skills: [],
    });
    expect(story.evidence).toBeNull();
    expect(story.highlights).toEqual([]);
    expect(story.questions).not.toContain("How have you used undefined?");
  });
  it("uses a real published work record for decomposition while retaining the application project separately", () => {
    const rules = {
      ...fixture.projects[0],
      id: "fictional-rules-id",
      title: "Configurable Excel and VBA Rules Engine",
      skills: ["Excel", "VBA", "Regex and Conditional Logic"],
      related_ids: [],
    };
    const app = {
      ...fixture.projects[1],
      id: "fictional-app-id",
      title: "Resume Builder and Career Brain",
    };
    const story = portfolioStory({ ...fixture, projects: [rules, app] });
    expect(story.modelEvidence?.title).toBe(rules.title);
    expect(story.modelEvidence?.skills).toEqual([
      "VBA",
      "Regex and Conditional Logic",
    ]);
    expect(story.evidence?.title).toBe(app.title);
    expect(JSON.stringify(story)).not.toContain(rules.id);
  });
  it("bounds the scroll chapters and requires a pause plus a fresh exit gesture", () => {
    expect(storyStep(-50, 400)).toBe(0);
    expect(storyStep(805, 400)).toBe(2);
    expect(storyStep(99999, 400)).toBe(7);
    expect(deliberateStoryExit(650, 0, 200)).toBe(false);
    expect(deliberateStoryExit(900, 0, 850)).toBe(false);
    expect(deliberateStoryExit(900, 0, 700)).toBe(true);
  });
});
