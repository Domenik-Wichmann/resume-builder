import { z } from "zod";
import type { Project } from "./model";

export const priorityProjectIds = [
  "2cf5bf4e-7fc1-4616-a8cd-8c014710392b", // Resume Builder
  "1ba79f8b-7379-41b1-94d2-7268a7e66b51", // SystemWright LMS
  "937f2379-7dbc-4eae-a12f-5c3dacc13b0c", // BabyCat
] as const;

export function isProjectOverview(question: string) {
  return (
    /\b(projects|portfolio)\b|\bwhat\b.*\b(built|created|developed)\b/i.test(
      question,
    ) &&
    !/\b(resume builder|systemwright|baby\s?cat|sonaway|other projects|additional projects)\b/i.test(
      question,
    )
  );
}

// The owner selected these apps for the portfolio. Other career records stay in
// the explorer; the Featured setting can add more apps without changing code.
export const selectedProjectNames: Readonly<Record<string, string>> = {
  "c05d7b83-2c3d-412c-918a-d468e27adee3": "Sonaway",
  "1ba79f8b-7379-41b1-94d2-7268a7e66b51": "SystemWright LMS",
  "2cf5bf4e-7fc1-4616-a8cd-8c014710392b": "Resume Builder",
  "937f2379-7dbc-4eae-a12f-5c3dacc13b0c": "BabyCat / Rules Engine",
};

export function selectShowcaseProjects(projects: Project[]): Project[] {
  return projects
    .filter(
      (project) =>
        project.is_public &&
        !project.archived &&
        (project.featured || Object.hasOwn(selectedProjectNames, project.id)),
    )
    .sort((a, b) => {
      const ids = Object.keys(selectedProjectNames);
      const rank = (id: string) =>
        ids.includes(id) ? ids.indexOf(id) : ids.length;
      return rank(a.id) - rank(b.id) || a.display_order - b.display_order;
    });
}

export function showcaseTitle(project: Pick<Project, "id" | "title">) {
  return selectedProjectNames[project.id] || project.title;
}

export const showcaseCardSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string(),
    subtitle: z.string(),
    summary: z.string(),
    cover: z.object({ id: z.uuid(), alt: z.string() }).nullable(),
  })
  .strict();
export const showcaseSchema = z
  .object({ projects: showcaseCardSchema.array() })
  .strict();
export type ShowcaseCard = z.infer<typeof showcaseCardSchema>;
