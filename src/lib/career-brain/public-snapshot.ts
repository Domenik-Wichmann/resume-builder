import "server-only";
import { z } from "zod";
import { candidateSchema } from "../ingestion/model";

export const evidenceRow = z.object({
  kind: z.string(),
  entity_id: z.string(),
  canonical_hash: z.string(),
  aliases: z.unknown(),
  claims: z.unknown(),
  updated_at: z.string(),
});
export type EvidenceRow = z.infer<typeof evidenceRow>;
export const publicSnapshot = z.object({
  canonical: z.array(
    candidateSchema.safeExtend({
      id: z.string(),
      hash: z.string(),
      published: z.literal(true),
      archived: z.literal(false),
      updated_at: z.string(),
    }),
  ),
  evidence: z.array(evidenceRow),
  sources: z.array(z.object({ id: z.string(), evidence_text: z.string() })),
});
