import { z } from "zod";

export const interviewMode = z.enum(["general", "role", "job", "record"]);
export const strength = z.enum(["STRONG", "PARTIAL", "RELATED", "NONE"]);
export const memorySchema = z
  .object({
    summary: z.string().max(2400),
    focus: z.string().max(160),
    topics: z.array(z.string().max(120)).max(40),
    denials: z.array(z.string().max(200)).max(40),
    unresolved: z.array(z.string().max(200)).max(30),
    findings: z
      .array(
        z
          .object({
            note: z.string().max(300),
            message_id: z.uuid(),
            quote: z.string().min(1).max(1500),
          })
          .strict(),
      )
      .max(40),
    requirements: z
      .array(
        z
          .object({
            requirement: z.string().max(180),
            strength,
            evidence_ids: z.array(z.uuid()).max(6),
            improved: z.boolean(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export const emptyMemory = (): Memory => ({
  summary: "",
  focus: "",
  topics: [],
  denials: [],
  unresolved: [],
  findings: [],
  requirements: [],
});
export type Memory = z.infer<typeof memorySchema>;
export const sessionSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  mode: interviewMode,
  status: z.enum(["ACTIVE", "FINISHED", "ARCHIVED"]),
  title: z.string(),
  target_role: z.string(),
  job_description: z.string(),
  target_record_id: z.uuid().nullable(),
  state: memorySchema,
  version: z.number().int(),
  turn_count: z.number().int(),
  reviewed_through: z.number().int(),
  last_import_id: z.uuid().nullable(),
  pending_token: z.uuid().nullable(),
  pending_until: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_activity_at: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;
export const sessionListSchema = sessionSchema.pick({
  id: true,
  mode: true,
  status: true,
  title: true,
  turn_count: true,
  last_activity_at: true,
});
export type SessionListItem = z.infer<typeof sessionListSchema>;
export const messageSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  sequence: z.number().int(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  rationale: z.string(),
  created_at: z.string(),
});
export type Message = z.infer<typeof messageSchema>;
export const startSchema = z
  .object({
    action: z.literal("start"),
    mode: interviewMode,
    title: z.string().trim().min(1).max(160),
    target_role: z.string().trim().max(1000).default(""),
    job_description: z.string().trim().max(16000).default(""),
    target_record_id: z.uuid().nullable().default(null),
  })
  .strict()
  .refine((x) => x.mode !== "role" || !!x.target_role)
  .refine((x) => x.mode !== "job" || !!x.job_description)
  .refine((x) => x.mode !== "record" || !!x.target_record_id);
const base = { id: z.uuid(), version: z.number().int().nonnegative() };
export const actionSchema = z.discriminatedUnion("action", [
  startSchema,
  z
    .object({
      ...base,
      action: z.literal("turn"),
      answer: z.string().min(1).max(6000).nullable(),
    })
    .strict(),
  z
    .object({ ...base, action: z.literal("review"), finish: z.boolean() })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("rename"),
      title: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("status"),
      status: z.enum(["ACTIVE", "ARCHIVED"]),
    })
    .strict(),
]);
export type InterviewAction = z.infer<typeof actionSchema>;
export type RecordChoice = { id: string; title: string; kind: string };
