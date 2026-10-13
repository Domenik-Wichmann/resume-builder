import { expect, it } from "vitest";
import {
  newProjectLink,
  projectLinkUrl,
} from "../src/lib/portfolio/edit-links";
import { linkSchema } from "../src/lib/portfolio/model";
it("accepts pasted project domains and preserves supported internal routes", () => {
  expect(projectLinkUrl(" example.com/demo ")).toBe("https://example.com/demo");
  expect(projectLinkUrl("/projects/resume-builder")).toBe(
    "/projects/resume-builder",
  );
});
it.each([
  "javascript:alert(1)",
  "data:text/html,evil",
  "http://example.com",
  "https://user:password@example.com",
  "//evil.test",
  "https://example.com\\evil",
  "/admin/projects",
])("does not normalize unsafe links into accepted URLs: %s", (value) => {
  expect(
    linkSchema.safeParse({
      ...newProjectLink("LIVE", 0),
      url: projectLinkUrl(value),
    }).success,
  ).toBe(false);
});
