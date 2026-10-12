import { z } from "zod";
import { linkSchema } from "./model";

export const caseContentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    tagline: z.string().max(300),
    summary: z.string().max(1200),
    overview: z.string().max(6000),
    highlights: z.array(z.string().max(1200)).max(24),
    implementation: z.string().max(18000),
    outcomes: z.array(z.string().max(1200)).max(24),
    limitations: z.array(z.string().max(1200)).max(24),
    links: z.array(linkSchema).max(12).default([]),
  })
  .strict();
export const caseStudySchema = z
  .object({
    project_id: z.uuid(),
    baseline_version: z.string().nullable(),
    project_version: z.string(),
    source_hash: z.string().regex(/^[a-f0-9]{64}$/),
    selected: z.boolean(),
    is_public: z.boolean(),
    content: caseContentSchema,
  })
  .strict();
export type CaseContent = z.infer<typeof caseContentSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;

export function screenshotDescription(filename: string) {
  let name = filename.split(/[\\/]/).at(-1) || "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* A literal percent is valid in an owner filename. */
  }
  return name
    .replace(/\.(?:png|jpe?g|webp|gif)$/i, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
