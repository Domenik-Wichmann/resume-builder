import "server-only";
import { getCareer } from "../career/repository";
import { retrieveCareerEvidence } from "../embeddings/retrieval";
import { jobQueries } from "../embeddings/content";
import { validateEvidence } from "./contracts";
import type { Workspace } from "../workspaces/model";
import type { UsageContext } from "../usage/service";
import { publishedPackets, answerPackets } from "../career-brain/serving";
import type { Career } from "../career/model";
import { measure } from "../performance";
import { answerEvidence, answerEvidenceLimit } from "./answer-evidence";
import {
  workspaceConversation,
  conversationQuery,
  conversationEvidence,
} from "../workspaces/conversation";
export async function analyze(
  task: "ask" | "match",
  input: string,
  workspace?: Workspace,
  usage: UsageContext = {},
  currentCareer?: Career,
) {
  const career = currentCareer || (await measure("career", () => getCareer()));
  const context = workspaceConversation(workspace);
  const referenceContext = conversationQuery(context, career);
  const queries =
    task === "match"
      ? jobQueries(input)
      : [
          input,
          ...(referenceContext
            ? [
                `${input}\nWorkspace context (references only):\n${referenceContext}`,
              ]
            : []),
        ];
  const retrieved = await retrieveCareerEvidence(queries, career, {
    ...usage,
    operation: usage.operation || task,
  });
  const evidence =
    task === "ask"
      ? answerEvidence(
          career,
          [...retrieved, ...conversationEvidence(context, career)],
          input,
          referenceContext,
        )
      : retrieved.slice(0, 8);
  const ids = evidence.map((record) => record.id);
  if (task === "ask") {
    const result =
      career.demo || !evidence.length
        ? {
            answer: evidence.length
              ? evidence.map((record) => record.summary).join(" ")
              : "No relevant evidence is currently stored.",
            evidence_ids: ids,
          }
        : await answerPackets(
            input,
            await publishedPackets(ids, usage.accountId, answerEvidenceLimit),
            usage,
            undefined,
            context,
          );
    validateEvidence(result.evidence_ids, ids);
    return { mode: career.demo ? "demo" : "live", result, evidence };
  }
  const result =
    career.demo || !evidence.length
      ? {
          overall_summary: evidence.length
            ? "The stored evidence supports these areas. This is a keyword-based demo, not a hiring score."
            : "No relevant evidence is currently stored.",
          strong_matches: evidence.map((record) => record.summary),
          supporting_experience: ids,
          skills: [...new Set(evidence.flatMap((record) => record.skills))],
          gaps: ["Requirements without supporting evidence need owner review."],
          suggested_resume_emphasis: evidence.map((record) => record.title),
        }
      : await (async () => {
          const answer = await answerPackets(
            `Which requirements in this job are directly supported, partly supported, or not established by the candidate's evidence? Explain the limits: ${input}`,
            await publishedPackets(ids, usage.accountId),
            usage,
            undefined,
            context,
          );
          return {
            overall_summary: answer.answer,
            strong_matches: answer.evidence_ids.length ? [answer.answer] : [],
            supporting_experience: answer.evidence_ids,
            skills: [],
            gaps: [
              "Requirements without direct source support remain unestablished.",
            ],
            suggested_resume_emphasis: evidence
              .filter((r) => answer.evidence_ids.includes(r.id))
              .map((r) => r.title),
          };
        })();
  validateEvidence(result.supporting_experience, ids);
  const allowedSkills = evidence.flatMap((record) => record.skills);
  if (result.skills.some((skill) => !allowedSkills.includes(skill)))
    throw new Error("AI returned an unsupported skill.");
  return { mode: career.demo ? "demo" : "live", result, evidence };
}
