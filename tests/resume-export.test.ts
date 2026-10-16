import { expect, it } from "vitest";
import {
  wordDocument,
  exportSections,
  exportWorkAuthorization,
  exportTimeline,
} from "../src/lib/resume-export";
import { designPreview } from "../src/lib/resume-design/preview";

it("exports visible résumé content without internal evidence, locked IDs, priorities or private metadata", () => {
  const ir = structuredClone(designPreview);
  ir.experiences[0].evidence_ids = ["secret-evidence-id"];
  ir.experiences[0].locked_id = "secret-locked-id";
  ir.experiences[0].priority = 918273;
  ir.experiences[0].timeline_note =
    "Reported start: Sep 2022 · end date unconfirmed";
  ir.summary = '<script>alert("untrusted text")</script>';
  ir.profile.contact.work_authorization = "German citizen · Available to work";
  ir.portfolio_url = "https://example.invalid";
  ir.github_url = "https://github.com/example";
  const document = wordDocument(ir);
  expect(document).toContain("&lt;script&gt;");
  expect(document).not.toContain("<script>");
  expect(document).not.toContain("secret-evidence-id");
  expect(document).not.toContain("secret-locked-id");
  expect(document).not.toContain("918273");
  expect(document).not.toContain("Reported start: Sep 2022");
  expect(document).not.toContain("end date unconfirmed");
  expect(document).toContain(ir.profile.name);
  expect(document).toContain('<td class="citizenship">German citizen</td>');
  expect(document).toContain("<strong>GitHub:</strong>");
  expect(document).not.toContain("Available to work");
  expect(exportWorkAuthorization(ir)).toBe("German citizen");
  expect(exportSections(ir).some((section) => section.records.length)).toBe(
    true,
  );
});

it("omits incomplete timelines in exports without inferring current employment", () => {
  const record = structuredClone(designPreview.experiences[0]);
  for (const dates of [
    { start: "2022-01-01", end: null },
    { start: null, end: "2023-01-01" },
    { start: null, end: null },
  ])
    expect(exportTimeline({ ...record, dates })).toBe("");
  expect(
    exportTimeline({
      ...record,
      dates: { start: "2022-01-01", end: "2023-01-01" },
    }),
  ).toBe("2022-01-01 – 2023-01-01");
});
