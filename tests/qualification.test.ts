import { describe, expect, it } from "vitest";
import { fixtures, candidate } from "../experiments/career-brain/fixtures";
import { queries } from "../experiments/career-brain/queries";
import {
  evaluate,
  rankMetrics,
  canonical,
  diffScore,
} from "../experiments/career-brain/metrics";
import { verifyProvenance } from "../src/lib/ingestion/diff";
import { interviewQuestions } from "../src/lib/interview/questions";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

describe("qualification scoring and fixed evidence", () => {
  it("verifies immutable baseline snapshots with portable line endings", async () => {
    const manifest = JSON.parse(
      await readFile("experiments/career-brain/baseline/manifest.json", "utf8"),
    ) as { normalizedHashes: Record<string, string> };
    for (const [path, hash] of Object.entries(manifest.normalizedHashes)) {
      const source = await readFile(
        `experiments/career-brain/baseline/${path.replaceAll("/", "__")}.snapshot`,
        "utf8",
      );
      expect(
        createHash("sha256")
          .update(source.replaceAll("\r\n", "\n"))
          .digest("hex"),
        path,
      ).toBe(hash);
    }
  });
  it("asks about outcomes when numbers identify departments and results are explicitly unmeasured", () => {
    const projects = fixtures
      .find((f) => f.id === "F-large")!
      .gold.filter((r) => r.key.startsWith("archive-check"));
    for (const project of projects) {
      const rows = canonical([candidate(project)]);
      const questions = interviewQuestions(
        rows,
        "record",
        "",
        `project:${project.key}`,
      );
      expect(questions.some((q) => q.id.endsWith(":outcome"))).toBe(true);
      rows[0].summary += " No measured result or claimed users.";
      expect(
        interviewQuestions(rows, "record", "", `project:${project.key}`).some(
          (q) => q.id.endsWith(":outcome"),
        ),
      ).toBe(true);
      rows[0].summary =
        "Personally built a checker and reduced checking time from five to two hours.";
      expect(
        interviewQuestions(rows, "record", "", `project:${project.key}`).some(
          (q) => q.id.endsWith(":outcome"),
        ),
      ).toBe(false);
    }
  });
  it("keeps all fixture evidence inside the original source and body boundary", () => {
    for (const fixture of fixtures) {
      expect(fixture.source.length).toBeLessThanOrEqual(40000);
      for (const r of fixture.gold)
        expect(
          fixture.source.includes(r.source_quote),
          `${fixture.id}:${r.key}`,
        ).toBe(true);
    }
    expect(
      fixtures.find((f) => f.id === "F-large")!.source.length,
    ).toBeGreaterThan(38000);
    expect(queries).toHaveLength(100);
    expect(queries.filter((q) => !q.relevant.length)).toHaveLength(20);
  });
  it("does not confuse identity coverage or exact quotes with claim support", () => {
    const f = fixtures[0],
      row = candidate(f.gold.find((r) => r.kind === "project")!);
    const unsupported = {
      ...row,
      summary: "Personally managed 100 employees using Kubernetes.",
    };
    expect(
      verifyProvenance([unsupported], f.source)[0].uncertainties,
    ).toHaveLength(0);
    const score = evaluate(f, [unsupported]);
    expect(score.missingFacts.length).toBeGreaterThan(0);
    expect(score.forbiddenFlags.length).toBeGreaterThan(0);
  });
  it("counts negative results and all relevant records rather than hit-only recall", () => {
    const score = rankMetrics([
      { relevant: ["a", "b"], ranking: ["a", "x", "b"] },
      { relevant: [], ranking: ["x"] },
      { relevant: [], ranking: [] },
    ]);
    expect(score.recall1).toBe(0.5);
    expect(score.recall3).toBe(1);
    expect(score.mrr).toBe(1);
    expect(score.negativeFalsePositiveRate).toBe(0.5);
  });
  it("freezes revision expectations including restore and unresolved attendance", () => {
    const [a, b, c] = [fixtures[0], fixtures[7], fixtures[8]];
    expect(
      diffScore(b, b.gold.map(candidate), canonical(a.gold.map(candidate)))
        .accuracy,
    ).toBe(1);
    expect(
      diffScore(
        c,
        c.gold.map(candidate),
        canonical(
          [
            ...b.gold.map(candidate),
            candidate(a.gold.find((r) => r.kind === "certification")!),
          ],
          ["certification:cedar-sql"],
        ),
      ).accuracy,
    ).toBe(1);
  });
});
