import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { complete } from "../experiments/career-brain/v2/provider";
import { auditAssertions } from "../experiments/career-brain/v2/continuation/audit";
import {
  groundingCases,
  reviewedSeed,
  supportCases,
  diffOracle,
} from "../experiments/career-brain/v2/continuation/fixtures";
import { compileAdmission } from "../experiments/career-brain/v2/continuation/resume";
import { reviewedRevision } from "../experiments/career-brain/v2/continuation/sequence";
import { factualHash } from "../experiments/career-brain/v2/evidence";

vi.mock("../experiments/career-brain/v2/provider", () => ({
  complete: vi.fn(),
}));
const gate = async <T>(
  _label: string,
  _provider: string,
  call: () => Promise<T>,
) => call();
describe("Career Brain continuation qualification boundaries", () => {
  it("keeps all frozen contrastive quotes exact without mistaking exactness for entailment", () => {
    const f = groundingCases();
    expect(f.cases).toHaveLength(24);
    expect(
      f.cases.every((c) =>
        c.record.claims.every((claim) =>
          claim.evidence.every(
            (e) => f.source.slice(e.start!, e.end!) === e.quote,
          ),
        ),
      ),
    ).toBe(true);
    const bad = f.cases.find((c) => c.id === "ground-1-unsafe")!;
    expect(bad.expected).toBe("UNSUPPORTED");
    expect(bad.record.uncertainties).toEqual([]);
  });
  it("withholds an unsupported display feature even when its indexed claim is supported", async () => {
    const r = groundingCases().cases.find(
      (c) => c.id === "ground-11-unsafe",
    )!.record;
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: [
        {
          id: "0:display",
          verdict: "UNSUPPORTED",
          reason: "Preference is not implementation",
        },
        {
          id: "0:claim:0",
          verdict: "SUPPORTED",
          reason: "SQL checks are stated",
        },
      ],
    });
    const audited = await auditAssertions(
      [r],
      groundingCases().source,
      "test-tenant",
      gate,
    );
    expect(audited.records[0].uncertainties).toContain(
      "Assertion UNSUPPORTED: Preference is not implementation",
    );
  });
  it("rejects fabricated assertion IDs rather than accepting an incomplete audit", async () => {
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: [
        { id: "0:display", verdict: "SUPPORTED", reason: "" },
        { id: "other:claim:0", verdict: "SUPPORTED", reason: "" },
      ],
    });
    await expect(
      auditAssertions(
        [groundingCases().cases[0].record],
        groundingCases().source,
        "test-tenant",
        gate,
      ),
    ).rejects.toThrow("Incomplete assertion audit");
  });
  it("does not compile partial, related, contradictory or irrelevant evidence", () => {
    const q = supportCases().find((q) => q.id === "support-sql-aws-mixed")!;
    for (const label of [
      "PARTIALLY_SUPPORTS",
      "RELATED_ONLY",
      "CONTRADICTS",
      "IRRELEVANT",
    ] as const) {
      const result = compileAdmission(
        q.packets.map((p) => ({ ...p, support: label })),
        q.text,
      );
      expect(result.admittedIds).toEqual([]);
      expect(result.compiledIds).toEqual([]);
      expect(result.ir.skill_groups).toEqual([]);
    }
  });
  it("compiles supported canonical evidence and never copies answer prose", () => {
    const q = supportCases().find((q) => q.id === "support-automation")!;
    const result = compileAdmission(
      q.packets.map((p) => ({ ...p, support: "SUPPORTS" })),
      q.text,
    );
    expect(result.ir.projects[0].bullets).toEqual([q.packets[0].summary]);
    expect(result.compiledIds).toEqual(result.admittedIds);
  });
  it("qualifies sequential rich facts against a separate corrected oracle", async () => {
    const original = JSON.parse(
      await readFile("experiments/career-brain/v2/benchmark.json", "utf8"),
    );
    expect(
      original.payload.fixtures.find(
        (f: { id: string }) => f.id === "A-clean-v2",
      ).expectedDiff["certification:cedar-sql"],
    ).toBe("REMOVED");
    expect(diffOracle.requiredTransitions.V2).toContain("certificate-review");
    const seed = (await reviewedSeed("A-clean-v1")).records;
    const current = seed.map((r, i) => ({
      ...r,
      id: `test-${i}`,
      hash: factualHash(r),
      published: false,
      archived: false,
      updated_at: "2026-10-05T00:00:00Z",
    }));
    const revised = reviewedRevision(current, "V2");
    expect(
      revised.find((r) => r.kind === "certification")!.uncertainties.length,
    ).toBeGreaterThan(0);
    expect(revised.find((r) => r.kind === "experience")!.end_date).toBe(
      "2024-06-30",
    );
    expect(revised.filter((r) => r.kind === "project")).toHaveLength(2);
  });
});
