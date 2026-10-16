import { expect, it } from "vitest";
import { packets } from "../src/lib/career-brain/packets";
import { brainFixture, claimFixture } from "./fixtures/project-case";

it("finds late stack facts without losing ownership or negative evidence and stays bounded", () => {
  const ownership = claimFixture(
    "Defined the fictional design with substantial AI implementation assistance.",
    { attribute: "ownership" },
  );
  const denial = claimFixture("No production deployment is established.", {
    attribute: "denial",
    attribution: "NEGATED",
  });
  const maturity = claimFixture(
    "The fictional project is not production-ready.",
    {
      attribute: "context",
      attribution: "NEGATED",
    },
  );
  const stack = claimFixture(
    "The fictional project uses Python and Azure Functions.",
    { attribute: "tool", attribution: "EXPOSURE" },
  );
  const claims = [
    ownership,
    denial,
    maturity,
    ...Array.from({ length: 24 }, (_, index) =>
      claimFixture(`Fictional unrelated activity ${index}.`),
    ),
    stack,
  ];
  const project = brainFixture({ claims });
  const before = JSON.stringify(project);
  const packet = packets(
    [project],
    [project.id],
    8,
    "What technology stack does the project use?",
  )[0];
  expect(packet.claims).toContainEqual(stack);
  expect(packet.claims).toContainEqual(ownership);
  expect(packet.claims).toContainEqual(denial);
  expect(packet.claims).toContainEqual(maturity);
  expect(packet.claims.length).toBeLessThanOrEqual(16);
  expect(
    packet.claims
      .flatMap((c) => c.evidence)
      .reduce((size, span) => size + span.quote.length, 0),
  ).toBeLessThanOrEqual(10000);
  expect(JSON.stringify(project)).toBe(before);
});

it("selects relevant decisions and capabilities instead of the first generic project actions", () => {
  const noise = Array.from({ length: 20 }, (_, index) =>
    claimFixture(`Fictional general activity ${index}.`),
  );
  const choice = claimFixture(
    "Chose a native video element for timed checkpoints instead of an embedded player.",
    { attribute: "context" },
  );
  const capability = claimFixture(
    "Catalog exports freeze rule revisions and require approval before delivery.",
    { attribute: "scope" },
  );
  const project = brainFixture({ claims: [...noise, choice, capability] });
  expect(packets([project], [project.id])[0].claims).not.toContainEqual(choice);
  expect(
    packets(
      [project],
      [project.id],
      8,
      "Why choose native video checkpoints?",
    )[0].claims,
  ).toContainEqual(choice);
  expect(
    packets(
      [project],
      [project.id],
      8,
      "How do catalog exports and approval work?",
    )[0].claims,
  ).toContainEqual(capability);
  expect(
    packets([{ ...project, published: false }], [project.id], 8, "What stack?"),
  ).toEqual([]);
  expect(
    packets([{ ...project, archived: true }], [project.id], 8, "What stack?"),
  ).toEqual([]);
});

it("finds detailed capabilities in exact supporting quotes when a normalized claim is broader", () => {
  const quote =
    "The fictional platform supports multiple-choice quizzes and free-text answers.";
  const assessment = claimFixture("Fictional course assessment features.", {
    attribute: "scope",
    evidence: [{ quote, start: 0, end: quote.length }],
  });
  const project = brainFixture({
    claims: [
      ...Array.from({ length: 24 }, (_, i) =>
        claimFixture(`Other fictional activity ${i}.`),
      ),
      assessment,
    ],
  });
  expect(
    packets(
      [project],
      [project.id],
      8,
      "Does it support multiple-choice quizzes?",
    )[0].claims,
  ).toContainEqual(assessment);
});
