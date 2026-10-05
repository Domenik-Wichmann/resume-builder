import { z } from "zod";
export const designSchema = z
  .object({
    page: z.enum(["A4", "LETTER"]),
    layout: z.enum(["CLASSIC", "SIDEBAR"]),
    font: z.enum(["SANS", "SERIF", "MONO"]),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    margin_mm: z.number().int().min(10).max(30),
    font_pt: z.number().int().min(9).max(13),
    spacing: z.enum(["COMPACT", "COMFORTABLE", "AIRY"]),
    headings: z.enum(["RULE", "PLAIN", "UPPERCASE"]),
    header: z.enum(["LEFT", "CENTER"]),
    photo: z.enum(["NONE", "CIRCLE", "SQUARE"]),
  })
  .strict();
export type ResumeDesign = z.infer<typeof designSchema>;
export const defaultDesign: ResumeDesign = {
  page: "A4",
  layout: "CLASSIC",
  font: "SANS",
  accent: "#325b48",
  text: "#202a25",
  margin_mm: 18,
  font_pt: 11,
  spacing: "COMFORTABLE",
  headings: "RULE",
  header: "LEFT",
  photo: "NONE",
};
export const templateSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    version: z.number().int().min(0),
    spec: designSchema,
    reference_id: z.uuid().nullable(),
    notes: z.string().max(3000),
    limitations: z.array(z.string().max(300)).max(10),
    is_default: z.boolean(),
  })
  .strict();
export type ResumeTemplate = z.infer<typeof templateSchema>;
export type OwnerAsset = {
  id: string;
  kind: "PORTRAIT" | "REFERENCE";
  name: string;
  mime_type: string;
  created_at: string;
};
export const generatedDesignSchema = z
  .object({
    spec: designSchema,
    limitations: z.array(z.string().max(300)).max(10),
  })
  .strict();
