import Link from "next/link";
import { AnalyticsChart, AnalyticsTrend } from "./analytics-chart";
import { AnalyticsFiltersForm } from "./analytics-filters";
import {
  analyticsHref,
  analyticsEventLabels,
  type AnalyticsFilters,
} from "@/lib/analytics/filters";
import { analyticsChange, type AnalyticsReport } from "@/lib/analytics/report";
import { VisitorAnalytics, visitorValueLabel } from "./analytics-visitors";
import { durationLabel } from "@/lib/tracking/dimensions";
export function contactRegionLabel(region: string | null) {
  if (region === "mixed") return "Multiple contact profiles";
  return region === "US"
    ? "United States"
    : region === "BG"
      ? "Bulgaria"
      : "Unknown / not recorded";
}
export function AnalyticsMetrics({ data }: { data: AnalyticsReport }) {
  return (
    <section
      className="admin-metrics analytics-metrics"
      aria-label="Filtered activity totals"
    >
      {[
        [
          "Page views",
          data.totals.views,
          analyticsChange(data.totals.views, data.previous.views),
        ],
        [
          "Browser sessions",
          data.totals.sessions,
          analyticsChange(data.totals.sessions, data.previous.sessions),
        ],
        [
          "Questions saved",
          data.totals.questions,
          analyticsChange(data.totals.questions, data.previous.questions),
        ],
        [
          "Workspaces started",
          data.totals.workspace_starts,
          "Created in this selection",
        ],
        [
          "Project & skill explorations",
          data.totals.explorations,
          "Recorded explorer selections",
        ],
        [
          "Resume previews",
          data.totals.previews,
          "Recruiter workspace previews",
        ],
        [
          "Export opens",
          data.totals.exports,
          "Does not prove a file was saved",
        ],
        [
          "Views from application links",
          data.totals.tracked_views,
          "Attributed page views",
        ],
        [
          "Button / link clicks",
          data.totals.clicks,
          "Selected public controls and links",
        ],
        [
          "Average active time / session",
          durationLabel(data.engagement.avg_session_seconds),
          `${data.engagement.measured_sessions} sessions with measured page time`,
        ],
        [
          "Engaged sessions",
          data.engagement.engaged_sessions,
          "10+ active seconds, 2+ views, or a recorded click",
        ],
        [
          "Total active time",
          data.totals.measured_views
            ? durationLabel(data.totals.active_seconds)
            : "Not measured",
          `${data.totals.measured_views} timed page views; idle/background time excluded`,
        ],
      ].map(([label, value, note]) => (
        <article className="project-card" key={label}>
          <strong>{value}</strong>
          <p>{label}</p>
          <small className="muted">{note}</small>
        </article>
      ))}
    </section>
  );
}
export function TrackingPerformance({
  data,
  filters,
  preview = false,
  compact = false,
}: {
  data: AnalyticsReport;
  filters: AnalyticsFilters;
  preview?: boolean;
  compact?: boolean;
}) {
  const rows = compact ? data.tracking.slice(0, 5) : data.tracking;
  return (
    <section className="surface analytics-link-performance">
      <div className="workspace-top">
        <div>
          <h2>
            {compact
              ? "Applications receiving interest"
              : "Activity by tracking code"}
          </h2>
          <p className="muted">
            {compact
              ? "Most active links in the last 30 days."
              : "Up to 100 most active links in the selection. Click a code to inspect it. Browser sessions are counted once per link."}
          </p>
        </div>
        {compact && (
          <Link className="text-link" href="/admin/analytics">
            Explore analytics →
          </Link>
        )}
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tracking code / application</th>
                <th>Contact profile</th>
                <th>Views</th>
                <th>Sessions</th>
                <th>Questions</th>
                <th>Workspaces</th>
                <th>Explorations</th>
                <th>Previews</th>
                <th>Export opens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code}>
                  <td>
                    <Link
                      className="text-link"
                      href={analyticsHref(filters, { code: row.code }, preview)}
                    >
                      <strong>{row.code}</strong>
                    </Link>
                    <span className="analytics-table-detail">{row.label}</span>
                    {row.application_id && (
                      <Link
                        className="text-link"
                        href={`/admin/applications/${row.application_id}`}
                      >
                        Resume &amp; application ↗
                      </Link>
                    )}
                  </td>
                  <td>{contactRegionLabel(row.region)}</td>
                  <td>{row.views}</td>
                  <td>{row.sessions}</td>
                  <td>{row.questions}</td>
                  <td>{row.workspace_starts}</td>
                  <td>{row.explorations}</td>
                  <td>{row.previews}</td>
                  <td>{row.exports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No application-link activity matches this selection.
        </p>
      )}
    </section>
  );
}
export function AnalyticsDashboard({
  data,
  filters,
  preview = false,
}: {
  data: AnalyticsReport;
  filters: AnalyticsFilters;
  preview?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(data.totals.activities / 50));
  const dateRows = data.daily.map((day) => ({
    label: day.label,
    href: analyticsHref(filters, { from: day.label, to: day.label }, preview),
  }));
  return (
    <>
      <AnalyticsFiltersForm
        filters={filters}
        links={data.links}
        countries={data.countries}
        preview={preview}
      />
      <div className="analytics-selection">
        <strong>
          {filters.from} – {filters.to} · UTC
        </strong>
        <span>
          {data.totals.activities.toLocaleString("en-US")} matching activities
        </span>
        {filters.code && (
          <span className="resume-badge">Code: {filters.code}</span>
        )}
        {filters.region !== "all" && (
          <span className="resume-badge">
            {contactRegionLabel(filters.region)}
          </span>
        )}
        {filters.event !== "all" && (
          <span className="resume-badge">
            {analyticsEventLabels[filters.event]}
          </span>
        )}
        {(["country", "device", "browser", "os", "referrer", "action"] as const)
          .filter((key) => filters[key] !== "all")
          .map((key) => (
            <span className="resume-badge" key={key}>
              {visitorValueLabel(key, filters[key])}
            </span>
          ))}
        {filters.session && (
          <Link
            className="text-link"
            href={analyticsHref(filters, { session: "" }, preview)}
          >
            One session selected · Clear
          </Link>
        )}
      </div>
      <AnalyticsMetrics data={data} />
      <p className="muted analytics-comparison-note">
        Comparisons use the preceding {data.daily.length} calendar days with the
        same filters. Today is partial; counts reflect retained records.
      </p>
      <VisitorAnalytics data={data} filters={filters} preview={preview} />
      <section className="analytics-grid section" aria-label="Activity trends">
        <AnalyticsTrend
          title="Page views by day"
          rows={dateRows.map((day, index) => ({
            ...day,
            count: data.daily[index].views,
          }))}
        />
        <AnalyticsTrend
          title="Questions by day"
          rows={dateRows.map((day, index) => ({
            ...day,
            count: data.daily[index].questions,
          }))}
        />
      </section>
      <details className="surface analytics-hourly">
        <summary>Activity by hour of day (UTC)</summary>
        <p className="muted">
          Combined across selected dates. Click an hour to filter all activity
          to it.
        </p>
        <AnalyticsChart
          title="Matching activities by hour"
          rows={data.hourly.map((row) => ({
            label: `${String(row.hour).padStart(2, "0")}:00–${String(row.hour).padStart(2, "0")}:59`,
            count: row.count,
            href: analyticsHref(
              filters,
              { hour_from: row.hour, hour_to: row.hour },
              preview,
            ),
          }))}
        />
      </details>
      <section
        className="analytics-grid section"
        aria-label="Activity breakdowns"
      >
        <AnalyticsChart
          title="Pages viewed"
          rows={data.pages.map((row) => ({
            ...row,
            href: analyticsHref(
              filters,
              {
                page:
                  row.label === "Historical landing"
                    ? "legacy"
                    : (row.label as AnalyticsFilters["page"]),
              },
              preview,
            ),
          }))}
        />
        <AnalyticsChart
          title="Activity by contact profile"
          rows={data.regions.map((row) => ({
            ...row,
            label: contactRegionLabel(row.label),
            href: analyticsHref(
              filters,
              { region: row.label as AnalyticsFilters["region"] },
              preview,
            ),
          }))}
        />
        <AnalyticsChart
          title="Application attribution"
          rows={data.sources.map((row) => ({
            ...row,
            href: analyticsHref(
              filters,
              {
                source:
                  row.label === "Application link" ? "tracked" : "untracked",
              },
              preview,
            ),
          }))}
        />
        <AnalyticsChart
          title="Most asked questions"
          rows={data.questions.slice(0, 10)}
        />
      </section>
      <TrackingPerformance data={data} filters={filters} preview={preview} />
      <section className="section surface" id="questions">
        <h2>Topics &amp; evidence signals</h2>
        <p className="muted">
          Counts use saved questions matching the filters. Evidence strength
          describes stored answer support, not proof of a skill gap.
        </p>
        {data.topics.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Questions</th>
                  <th>Strong</th>
                  <th>Partial</th>
                  <th>No evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.topics.map((topic) => (
                  <tr key={topic.label}>
                    <td>
                      <Link
                        className="text-link"
                        href={analyticsHref(
                          filters,
                          { search: topic.label, event: "question" },
                          preview,
                        )}
                      >
                        {topic.label}
                      </Link>
                    </td>
                    <td>{topic.count}</td>
                    <td>{topic.strong}</td>
                    <td>{topic.partial}</td>
                    <td>{topic.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No saved topic signals match these filters.</p>
        )}
      </section>
      <section className="surface section" id="activity">
        <div className="workspace-top">
          <div>
            <h2>Activity log</h2>
            <p className="muted">
              {filters.session ? "Journey order · " : "Newest first · "}
              {data.totals.activities.toLocaleString("en-US")} matching
              activities. Expand a saved question to read its answer.
            </p>
          </div>
          <span className="resume-badge">
            Page {filters.page_number} of {pages}
          </span>
        </div>
        {data.events.length ? (
          <div className="table-scroll">
            <table className="analytics-event-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Activity</th>
                  <th>Tracking / application</th>
                  <th>Contact profile</th>
                  <th>Visitor / session</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={`${event.event_type}:${event.id}`}>
                    <td>
                      {new Date(event.created_at)
                        .toISOString()
                        .slice(0, 19)
                        .replace("T", " ")}
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={analyticsHref(
                          filters,
                          { event: event.event_type },
                          preview,
                        )}
                      >
                        {analyticsEventLabels[event.event_type]}
                      </Link>
                    </td>
                    <td>
                      {event.code ? (
                        <>
                          <Link
                            className="text-link"
                            href={analyticsHref(
                              filters,
                              { code: event.code },
                              preview,
                            )}
                          >
                            {event.code}
                          </Link>
                          <span className="analytics-table-detail">
                            {[event.organization, event.role]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </>
                      ) : (
                        <span className="muted">No application link</span>
                      )}
                    </td>
                    <td>{contactRegionLabel(event.region)}</td>
                    <td>
                      {visitorValueLabel("country", event.visitor_country)}
                      <span className="analytics-table-detail">
                        {visitorValueLabel("device", event.device)} ·{" "}
                        {visitorValueLabel("browser", event.browser)} ·{" "}
                        {visitorValueLabel("os", event.os)}
                      </span>
                      <span className="analytics-table-detail">
                        {visitorValueLabel("referrer", event.referrer)}
                      </span>
                      {event.session_id && (
                        <Link
                          className="text-link"
                          href={
                            analyticsHref(
                              filters,
                              { session: event.session_id },
                              preview,
                            ) + "#activity"
                          }
                        >
                          Inspect session
                        </Link>
                      )}
                    </td>
                    <td>
                      {event.question ? (
                        <details>
                          <summary>{event.question}</summary>
                          <p>{event.answer}</p>
                        </details>
                      ) : (
                        <span>
                          {event.action
                            ? visitorValueLabel("action", event.action)
                            : event.subject}
                          {event.event_type === "interaction" && (
                            <span className="analytics-table-detail">
                              On {event.page_path}
                            </span>
                          )}
                          {event.event_type === "page_view" && (
                            <span className="analytics-table-detail">
                              {durationLabel(event.active_seconds)} active ·{" "}
                              {event.scroll_depth === null
                                ? "Scroll not measured"
                                : `${event.scroll_depth}% scroll`}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="resume-empty">
            <h3>No activity matches these filters.</h3>
            <p>
              Try a wider date range, a different tracking code, or reset the
              filters. Older untracked visits may have no recorded region.
            </p>
          </div>
        )}
        <nav className="analytics-pagination" aria-label="Activity log pages">
          {filters.page_number > 1 && (
            <Link
              className="button"
              href={
                analyticsHref(
                  filters,
                  { page_number: filters.page_number - 1 },
                  preview,
                ) + "#activity"
              }
            >
              ← Previous 50
            </Link>
          )}
          {filters.page_number < pages && filters.page_number < 1000 && (
            <Link
              className="button"
              href={
                analyticsHref(
                  filters,
                  { page_number: filters.page_number + 1 },
                  preview,
                ) + "#activity"
              }
            >
              Next 50 →
            </Link>
          )}
        </nav>
      </section>
      <details className="admin-count-notes">
        <summary>What these analytics mean</summary>
        <p>
          Contact region is the US or Bulgaria contact profile shown on the
          site, not a visitor’s physical location. Older untracked views without
          a recorded profile remain Unknown. Browser sessions use a random
          24-hour identifier; they do not identify people. Questions are saved
          privately in recruiter workspaces. Deleted workspaces remove their
          questions and activity. Privacy signals, blocked scripts and signed-in
          owner page views are excluded. Views are retained for up to 90 days.
          Export opens do not prove a file was downloaded. Approximate country,
          coarse device/browser/OS, arrival-source category and selected clicks
          are recorded for new visits. Referrer URLs, IP addresses, raw browser
          headers, form values and fingerprints are not recorded. Active time
          and scroll are estimates; closed tabs and blocked requests can leave
          them incomplete. Page time is capped at four hours per view. Visitor
          filters omit records without matching context; older visits are not
          backfilled.
        </p>
      </details>
    </>
  );
}
