import { expect, it } from "vitest";
import {
  skillContextIssue,
  type SkillContext,
} from "../src/lib/applications/skill-context";
const good =
  "Built a supplier catalog import with spreadsheet rules to catch duplicate product identifiers before preparing marketplace feeds.";
const context: SkillContext = {
  subject: "supplier catalog import",
  purpose:
    "catch duplicate product identifiers before preparing marketplace feeds",
  requirement_index: 0,
  priority: "CORE",
};
it("requires completed-work evidence, not only a confirmed method/tool list", () => {
  expect(skillContextIssue(good, context, false, 1)).toContain(
    "actual project",
  );
  expect(skillContextIssue(good, context, true, 1)).toBeUndefined();
});
it("rejects the reported generic project-runs sentence even if a reviewer approves it", () => {
  const text =
    "Compared project runs using frozen fixtures, repeatability checks, provenance, and cost analysis to assess whether changes behaved consistently.";
  expect(
    skillContextIssue(
      text,
      {
        ...context,
        subject: "project runs",
        purpose: "assess whether changes behaved consistently",
      },
      true,
      1,
    ),
  ).toContain("generic project");
});
it("does not accept context supplied only in private reviewer notes", () => {
  expect(
    skillContextIssue(
      good,
      { ...context, subject: "receipt recognition" },
      true,
      1,
    ),
  ).toContain("explicit");
  expect(skillContextIssue(good, null, true, 1)).toContain("concrete work");
});
it.each([null, 1, 7])(
  "requires a real job-requirement index, received %s",
  (index) => {
    expect(
      skillContextIssue(
        good,
        { ...context, requirement_index: index },
        true,
        1,
      ),
    ).toContain("job requirement");
  },
);
