import type { Workspace, Topic } from "./model";
import type { CareerRecord } from "../career/model";
import { deduplicate } from "../career/utils";
import type { Answer, Match } from "../ai/contracts";
export function deriveTopics(
  question: string,
  evidence: CareerRecord[],
  knownSkills: string[],
): Topic[] {
  const mentioned = knownSkills.filter((skill) =>
    question.toLowerCase().includes(skill.toLowerCase()),
  );
  const hints = [
    "AWS",
    "Azure",
    "Python",
    "management",
    "leadership",
    "international",
    "SQL",
    "automation",
  ];
  const candidates = [
    ...hints.filter((topic) =>
      question.toLowerCase().includes(topic.toLowerCase()),
    ),
    ...mentioned,
  ];
  const topics = [
    ...new Map(
      candidates.map((topic) => [topic.toLowerCase(), topic]),
    ).values(),
  ];
  return (topics.length ? topics : [question.trim().slice(0, 80)])
    .slice(0, 8)
    .map((topic) => {
      const direct = evidence.some(
        (record) =>
          record.skills.some(
            (skill) => skill.toLowerCase() === topic.toLowerCase(),
          ) ||
          `${record.title} ${record.summary}`
            .toLowerCase()
            .includes(topic.toLowerCase()),
      );
      return {
        topic,
        strength: direct ? "STRONG" : evidence.length ? "PARTIAL" : "NONE",
      };
    });
}
export function requirementsFromJob(input: string) {
  return [
    ...new Set(
      input
        .split(/[\n;]+/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 10),
    ),
  ]
    .slice(0, 20)
    .map((line) => line.slice(0, 500));
}
export function applyQuestion(
  workspace: Workspace,
  input: string,
  answer: Answer,
  evidence: CareerRecord[],
  topics: Topic[],
): Workspace {
  if (workspace.questions.length >= 50)
    throw new Error("This workspace has reached its 50-question limit.");
  return {
    ...workspace,
    updated_at: new Date().toISOString(),
    evidence: deduplicate([...workspace.evidence, ...evidence], 60),
    questions: [
      ...workspace.questions,
      {
        question: input,
        answer: answer.answer,
        evidence_ids: answer.evidence_ids,
        topics,
        created_at: new Date().toISOString(),
      },
    ],
  };
}
export function applyMatch(
  workspace: Workspace,
  input: string,
  result: Match,
  evidence: CareerRecord[],
): Workspace {
  return {
    ...workspace,
    title: "Role & career exploration",
    job_description: input,
    requirements: requirementsFromJob(input),
    match: result,
    evidence: deduplicate([...workspace.evidence, ...evidence], 60),
    updated_at: new Date().toISOString(),
  };
}
