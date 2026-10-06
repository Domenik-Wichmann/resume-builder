import { z } from "zod";
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
export function analyticsPath(path: string) {
  if (path.startsWith("/workspace/")) return "/workspace";
  if (path.startsWith("/projects/")) return "/projects";
  return pageViewSchema.shape.path.safeParse(path).data ?? null;
}
