import { readFile } from "node:fs/promises";
import { describe, it, expect, vi } from "vitest";
import { complete } from "../src/lib/ai/openrouter";
import {
  reconcileOmissions,
  omittedComponents,
} from "../src/lib/career-brain/continuity";
import {
  actor,
  fixture,
  dropCases,
} from "../experiments/career-brain/v2/omission-repair/fixtures";
import {
  hydrateClaims,
  usable,
  type StateRecord,
} from "../src/lib/career-brain/state";
import {
  stateDiff,
  repairEquivalence,
} from "../src/lib/career-brain/equivalence";
import {
  reconcile,
  richSchema,
  type RichCandidate,
} from "../src/lib/career-brain/model";
vi.mock("../src/lib/ai/openrouter", () => ({
  complete: vi.fn(),
}));
const gate = async <T>(
  _label: string,
  _provider: string,
  call: () => Promise<T>,
) => call();
async function current(): Promise<StateRecord[]> {
  const input = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/claim-repair/results/repeat-state.json",
      "utf8",
    ),
  );
  return input.current.map((r: StateRecord) => hydrateClaims(r, "CONFIRMED"));
}
describe("Production continuity contract", () => {
  it("keeps long-title identity keys valid at a separator truncation boundary", async () => {
    const base = (await current())[0];
    const title = "a".repeat(59) + " boundary project";
    const first = reconcile(
      [{ ...base, title, aliases: [], key: "temporary" }],
      [],
    ).records[0];
    expect(first.key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(richSchema.shape.key.safeParse(first.key).success).toBe(true);
    const second = reconcile([{ ...first, key: "different-hint" }], [])
      .records[0];
    expect(second.key).toBe(first.key);
    const existing = { ...base, title, aliases: [], key: "approved-identity" };
    expect(reconcile([first], [existing]).records[0].key).toBe(existing.key);
  });
  it("does not let a model's EQUIVALENT verdict undo a new availability correction", async () => {
    const old = (await current()).filter(
      (r) => r.kind === "skill" && r.title === "Git",
    );
    const corrected = old.map((r) => ({
      ...r,
      claims: r.claims.map((c) => ({
        ...c,
        availability: "SUPERSEDED" as const,
      })),
    }));
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: [
        {
          key: `skill:${old[0].key}`,
          verdict: "EQUIVALENT",
          reason: "Same wording",
        },
      ],
    });
    const result = await repairEquivalence(
      corrected,
      old,
      actor,
      "test",
      gate,
      true,
    );
    expect(
      result.records[0].claims.every((c) => c.availability === "SUPERSEDED"),
    ).toBe(true);
    expect(stateDiff(result.records, old, actor, false)[0].status).toBe(
      "REVIEW",
    );
  });
  it("preserves skill/achievement/category edges, all role links and the omitted training claim without provider calls on identical evidence", async () => {
    const state = await current();
    const source = fixture("B-messy").source;
    const noCalls = async <T>(): Promise<T> => {
      throw new Error("deterministic evidence should need no call");
    };
    for (const c of dropCases(state)) {
      const result = await reconcileOmissions(
        [c.after],
        state.filter((r) => r.key === c.record.key),
        source,
        source,
        actor,
        "test",
        noCalls,
      );
      // Endpoint evidence is required; supply the canonical inventory in the actual run.
      if (c.id.includes("claim"))
        expect(
          stateDiff(result.records, [c.record], actor, false)[0].status,
        ).toBe("UNCHANGED");
      const all = await reconcileOmissions(
        state.map((r) => (r.key === c.record.key ? c.after : r)),
        state,
        source,
        source,
        actor,
        "test",
        noCalls,
      );
      expect(
        stateDiff(all.records, state, actor).every(
          (c) => c.status === "UNCHANGED",
        ),
      ).toBe(true);
      expect(
        all.decisions.every(
          (d) => d.action === "PRESERVED_SOURCE_STILL_SUPPORTS",
        ),
      ).toBe(true);
    }
  });
  it("does not validate an old quote when the revision changes and appends a correction", async () => {
    const state = await current();
    const source = fixture("B-messy").source;
    const c = dropCases(state).find((c) => c.id === "partial-project-skills")!;
    const incoming = state.map((r) => (r.key === c.record.key ? c.after : r));
    const components = omittedComponents(incoming, state, actor);
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: components.map((c) => ({
        ref: c.ref,
        verdict:
          c.endpoint?.title === "Git" ? "CONTRADICTED" : "SUPPORTED_EQUIVALENT",
        reason: "Check current correction",
        quotes: [
          c.endpoint?.title === "Git"
            ? "Correction: Git was not actually used on Dispatch Loom."
            : c.quotes[0],
        ],
      })),
    });
    const result = await reconcileOmissions(
      incoming,
      state,
      source + "\nCorrection: Git was not actually used on Dispatch Loom.",
      source,
      actor,
      "test",
      gate,
    );
    expect(
      result.decisions.find(
        (d) =>
          components.find((c) => c.ref === d.ref)?.endpoint?.title === "Git",
      )?.action,
    ).toBe("REVIEW_SOURCE_CONTRADICTS");
    expect(
      stateDiff(result.records, state, actor).find(
        (change) => change.before?.key === c.record.key,
      )?.status,
    ).toBe("REVIEW");
    const project = result.records.find((r) => r.key === c.record.key)!;
    expect(
      project.claims
        .filter((claim) => /\bGit\b/i.test(claim.value))
        .every((claim) => !usable(claim as StateRecord["claims"][number])),
    ).toBe(true);
    expect(
      project.claims.find((claim) => /PostgreSQL/.test(claim.value)) &&
        usable(
          project.claims.find((claim) =>
            /PostgreSQL/.test(claim.value),
          )! as StateRecord["claims"][number],
        ),
    ).toBe(true);
  });
  it("fails silent absence, malformed or timed-out semantic audits to review rather than removal", async () => {
    const state = (await current()).filter((r) => r.kind === "certification");
    for (const result of [new Error("timeout"), { decisions: [] }]) {
      if (result instanceof Error)
        vi.mocked(complete).mockRejectedValueOnce(result);
      else vi.mocked(complete).mockResolvedValueOnce(result);
      const repaired = await reconcileOmissions(
        [],
        state,
        "I completed a course.",
        "Different old revision",
        actor,
        "test",
        gate,
      );
      expect(stateDiff(repaired.records, state, actor)[0].status).toBe(
        "REVIEW",
      );
      expect(
        repaired.records[0].claims.every(
          (c) => !usable(c as StateRecord["claims"][number]),
        ),
      ).toBe(true);
    }
  });
  it("preserves unavailable history without letting identical evidence re-confirm it", async () => {
    for (const availability of [
      "DISPUTED",
      "PENDING_REVIEW",
      "SUPERSEDED",
      "REMOVED",
    ] as const) {
      const state = (await current())
        .filter((r) => r.kind === "achievement")
        .slice(0, 1);
      state[0].claims = state[0].claims.map((c) => ({ ...c, availability }));
      const incoming = [{ ...state[0], claims: [state[0].claims[0]] }];
      const source = fixture("B-messy").source;
      const repaired = await reconcileOmissions(
        incoming,
        state,
        source,
        source,
        actor,
        "test",
        gate,
      );
      expect(
        repaired.records[0].claims.every(
          (c) =>
            (c as StateRecord["claims"][number]).availability === availability,
        ),
      ).toBe(true);
      expect(
        repaired.records[0].claims.every(
          (c) => !usable(c as StateRecord["claims"][number]),
        ),
      ).toBe(true);
    }
  });
  it("retains new enrichment while protecting omitted ownership/metric/scope/credential/date components", async () => {
    const state = await current();
    const source = fixture("B-messy").source;
    const incoming: RichCandidate[] = state.map((r) => ({
      ...r,
      organization: null,
      start_date: null,
      end_date: null,
      claims: [],
    }));
    const enriched = {
      ...state[0].claims[0],
      value: "Source-reviewed additional component",
    };
    incoming[0].claims.push(enriched);
    const repaired = await reconcileOmissions(
      incoming,
      state,
      source,
      source,
      actor,
      "test",
      gate,
    );
    expect(repaired.records[0].claims).toContainEqual(enriched);
    for (const old of state) {
      const after = repaired.records.find((r) => r.key === old.key)!;
      expect(after.start_date).toBe(old.start_date);
      expect(after.end_date).toBe(old.end_date);
      expect(after.organization).toBe(old.organization);
      expect(after.claims).toEqual(
        expect.arrayContaining(
          old.claims.map((c) =>
            expect.objectContaining({
              value: c.value,
              attribution: c.attribution,
            }),
          ),
        ),
      );
    }
  });
});
