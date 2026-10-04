import { z } from "zod";
export const answerSchema = z
  .object({
    answer: z.string().max(5000),
    evidence_ids: z.array(z.string()).max(8),
  })
  .strict();
export const matchSchema = z
  .object({
    overall_summary: z.string().max(2000),
    strong_matches: z.array(z.string().max(500)).max(12),
    supporting_experience: z.array(z.string()).max(8),
    skills: z.array(z.string()).max(30),
    gaps: z.array(z.string().max(500)).max(12),
    suggested_resume_emphasis: z.array(z.string().max(500)).max(12),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema>;
export type Match = z.infer<typeof matchSchema>;
export function validateEvidence(ids: string[], allowed: string[]) {
  if (ids.some((id) => !allowed.includes(id)))
    throw new Error("AI cited evidence outside the supplied context.");
}
