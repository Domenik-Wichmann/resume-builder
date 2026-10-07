import { expect, it, vi } from "vitest";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import { fixture } from "../src/lib/career/fixture";

const loader = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/career-brain/repository", () => ({ loadBrain: loader }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
vi.mock("../src/lib/db", () => ({ database: () => ({}) }));
import { getPortfolioStory } from "../src/lib/portfolio/story-server";

function record(): BrainRecord {
  const quote = "Fictional owner wrote SQL queries for a reporting project.";
  return {
    id: fixture.projects[0].id,
    key: "test",
    kind: "project",
    title: fixture.projects[0].title,
    subtitle: "Fictional test",
    organization: null,
    start_date: null,
    end_date: null,
    summary: "Not source evidence",
    source_quote: "PRIVATE WHOLE DOCUMENT",
    skill_keys: ["sql"],
    achievement_keys: [],
    category_key: null,
    uncertainties: [],
    aliases: [],
    published: true,
    archived: false,
    hash: "internal-hash",
    updated_at: "internal-version",
    evidence_version: "internal-proof",
    claims: [
      {
        attribute: "action",
        value: "Wrote SQL reporting queries",
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [{ quote, start: 0, end: quote.length }],
      },
    ],
  };
}

function skill(): BrainRecord {
  const row = record();
  const quote = "Fictional SQL skill.";
  return {
    ...row,
    id: "skill-id",
    key: "sql",
    kind: "skill",
    title: "SQL",
    skill_keys: [],
    claims: [
      {
        ...row.claims[0],
        value: "SQL",
        evidence: [{ quote, start: 0, end: quote.length }],
      },
    ],
  };
}

it("projects only confirmed public quote excerpts, excluding private source documents and metadata", async () => {
  loader.mockResolvedValue([record(), skill()]);
  const story = await getPortfolioStory();
  expect(loader).toHaveBeenCalledWith({}, expect.any(String), true);
  expect(story.evidence?.source?.quote).toBe(
    record().claims[0].evidence[0].quote,
  );
  expect(story.evidence?.source?.claims).toEqual([
    "Wrote SQL reporting queries",
  ]);
  const serialized = JSON.stringify(story);
  for (const forbidden of [
    record().id,
    "PRIVATE WHOLE DOCUMENT",
    "internal-hash",
    "internal-proof",
  ])
    expect(serialized).not.toContain(forbidden);
});

it("keeps every supporting span together rather than implying one excerpt supports the whole claim", async () => {
  const row = record();
  const extra = "Fictional second passage documents the reporting context.";
  row.claims[0].evidence.push({ quote: extra, start: 0, end: extra.length });
  loader.mockResolvedValue([row, skill()]);
  const story = await getPortfolioStory();
  expect(story.evidence?.source?.quote).toBe(
    `${row.claims[0].evidence[0].quote}\n\n${extra}`,
  );
});

it.each(["private", "archived", "pending", "uncertain", "invalid span"])(
  "does not expose %s quote excerpts",
  async (condition) => {
    const row = record();
    if (condition === "private") row.published = false;
    if (condition === "archived") row.archived = true;
    if (condition === "pending") row.claims[0].availability = "PENDING_REVIEW";
    if (condition === "uncertain") row.claims[0].attribution = "UNCERTAIN";
    if (condition === "invalid span") row.claims[0].evidence[0].end = 1;
    loader.mockResolvedValue([row, skill()]);
    const story = await getPortfolioStory();
    expect(story.evidence?.source ?? null).toBeNull();
    expect(JSON.stringify(story)).not.toContain(
      row.claims[0].evidence[0].quote,
    );
  },
);

it("precomputes answers only from usable public claims and preserves attribution scope", async () => {
  const row = record();
  row.claims.push({
    ...row.claims[0],
    value: "PRIVATE PENDING FACT",
    availability: "PENDING_REVIEW",
  });
  row.claims.push({
    ...row.claims[0],
    value: "Contributed to a team workflow",
    attribution: "TEAM",
  });
  loader.mockResolvedValue([row, skill()]);
  const story = await getPortfolioStory();
  const examples = JSON.stringify(story.questionExamples);
  expect(examples).toContain("Team work: Contributed to a team workflow");
  expect(examples).not.toContain("PRIVATE PENDING FACT");
  expect(examples).not.toContain("PRIVATE WHOLE DOCUMENT");
  expect(examples).not.toContain("internal-hash");
  expect(
    story.schemaEntities.find((entity) => entity.kind === "Achievement")
      ?.linked,
  ).toBe(false);
});
