import { expect, it } from "vitest";
import {
  resumeExperiencePreference,
  resumeStyleIssue,
} from "../src/lib/resume-relevance";
import {
  validateVerification,
  type BulletInput,
} from "../src/lib/career-brain/bullets";
import { brainFixture } from "./fixtures/project-case";
import {
  selectInventory,
  recoveryInventory,
  admittedInputs,
  packetInventory,
} from "../src/lib/applications/generation";

const plan = {
  focus: "Software and data engineering",
  requirements: [
    {
      requirement: "Build data automation",
      importance: "ESSENTIAL" as const,
      query: "data automation",
      transferable_query: "business operations",
    },
  ],
};
const business = brainFixture({
  id: "9c46d2d1-e8f1-4b23-a5f1-04db8ca763e3",
  kind: "experience",
  organization: "Juno Freeze Dried LTD / Juno Farms",
  title: "Fictional business fixture",
});
const support = brainFixture({
  id: "057c18d5-d70a-4fff-9ccc-d1ca94e02e99",
  kind: "experience",
  organization: "Sutherland",
  title: "Fictional phone support fixture",
});

it("prefers the business to phone support for technical roles without inventing evidence", () => {
  const original = JSON.stringify([business, support]);
  expect(
    selectInventory([support, business], plan, [support.id]).map((r) => r.id),
  ).toEqual([business.id]);
  expect(
    recoveryInventory([support, business], [], plan).map((p) => p.id),
  ).toEqual([business.id]);
  expect(JSON.stringify([business, support])).toBe(original);
  expect(
    selectInventory([{ ...business, published: false }, support], plan, []),
  ).toEqual([]);
});

it("keeps support available for German and actual customer-support roles", () => {
  for (const focus of [
    "German-speaking software engineer",
    "Technical support engineer",
    "Customer service associate",
  ]) {
    const role = { ...plan, focus };
    expect(resumeExperiencePreference(support, focus)).toBe(0);
    expect(
      selectInventory([business, support], role, [support.id]),
    ).toContainEqual(support);
  }
});

it("rejects third-person assessment prose even when a factual verifier returns PASS", () => {
  for (const bullet of [
    "He built a fictional interface.",
    "His experience includes SQL.",
    "Evidence suggests SQL skills.",
    "Worked from January to end date unconfirmed.",
    "I only use this personally, not as a team-wide tool.",
    "Used ChatGPT only for personal use.",
    "Built a prototype, not production experience.",
    "Used an assistant without professional experience.",
  ]) {
    const input: BulletInput = {
      ...admittedInputs(packetInventory([business]), "")[0],
      id: "fixture",
      bullet,
    };
    expect(
      validateVerification(input, {
        id: "fixture",
        verdict: "PASS",
        assertions: [
          {
            text: bullet,
            verdict: "SUPPORTED",
            claimRefs: [input.claims[0].ref],
            reason: "Fictional verifier approval of the complete statement",
          },
        ],
        reason: "Fictional verifier approval",
      }).verdict,
    ).toBe("REVIEW");
  }
  for (const text of [
    "Built an AI-assisted prototype.",
    "I co-founded a business.",
    "Contributed to the team's data workflow.",
    "Reported customer incidents and resolved support requests.",
    "Python (basic)",
    "Built a personal RAG assistant to search my documents.",
    "Prototyped a course chatbot grounded in training material.",
  ]) {
    expect(resumeStyleIssue(text)).toBeUndefined();
  }
});
