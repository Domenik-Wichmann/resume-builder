import { readFile } from "node:fs/promises";
import { beforeEach, it, expect, vi } from "vitest";
import { complete } from "../src/lib/ai/openrouter";
import { z } from "zod";
import { answerSchema } from "../src/lib/ai/contracts";
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
it("answers with exactly one Luna call and preserves structured evidence IDs when cleaning public prose", async () => {
  const q = await input();
  const id = "057c18d5-d70a-4fff-9ccc-d1ca94e02e99";
  const answer = { answer: `Used SQL [${id}].`, evidence_ids: [id] };
  vi.mocked(complete).mockResolvedValueOnce(answer);
  const result = await answerPackets(
    "SQL?",
    {
      actor: {
        name: "Fictional candidate",
        aliases: [],
        firstPersonOwner: true,
      },
      packets: [{ ...q.packet, id }],
    },
    {},
    gate,
  );
  expect(complete).toHaveBeenCalledTimes(1);
  for (const call of vi.mocked(complete).mock.calls)
    expect(call[3]?.model).toBe("openai/gpt-6-luna");
  const schema = vi.mocked(complete).mock.calls[0][2];
  expect(schema.safeParse(answer).success).toBe(true);
  expect(
    schema.safeParse({ ...answer, evidence_ids: ["not-in-context"] }).success,
  ).toBe(false);
  expect(result).toEqual({ answer: "Used SQL.", evidence_ids: [id] });
});
it("allows a complete twelve-record career overview and constrains the provider schema to its verified IDs", async () => {
  const q = await input();
  const packets = Array.from({ length: 12 }, (_, index) => ({
    ...q.packet,
    id: `fictional-role-${index}`,
  }));
  const ids = packets.map((packet) => packet.id);
  const answer = { answer: "Fictional career overview.", evidence_ids: ids };
  vi.mocked(complete).mockResolvedValueOnce(answer);
  const result = await answerPackets(
    "What jobs has he done?",
    {
      actor: {
        name: "Fictional candidate",
        aliases: [],
        firstPersonOwner: true,
      },
      packets,
    },
    {},
    gate,
  );
  const call = vi.mocked(complete).mock.calls[0];
  const schema = call[2];
  expect(schema.safeParse(answer).success).toBe(true);
  expect(answerSchema.safeParse(result).success).toBe(true);
  expect(
    answerSchema.safeParse({ ...answer, evidence_ids: [...ids, "extra"] })
      .success,
  ).toBe(false);
  expect(
    schema.safeParse({ ...answer, evidence_ids: ["fictional-source-id"] })
      .success,
  ).toBe(false);
  const jsonSchema = z.toJSONSchema(schema);
  expect(jsonSchema.properties?.evidence_ids).toMatchObject({
    maxItems: 12,
    items: { enum: ids },
  });
  expect(JSON.parse(String(call[1])).allowed_evidence_ids).toEqual(ids);
  expect(call[0]).toContain("source_id and relatedIds are not citation IDs");
  expect(call[0]).toContain("concrete example or location");
});
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
  expect(complete).toHaveBeenCalledTimes(3);
  for (const call of vi.mocked(complete).mock.calls)
    expect(call[3]?.model).toBe("openai/gpt-6-luna");
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
it("rejects answer citations outside the freshly verified context without a model audit", async () => {
  const q = await input();
  vi.mocked(complete).mockResolvedValueOnce({
    answer: "Fictional answer with an unauthorized citation.",
    evidence_ids: ["not-in-context"],
  });
  await expect(
    answerPackets(
      "Was a warning implemented?",
      {
        actor: { name: "Ada", aliases: [], firstPersonOwner: true },
        packets: [q.packet],
      },
      { accountId: "test" },
      gate,
    ),
  ).rejects.toThrow("AI cited evidence outside the supplied context.");
  expect(complete).toHaveBeenCalledTimes(1);
});
it("passes uncertainty and exact evidence to Luna without treating follow-up questions as proof", async () => {
  const q = await input();
  const packet = {
    ...q.packet,
    uncertainties: ["Fictional proficiency is not established."],
  };
  vi.mocked(complete).mockResolvedValueOnce({
    answer: "Fictional proficiency is not established.",
    evidence_ids: [packet.id],
  });
  await answerPackets(
    "How did he learn it?",
    {
      actor: {
        name: "Fictional candidate",
        aliases: [],
        firstPersonOwner: true,
      },
      packets: [packet],
    },
    {},
    gate,
    ["Does he speak Mandarin?"],
  );
  const sent = JSON.parse(String(vi.mocked(complete).mock.calls[0][1]));
  expect(sent.evidence).toEqual([packet]);
  expect(sent.recent_questions).toEqual(["Does he speak Mandarin?"]);
  expect(complete).toHaveBeenCalledTimes(1);
});
it.each(["PENDING_REVIEW", "DISPUTED", "SUPERSEDED", "REMOVED"] as const)(
  "does not call providers when all claim evidence is %s",
  async (availability) => {
    const q = await input();
    const result = await answerPackets(
      "What was implemented?",
      {
        actor: {
          name: "Fictional candidate",
          aliases: [],
          firstPersonOwner: true,
        },
        packets: [
          {
            ...q.packet,
            claims: q.packet.claims.map((claim) => ({
              ...claim,
              availability,
            })),
          },
        ],
      },
      {},
      gate,
    );
    expect(result).toEqual({
      answer: "No relevant evidence is currently stored.",
      evidence_ids: [],
    });
    expect(complete).not.toHaveBeenCalled();
  },
);
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
