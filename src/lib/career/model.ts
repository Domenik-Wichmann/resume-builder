import { z } from "zod";
export const recordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  organization: z.string().nullable().optional(),
  start_date: z.iso.date().nullable().optional(),
  end_date: z.iso.date().nullable().optional(),
});
export const careerSchema = z.object({
  profile: z.object({
    name: z.string(),
    title: z.string(),
    introduction: z.string(),
  }),
  experiences: z.array(recordSchema),
  projects: z.array(recordSchema),
  skills: z.array(z.string()),
  skill_records: z.array(recordSchema),
  achievements: z.array(recordSchema),
  education: z.array(recordSchema),
  certifications: z.array(recordSchema),
  languages: z.array(recordSchema).optional(),
  demo: z.boolean(),
});
export type Career = z.infer<typeof careerSchema>;
export type CareerRecord = z.infer<typeof recordSchema>;
