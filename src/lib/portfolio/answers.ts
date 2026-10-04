import { z } from "zod";
import { kinds } from "../ingestion/model";
export const sourceSchema = z
  .object({ kind: z.enum(kinds), id: z.uuid() })
  .strict();
export const cardSchema = z
  .object({
    id: z.uuid().nullable(),
    slug: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    question: z.string().trim().min(3).max(1000),
    answer: z.string().trim().min(1).max(5000),
    display_priority: z.number().int().min(0).max(10000),
    review_days: z.number().int().min(1).max(365),
    generated: z.boolean(),
    sources: z.array(sourceSchema).min(1).max(20),
  })
  .strict();
export type CardInput = z.infer<typeof cardSchema>;
export type AnswerCard = {
  id: string;
  slug: string;
  question: string;
  answer: string;
  display_priority: number;
  is_public: boolean;
  stale: boolean;
  expires_at: string;
  generated_at: string | null;
  sources: z.infer<typeof sourceSchema>[];
};
export function cardVisible(
  card: Pick<AnswerCard, "is_public" | "stale" | "expires_at" | "sources">,
  published: Set<string>,
  now = Date.now(),
) {
  return (
    card.is_public &&
    !card.stale &&
    Date.parse(card.expires_at) > now &&
    card.sources.length > 0 &&
    card.sources.every((s) => published.has(`${s.kind}:${s.id}`))
  );
}
