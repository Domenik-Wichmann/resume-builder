import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  emptyMemory,
  actionSchema,
  type Message,
} from "../src/lib/interview/model";
import {
  planningContext,
  validatePlan,
  interviewSource,
  type Plan,
} from "../src/lib/interview/planning";
import {
  getCareerRecord,
  searchCareer,
  inspectRequirement,
} from "../src/lib/interview/retrieval";
import { demoSession } from "../src/lib/interview/demo";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import { HttpError } from "../src/lib/http";

function record(
  title: string,
  value: string,
  availability: BrainRecord["claims"][number]["availability"] = "CONFIRMED",
): BrainRecord {
  return {
    id: randomUUID(),
    kind: "project",
    key: title.toLowerCase(),
    title,
    subtitle: "",
    summary: "Thin summary",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: value,
    published: false,
    archived: false,
    hash: "a".repeat(64),
    updated_at: "2026-10-08T00:00:00Z",
    evidence_version: null,
    aliases: [],
    uncertainties: [],
    claims: [
      {
        attribute: "action",
        value,
        availability,
        attribution: "PERSONAL",
        evidence: [{ quote: value, start: 0, end: value.length }],
      },
    ],
  };
}
const message = (
  role: Message["role"],
  content: string,
  sequence = 1,
): Message => ({
  id: randomUUID(),
  session_id: demoSession.id,
  role,
  content,
  sequence,
  rationale: "",
  created_at: "2026-10-08T00:00:00Z",
});
const plan = (question: string): Plan => ({
  question,
  rationale: "Investigate an evidence gap, not assumed absence.",
  state: emptyMemory(),
});

it("searches confirmed claim-level evidence, includes private records, and separates conflicts from proof", () => {
  const sql = record("Database checks", "I designed SQL validation checks.");
  const conflict = record("Workshop", "Trained 40 people", "DISPUTED");
  const archived = { ...record("Old SQL", "I used SQL"), archived: true };
  expect(searchCareer([conflict, sql, archived], "SQL")[0].id).toBe(sql.id);
  expect(getCareerRecord([conflict], conflict.id)?.claims).toEqual([]);
  expect(
    getCareerRecord([conflict], conflict.id)?.uncertainties[0].availability,
  ).toBe("DISPUTED");
  expect(inspectRequirement([sql, archived], "SQL").candidates).toHaveLength(1);
  expect(inspectRequirement([sql], "AWS").candidates).toEqual([]);
  expect(inspectRequirement([sql], "AWS").note).toContain(
    "not proof of no skill",
  );
});
it("bounds rich retrieval and includes selected project associations", () => {
  const rows = Array.from({ length: 107 }, (_, i) =>
    record(`Work ${i}`, `I built example ${i}`),
  );
  const skill = { ...record("SQL", "I used SQL"), kind: "skill" as const };
  rows[90].skill_keys = [skill.key];
  const hits = searchCareer([...rows, skill], "", rows[90].id);
  expect(hits).toHaveLength(6);
  expect(hits[0].id).toBe(rows[90].id);
  expect(hits.some((h) => h.id === skill.id)).toBe(true);
});
it("rejects repeated questions and continued named-technology probing after an explicit denial", () => {
  const earlier = message("assistant", "Have you used Kubernetes?");
  expect(() =>
    validatePlan(plan("Have you used Kubernetes?"), demoSession, [earlier], []),
  ).toThrow("repeated");
  const state = { ...emptyMemory(), denials: ["Kubernetes"] };
  expect(() =>
    validatePlan(
      plan("When did you use Kubernetes?"),
      { ...demoSession, state },
      [],
      [],
    ),
  ).toThrow("denied");
  expect(
    validatePlan(
      plan("How did coworkers start using the tool?"),
      { ...demoSession, state },
      [],
      [],
    ).state.denials,
  ).toEqual(["Kubernetes"]);
});
it("keeps exact owner-answer findings and drops agent-question quotations and unsupported strength claims", () => {
  const owner = message(
    "user",
    "I explained technical failures to clients in German.",
    2,
  );
  const assistant = message("assistant", "Did you train two coworkers?", 1);
  const result = plan("Was German something you regularly used with clients?");
  result.state.findings = [
    {
      note: "Professional German (temporary)",
      message_id: owner.id,
      quote: "technical failures to clients in German",
    },
    {
      note: "Invented training",
      message_id: assistant.id,
      quote: assistant.content,
    },
  ];
  result.state.requirements = [
    {
      requirement: "AWS",
      strength: "STRONG",
      evidence_ids: [randomUUID()],
      improved: false,
    },
  ];
  const checked = validatePlan(result, demoSession, [assistant, owner], []);
  expect(checked.state.findings).toHaveLength(1);
  expect(checked.state.requirements[0].strength).toBe("NONE");
});
it("preserves compact summaries and unresolved/denied context without sending an unbounded transcript", () => {
  const messages = Array.from({ length: 300 }, (_, i) =>
    message(i % 2 ? "user" : "assistant", `turn ${i}`, i + 1),
  );
  const state = {
    ...emptyMemory(),
    summary: "Owner does not remember the savings metric.",
    unresolved: ["Metric unavailable"],
    denials: ["AWS"],
  };
  const context = planningContext({ ...demoSession, state }, messages, []);
  expect(context.recent_messages).toHaveLength(14);
  expect(context.prior_questions).toHaveLength(80);
  expect(context.memory.summary).toContain("does not remember");
  expect(context.memory.denials).toEqual(["AWS"]);
});
it("checkpoints preserve exact owner answers as primary proof and keep questions separate", () => {
  const q = message("assistant", "Did you save 100 hours?", 1),
    a = message("user", "I do not remember the time saved.", 2);
  const q2 = message("assistant", "What did you personally build?", 3),
    a2 = message("user", "I wrote the validation rules myself.", 4);
  const source = interviewSource([q, a, q2, a2], 0);
  expect(source.text).toBe(`${a.content}\n\n${a2.content}`);
  expect(source.text).not.toContain("100 hours");
  expect(source.context).toContain(q.content);
  expect(source.through).toBe(4);
  expect(interviewSource([q, a, q2, a2], 2).text).toBe(a2.content);
});
it("chunks long reviews without dropping any raw answers", () => {
  const answers = Array.from({ length: 12 }, (_, i) =>
    message("user", `${i}:` + "x".repeat(5900), i + 1),
  );
  const first = interviewSource(answers, 0),
    second = interviewSource(answers, first.through);
  expect(first.text.length).toBeLessThan(40000);
  expect(first.hasMore).toBe(true);
  expect(second.hasMore).toBe(false);
  for (const a of answers)
    expect(
      first.text.includes(a.content) || second.text.includes(a.content),
    ).toBe(true);
});
it("requires goal-specific inputs and never accepts browser account authority", () => {
  expect(
    actionSchema.safeParse({ action: "start", mode: "job", title: "Target" })
      .success,
  ).toBe(false);
  expect(
    actionSchema.safeParse({
      action: "start",
      mode: "role",
      title: "Target",
      target_role: "AI automation",
    }).success,
  ).toBe(true);
  expect(
    actionSchema.safeParse({
      action: "start",
      mode: "general",
      title: "Discovery",
      account_id: randomUUID(),
    }).success,
  ).toBe(false);
});

vi.mock("../src/lib/admin", () => ({
  requireOwner: vi.fn(async () => {
    throw new HttpError(403, "owner authentication required");
  }),
}));
vi.mock("../src/lib/accounts", () => ({ requireAccount: vi.fn() }));
it("rejects public interview reads and writes before accessing accounts or providers", async () => {
  const { GET, POST } = await import("../src/app/api/admin/interviews/route");
  const { NextRequest } = await import("next/server");
  const { requireAccount } = await import("../src/lib/accounts");
  expect(
    (await GET(new NextRequest("http://localhost:3000/api/admin/interviews")))
      .status,
  ).toBe(403);
  expect(
    (
      await POST(
        new NextRequest("http://localhost:3000/api/admin/interviews", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(403);
  expect(requireAccount).not.toHaveBeenCalled();
});
