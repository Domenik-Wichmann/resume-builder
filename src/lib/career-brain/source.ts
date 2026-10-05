import { z } from "zod";

export const careerSourceLimit = 100000;
export const careerSourceBodyLimit = 700000;
export const sourceKindSchema = z.enum(["MASTER", "INTERVIEW", "MANUAL"]);
export const completeSource = (kind: z.infer<typeof sourceKindSchema>) =>
  kind === "MASTER";
export const extractSourceSchema = z
  .object({
    action: z.literal("extract"),
    text: z.string().min(10).max(careerSourceLimit),
    kind: sourceKindSchema,
    context: z.string().max(8000).optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.text.trim().length >= 10 &&
      (input.kind !== "INTERVIEW" || input.text.length <= 40000),
    "Career sources must contain text; interview answers must fit within 40,000 characters.",
  );
