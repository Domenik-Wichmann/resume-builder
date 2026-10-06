import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { answerDisplay } from "../src/lib/answer-display";
import { evidenceEdges } from "../src/lib/career/evidence-graph";
import { containPoint, mapPoint } from "../src/lib/career/evidence-layout";
import type { CareerRecord } from "../src/lib/career/model";
import { EvidenceMap } from "../src/components/evidence-map";
import { newWorkspace } from "../src/lib/workspaces/model";
import { exportWorkspaceText } from "../src/lib/workspaces/export";

const id = "057c18d5-d70a-4fff-9ccc-d1ca94e02e99";
const secondId = "a1111111-1111-4111-8111-111111111111";
const record = (
  id: string,
  extra: Partial<CareerRecord> = {},
): CareerRecord => ({
  id,
  slug: id,
  title: `Fictional ${id}`,
  subtitle: "",
  summary: "Synthetic test evidence",
  skills: [],
  ...extra,
});

it("keeps floating, rearranging and dragged nodes inside the label-safe canvas bounds", () => {
  for (const size of [
    { width: 146, height: 340 },
    { width: 280, height: 755 },
  ]) {
    for (const busy of [true, false]) {
      for (let time = 0; time < 16000; time += 97) {
        for (let i = 0; i < 12; i++) {
          const point = mapPoint(i, 12, size, time, busy, { x: 100, y: 100 });
          expect(containPoint(point, size)).toEqual(point);
          expect((point.x * size.width) / 100).toBeGreaterThanOrEqual(55.9);
          expect(((100 - point.y) * size.height) / 100).toBeGreaterThanOrEqual(
            75.9,
          );
        }
      }
    }
  }
  const dragged = containPoint(
    { x: -100, y: 1000 },
    { width: 280, height: 600 },
  );
  expect(dragged.x).toBe(20);
  expect(dragged.y).toBeCloseTo(100 - 76 / 6);
});

it("shows a decorative loading constellation before any real evidence is available", () => {
  const html = renderToStaticMarkup(
    <EvidenceMap records={[]} busy collapsed={false} onToggle={() => {}} />,
  );
  expect(html).toContain('class="processing-cloud" aria-hidden="true"');
  expect(html).toContain('aria-label="Finding evidence"');
  expect(html).not.toContain('class="evidence-node');
});

it("removes internal citations without losing qualifications, uncertainty, metrics or Markdown", () => {
  expect(
    answerDisplay(
      `## Experience\n- **SQL** checks [${id}].\n- Team outcome [${id}, ${secondId}]; personal ownership is uncertain.\n- 8 reports (${id}).\n\nNo AWS evidence [not verified].`,
    ),
  ).toBe(
    "## Experience\n- **SQL** checks.\n- Team outcome; personal ownership is uncertain.\n- 8 reports.\n\nNo AWS evidence [not verified].",
  );
  expect(answerDisplay(`Built checks [Source: ${id}]`)).toBe("Built checks");
  expect(answerDisplay(`Built checks ${id}.`)).toBe("Built checks.");
  expect(answerDisplay("No relevant evidence is currently stored.")).toBe(
    "No relevant evidence is currently stored.",
  );
});

it("cleans citations in historical workspace text exports while retaining structured evidence", () => {
  const workspace = newWorkspace(secondId, "US", true);
  workspace.questions = [
    {
      question: "SQL?",
      answer: `Used SQL [${id}].`,
      evidence_ids: [id],
      topics: [],
      created_at: "2026-10-06",
    },
  ];
  expect(exportWorkspaceText(workspace)).toContain("A: Used SQL.");
  expect(exportWorkspaceText(workspace)).not.toContain(id);
  expect(workspace.questions[0].evidence_ids).toEqual([id]);
});

it("connects actual skill and achievement links even when endpoint skill labels are empty", () => {
  const records = [
    record("role", {
      related_ids: ["skill", "achievement", "not-in-workspace"],
    }),
    record("skill"),
    record("achievement"),
    record("unrelated"),
  ];
  expect(evidenceEdges(records)).toEqual([
    { source: "role", target: "skill", label: "Linked career records" },
    { source: "role", target: "achievement", label: "Linked career records" },
  ]);
  expect(evidenceEdges([...records].reverse())).toHaveLength(2);
});

it("matches normalized shared skills without inferring connections from prose, employers or similar names", () => {
  expect(
    evidenceEdges([
      record("a", { skills: ["SQL"], organization: "Example" }),
      record("b", { skills: [" sql "] }),
      record("c", {
        skills: ["NoSQL"],
        organization: "Example",
        summary: "SQL",
      }),
    ]),
  ).toEqual([{ source: "a", target: "b", label: "Shared skills: SQL" }]);
});

it("renders links and nodes beyond the old eight-record cutoff without the explanatory headings", () => {
  const records = Array.from({ length: 10 }, (_, i) =>
    record(String(i), i === 0 ? { related_ids: ["9"] } : {}),
  );
  const html = renderToStaticMarkup(
    <EvidenceMap
      records={records}
      busy={false}
      collapsed={false}
      onToggle={() => {}}
    />,
  );
  expect(html).toContain('aria-label="Fictional 9"');
  expect(html).toContain("<line");
  expect(html).not.toContain("The connections behind");
  expect(html).not.toContain("Published records used");
});
