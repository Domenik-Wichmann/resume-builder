import { z } from "zod";
import type { ProjectMedia } from "./model";

export const projectContextSchema = z.object({
  projects: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().regex(/^\/projects\/[a-z0-9-]+$/),
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
