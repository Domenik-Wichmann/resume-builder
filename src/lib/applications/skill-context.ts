import { z } from "zod";

export const skillContextSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(1).max(200),
    requirement_index: z.number().int().min(0).max(7).nullable(),
    priority: z.enum(["CORE", "SUPPORTING"]),
  })
  .strict();
export type SkillContext = z.infer<typeof skillContextSchema>;

/** Context must be readable in the exported sentence, not only in private notes. */
export function skillContextIssue(
  text: string,
  context: SkillContext | null | undefined,
  hasWorkEvidence: boolean,
  requirementCount?: number,
) {
  if (!hasWorkEvidence)
    return "A skill/tool list alone does not establish completed work. Cite the actual project, experience or achievement supporting the action and purpose.";
  if (!context)
    return "Identify the concrete work and purpose in the sentence.";
  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  const sentence = normalize(text);
  const subject = normalize(context.subject);
  if (
    !sentence.includes(subject) ||
    !sentence.includes(normalize(context.purpose))
  )
    return "The work and purpose must be explicit in the résumé sentence, not supplied only by reviewer notes.";
  if (
    /^(?:(?:the|my|a|an|some) )?(?:projects?(?: runs?| evaluations?| outputs?)?|runs?|changes?|outputs?|results?|systems?|data|information|business information|workflows?|process(?:es)?|tools?|applications?|AI outputs?|LLM outputs?)$/i.test(
      subject,
    )
  )
    return "Name the actual system, data domain or workflow; a generic project/run/output is not enough context.";
  if (
    requirementCount !== undefined &&
    (context.requirement_index === null ||
      context.requirement_index < 0 ||
      context.requirement_index >= requirementCount)
  )
    return "Connect this capability to an actual job requirement.";
  if (/^Project exposure\b/i.test(text.trim()))
    return "Describe supported work rather than an exposure or feature inventory.";
}
