import { expect, it } from "vitest";
import babycat from "./fixtures/owner-approved-babycat.json";
import {
  clearSignalContent,
  fixedContentSchema,
  applyFixedContent,
  withTrackingUrl,
} from "../src/lib/resume-design/fixed-content";
import { designPreview } from "../src/lib/resume-design/preview";
import { wordDocument } from "../src/lib/resume-export";
// This is the owner's exact approved block from the request, not invented evidence.
it("accepts the supplied third project with all six approved bullets and exports its own homepage", () => {
  const fixed = fixedContentSchema.parse({
    ...clearSignalContent,
    learning_demo: "https://example.test/lms-learning",
    projects: [...clearSignalContent.projects, babycat],
  });
  const ir = withTrackingUrl(
    applyFixedContent(designPreview, fixed),
    "saved001",
  );
  expect(ir.projects.map((project) => project.locked_id)).toEqual([
    "personal_portfolio",
    "lms",
    "babycat",
  ]);
  expect(ir.projects[2].bullets).toEqual(babycat.bullets);
  expect(ir.projects[2].links).toEqual([
    { label: "Homepage", url: babycat.homepage },
  ]);
  expect(ir.projects[0].links?.[0].url).toContain("/r/saved001");
  expect(ir.projects[1].links?.[1].url).toBe(fixed.learning_demo);
  const doc = wordDocument(ir);
  expect(doc).toContain(babycat.homepage);
  for (const bullet of babycat.bullets) expect(doc).toContain(bullet);
});
it("does not impose an item count and keeps identity-based links correct when blocks are reordered or removed", () => {
  expect(
    fixedContentSchema.parse({ ...clearSignalContent, projects: [] }).projects,
  ).toEqual([]);
  expect(
    fixedContentSchema.parse({
      ...clearSignalContent,
      projects: Array.from({ length: 40 }, (_, index) => ({
        ...babycat,
        id: `extra-${index}`,
      })),
    }).projects,
  ).toHaveLength(40);
  const fixed = fixedContentSchema.parse({
    ...clearSignalContent,
    learning_demo: "https://example.test/learning",
    projects: [babycat, ...clearSignalContent.projects],
  });
  const ir = applyFixedContent(designPreview, fixed);
  expect(ir.projects[0].links).toEqual([
    { label: "Homepage", url: babycat.homepage },
  ]);
  expect(ir.projects[1].links?.[0].portfolio).toBe(true);
  expect(ir.projects[2].links?.[1].label).toBe("Learning demo");
  expect(
    applyFixedContent(designPreview, { ...fixed, projects: [babycat] })
      .projects[0].links,
  ).toEqual([{ label: "Homepage", url: babycat.homepage }]);
});
it("still rejects duplicate block IDs and unsafe links", () => {
  expect(
    fixedContentSchema.safeParse({
      ...clearSignalContent,
      projects: [babycat, babycat],
    }).success,
  ).toBe(false);
  expect(
    fixedContentSchema.safeParse({
      ...clearSignalContent,
      projects: [{ ...babycat, homepage: "javascript:alert(1)" }],
    }).success,
  ).toBe(false);
});
