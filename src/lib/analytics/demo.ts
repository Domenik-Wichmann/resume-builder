import type { AnalyticsFilters } from "./filters";
import { analyticsEvents } from "./filters";
import type { AnalyticsReport } from "./report";
// Layout-only activity, explicitly fictional. Never used in live mode.
export function fictionalAnalytics(
  filters: AnalyticsFilters,
  now = new Date(),
): AnalyticsReport {
  const links: AnalyticsReport["links"] = [
    {
      code: "demoLink",
      label: "Fictional engineering application",
      market: "US",
      active: true,
    },
    {
      code: "demoBGbg",
      label: "Fictional operations application",
      market: "BG",
      active: false,
    },
  ];
  const all: AnalyticsReport["events"] = Array.from(
    { length: 120 },
    (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - Math.floor(index / 10));
      date.setUTCHours([9, 13, 22][index % 3], index % 60, 0, 0);
      const event_type = analyticsEvents[1 + (index % 8)];
      const link = links[index % 3];
      return {
        id: `fictional-${index}`,
        event_type,
        created_at: date.toISOString(),
        code: link?.code || null,
        region: link?.market || null,
        page_path:
          event_type === "page_view" ? (index % 2 ? "/projects" : "/") : null,
        subject:
          event_type === "question"
            ? "Fictional question about workflow automation"
            : "Fictional portfolio activity",
        question:
          event_type === "question"
            ? "Fictional question about workflow automation"
            : null,
        answer:
          event_type === "question"
            ? "Fictional answer for layout verification; not owner evidence."
            : null,
        application_id: null,
        organization: link ? "Fictional employer" : null,
        role: link ? "Fictional role" : null,
      };
    },
  );
  const matches = (event: AnalyticsReport["events"][number]) => {
    const hour = new Date(event.created_at).getUTCHours();
    return (
      (filters.hour_from <= filters.hour_to
        ? hour >= filters.hour_from && hour <= filters.hour_to
        : hour >= filters.hour_from || hour <= filters.hour_to) &&
      (!filters.code || event.code === filters.code) &&
      (filters.region === "all" ||
        (event.region || "unknown") === filters.region) &&
      (filters.source === "all" ||
        (filters.source === "tracked" ? Boolean(event.code) : !event.code)) &&
      (filters.event === "all" || event.event_type === filters.event) &&
      (filters.page === "all" || event.page_path === filters.page) &&
      (filters.active === "all" ||
        links.find((link) => link.code === event.code)?.active ===
          (filters.active === "active")) &&
      filters.status === "all" &&
      (!filters.search ||
        `${event.subject} ${event.organization} ${event.role}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()))
    );
  };
  const rows = all
    .filter(
      (event) =>
        matches(event) &&
        event.created_at.slice(0, 10) >= filters.from &&
        event.created_at.slice(0, 10) <= filters.to,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count = (type: string) =>
    rows.filter((event) => event.event_type === type).length;
  const ranks = (values: string[]) =>
    [...new Set(values)]
      .map((label) => ({
        label,
        count: values.filter((value) => value === label).length,
      }))
      .sort((a, b) => b.count - a.count);
  const days =
    Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) +
    1;
  return {
    totals: {
      activities: rows.length,
      views: count("page_view"),
      sessions: count("page_view"),
      questions: count("question"),
      workspace_starts: count("created"),
      previews: count("resume_preview"),
      exports: count("workspace_export"),
      explorations:
        count("project_viewed") +
        count("skill_explored") +
        count("category_explored"),
      tracked_views: rows.filter(
        (row) => row.event_type === "page_view" && row.code,
      ).length,
    },
    previous: { views: 0, sessions: 0, questions: 0 },
    daily: Array.from({ length: days }, (_, index) => {
      const date = new Date(filters.from);
      date.setUTCDate(date.getUTCDate() + index);
      const label = date.toISOString().slice(0, 10);
      const day = rows.filter((row) => row.created_at.slice(0, 10) === label);
      return {
        label,
        views: day.filter((row) => row.event_type === "page_view").length,
        questions: day.filter((row) => row.event_type === "question").length,
        activity: day.length,
      };
    }),
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: rows.filter(
        (row) => new Date(row.created_at).getUTCHours() === hour,
      ).length,
    })),
    pages: ranks(
      rows
        .filter((row) => row.event_type === "page_view")
        .map((row) => row.page_path || "Historical landing"),
    ),
    regions: ranks(rows.map((row) => row.region || "unknown")),
    sources: ranks(
      rows.map((row) =>
        row.code ? "Application link" : "Without application link",
      ),
    ),
    tracking: links
      .filter((link) => rows.some((row) => row.code === link.code))
      .map((link) => {
        const selected = rows.filter((row) => row.code === link.code);
        const n = (type: string) =>
          selected.filter((row) => row.event_type === type).length;
        return {
          code: link.code,
          label: link.label,
          region: link.market,
          application_id: null,
          views: n("page_view"),
          sessions: n("page_view"),
          questions: n("question"),
          workspace_starts: n("created"),
          previews: n("resume_preview"),
          exports: n("workspace_export"),
          explorations:
            n("project_viewed") + n("skill_explored") + n("category_explored"),
        };
      }),
    topics: count("question")
      ? [
          {
            label: "Fictional automation topic",
            count: count("question"),
            strong: 0,
            partial: count("question"),
            none: 0,
          },
        ]
      : [],
    questions: ranks(
      rows.filter((row) => row.question).map((row) => row.question!),
    ),
    events: rows.slice(
      (filters.page_number - 1) * 50,
      filters.page_number * 50,
    ),
    links,
  };
}
