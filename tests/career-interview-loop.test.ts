import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyMemory,
  type Message,
  type Session,
} from "../src/lib/interview/model";
import { demoSession } from "../src/lib/interview/demo";
import type { BrainRecord } from "../src/lib/career-brain/repository";
const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  load: vi.fn(),
  propose: vi.fn(),
}));
vi.mock("../src/lib/ai/openrouter", () => ({ complete: mocks.complete }));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.load,
}));
vi.mock("../src/lib/career-brain/propose", () => ({
  proposeBrain: mocks.propose,
}));
vi.mock("../src/lib/career-brain/provider", () => ({
  productionGate: async (
    _label: string,
    _provider: string,
    call: () => Promise<unknown>,
  ) => call(),
}));
import { interviewAction } from "../src/lib/interview/repository";

// Small Supabase contract fixture. Real persistence/RLS/atomicity is exercised
// separately against all committed PostgreSQL migrations in PGlite.
function storage(initial: Session, initialMessages: Message[]) {
  let session = { ...initial };
  const messages = [...initialMessages];
  const tables: string[] = [],
    calls: { name: string; args: Record<string, unknown> }[] = [];
  let status = "";
  function from(table: string) {
    tables.push(table);
    let descending = false;
    let mutation: Record<string, unknown> | null = null;
    const result = () => {
      if (table === "career_interview_sessions") {
        if (mutation) session = { ...session, ...mutation };
        return { data: { ...session }, error: null };
      }
      if (table === "career_interview_messages")
        return {
          data: descending ? [...messages].reverse() : [...messages],
          error: null,
        };
      if (table === "career_imports") return { data: { status }, error: null };
      throw new Error(`Unexpected table ${table}`);
    };
    const query = {
      select: () => query,
      eq: () => query,
      order: (
        _field: string,
        options: { ascending: boolean } = { ascending: true },
      ) => {
        descending = !options.ascending;
        return query;
      },
      limit: () => query,
      update: (values: Record<string, unknown>) => {
        mutation = values;
        return query;
      },
      maybeSingle: async () => result(),
      single: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
        Promise.resolve(result()).then(resolve),
    };
    return query;
  }
  const db = {
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "begin_career_interview") {
        session = {
          ...session,
          version: session.version + 1,
          pending_token: String(args.p_token),
          pending_until: "2099-10-08T00:00:00Z",
        };
        if (args.p_answer)
          messages.push({
            id: randomUUID(),
            session_id: session.id,
            sequence: messages.length + 1,
            role: "user",
            content: String(args.p_answer),
            rationale: "",
            created_at: session.created_at,
          });
        return { data: { ...session }, error: null };
      }
      if (name === "complete_career_interview") {
        session = {
          ...session,
          state: args.p_state as Session["state"],
          turn_count: session.turn_count + 1,
          pending_token: null,
          pending_until: null,
        };
        messages.push({
          id: randomUUID(),
          session_id: session.id,
          sequence: messages.length + 1,
          role: "assistant",
          content: String(args.p_content),
          rationale: String(args.p_rationale),
          created_at: session.created_at,
        });
        return { data: null, error: null };
      }
      if (name === "review_career_interview") {
        const id = randomUUID();
        status = "DRAFT";
        session = {
          ...session,
          reviewed_through: Number(args.p_through),
          last_import_id: id,
          status: args.p_finish ? "FINISHED" : session.status,
          pending_token: null,
          pending_until: null,
        };
        return { data: id, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  } as unknown as SupabaseClient;
  return { db, tables, calls, read: () => ({ session, messages }) };
}
const agentQuestion: Message = {
  id: randomUUID(),
  session_id: demoSession.id,
  sequence: 1,
  role: "assistant",
  content: "Who besides you used the validation tool?",
  rationale: "Adoption evidence is partial.",
  created_at: demoSession.created_at,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue([]);
  mocks.propose.mockResolvedValue({ changes: [] });
});
it("retrieves again after an answer, runs exactly one accounted planner call, and persists adaptive working memory", async () => {
  const state = emptyMemory();
  state.denials = ["AWS"];
  const s = { ...demoSession, state, version: 1 };
  const store = storage(s, [agentQuestion]);
  mocks.complete.mockImplementation(async (_system: string, input: string) => {
    const context = JSON.parse(input) as {
      recent_messages: Message[];
      memory: Session["state"];
    };
    const answer = context.recent_messages.at(-1)!;
    expect(answer.content).toContain("German");
    expect(context.memory.denials).toEqual(["AWS"]);
    return {
      question: "Was German something you regularly used with clients?",
      rationale: "Your answer revealed a useful communication detail.",
      state: {
        ...state,
        focus: "Professional German",
        findings: [
          {
            note: "Client communication in German",
            message_id: answer.id,
            quote: "technical failures to clients in German",
          },
        ],
      },
    };
  });
  const result = await interviewAction(store.db, s.account_id, {
    action: "turn",
    id: s.id,
    version: 1,
    answer:
      "A couple coworkers. I also explained technical failures to clients in German.",
  });
  expect(mocks.complete).toHaveBeenCalledTimes(1);
  expect(mocks.load).toHaveBeenCalledWith(store.db, s.account_id);
  expect(mocks.complete.mock.calls[0][3]).toMatchObject({
    model: "openai/gpt-6-luna-pro",
    usage: { accountId: s.account_id, operation: "career_interview_plan" },
  });
  expect(result.messages.at(-1)?.content).toContain("German");
  expect(result.session.state.findings).toHaveLength(1);
  expect(
    store.tables.every((t) =>
      [
        "career_interview_sessions",
        "career_interview_messages",
        "career_imports",
      ].includes(t),
    ),
  ).toBe(true);
  expect(mocks.propose).not.toHaveBeenCalled();
});
it("provider failure retains the answer and releases the lease for a no-duplicate retry", async () => {
  const s = { ...demoSession, state: emptyMemory(), version: 1 };
  const store = storage(s, [agentQuestion]);
  mocks.complete.mockRejectedValue(new Error("Provider unavailable"));
  await expect(
    interviewAction(store.db, s.account_id, {
      action: "turn",
      id: s.id,
      version: 1,
      answer: "I showed one coworker the regex rules.",
    }),
  ).rejects.toThrow("Provider unavailable");
  expect(store.read().messages.at(-1)?.role).toBe("user");
  expect(store.read().session.pending_token).toBeNull();
  mocks.complete.mockResolvedValue({
    question:
      "Did you work directly with that coworker to understand their file requirements?",
    rationale: "Follow up on a concrete detail.",
    state: emptyMemory(),
  });
  await interviewAction(store.db, s.account_id, {
    action: "turn",
    id: s.id,
    version: 2,
    answer: null,
  });
  expect(store.read().messages.filter((m) => m.role === "user")).toHaveLength(
    1,
  );
});
it("finish invokes the existing partial-source proposal pipeline with owner-only proof and uses the draft transaction only", async () => {
  const s = { ...demoSession, state: emptyMemory(), version: 1 };
  const answer: Message = {
    ...agentQuestion,
    id: randomUUID(),
    sequence: 2,
    role: "user",
    content: "I personally introduced the validation tool to two coworkers.",
  };
  const store = storage(s, [agentQuestion, answer]);
  const result = await interviewAction(store.db, s.account_id, {
    action: "review",
    id: s.id,
    version: 1,
    finish: true,
  });
  expect(mocks.propose).toHaveBeenCalledOnce();
  const proposal = mocks.propose.mock.calls[0];
  expect(proposal[2]).toBe(answer.content);
  expect(proposal[4]).toBe(false);
  expect(proposal[6]).toContain(agentQuestion.content);
  const saved = store.calls.find((c) => c.name === "review_career_interview")!;
  expect(saved.args.p_source).toBe(answer.content);
  expect(saved.args.p_candidates).toEqual([]);
  expect(result.session.status).toBe("FINISHED");
  expect(store.calls.some((c) => c.name.includes("apply"))).toBe(false);
  expect(mocks.complete).not.toHaveBeenCalled();
});
it("interview source context reaches extraction and audit as non-evidence without entering the primary source", async () => {
  const { extractRich, auditGrounding } =
    await import("../src/lib/career-brain/extract");
  const source = "I showed two coworkers the validation rules.";
  mocks.complete.mockResolvedValueOnce({ records: [] });
  const gate = async <T>(
    _label: string,
    _provider: "OPENROUTER" | "COHERE",
    call: () => Promise<T>,
  ) => call();
  await extractRich(
    source,
    [] as BrainRecord[],
    demoSession.account_id,
    gate,
    false,
    true,
    false,
    "Question: Did you train 100 people?",
  );
  const extraction = mocks.complete.mock.calls[0];
  expect(extraction[0]).toContain("NOT EVIDENCE");
  expect(extraction[1]).toBe(source);
  mocks.complete.mockResolvedValueOnce({
    decisions: [
      { index: 0, verdict: "SUPPORTED", reason: "Owner-answer support only" },
    ],
  });
  await auditGrounding(
    [
      {
        kind: "project",
        key: "fictional-tool",
        title: "Fictional tool",
        subtitle: "",
        summary: "Showed validation rules",
        organization: null,
        start_date: null,
        end_date: null,
        skill_keys: [],
        achievement_keys: [],
        category_key: null,
        source_quote: source,
        aliases: [],
        uncertainties: [],
        claims: [
          {
            attribute: "action",
            value: "Showed validation rules to coworkers",
            attribution: "PERSONAL",
            evidence: [{ quote: source, start: 0, end: source.length }],
          },
        ],
      },
    ],
    source,
    demoSession.account_id,
    gate,
    undefined,
    "Question: Did you train 100 people?",
  );
  const audit = JSON.parse(mocks.complete.mock.calls[1][1]) as {
    source: string;
    question_context: string;
    context_rule: string;
  };
  expect(audit.source).toBe(source);
  expect(audit.question_context).toContain("100 people");
  expect(audit.context_rule).toContain("not proof");
});
