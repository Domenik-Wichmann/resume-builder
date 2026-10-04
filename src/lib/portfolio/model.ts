import { z } from "zod";
export const projectImageLimit = 4 * 1024 * 1024;

export function safeProjectUrl(value: string) {
  if (
    /^\/(?:projects|explore|answers|workspace|resume)(?:\/[a-z0-9-]+)?(?:#[a-z0-9-]+)?$/.test(
      value,
    )
  )
    return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !/[\u0000-\u0020\\]/.test(value)
    );
  } catch {
    return false;
  }
}
export const linkSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    link_type: z.enum([
      "LIVE",
      "GITHUB",
      "DEMO",
      "TRIAL",
      "CASE_STUDY",
      "DOCUMENTATION",
      "OTHER",
    ]),
    url: z
      .string()
      .max(2000)
      .refine(safeProjectUrl, "Use HTTPS or a supported internal route."),
    display_order: z.number().int().min(0).max(10000),
    is_public: z.boolean(),
  })
  .strict();
export const projectSchema = z
  .object({
    id: z.uuid().nullable(),
    baseline_version: z.string().nullable(),
    title: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    subtitle: z.string().max(300),
    summary: z.string().max(4000),
    description: z.string().max(20000),
    organization: z.string().max(200).nullable(),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "PAUSED", "OTHER"]),
    featured: z.boolean(),
    is_public: z.boolean(),
    archived: z.boolean(),
    display_order: z.number().int().min(0).max(10000),
    skill_ids: z.array(z.uuid()).max(30),
    achievement_ids: z.array(z.uuid()).max(30),
    links: z.array(linkSchema).max(12),
  })
  .strict()
  .refine(
    (p) => !p.start_date || !p.end_date || p.end_date >= p.start_date,
    "Dates must be ordered.",
  );
export type ProjectInput = z.infer<typeof projectSchema>;
export type Project = Omit<ProjectInput, "baseline_version"> & {
  id: string;
  updated_at: string;
};
export const mediaSchema = z
  .object({
    id: z.uuid(),
    alt: z.string().trim().min(1).max(300),
    caption: z.string().max(500),
    display_order: z.number().int().min(0).max(10000),
    is_cover: z.boolean(),
  })
  .strict();
export type ProjectMedia = z.infer<typeof mediaSchema> & { project_id: string };
