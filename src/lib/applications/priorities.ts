import "server-only";
import type { StatePacket } from "../career-brain/state";
import { usable } from "../career-brain/state";

type RolePlan = {
  focus: string;
  requirements: { requirement: string; importance: string }[];
};

export function isAIRole(plan: RolePlan) {
  return /\b(?:AI|LLMs?|RAG|artificial intelligence|machine learning|language models?)\b/i.test(
    [
      plan.focus,
      ...plan.requirements
        .filter((r) => r.importance === "ESSENTIAL")
        .map((r) => r.requirement),
    ].join(" "),
  );
}

/** A selection hint, never proof of a tool, contribution, or job qualification. */
export function priorityAIWork(evidence: StatePacket[], plan: RolePlan) {
  if (!isAIRole(plan)) return [];
  return evidence.flatMap((packet) => {
    if (!["project", "experience", "achievement"].includes(packet.kind))
      return [];
    const refs = packet.claims.flatMap((claim, index) =>
      usable(claim) &&
      /\b(?:RAG|embeddings?|LLMs?|chatbots?|language models?|Gemini|OpenRouter|Cohere|generative AI|(?:vector|semantic|document|knowledge) retrieval|retrieval[ -]augmented)\b/i.test(
        claim.value,
      )
        ? [`${packet.id}:${index}`]
        : [],
    );
    return refs.length
      ? [{ record_id: packet.id, title: packet.title, refs }]
      : [];
  });
}

export const applicationPositioningInstructions =
  "Select evidence as if this were your own application: what would make a hiring reader want to interview you for THIS role? For AI roles, lead technical skills with substantial AI system implementation across the published projects: retrieval/RAG, document ingestion, embeddings, grounded chatbots, model integration and evaluation, wherever the exact evidence supports those mechanisms. Explain the named project, actual tools, what information it processes and its useful purpose. A job asking for model evaluation or AI operations can value hands-on building and checking those systems even without the word RAG in its description; mark that connection TRANSFERABLE privately when appropriate. Compare priority_ai_work across projects and use at least two distinct relevant implementations when supported, rather than repeating a single example. Spreadsheet automation can support an explicit requirement later; it must not displace stronger AI implementation evidence. For other jobs, select the strongest work for their own responsibilities rather than forcing AI into every resume. Fixed project descriptions do not prevent a skills sentence from explaining a distinct technical capability from that project with canonical evidence. Avoid repeating the same sentence or feature across summary, skills and project bullets. Do not add negative scope disclaimers; name the real positive contribution without inflating it. Priority hints and project titles are navigation only, never proof.";
