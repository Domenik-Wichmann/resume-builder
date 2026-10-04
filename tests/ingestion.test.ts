import { describe, it, expect } from "vitest";
import {
  candidateSchema,
  extractionSchema,
  type Candidate,
  type Canonical,
} from "../src/lib/ingestion/model";
import {
  diffCareer,
  semanticHash,
  verifyProvenance,
} from "../src/lib/ingestion/diff";
import { interviewQuestions } from "../src/lib/interview/questions";
const record: Candidate = {
  kind: "project",
  key: "validation-engine",
  title: "Validation engine",
  subtitle: "Operations",
  summary: "Built SQL validation for another team.",
  organization: null,
  start_date: null,
  end_date: null,
  skill_keys: ["sql"],
  achievement_keys: [],
  category_key: null,
  source_quote: "Built SQL validation for another team.",
  uncertainties: [],
};
function stored(patch: Partial<Canonical> = {}): Canonical {
  return {
    ...record,
    id: "11111111-1111-4111-8111-111111111111",
    hash: semanticHash(record),
    published: false,
    archived: false,
    updated_at: "2026-10-04T00:00:00Z",
    ...patch,
  };
}
describe("Career Master contracts and deterministic review", () => {
  it("rejects extra fields, invalid identity and inconsistent dates", () => {
    expect(
      extractionSchema.safeParse({ records: [{ ...record, magic: "fact" }] })
        .success,
    ).toBe(false);
    expect(
      candidateSchema.safeParse({ ...record, key: "Project Thing" }).success,
    ).toBe(false);
    expect(
      candidateSchema.safeParse({
        ...record,
        start_date: "2026-10-04",
        end_date: "2020-01-01",
      }).success,
    ).toBe(false);
  });
  it("distinguishes all five diff states and preserves UUID identity across wording updates", () => {
    expect(diffCareer([record], [], true)[0].status).toBe("ADDED");
    expect(diffCareer([record], [stored()], true)[0].status).toBe("UNCHANGED");
    const updated = diffCareer(
      [
        {
          ...record,
          summary: "Built SQL validation and trained another team.",
        },
      ],
      [stored()],
      true,
    )[0];
    expect(updated.status).toBe("UPDATED");
    expect(updated.before?.id).toBe(stored().id);
    expect(diffCareer([], [stored()], true)[0].status).toBe("REMOVED");
    expect(
      diffCareer([{ ...record, key: "new-key" }], [stored()], false)[0].status,
    ).toBe("REVIEW");
  });
  it("flags duplicate identities and unverified quotations; interview imports cannot imply removals", () => {
    expect(
      diffCareer([record, record], [], false).every(
        (row) => row.status === "REVIEW",
      ),
    ).toBe(true);
    const checked = verifyProvenance([record], "Nothing supports this claim.");
    expect(diffCareer(checked, [], false)[0].status).toBe("REVIEW");
    expect(diffCareer([], [stored()], false)).toEqual([]);
  });
  it("excludes provenance wording from semantic hashes and normalizes skill order", () => {
    expect(semanticHash({ ...record, skill_keys: ["sql", "python"] })).toBe(
      semanticHash({
        ...record,
        skill_keys: ["python", "sql"],
        source_quote: "Changed quotation",
      }),
    );
    expect(semanticHash({ ...record, summary: "Different facts" })).not.toBe(
      semanticHash(record),
    );
  });
});
describe("explainable career interview", () => {
  it("prioritizes missing evidence, suppresses repeated questions and keeps job gaps uncertain", () => {
    const rows = interviewQuestions(
      [stored()],
      "job",
      "SQL stakeholder requirements",
      "",
      [],
    );
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(rows.some((row) => row.reason.includes("not explicit"))).toBe(true);
    expect(
      interviewQuestions(
        [stored()],
        "job",
        "SQL stakeholder requirements",
        "",
        rows.map((row) => row.id),
      ).every((row) => !rows.some((old) => old.id === row.id)),
    ).toBe(true);
    const noEvidence = interviewQuestions([], "job", "SQL", "", []);
    expect(
      noEvidence.some((row) =>
        row.reason.includes("no explicit career evidence"),
      ),
    ).toBe(true);
  });
  it("limits a record interview to the selected canonical record", () => {
    expect(
      interviewQuestions(
        [stored(), stored({ key: "other", title: "Other" })],
        "record",
        "",
        "project:validation-engine",
      ).every((row) => row.record_key === "project:validation-engine"),
    ).toBe(true);
  });
});
