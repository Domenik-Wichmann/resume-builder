import { expect, it } from "vitest";
import { newWorkspace, type Workspace } from "../src/lib/workspaces/model";
import { fixture } from "../src/lib/career/fixture";
import {
  workspaceConversation,
  conversationEvidence,
  conversationQuery,
  conversationCharacterLimit,
} from "../src/lib/workspaces/conversation";

function workspace(count = 10): Workspace {
  return {
    ...newWorkspace("00000000-0000-4000-8000-000000000001", "US", false),
    questions: Array.from({ length: count }, (_, index) => ({
      question: `Fictional question ${index}`,
      answer: `Fictional answer ${index}`,
      evidence_ids: [],
      topics: [
        { topic: `Fictional topic ${index}`, strength: "NONE" as const },
      ],
      created_at: "2026-10-06",
    })),
  };
}
it("keeps the newest eight exchanges in order without modifying persistent history", () => {
  const stored = workspace();
  const context = workspaceConversation(stored);
  expect(context.turns.map((turn) => turn.question)).toEqual(
    stored.questions.slice(-8).map((turn) => turn.question),
  );
  expect(context.turns[0].answer).toBe("Fictional answer 2");
  expect(context.topics[0]).toBe("Fictional topic 9");
  expect(stored.questions).toHaveLength(10);
});
it("bounds long conversation, job and topics while prioritizing the latest exchange", () => {
  const stored = workspace();
  stored.job_description = "j".repeat(12000);
  stored.requirements = Array(20).fill("r".repeat(500));
  stored.questions = stored.questions.map((turn) => ({
    ...turn,
    question: turn.question.padEnd(1000, "q"),
    answer: "a".repeat(5000),
  }));
  const context = workspaceConversation(stored);
  const characters =
    (context.job_description?.length || 0) +
    context.requirements.join("").length +
    context.topics.join("").length +
    context.turns.reduce(
      (sum, turn) => sum + turn.question.length + turn.answer.length,
      0,
    );
  expect(characters).toBeLessThanOrEqual(conversationCharacterLimit);
  expect(context.turns.at(-1)?.question).toContain("question 9");
  expect(context.turns.some((turn) => turn.answer_truncated)).toBe(true);
});
it("cannot leak another workspace through shared conversational memory", () => {
  const first = workspace(1);
  first.questions[0].answer = "Private fictional workspace A answer";
  const second = workspace(1);
  second.questions[0].answer = "Private fictional workspace B answer";
  workspaceConversation(first);
  expect(JSON.stringify(workspaceConversation(second))).not.toContain(
    "workspace A",
  );
  expect(workspaceConversation().turns).toEqual([]);
});
it("uses current public records for prior citations and keeps model prose out of retrieval hints", () => {
  const stored = workspace(1);
  const project = fixture.projects[0];
  stored.questions[0].evidence_ids = [project.id, "private-or-unpublished"];
  stored.questions[0].answer =
    "Invented fictional previous model prose is not evidence";
  stored.evidence = [{ ...project, title: "Stale fictional title" }];
  const context = workspaceConversation(stored);
  expect(conversationEvidence(context, fixture)).toEqual([project]);
  const hint = conversationQuery(context, fixture);
  expect(hint).toContain(project.title);
  expect(hint).not.toContain("Invented");
  expect(hint).not.toContain("Stale fictional title");
  expect(conversationEvidence(context, { ...fixture, projects: [] })).toEqual(
    [],
  );
  expect(hint.length).toBeLessThanOrEqual(2000);
});
