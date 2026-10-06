import "server-only";
import type { Workspace } from "./model";
import type { Career } from "../career/model";
import { answerEvidenceLimit } from "../ai/contracts";

export type ConversationTurn = {
  question: string;
  answer: string;
  answer_truncated: boolean;
  evidence_ids: string[];
};
export type WorkspaceConversation = {
  turns: ConversationTurn[];
  job_description: string | null;
  requirements: string[];
  topics: string[];
};
export const conversationTurnLimit = 8;
export const conversationCharacterLimit = 12000;

// Rebuild locally from one owned workspace. No shared memory or generated summary
// may turn a previous answer into canonical career truth.
export function workspaceConversation(
  workspace?: Workspace,
): WorkspaceConversation {
  const job = workspace?.job_description?.slice(0, 2000) || null;
  const requirements = (workspace?.requirements || [])
    .slice(0, 6)
    .map((value) => value.slice(0, 200));
  const topics = [
    ...new Set([
      ...(workspace?.questions || [])
        .slice()
        .reverse()
        .flatMap((turn) => turn.topics.map((topic) => topic.topic)),
      ...(workspace?.interests || []),
    ]),
  ]
    .slice(0, 8)
    .map((value) => value.slice(0, 100));
  let remaining =
    conversationCharacterLimit -
    (job?.length || 0) -
    requirements.join("").length -
    topics.join("").length;
  const turns: ConversationTurn[] = [];
  for (const turn of (workspace?.questions || [])
    .slice(-conversationTurnLimit)
    .reverse()) {
    const question = turn.question.slice(0, 1000);
    if (question.length > remaining) break;
    const answer = turn.answer.slice(
      0,
      Math.min(5000, remaining - question.length),
    );
    turns.unshift({
      question,
      answer,
      answer_truncated: answer.length < turn.answer.length,
      evidence_ids: turn.evidence_ids
        .slice(0, answerEvidenceLimit)
        .map((id) => id.slice(0, 100)),
    });
    remaining -= question.length + answer.length;
    if (remaining === 0) break;
  }
  return { turns, job_description: job, requirements, topics };
}

export function conversationEvidence(
  context: WorkspaceConversation,
  career: Career,
) {
  const records = [
    ...career.experiences,
    ...career.projects,
    ...career.achievements,
    ...career.skill_records,
    ...career.education,
    ...career.certifications,
    ...(career.languages || []),
  ];
  const current = new Map(records.map((record) => [record.id, record]));
  const ids = [
    ...new Set(
      context.turns
        .slice(-3)
        .reverse()
        .flatMap((turn) => turn.evidence_ids),
    ),
  ];
  // Old citations are references only: resolve them against current public records.
  return ids
    .flatMap((id) => (current.has(id) ? [current.get(id)!] : []))
    .slice(0, answerEvidenceLimit);
}

export function conversationQuery(
  context: WorkspaceConversation,
  career: Career,
) {
  if (
    !context.turns.length &&
    !context.job_description &&
    !context.topics.length &&
    !context.requirements.length
  )
    return "";
  // This local retrieval hint contains questions/current labels, not prior answers.
  return [
    `Recent questions: ${context.turns
      .slice(-3)
      .reverse()
      .map((turn) => turn.question)
      .join(" / ")}`,
    `Discussed career records: ${conversationEvidence(context, career)
      .map((record) => record.title)
      .join(", ")}`,
    `Topics: ${context.topics.join(", ")}`,
    `Role context: ${context.job_description || context.requirements.join("; ")}`,
  ]
    .join("\n")
    .slice(0, 2000);
}
