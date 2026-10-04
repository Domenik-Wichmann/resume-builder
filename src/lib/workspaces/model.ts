import { z } from "zod";
import { recordSchema } from "../career/model";
import { matchSchema } from "../ai/contracts";
import { marketSchema } from "../markets";
export const topicSchema = z.object({
  topic: z.string().max(100),
  strength: z.enum(["STRONG", "PARTIAL", "NONE"]),
});
export const questionSchema = z.object({
  question: z.string().max(1000),
  answer: z.string().max(5000),
  evidence_ids: z.array(z.string()),
  topics: z.array(topicSchema),
  created_at: z.string(),
});
export const workspaceSchema = z.object({
  id: z.uuid(),
  market: marketSchema,
  title: z.string().max(100),
  job_description: z.string().nullable(),
  requirements: z.array(z.string()),
  match: matchSchema.nullable(),
  evidence: z.array(recordSchema).max(60),
  questions: z.array(questionSchema).max(50),
  created_at: z.string(),
  updated_at: z.string(),
  demo: z.boolean(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Topic = z.infer<typeof topicSchema>;
export function newWorkspace(
  id: string,
  market: "US" | "BG",
  demo: boolean,
): Workspace {
  const now = new Date().toISOString();
  return {
    id,
    market,
    title: "Career exploration",
    job_description: null,
    requirements: [],
    match: null,
    evidence: [],
    questions: [],
    created_at: now,
    updated_at: now,
    demo,
  };
}
