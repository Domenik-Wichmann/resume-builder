import { expect, it } from "vitest";
import { wordDocument, exportSections } from "../src/lib/resume-export";
import { designPreview } from "../src/lib/resume-design/preview";

it("exports visible résumé content without internal evidence, locked IDs, priorities or private metadata", () => {
  const ir = structuredClone(designPreview);
  ir.experiences[0].evidence_ids = ["secret-evidence-id"];
  ir.experiences[0].locked_id = "secret-locked-id";
  ir.experiences[0].priority = 918273;
  ir.experiences[0].timeline_note =
    "Reported start: Sep 2022 · end date unconfirmed";
  ir.summary = '<script>alert("untrusted text")</script>';
  const document = wordDocument(ir);
  expect(document).toContain("&lt;script&gt;");
  expect(document).not.toContain("<script>");
  expect(document).not.toContain("secret-evidence-id");
  expect(document).not.toContain("secret-locked-id");
  expect(document).not.toContain("918273");
  expect(document).toContain("Reported start: Sep 2022");
  expect(document).toContain(ir.profile.name);
  expect(exportSections(ir).some((section) => section.records.length)).toBe(
    true,
  );
});
