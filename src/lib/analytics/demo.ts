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
      const event_type =
        analyticsEvents[1 + (index % (analyticsEvents.length - 1))];
      const link = links[index % 3];
      const browserEvent =
        event_type === "page_view" || event_type === "interaction";
      return {
        id: `fictional-${index}`,
        event_type,
        created_at: date.toISOString(),
        code: link?.code || null,
        region: link?.market || null,
        page_path: browserEvent ? (index % 2 ? "/projects" : "/") : null,
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
        analytics_visitor_id: `10000000-0000-4000-8000-${String(Math.floor(index / 27) + 1).padStart(12, "0")}`,
        session_id: browserEvent
          ? `00000000-0000-4000-8000-${String(Math.floor(index / 9) + 1).padStart(12, "0")}`
          : null,
        visitor_country: browserEvent
          ? ["US", "BG", "DE"][Math.floor(index / 9) % 3]
          : null,
        device: browserEvent
          ? Math.floor(index / 9) % 2
            ? "mobile"
            : "desktop"
          : null,
        browser: browserEvent
          ? Math.floor(index / 9) % 2
            ? "Safari"
            : "Chrome"
          : null,
        os: browserEvent
          ? Math.floor(index / 9) % 2
            ? "iOS"
            : "Windows"
          : null,
        referrer: browserEvent
          ? ["direct", "search", "linkedin"][Math.floor(index / 9) % 3]
          : null,
        action:
          event_type === "interaction"
            ? index % 2
              ? "email"
              : "project"
            : null,
        active_seconds: browserEvent ? 15 + Math.floor(index / 9) * 12 : null,
        scroll_depth: browserEvent
          ? Math.floor(index / 9) % 2
            ? 50
            : 100
          : null,
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
      (filters.country === "all" ||
        (event.visitor_country || "unknown") === filters.country) &&
      (filters.device === "all" ||
        (event.device || "unknown") === filters.device) &&
      (filters.browser === "all" ||
        (event.browser || "unknown") === filters.browser) &&
      (filters.os === "all" || (event.os || "unknown") === filters.os) &&
      (filters.referrer === "all" ||
        (event.referrer || "unknown") === filters.referrer) &&
      (filters.action === "all" || event.action === filters.action) &&
      (!filters.visitor || event.analytics_visitor_id === filters.visitor) &&
      (!filters.session || event.session_id === filters.session) &&
      (filters.min_seconds === 0 ||
        (event.active_seconds !== null &&
          event.active_seconds >= filters.min_seconds)) &&
      (filters.max_seconds === 14400 ||
        (event.active_seconds !== null &&
          event.active_seconds <= filters.max_seconds)) &&
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
  const ranks = (
    selected: typeof rows,
    labelFor: (row: (typeof rows)[number]) => string,
  ) =>
    [...new Set(selected.map(labelFor))]
      .map((label) => {
        const matching = selected.filter((row) => labelFor(row) === label);
        return {
          label,
          count: matching.length,
          visitors: new Set(
            matching.flatMap((row) =>
              row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
            ),
          ).size,
        };
      })
      .sort((a, b) => b.count - a.count);
  const days =
    Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) +
    1;
  const average = (values: (number | null)[]) => {
    const measured = values.filter((value): value is number => value !== null);
    return measured.length
      ? Math.round(
          (measured.reduce((n, value) => n + value, 0) / measured.length) * 10,
        ) / 10
      : null;
  };
  const journeys: AnalyticsReport["journeys"] = [
    ...new Set(rows.flatMap((row) => (row.session_id ? [row.session_id] : []))),
  ].map((session_id) => {
    const selected = rows.filter((row) => row.session_id === session_id);
    const views = selected.filter((row) => row.event_type === "page_view");
    const measured = views.filter((row) => row.active_seconds !== null);
    const first = selected.at(-1)!,
      last = selected[0];
    return {
      session_id,
      analytics_visitor_id: first.analytics_visitor_id,
      first_seen: first.created_at,
      last_seen: last.created_at,
      entry_page: first.page_path,
      last_page: last.page_path,
      views: views.length,
      clicks: selected.filter((row) => row.event_type === "interaction").length,
      measured_views: measured.length,
      active_seconds: measured.length
        ? measured.reduce((n, row) => n + row.active_seconds!, 0)
        : null,
      scroll_depth: measured.length
        ? Math.max(...measured.map((row) => row.scroll_depth || 0))
        : null,
      visitor_country: first.visitor_country,
      device: first.device,
      browser: first.browser,
      os: first.os,
      referrer: first.referrer,
    };
  });
  const views = rows.filter((row) => row.event_type === "page_view");
  const visitorRows: AnalyticsReport["visitors"] = [
    ...new Set(
      rows.flatMap((row) =>
        row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
      ),
    ),
  ].map((visitor_id) => {
    const selected = rows.filter(
      (row) => row.analytics_visitor_id === visitor_id,
    );
    const pageViews = selected.filter((row) => row.event_type === "page_view");
    const measured = pageViews.filter((row) => row.active_seconds !== null);
    const context = (
      key: "visitor_country" | "device" | "browser" | "os" | "referrer",
    ) =>
      [
        ...new Set(selected.flatMap((row) => (row[key] ? [row[key]] : []))),
      ].sort();
    const n = (type: string) =>
      selected.filter((row) => row.event_type === type).length;
    return {
      visitor_id,
      first_seen: selected.at(-1)!.created_at,
      last_seen: selected[0].created_at,
      activities: selected.length,
      sessions: new Set(
        selected.flatMap((row) => (row.session_id ? [row.session_id] : [])),
      ).size,
      views: n("page_view"),
      clicks: n("interaction"),
      questions: n("question"),
      workspace_starts: n("created"),
      previews: n("resume_preview"),
      exports: n("workspace_export"),
      explorations:
        n("project_viewed") + n("skill_explored") + n("category_explored"),
      active_seconds: measured.length
        ? measured.reduce((sum, row) => sum + row.active_seconds!, 0)
        : null,
      scroll_depth: measured.length
        ? Math.max(...measured.map((row) => row.scroll_depth || 0))
        : null,
      countries: context("visitor_country"),
      devices: context("device"),
      browsers: context("browser"),
      operating_systems: context("os"),
      referrers: context("referrer"),
      pages: ranks(pageViews, (row) => row.page_path || "Historical landing"),
      actions: ranks(
        selected.filter((row) => row.action !== null),
        (row) => row.action!,
      ),
    };
  });
  return {
    totals: {
      activities: rows.length,
      views: count("page_view"),
      sessions: journeys.length,
      visitors: visitorRows.length,
      unidentified_sessions: new Set(
        rows
          .filter((row) => !row.analytics_visitor_id)
          .flatMap((row) => (row.session_id ? [row.session_id] : [])),
      ).size,
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
      clicks: count("interaction"),
      measured_views: views.filter((row) => row.active_seconds !== null).length,
      active_seconds: views.reduce(
        (n, row) => n + (row.active_seconds || 0),
        0,
      ),
    },
    countries: ranks(
      rows.filter((row) => row.session_id !== null),
      (row) => row.visitor_country || "unknown",
    ),
    devices: ranks(
      rows.filter((row) => row.session_id !== null),
      (row) => row.device || "unknown",
    ),
    browsers: ranks(
      rows.filter((row) => row.session_id !== null),
      (row) => row.browser || "unknown",
    ),
    operating_systems: ranks(
      rows.filter((row) => row.session_id !== null),
      (row) => row.os || "unknown",
    ),
    referrers: ranks(
      rows.filter((row) => row.session_id !== null),
      (row) => row.referrer || "unknown",
    ),
    actions: ranks(
      rows.filter((row) => row.action !== null),
      (row) => row.action!,
    ),
    visitors: visitorRows.slice(
      (filters.visitor_page - 1) * 20,
      filters.visitor_page * 20,
    ),
    engagement: {
      avg_visitor_seconds: average(
        visitorRows.map((row) => row.active_seconds),
      ),
      avg_session_seconds: average(journeys.map((row) => row.active_seconds)),
      measured_sessions: journeys.filter((row) => row.measured_views > 0)
        .length,
      engaged_sessions: journeys.filter(
        (row) =>
          (row.active_seconds || 0) >= 10 || row.views >= 2 || row.clicks > 0,
      ).length,
    },
    page_engagement: ranks(
      views,
      (row) => row.page_path || "Historical landing",
    ).map(({ label, count, visitors }) => {
      const selected = views.filter(
        (row) => (row.page_path || "Historical landing") === label,
      );
      return {
        label,
        views: count,
        visitors,
        measured_views: selected.filter((row) => row.active_seconds !== null)
          .length,
        avg_seconds: average(selected.map((row) => row.active_seconds)),
        avg_scroll: average(selected.map((row) => row.scroll_depth)),
      };
    }),
    journeys: journeys.slice(0, 20),
    previous: { views: 0, sessions: 0, visitors: 0, questions: 0 },
    daily: Array.from({ length: days }, (_, index) => {
      const date = new Date(filters.from);
      date.setUTCDate(date.getUTCDate() + index);
      const label = date.toISOString().slice(0, 10);
      const day = rows.filter((row) => row.created_at.slice(0, 10) === label);
      return {
        label,
        views: day.filter((row) => row.event_type === "page_view").length,
        questions: day.filter((row) => row.event_type === "question").length,
        question_visitors: new Set(
          day
            .filter((row) => row.event_type === "question")
            .flatMap((row) =>
              row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
            ),
        ).size,
        activity: day.length,
        visitors: new Set(
          day.flatMap((row) =>
            row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
          ),
        ).size,
      };
    }),
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      visitors: new Set(
        rows
          .filter((row) => new Date(row.created_at).getUTCHours() === hour)
          .flatMap((row) =>
            row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
          ),
      ).size,
      count: rows.filter(
        (row) => new Date(row.created_at).getUTCHours() === hour,
      ).length,
    })),
    pages: ranks(views, (row) => row.page_path || "Historical landing"),
    regions: ranks(rows, (row) => row.region || "unknown"),
    sources: ranks(rows, (row) =>
      row.code ? "Application link" : "Without application link",
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
          sessions: new Set(
            selected.flatMap((row) => (row.session_id ? [row.session_id] : [])),
          ).size,
          visitors: new Set(
            selected.flatMap((row) =>
              row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
            ),
          ).size,
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
            visitors: new Set(
              rows
                .filter((row) => row.event_type === "question")
                .flatMap((row) =>
                  row.analytics_visitor_id ? [row.analytics_visitor_id] : [],
                ),
            ).size,
            strong: 0,
            partial: count("question"),
            none: 0,
          },
        ]
      : [],
    questions: ranks(
      rows.filter((row) => row.question !== null),
      (row) => row.question!,
    ),
    events: (filters.session || filters.visitor
      ? [...rows].reverse()
      : rows
    ).slice((filters.page_number - 1) * 50, filters.page_number * 50),
    links,
  };
}
