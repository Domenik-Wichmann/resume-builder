import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

export const reviewCheckpointSchema = z
  .object({
    key: z.string().regex(/^[a-f0-9]{64}$/),
    audit: z
      .array(
        z
          .object({
            text: z.string().max(700),
            refs: z.array(z.string().max(200)).max(16),
            pass: z.boolean(),
            reason: z.string().max(2000),
            kind: z.enum(["skill", "content"]).optional(),
            order: z.number().finite().optional(),
          })
          .strict(),
      )
      .max(52),
  })
  .strict();

// The private checkpoint is reusable only with the exact same source packets,
// draft, job plan and locked content. The browser cannot supply this state.
export function reviewCheckpointKey(input: {
  writing: unknown;
  evidence: unknown;
  plan: unknown;
  lockedBlocks: unknown;
}) {
  return createHash("sha256")
    .update(JSON.stringify({ policy: "review-v1", ...input }))
    .digest("hex");
}

export function checkpointAudit(value: unknown, key: string) {
  const parsed = reviewCheckpointSchema.safeParse(value);
  return parsed.success && parsed.data.key === key
    ? parsed.data.audit
    : undefined;
}
