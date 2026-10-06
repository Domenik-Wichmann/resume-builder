import { describe, it, expect } from "vitest";
import {
  rankQuestions,
  rankTopics,
  summarizeAnalytics,
} from "../src/lib/analytics/model";
import { analyticsPath, pageViewSchema } from "../src/lib/tracking/paths";
describe("private analytics aggregation", () => {
  it("groups repeated wording without inventing semantic similarity", () => {
    const rows = [
      " SQL  experience? ",
      "sql experience?",
      "Database experience?",
    ].map((question) => ({
      question,
      answer: "",
      created_at: "2026-10-06T12:00:00Z",
    }));
    expect(rankQuestions(rows)).toEqual([
      { label: "SQL experience?", count: 2 },
      { label: "Database experience?", count: 1 },
    ]);
  });
  it("counts a topic once per question and preserves uncertain support", () => {
    const row = { topic: "SQL", question_id: "q1", evidence_strength: "NONE" };
    expect(
      rankTopics([
        row,
        row,
        { ...row, question_id: "q2", evidence_strength: "PARTIAL" },
      ]),
    ).toEqual([{ label: "SQL", count: 2, strong: 0, partial: 1, none: 1 }]);
  });
  it("zero fills UTC dates and counts sessions independently from views", () => {
    const visits = [
      {
        session_id: "a",
        link_id: null,
        page_path: "/",
        created_at: "2026-10-05T23:59:00Z",
      },
      {
        session_id: "a",
        link_id: "link",
        page_path: "/resume",
        created_at: "2026-10-06T00:01:00Z",
      },
    ];
    const result = summarizeAnalytics(
      visits,
      [],
      [],
      [{ event_type: "workspace_export", created_at: "2026-10-06" }],
      3,
      new Date("2026-10-06T12:00:00Z"),
    );
    expect(result.daily.map((d) => d.views)).toEqual([0, 1, 1]);
    expect(result.sessions).toBe(1);
    expect(result.attributedViews).toBe(1);
    expect(result.exports).toBe(1);
  });
  it("only permits coarse public categories, excluding private paths and metadata", () => {
    expect(analyticsPath("/projects/private-slug")).toBe("/projects");
    expect(analyticsPath("/workspace/opaque-id")).toBe("/workspace");
    expect(analyticsPath("/answers")).toBe("/answers");
    expect(analyticsPath("/admin/analytics")).toBeNull();
    expect(pageViewSchema.safeParse({ path: "/?secret=x" }).success).toBe(
      false,
    );
    expect(
      pageViewSchema.safeParse({ path: "/", account_id: "someone" }).success,
    ).toBe(false);
  });
});
