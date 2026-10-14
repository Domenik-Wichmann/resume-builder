import { z } from "zod";
import { analyticsEvents } from "./filters";
const count = z.number().int().nonnegative();
const ranked = z.object({ label: z.string(), count });
export const analyticsTotalsSchema = z.object({
  activities: count,
  views: count,
  sessions: count,
  questions: count,
  workspace_starts: count,
  previews: count,
  exports: count,
  explorations: count,
  tracked_views: count,
  clicks: count,
  measured_views: count,
  active_seconds: count,
});
export const analyticsReportSchema = z.object({
  totals: analyticsTotalsSchema,
  previous: z.object({ views: count, sessions: count, questions: count }),
  daily: z.array(
    z.object({
      label: z.string(),
      views: count,
      questions: count,
      activity: count,
    }),
  ),
  hourly: z.array(z.object({ hour: z.number().int().min(0).max(23), count })),
  pages: z.array(ranked),
  regions: z.array(ranked),
  sources: z.array(ranked),
  countries: z.array(ranked),
  devices: z.array(ranked),
  browsers: z.array(ranked),
  operating_systems: z.array(ranked),
  referrers: z.array(ranked),
  actions: z.array(ranked),
  engagement: z.object({
    avg_session_seconds: z.number().nonnegative().nullable(),
    measured_sessions: count,
    engaged_sessions: count,
  }),
  page_engagement: z.array(
    z.object({
      label: z.string(),
      views: count,
      measured_views: count,
      avg_seconds: z.number().nonnegative().nullable(),
      avg_scroll: z.number().min(0).max(100).nullable(),
    }),
  ),
  journeys: z.array(
    z.object({
      session_id: z.string(),
      first_seen: z.string(),
      last_seen: z.string(),
      entry_page: z.string().nullable(),
      last_page: z.string().nullable(),
      views: count,
      clicks: count,
      measured_views: count,
      active_seconds: count.nullable(),
      scroll_depth: count.nullable(),
      visitor_country: z.string().nullable(),
      device: z.string().nullable(),
      browser: z.string().nullable(),
      os: z.string().nullable(),
      referrer: z.string().nullable(),
    }),
  ),
  tracking: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      region: z.string(),
      application_id: z.string().nullable(),
      views: count,
      sessions: count,
      questions: count,
      workspace_starts: count,
      previews: count,
      exports: count,
      explorations: count,
    }),
  ),
  topics: z.array(
    ranked.extend({ strong: count, partial: count, none: count }),
  ),
  questions: z.array(ranked),
  events: z.array(
    z.object({
      id: z.string(),
      event_type: z.enum(analyticsEvents),
      created_at: z.string(),
      code: z.string().nullable(),
      region: z.string().nullable(),
      page_path: z.string().nullable(),
      subject: z.string(),
      question: z.string().nullable(),
      answer: z.string().nullable(),
      application_id: z.string().nullable(),
      organization: z.string().nullable(),
      role: z.string().nullable(),
      session_id: z.string().nullable(),
      visitor_country: z.string().nullable(),
      device: z.string().nullable(),
      browser: z.string().nullable(),
      os: z.string().nullable(),
      referrer: z.string().nullable(),
      action: z.string().nullable(),
      active_seconds: count.nullable(),
      scroll_depth: count.nullable(),
    }),
  ),
  links: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      market: z.enum(["US", "BG"]),
      active: z.boolean(),
    }),
  ),
});
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;
export function analyticsChange(current: number, previous: number) {
  return previous > 0
    ? `${current >= previous ? "+" : ""}${Math.round(((current - previous) / previous) * 100)}% vs previous period`
    : current > 0
      ? "No recorded activity in previous period"
      : "No change";
}
