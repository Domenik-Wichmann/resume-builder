import { z } from "zod";
export const kinds = [
  "profile",
  "experience",
  "project",
  "achievement",
  "skill",
  "education",
  "certification",
  "language",
  "category",
] as const;
export const tableFor = {
  profile: "profile",
  experience: "experiences",
  project: "projects",
  achievement: "achievements",
  skill: "skills",
  education: "education",
  certification: "certifications",
  language: "languages",
  category: "skill_categories",
} as const;
export const candidateSchema = z
  .object({
    kind: z.enum(kinds),
    key: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(200),
    subtitle: z.string().max(300),
    summary: z.string().max(4000),
    organization: z.string().max(200).nullable(),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    skill_keys: z.array(z.string().max(100)).max(30),
    achievement_keys: z.array(z.string().max(100)).max(30),
    category_key: z.string().max(100).nullable(),
    source_quote: z.string().min(1).max(2000),
    uncertainties: z.array(z.string().max(300)).max(10),
  })
  .strict()
  .refine(
    (record) =>
      !record.start_date ||
      !record.end_date ||
      record.end_date >= record.start_date,
    "Dates must be ordered.",
  )
  .refine(
    (record) => record.kind !== "profile" || record.key === "profile",
    "The profile has one stable key: profile.",
  )
  .refine(
    (record) =>
      ["experience", "project", "achievement"].includes(record.kind) ||
      record.skill_keys.length === 0,
    "Only roles, projects and achievements have skill links.",
  )
  .refine(
    (record) =>
      !["profile", "skill", "category"].includes(record.kind) ||
      (!record.organization && !record.start_date && !record.end_date),
    "Profile, skill and category records have no employment dates or organization.",
  )
  .refine(
    (record) =>
      ["experience", "project"].includes(record.kind) ||
      record.achievement_keys.length === 0,
    "Only roles and projects have achievement links.",
  )
  .refine(
    (record) => record.kind === "skill" || record.category_key === null,
    "Only skills have a category.",
  );
export const extractionSchema = z
  .object({ records: z.array(candidateSchema).max(150) })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export type Canonical = Candidate & {
  id: string;
  hash: string;
  published: boolean;
  archived: boolean;
  updated_at: string;
};
export type Change = {
  identity: string;
  status: "ADDED" | "UNCHANGED" | "UPDATED" | "REMOVED" | "REVIEW";
  before: Canonical | null;
  after: Candidate | null;
  reason: string;
};
