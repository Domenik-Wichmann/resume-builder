import { readFile } from "node:fs/promises";
import { describe, it, expect, vi } from "vitest";
import { complete } from "../experiments/career-brain/v2/provider";
import {
  actorValue,
  compact,
  selectClaims,
  applyConflicts,
  usable,
  hydrateClaims,
  type StateRecord,
  type ClaimDecision,
} from "../experiments/career-brain/v2/claim-repair/claims";
import {
  verify,
  validateVerification,
  compileVerified,
  fallback,
  type Verification,
} from "../experiments/career-brain/v2/claim-repair/bullets";
import {
  actor,
  root,
  type AdmissionCase,
} from "../experiments/career-brain/v2/claim-repair/fixtures";
import { stateDiff } from "../experiments/career-brain/v2/claim-repair/equivalence";
vi.mock("../experiments/career-brain/v2/provider", () => ({
  complete: vi.fn(),
}));
const gate = async <T>(
  _label: string,
  _provider: string,
  call: () => Promise<T>,
) => call();
async function fixture() {
  const frozen: { cases: AdmissionCase[] } = JSON.parse(
    await readFile(`${root}/inputs.json`, "utf8"),
  );
  return frozen.cases[0];
}
const selected = (q: AdmissionCase): ClaimDecision[] =>
  q.packet.claims.map((_, i) => ({
    ref: `${q.id}:${i}`,
    label: i === 0 ? "DIRECT_SUPPORT" : "RELATED_ONLY",
    reason: "Independent fixture gold",
  }));
const pass = (id: string, bullet: string, ref: string): Verification => ({
  id,
  verdict: "PASS",
  reason: "",
  assertions: [
    { text: bullet, verdict: "SUPPORTED", claimRefs: [ref], reason: "" },
  ],
});
describe("Claim repair admission and grounding boundaries", () => {
  it("compiles the supported SQL claim without leaking a poisoned record summary", async () => {
    const q = await fixture();
    const decisions = selected(q);
    const bullet = { ...compact(q, decisions), bullet: q.goodBullet };
    const ir = compileVerified(
      q,
      decisions,
      bullet,
      pass(q.id, bullet.bullet, `${q.id}:0`),
    );
    expect(ir.ir.projects[0].bullets).toEqual([q.goodBullet]);
    expect(JSON.stringify(ir.ir)).not.toContain(
      "implemented a visible warning",
    );
    expect(ir.ir.skill_groups).toEqual([]);
  });
  it("fails closed when an otherwise PASS audit omits the unsupported second clause", async () => {
    const q = await fixture();
    const b = { ...compact(q, selected(q)), bullet: q.badBullet! };
    const incomplete = pass(q.id, q.goodBullet.replace(/\.$/, ""), `${q.id}:0`);
    expect(validateVerification(b, incomplete).verdict).toBe("REVIEW");
    expect(compileVerified(q, selected(q), b, incomplete).compiledIds).toEqual(
      [],
    );
  });
  it("rejects unknown claim references and unsupported clauses despite a top-level PASS", async () => {
    const q = await fixture();
    const b = { ...compact(q, selected(q)), bullet: q.goodBullet };
    expect(
      validateVerification(b, pass(q.id, b.bullet, "foreign-ref")).verdict,
    ).toBe("REVIEW");
    const contradicted = pass(q.id, b.bullet, `${q.id}:0`);
    contradicted.assertions[0].verdict = "UNSUPPORTED";
    expect(validateVerification(b, contradicted).verdict).toBe("FAIL");
  });
  it("does not turn a verifier timeout or missing decision into approval", async () => {
    const q = await fixture();
    const b = { ...compact(q, selected(q)), bullet: q.goodBullet };
    vi.mocked(complete).mockRejectedValueOnce(new Error("timeout"));
    expect((await verify([b], "test", gate))[0].verdict).toBe("REVIEW");
    vi.mocked(complete).mockResolvedValueOnce({ decisions: [] });
    expect((await verify([b], "test", gate))[0].verdict).toBe("REVIEW");
  });
  it("withholds all unavailable states even if the model labels them direct", async () => {
    const q = await fixture();
    for (const availability of [
      "DISPUTED",
      "PENDING_REVIEW",
      "SUPERSEDED",
      "REMOVED",
    ] as const) {
      const packet = {
        ...q.packet,
        claims: q.packet.claims.map((c) => ({ ...c, availability })),
      };
      expect(packet.claims.every((c) => !usable(c))).toBe(true);
      expect(compact({ ...q, packet }, selected(q)).claims).toEqual([]);
    }
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: q.packet.claims.map((_, i) => ({
        ref: `${q.id}:${i}`,
        label: "DIRECT_SUPPORT",
        reason: "",
      })),
    });
    const decisions = await selectClaims(
      [
        {
          ...q,
          packet: {
            ...q.packet,
            claims: q.packet.claims.map((c) => ({
              ...c,
              availability: "DISPUTED",
            })),
          },
        },
      ],
      "test",
      gate,
    );
    expect(decisions.every((d) => d.label === "BLOCKED_BY_CONFLICT")).toBe(
      true,
    );
  });
  it("never admits partial, related, contradictory or irrelevant sibling claims", async () => {
    const q = await fixture();
    for (const label of [
      "PARTIAL_SUPPORT",
      "RELATED_ONLY",
      "CONTRADICTS",
      "IRRELEVANT",
      "BLOCKED_BY_CONFLICT",
    ] as const) {
      const decisions = selected(q);
      decisions[1].label = label;
      expect(compact(q, decisions).claims.map((c) => c.ref)).toEqual([
        `${q.id}:0`,
      ]);
    }
  });
  it("propagates a quantity conflict to parent and child without losing the safe action", async () => {
    const q = await fixture();
    const record: StateRecord = {
      kind: "achievement",
      key: "training",
      id: q.packet.id,
      title: "Training",
      subtitle: "",
      summary: "Trained 12 coworkers",
      organization: null,
      start_date: null,
      end_date: null,
      skill_keys: [],
      achievement_keys: [],
      category_key: null,
      source_quote: q.source,
      uncertainties: [],
      aliases: [],
      hash: "",
      updated_at: "",
      archived: false,
      published: false,
      claims: [{ ...q.packet.claims[0], value: "Trained 12 coworkers" }],
    };
    const parent = { ...record, kind: "experience" as const, key: "role" };
    const source =
      "I trained coworkers through workshops. Attendance of 12 or 14 is unresolved.";
    const result = applyConflicts(
      [parent, record],
      {
        conflicts: [
          {
            key: "attendance",
            refs: ["experience:role:0", "achievement:training:0"],
            reason: "Unresolved attendance",
            quotes: [source],
            safeClaims: [
              ...[parent, record].map((r) => ({
                recordKey: `${r.kind}:${r.key}`,
                value: "Trained coworkers through workshops",
                attribute: "action" as const,
                attribution: "PERSONAL" as const,
                quotes: ["I trained coworkers through workshops."],
              })),
            ],
          },
        ],
      },
      source,
    );
    expect(
      result.every(
        (r) =>
          r.claims[0].availability === "DISPUTED" &&
          r.claims[1].availability === "CONFIRMED",
      ),
    ).toBe(true);
  });
  it("normalizes only known actor references and keeps ownership strength material", () => {
    expect(actorValue("my contribution was the checks", actor)).toBe(
      actorValue("Ada's contribution was the checks", actor),
    );
    expect(
      actorValue("the candidate's contribution was the checks", actor),
    ).toBe(actorValue("Ada Rowan's contribution was the checks", actor));
    expect(actorValue("I built the tool", actor)).not.toBe(
      actorValue("we built the tool", actor),
    );
    expect(actorValue("I contributed to the tool", actor)).not.toBe(
      actorValue("I led the tool", actor),
    );
    expect(actorValue("Mira built the tool", actor)).not.toBe(
      actorValue("Ada built the tool", actor),
    );
    expect(
      actorValue("my contribution", { ...actor, firstPersonOwner: false }),
    ).not.toBe(actorValue("Ada's contribution", actor));
  });
  it("does not fabricate provenance or confirmation for a legacy record", async () => {
    const inputs = JSON.parse(
      await readFile(
        "experiments/career-brain/v2/continuation/results/repeat-state.json",
        "utf8",
      ),
    );
    const record = hydrateClaims(inputs.current[0]);
    expect(
      record.claims.every((c) => c.availability === "PENDING_REVIEW"),
    ).toBe(true);
    expect(record.claims[0].evidence).toEqual(
      inputs.current[0].claims[0].evidence,
    );
  });
  it("classifies known-actor wording as unchanged but a quantity/date change as updated", async () => {
    const inputs = JSON.parse(
      await readFile(
        "experiments/career-brain/v2/continuation/results/repeat-state.json",
        "utf8",
      ),
    );
    const record = hydrateClaims(
      inputs.current.find((r: { kind: string }) => r.kind === "achievement"),
      "CONFIRMED",
    );
    record.claims = [
      { ...record.claims[0], value: "my contribution was the checks" },
    ];
    const revised = {
      ...record,
      claims: [
        { ...record.claims[0], value: "Ada's contribution was the checks" },
      ],
    };
    expect(stateDiff([revised], [record], actor, false)[0].status).toBe(
      "UNCHANGED",
    );
    expect(
      stateDiff(
        [{ ...revised, end_date: "2024-06-30" }],
        [record],
        actor,
        false,
      )[0].status,
    ).toBe("UPDATED");
    const disputed: StateRecord = {
      ...revised,
      claims: [{ ...revised.claims[0], availability: "DISPUTED" }],
    };
    expect(stateDiff([disputed], [record], actor, false)[0].status).toBe(
      "UPDATED",
    );
  });
  it("uses a single admitted proposition as fallback and never reads the summary", async () => {
    const q = await fixture();
    const b = { ...compact(q, selected(q)), bullet: q.badBullet! };
    expect(fallback(b).bullet).toBe(q.packet.claims[0].value);
    expect(fallback(b).bullet).not.toContain("warning");
  });
  it("preserves the historical certificate primary provenance during a metadata-only reviewed update", async () => {
    const read = async (name: string) =>
      JSON.parse(await readFile(`${root}/${name}.json`, "utf8"));
    const states = await Promise.all(
      ["persistence-v1", "persistence-v2", "persistence-v3"].map(read),
    );
    for (const s of states) {
      expect(s.provenance.valid).toBe(s.provenance.total);
      expect(s.provenance.primaryValid).toBe(s.provenance.primaryTotal);
    }
    const certs = states.map(
      (s) =>
        s.state.find(
          (r: StateRecord) => r.kind === "certification",
        ) as StateRecord,
    );
    expect(new Set(certs.map((c) => c.id)).size).toBe(1);
    expect(certs[1].updated_at).toBe(certs[0].updated_at);
    expect(
      certs[1].claims.every((c) => c.availability === "PENDING_REVIEW"),
    ).toBe(true);
    expect(certs[2].claims.every((c) => c.availability === "CONFIRMED")).toBe(
      true,
    );
    expect(states[1].metadataOnly).toEqual([`certification:${certs[1].key}`]);
  });
  it("keeps disputed parent/child counts out of persisted admission and complete generated bullets", async () => {
    const r = JSON.parse(
      await readFile(`${root}/conflict-resume.json`, "utf8"),
    );
    expect(
      r.compiled.filter((c: { compiledIds: string[] }) => c.compiledIds.length),
    ).toHaveLength(2);
    expect(
      r.generated.every(
        (b: { bullet: string }) => !/\b(?:12|14)\b/.test(b.bullet),
      ),
    ).toBe(true);
    const checks = JSON.parse(
      await readFile(`${root}/conflict-whole-bullet.json`, "utf8"),
    );
    expect(
      checks.decisions.every((v: Verification) => v.verdict !== "PASS"),
    ).toBe(true);
  });
});
