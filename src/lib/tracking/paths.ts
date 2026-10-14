import { z } from "zod";
import { arrivalSources, interactionSchema } from "./dimensions";
export const pageViewSchema = z
  .object({
    path: z.enum([
      "/",
      "/explore",
      "/workspace",
      "/resume",
      "/projects",
      "/answers",
    ]),
  })
  .strict();
const pagePath = pageViewSchema.shape.path;
export const trackingEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("page_view").default("page_view"),
      path: pagePath,
      view_id: z.uuid().optional(),
      referrer: z.enum(arrivalSources).default("unknown"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("engagement"),
      path: pagePath,
      view_id: z.uuid(),
      active_seconds: z.number().int().min(0).max(14400),
      scroll_depth: z.union([
        z.literal(0),
        z.literal(25),
        z.literal(50),
        z.literal(75),
        z.literal(100),
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("interaction"),
      path: pagePath,
      view_id: z.uuid(),
      action: interactionSchema,
    })
    .strict(),
]);
export type TrackingEvent = z.infer<typeof trackingEventSchema>;
export function analyticsPath(path: string) {
  if (path.startsWith("/workspace/")) return "/workspace";
  if (path.startsWith("/projects/")) return "/projects";
  return pageViewSchema.shape.path.safeParse(path).data ?? null;
}
