import Link from "next/link";
import { AnalyticsChart } from "./analytics-chart";
import { analyticsHref, type AnalyticsFilters } from "@/lib/analytics/filters";
import type { AnalyticsReport } from "@/lib/analytics/report";
import {
  arrivalLabels,
  countryLabel,
  durationLabel,
  interactionLabels,
} from "@/lib/tracking/dimensions";

export function visitorValueLabel(key: string, value: string | null) {
  if (!value || value === "unknown") return "Unknown / not recorded";
  if (key === "country") return countryLabel(value);
  if (key === "referrer")
    return arrivalLabels[value as keyof typeof arrivalLabels] || value;
  if (key === "action")
    return interactionLabels[value as keyof typeof interactionLabels] || value;
  if (value === "iOS" || value === "macOS") return value;
  return value === "other" ? "Other" : value[0].toUpperCase() + value.slice(1);
}

export function VisitorAnalytics({
  data,
  filters,
  preview,
}: {
  data: AnalyticsReport;
  filters: AnalyticsFilters;
  preview: boolean;
}) {
  const breakdowns = [
    {
      title: "Visitor country (approximate)",
      key: "country",
      rows: data.countries,
    },
    { title: "Device type", key: "device", rows: data.devices },
    { title: "Browser", key: "browser", rows: data.browsers },
    { title: "Operating system", key: "os", rows: data.operating_systems },
    { title: "Arrival source", key: "referrer", rows: data.referrers },
    { title: "Buttons & links clicked", key: "action", rows: data.actions },
  ] as const;
  return (
    <section className="section" aria-labelledby="visitor-insights-heading">
      <div className="workspace-top">
        <div>
          <h2 id="visitor-insights-heading">Visitors &amp; engagement</h2>
          <p className="muted">
            {filters.metric === "unique"
              ? "Charts count each recognized visitor once per category."
              : "Charts count matching activity; buttons count clicks."}{" "}
            Click any breakdown to filter the report.
          </p>
        </div>
      </div>
      <div className="analytics-grid">
        {breakdowns.map(({ title, key, rows }) => (
          <AnalyticsChart
            key={key}
            title={title}
            rows={rows.map((row) => ({
              ...row,
              count: filters.metric === "unique" ? row.visitors : row.count,
              label: visitorValueLabel(key, row.label),
              href: analyticsHref(filters, { [key]: row.label }, preview),
            }))}
          />
        ))}
      </div>
      <p className="muted analytics-comparison-note">
        In unique mode, a visitor counts once per category, across sessions and
        repeat actions. A visitor can appear in multiple categories if its
        context changes. Country is an approximate hosting-provider signal,
        separate from the contact profile shown. Devices and browsers are
        best-effort categories. A missing referrer can mean a direct visit, an
        app, or a privacy setting. Older records and workspace-only events have
        no browser details. Clicks indicate intent, not a completed submission
        or download.
      </p>
      <section
        className="surface section analytics-visitor-table"
        aria-labelledby="page-engagement-heading"
      >
        <h3 id="page-engagement-heading">Time &amp; scroll depth by page</h3>
        <p className="muted">
          Active time counts a visible, focused tab, pausing after 30 seconds
          without interaction. Scroll depth is the furthest quarter of the page
          reached. Unmeasured views are excluded from averages.
        </p>
        {data.page_engagement.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Page category</th>
                  <th>Views</th>
                  <th>Unique visitors</th>
                  <th>Timed views</th>
                  <th>Average active time</th>
                  <th>Average scroll depth</th>
                </tr>
              </thead>
              <tbody>
                {data.page_engagement.map((row) => (
                  <tr key={row.label}>
                    <td>
                      <Link
                        className="text-link"
                        href={analyticsHref(
                          filters,
                          {
                            page:
                              row.label === "Historical landing"
                                ? "legacy"
                                : (row.label as AnalyticsFilters["page"]),
                          },
                          preview,
                        )}
                      >
                        {row.label === "/" ? "Main page" : row.label}
                      </Link>
                    </td>
                    <td>{row.views}</td>
                    <td>{row.visitors}</td>
                    <td>{row.measured_views}</td>
                    <td>{durationLabel(row.avg_seconds)}</td>
                    <td>
                      {row.avg_scroll === null
                        ? "Not measured"
                        : `${Math.round(row.avg_scroll)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No page views match this selection.</p>
        )}
      </section>
      <details className="surface section analytics-visitor-table">
        <summary id="session-journeys-heading">
          Individual session journeys
        </summary>
        <p className="muted">
          Latest 20 browser sessions with matching activity. First and last
          pages, counts and time reflect this selection; visitor context comes
          from the first matching activity. Open a journey to inspect its pages
          and clicks in the activity log.
        </p>
        {data.journeys.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>First seen (UTC)</th>
                  <th>Visitor context</th>
                  <th>First → last page</th>
                  <th>Views / clicks</th>
                  <th>Active time</th>
                  <th>Journey</th>
                </tr>
              </thead>
              <tbody>
                {data.journeys.map((row) => (
                  <tr key={row.session_id}>
                    <td>
                      {new Date(row.first_seen)
                        .toISOString()
                        .slice(0, 19)
                        .replace("T", " ")}
                    </td>
                    <td>
                      {visitorValueLabel("country", row.visitor_country)}
                      <span className="analytics-table-detail">
                        {visitorValueLabel("device", row.device)} ·{" "}
                        {visitorValueLabel("browser", row.browser)}
                      </span>
                    </td>
                    <td>
                      {row.entry_page || "Historical landing"} →{" "}
                      {row.last_page || "Historical landing"}
                    </td>
                    <td>
                      {row.views} / {row.clicks}
                    </td>
                    <td>{durationLabel(row.active_seconds)}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={
                          analyticsHref(
                            filters,
                            { session: row.session_id },
                            preview,
                          ) + "#activity"
                        }
                      >
                        Inspect journey →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No browser sessions match these filters.</p>
        )}
      </details>
    </section>
  );
}
