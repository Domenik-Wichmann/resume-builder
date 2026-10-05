import { readFile } from "node:fs/promises";
import { beforeEach, it, expect, vi } from "vitest";
import { complete } from "../src/lib/ai/openrouter";
import {
  compilePacketResume,
  answerPackets,
} from "../src/lib/career-brain/serving";
import { fixture } from "../src/lib/career/fixture";
import { newWorkspace } from "../src/lib/workspaces/model";
import type { StatePacket } from "../src/lib/career-brain/state";
import type { Gate } from "../src/lib/career-brain/provider";
import { proposeBrain } from "../src/lib/career-brain/propose";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import { completeSource } from "../src/lib/career-brain/source";
vi.mock("../src/lib/ai/openrouter", () => ({ complete: vi.fn() }));
const gate: Gate = async (_label, _provider, call) => call();
const presentation = {
  market: "US" as const,
  location: "",
  contact_email: "",
  phone: "",
  work_authorization: "",
};
async function input() {
  const data = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/omission-repair/results/inputs.json",
      "utf8",
    ),
  );
  return { ...data.cases[0], id: data.cases[0].packet.id } as {
    id: string;
    goodBullet: string;
    badBullet: string;
    packet: StatePacket;
  };
}
beforeEach(() => vi.mocked(complete).mockReset());
it("MANUAL silence cannot archive unrelated approved career records", async () => {
  const data = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/omission-repair/results/repeat-state.json",
      "utf8",
    ),
  );
  const current = data.current.map((r: BrainRecord) => ({
    ...r,
    evidence_version: null,
  })) as BrainRecord[];
  vi.mocked(complete)
    .mockResolvedValueOnce({ conflicts: [] })
    .mockResolvedValueOnce({ records: [] });
  const result = await proposeBrain(
    {} as SupabaseClient,
    "test",
    "A supplemental source about another project.",
    current,
    completeSource("MANUAL"),
    gate,
  );
  expect(result.changes).toEqual([]);
  expect(current.length).toBeGreaterThan(0);
});
it("renders only independently verified admitted claims; summaries, sibling warnings, skills and profile claims cannot leak into Resume IR", async () => {
  const q = await input();
  vi.mocked(complete).mockResolvedValueOnce({
    decisions: q.packet.claims.map((_, i) => ({
      ref: `${q.id}:${i}`,
      label: i === 0 ? "DIRECT_SUPPORT" : "RELATED_ONLY",
      reason: "gold",
    })),
  });
  vi.mocked(complete).mockResolvedValueOnce({
    bullets: [{ id: q.id, bullet: q.goodBullet }],
  });
  vi.mocked(complete).mockResolvedValueOnce({
    decisions: [
      {
        id: q.id,
        verdict: "PASS",
        reason: "exact evidence",
        assertions: [
          {
            text: q.goodBullet,
            verdict: "SUPPORTED",
            claimRefs: [`${q.id}:0`],
            reason: "gold",
          },
        ],
      },
    ],
  });
  const career = {
    ...fixture,
    demo: false,
    projects: [
      {
        id: q.id,
        slug: "private-fixture",
        title: "SQL checks",
        subtitle: "",
        summary: q.badBullet,
        skills: ["Invented warning implementation"],
      },
    ],
  };
  const ir = await compilePacketResume(
    career,
    {
      ...newWorkspace("test", "US", false),
      job_description: "SQL checks",
      evidence: career.projects,
    },
    presentation,
    [q.packet],
    "TRADITIONAL",
    "test",
    gate,
  );
  expect(ir.projects[0].bullets).toEqual([q.goodBullet]);
  expect(ir.skill_groups).toEqual([]);
  expect(ir.headline).toBe("");
  expect(ir.summary).toBe("");
  expect(JSON.stringify(ir)).not.toContain("Invented warning");
});
it("withholds all bullets when the verifier is unavailable, including the single-claim fallback", async () => {
  const q = await input();
  vi.mocked(complete).mockResolvedValueOnce({
    decisions: q.packet.claims.map((_, i) => ({
      ref: `${q.id}:${i}`,
      label: i === 0 ? "DIRECT_SUPPORT" : "RELATED_ONLY",
      reason: "gold",
    })),
  });
  vi.mocked(complete).mockResolvedValueOnce({
    bullets: [{ id: q.id, bullet: q.badBullet }],
  });
  vi.mocked(complete)
    .mockRejectedValueOnce(new Error("Verifier unavailable"))
    .mockRejectedValueOnce(new Error("Verifier unavailable"));
  const career = {
    ...fixture,
    demo: false,
    projects: [
      {
        id: q.id,
        slug: "fixture",
        title: "SQL checks",
        subtitle: "",
        summary: q.badBullet,
        skills: [],
      },
    ],
  };
  const ir = await compilePacketResume(
    career,
    { ...newWorkspace("test", "US", false), evidence: career.projects },
    presentation,
    [q.packet],
    "TRADITIONAL",
    "test",
    gate,
  );
  expect(ir.projects).toEqual([]);
});
it("fails closed on unsupported Q&A even when a broad related packet was retrieved", async () => {
  const q = await input();
  vi.mocked(complete).mockResolvedValueOnce({
    decisions: [
      {
        id: q.packet.id,
        support: "RELATED_ONLY",
        reason: "preference is not implementation",
      },
    ],
  });
  vi.mocked(complete).mockResolvedValueOnce({
    answer: "Implemented a warning",
    evidence_ids: [q.packet.id],
  });
  vi.mocked(complete).mockResolvedValueOnce({
    verdict: "FAIL",
    reason: "Unsupported implementation",
  });
  const result = await answerPackets(
    "Was a warning implemented?",
    {
      actor: { name: "Ada", aliases: [], firstPersonOwner: true },
      packets: [q.packet],
    },
    { accountId: "test" },
    gate,
  );
  expect(result.evidence_ids).toEqual([]);
  expect(result.answer).not.toContain("Implemented");
});
it("never calls providers for legacy records with no claim-level proof", async () => {
  const q = await input();
  const result = await answerPackets(
    "What was implemented?",
    {
      actor: { name: "Ada", aliases: [], firstPersonOwner: true },
      packets: [{ ...q.packet, claims: [] }],
    },
    {},
    gate,
  );
  expect(result.answer).toBe("No relevant evidence is currently stored.");
  expect(complete).not.toHaveBeenCalled();
});
it("propagates an interview conflict even when the extraction omits that entire record, without archiving other career facts", async () => {
  const data = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/omission-repair/results/repeat-state.json",
      "utf8",
    ),
  );
  const current = data.current.map((r: BrainRecord) => ({
    ...r,
    evidence_version: null,
  })) as BrainRecord[];
  const role = current.find((r) => r.kind === "experience")!;
  const index = role.claims.findIndex((c) => /12/.test(c.value));
  expect(index).toBeGreaterThanOrEqual(0);
  const source = "Workshop attendance 12 versus 14 is unresolved.";
  const conflicts = {
    conflicts: [
      {
        refs: [`${role.kind}:${role.key}:${index}`],
        reason: "Unresolved attendance",
        quotes: [source],
        safeClaims: [],
      },
    ],
  };
  vi.mocked(complete)
    .mockResolvedValueOnce(conflicts)
    .mockResolvedValueOnce({ records: [] })
    .mockResolvedValueOnce(conflicts);
  const result = await proposeBrain(
    {} as SupabaseClient,
    "test",
    source,
    current,
    false,
    gate,
  );
  expect(result.changes).toHaveLength(1);
  expect(result.changes[0].status).toBe("REVIEW");
  expect(result.changes[0].before!.id).toBe(role.id);
  expect(
    (result.changes[0].after as BrainRecord).claims[index].availability,
  ).toBe("DISPUTED");
});
