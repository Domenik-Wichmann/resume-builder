import { z } from "zod";
import type { ProjectMedia } from "./model";
import { linkSchema } from "./model";

export const projectContextSchema = z.object({
  projects: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().max(1200).default(""),
        skills: z.array(z.string().max(200)).max(16).default([]),
        highlights: z.array(z.string().max(1200)).max(4).default([]),
        preview: z
          .object({
            src: z
              .string()
              .regex(
                /^\/(?:images\/projects\/[a-z0-9.-]+|media\/[a-f0-9-]{36})$/i,
              ),
            alt: z.string(),
            label: z.string(),
          })
          .nullable()
          .default(null),
        url: z.string().regex(/^\/projects\/[a-z0-9-]+$/),
        links: linkSchema
          .pick({ label: true, url: true })
          .array()
          .max(12)
          .default([]),
        images: z
          .array(
            z.object({ id: z.uuid(), alt: z.string(), caption: z.string() }),
          )
          .max(3),
      }),
    )
    .max(6),
});
export type ProjectContext = z.infer<typeof projectContextSchema>;

const stop = new Set(
  "a an and are as at be can could did do does for from has have how i in is it me my of on or project projects show screenshot screenshots see system the their this to use used was what which with would you your".split(
    " ",
  ),
);
function words(value: string) {
  return [
    ...new Set(
      value
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]{3,}/gu) || [],
    ),
  ].filter((word) => !stop.has(word));
}
export function relevantScreenshots(
  media: ProjectMedia[],
  query: string,
): ProjectMedia[] {
  const terms = words(query);
  const explicit = /\b(screenshots?|images?|pictures?|photos?)\b/i.test(query);
  return media
    .filter((m) => m.is_public === true)
    .map((m) => {
      const labels = new Set(
        words(`${m.alt} ${m.caption} ${m.source_filename || ""}`),
      );
      const score = terms.filter((term) => labels.has(term)).length;
      return { m, score };
    })
    .filter(({ score }) => score > 0 || (explicit && terms.length === 0))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.m.is_cover) - Number(a.m.is_cover) ||
        a.m.display_order - b.m.display_order,
    )
    .slice(0, 3)
    .map(({ m }) => m);
}

/** Represent each project before filling the graph with extra skill nodes. */
export function projectConnectionSkills(
  projects: ProjectContext["projects"],
  limit = 8,
) {
  const counts = new Map<string, number>();
  for (const project of projects)
    for (const skill of new Set(project.skills))
      counts.set(skill, (counts.get(skill) || 0) + 1);
  const rank = (a: string, b: string) =>
    (counts.get(b) || 0) - (counts.get(a) || 0);
  const selected: string[] = [];
  for (const project of projects) {
    if (selected.length >= limit) break;
    if (project.skills.some((skill) => selected.includes(skill))) continue;
    const skill = project.skills.toSorted(rank)[0];
    if (skill) selected.push(skill);
  }
  for (const skill of [...counts.keys()].toSorted(rank)) {
    if (selected.length >= limit) break;
    if (!selected.includes(skill)) selected.push(skill);
  }
  return selected;
}
