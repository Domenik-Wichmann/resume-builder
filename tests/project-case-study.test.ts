import { expect, it } from "vitest";
import {
  fillCaseStudy,
  caseEvidenceHash,
} from "../src/lib/portfolio/case-study-server";
import { screenshotDescription } from "../src/lib/portfolio/case-study";
import { relevantScreenshots } from "../src/lib/portfolio/project-context";
import {
  projectFixture,
  brainFixture,
  claimFixture,
} from "./fixtures/project-case";

it("fills a private presentation draft with confirmed facts while preserving team, exposure and uncertainty", () => {
  const record = brainFixture({
    claims: [
      claimFixture("Built a fictional graph-review interface."),
      claimFixture("Improved a fictional team workflow.", {
        attribution: "TEAM",
      }),
      claimFixture("A fictional Azure integration exists.", {
        attribute: "tool",
        attribution: "EXPOSURE",
      }),
      claimFixture("Deployment maturity is uncertain.", {
        attribution: "UNCERTAIN",
      }),
      claimFixture("Unsupported metric: 99% faster.", {
        availability: "DISPUTED",
      }),
      claimFixture("Pending proprietary detail.", {
        availability: "PENDING_REVIEW",
      }),
    ],
  });
  const draft = fillCaseStudy(projectFixture(), record);
  expect(draft.is_public).toBe(false);
  expect(draft.content.highlights).toContain(
    "Team contribution: Improved a fictional team workflow.",
  );
  expect(draft.content.implementation).toContain(
    "Project context: A fictional Azure integration exists.",
  );
  expect(draft.content.limitations).toContain(
    "Deployment maturity is uncertain.",
  );
  expect(JSON.stringify(draft.content)).not.toContain("99%");
  expect(JSON.stringify(draft.content)).not.toContain("proprietary");
  expect(draft.content.outcomes).toEqual([]);
});
it("invalidates case-study provenance after a claim becomes disputed without a canonical hash change", () => {
  const original = brainFixture();
  const updated = {
    ...original,
    claims: [{ ...original.claims[0], availability: "DISPUTED" as const }],
  };
  expect(updated.hash).toBe(original.hash);
  expect(caseEvidenceHash(updated)).not.toBe(caseEvidenceHash(original));
});
it("fills referenced repository URLs as private links requiring review, without inventing a live app URL", () => {
  const record = brainFixture({
    claims: [
      claimFixture(
        "Fictional repository https://github.com/example/fictional-project",
      ),
    ],
  });
  const draft = fillCaseStudy(projectFixture(), record);
  expect(draft.content.links).toEqual([
    expect.objectContaining({
      url: "https://github.com/example/fictional-project",
      is_public: false,
    }),
  ]);
});
it("uses descriptive filenames as editable labels without treating paths or instructions as code", () => {
  expect(
    screenshotDescription(
      "C:\\fakepath\\Sonaway_graph-review_approval-controls.PNG",
    ),
  ).toBe("Sonaway graph review approval controls");
  expect(screenshotDescription("graph%20review.png")).toBe("graph review");
  expect(screenshotDescription("SonawayGraphReview.png")).toBe(
    "Sonaway Graph Review",
  );
  expect(screenshotDescription("<script>alert(1)</script>.png")).toBe(
    "script>.png".replace(/\.png$/, ""),
  );
});
it("attaches only published screenshots with matching descriptive terms, or an explicit screenshot request", () => {
  const media = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      project_id: projectFixture().id,
      alt: "Graph review",
      caption: "Approve knowledge graph changes",
      source_filename: "graph_review_approval.png",
      is_public: true,
      is_cover: false,
      display_order: 1,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      project_id: projectFixture().id,
      alt: "Payroll",
      caption: "Payroll screen",
      is_public: true,
      is_cover: false,
      display_order: 2,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      project_id: projectFixture().id,
      alt: "Secret graph review",
      caption: "Graph approval",
      is_public: false,
      is_cover: true,
      display_order: 0,
    },
  ];
  expect(
    relevantScreenshots(media, "How does graph approval work?").map(
      (m) => m.id,
    ),
  ).toEqual([media[0].id]);
  expect(relevantScreenshots(media, "How does translation work?")).toEqual([]);
  expect(relevantScreenshots(media, "Show screenshots")).toHaveLength(2);
  expect(relevantScreenshots(media, "Show a translation screenshot")).toEqual(
    [],
  );
});
