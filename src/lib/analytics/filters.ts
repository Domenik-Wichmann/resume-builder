import { z } from "zod";
import { outcomes } from "../applications/model";
export const analyticsEvents = [
  "all",
  "page_view",
  "question",
  "created",
  "resume_preview",
  "workspace_export",
  "project_viewed",
  "skill_explored",
  "category_explored",
] as const;
export const analyticsEventLabels: Record<
  (typeof analyticsEvents)[number],
  string
> = {
  all: "All activity",
  page_view: "Page view",
  question: "Question saved",
  created: "Workspace started",
  resume_preview: "Resume preview",
  workspace_export: "Export opened",
  project_viewed: "Project explored",
  skill_explored: "Skill explored",
  category_explored: "Category explored",
};
export const analyticsFiltersSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    hour_from: z.coerce.number().int().min(0).max(23),
    hour_to: z.coerce.number().int().min(0).max(23),
    code: z.string().regex(/^(?:[A-Za-z0-9_-]{8})?$/),
    region: z.enum(["all", "US", "BG", "unknown"]),
    source: z.enum(["all", "tracked", "untracked"]),
    event: z.enum(analyticsEvents),
    page: z.enum([
      "all",
      "/",
      "/explore",
      "/workspace",
      "/resume",
      "/projects",
      "/answers",
      "legacy",
    ]),
    status: z.enum(["all", ...outcomes]),
    active: z.enum(["all", "active", "inactive"]),
    search: z.string().trim().max(200),
    page_number: z.coerce.number().int().min(1).max(1000),
  })
  .refine((value) => {
    const span = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
    return span >= 0 && span < 90;
  }, "Choose an ordered date range of up to 90 days.");
export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
export type AnalyticsQuery = Record<string, string | string[] | undefined>;
export function defaultAnalyticsFilters(
  days = 30,
  now = new Date(),
): AnalyticsFilters {
  const end = new Date(now),
    start = new Date(now);
  start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(days, 90)) + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    hour_from: 0,
    hour_to: 23,
    code: "",
    region: "all",
    source: "all",
    event: "all",
    page: "all",
    status: "all",
    active: "all",
    search: "",
    page_number: 1,
  };
}
export function parseAnalyticsFilters(query: AnalyticsQuery, now = new Date()) {
  const days =
    typeof query.days === "string" &&
    ["1", "7", "30", "90"].includes(query.days)
      ? Number(query.days)
      : 30;
  const defaults = defaultAnalyticsFilters(days, now);
  const input: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (query[key] !== undefined && query[key] !== "") input[key] = query[key];
  }
  if (typeof input.code === "string") {
    input.code = input.code.trim();
    try {
      const url = new URL(input.code as string);
      input.code =
        url.pathname.match(/^\/r\/([A-Za-z0-9_-]{8})\/?$/)?.[1] || input.code;
    } catch {
      /* A plain tracking code is the usual input. */
    }
  }
  return analyticsFiltersSchema.safeParse(input);
}
export function analyticsHref(
  filters: AnalyticsFilters,
  patch: Partial<AnalyticsFilters> = {},
  preview = false,
) {
  const value = { ...filters, page_number: 1, ...patch };
  const query = new URLSearchParams();
  for (const [key, item] of Object.entries(value)) {
    if (item !== "" && item !== "all") query.set(key, String(item));
  }
  if (preview) query.set("preview", "1");
  return "/admin/analytics?" + query.toString();
}
