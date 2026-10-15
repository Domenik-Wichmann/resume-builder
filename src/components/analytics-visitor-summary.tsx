import Link from "next/link";
import type { AnalyticsReport } from "@/lib/analytics/report";
import { analyticsHref, type AnalyticsFilters } from "@/lib/analytics/filters";
import { durationLabel } from "@/lib/tracking/dimensions";
import { visitorValueLabel } from "./analytics-visitors";

export function AnalyticsVisitorSummary({
  data,
  filters,
  preview,
}: {
  data: AnalyticsReport;
  filters: AnalyticsFilters;
  preview: boolean;
}) {
  const pages = Math.max(1, Math.ceil(data.totals.visitors / 20));
  return (
    <section
      id="visitors"
      className="surface section analytics-visitor-table"
      aria-labelledby="visitor-summary-heading"
    >
      <div className="workspace-top">
        <div>
          <h2 id="visitor-summary-heading">Visitors · combined activity</h2>
          <p className="muted">
            One row per recognized browser, combining its sessions within these
            filters. Expand a visitor to see pages, buttons and workspace
            totals, or inspect their full activity.
          </p>
        </div>
        <span className="resume-badge">
          {data.totals.visitors} unique visitors
        </span>
      </div>
      <p className="muted analytics-comparison-note">
        Recognition uses a separate anonymous 90-day cookie. Different browsers
        and cleared or expired cookies count separately. Historical sessions
        without that cookie stay unidentified. Totals below reflect the selected
        dates and filters.
      </p>
      {data.visitors.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Last seen (UTC)</th>
                <th>Sessions</th>
                <th>Views / clicks</th>
                <th>Active time</th>
                <th>Combined details</th>
              </tr>
            </thead>
            <tbody>
              {data.visitors.map((row) => (
                <tr key={row.visitor_id}>
                  <td>
                    <Link
                      className="text-link"
                      href={
                        analyticsHref(
                          filters,
                          { visitor: row.visitor_id, session: "" },
                          preview,
                        ) + "#activity"
                      }
                    >
                      Visitor {row.visitor_id.slice(-8)} →
                    </Link>
                    <span className="analytics-table-detail">
                      {row.countries
                        .map((country) => visitorValueLabel("country", country))
                        .join(", ") || "Country not recorded"}
                      <br />
                      {row.devices
                        .map((device) => visitorValueLabel("device", device))
                        .join(", ") || "Device not recorded"}
                    </span>
                  </td>
                  <td>{row.last_seen.slice(0, 19).replace("T", " ")}</td>
                  <td>{row.sessions}</td>
                  <td>
                    {row.views} / {row.clicks}
                  </td>
                  <td>{durationLabel(row.active_seconds)}</td>
                  <td>
                    <details className="analytics-visitor-detail">
                      <summary>Pages, buttons &amp; more</summary>
                      <dl>
                        <dt>First matching activity (UTC)</dt>
                        <dd>{row.first_seen.slice(0, 19).replace("T", " ")}</dd>
                        <dt>All activity</dt>
                        <dd>{row.activities}</dd>
                        <dt>Questions / workspaces started</dt>
                        <dd>
                          {row.questions} / {row.workspace_starts}
                        </dd>
                        <dt>Resume previews / exports opened</dt>
                        <dd>
                          {row.previews} / {row.exports}
                        </dd>
                        <dt>Project &amp; skill explorations</dt>
                        <dd>{row.explorations}</dd>
                        <dt>Furthest scroll</dt>
                        <dd>
                          {row.scroll_depth === null
                            ? "Not measured"
                            : `${row.scroll_depth}%`}
                        </dd>
                        <dt>Browsers / operating systems</dt>
                        <dd>
                          {row.browsers.join(", ") || "Not recorded"} /{" "}
                          {row.operating_systems.join(", ") || "Not recorded"}
                        </dd>
                        <dt>Arrival sources</dt>
                        <dd>
                          {row.referrers
                            .map((value) =>
                              visitorValueLabel("referrer", value),
                            )
                            .join(", ") || "Not recorded"}
                        </dd>
                        <dt>Pages viewed</dt>
                        <dd>
                          {row.pages.length ? (
                            <ul>
                              {row.pages.map((page) => (
                                <li key={page.label}>
                                  {page.label === "/"
                                    ? "Main page"
                                    : page.label}{" "}
                                  · {page.count} views
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "No matching page views"
                          )}
                        </dd>
                        <dt>Buttons &amp; links</dt>
                        <dd>
                          {row.actions.length ? (
                            <ul>
                              {row.actions.map((action) => (
                                <li key={action.label}>
                                  {visitorValueLabel("action", action.label)} ·{" "}
                                  {action.count} clicks
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "No matching clicks"
                          )}
                        </dd>
                      </dl>
                      <Link
                        className="text-link"
                        href={
                          analyticsHref(
                            filters,
                            { visitor: row.visitor_id, session: "" },
                            preview,
                          ) + "#activity"
                        }
                      >
                        Inspect all matching activity →
                      </Link>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No recognized visitors match these filters. Earlier activity is still
          included in total views and sessions.
        </p>
      )}
      <nav className="analytics-pagination" aria-label="Visitor pages">
        {filters.visitor_page > 1 ? (
          <Link
            className="button"
            href={
              analyticsHref(
                filters,
                {
                  visitor_page: filters.visitor_page - 1,
                  page_number: filters.page_number,
                },
                preview,
              ) + "#visitors"
            }
          >
            ← Previous 20 visitors
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page {filters.visitor_page} of {pages}
        </span>
        {filters.visitor_page < Math.min(pages, 1000) && (
          <Link
            className="button"
            href={
              analyticsHref(
                filters,
                {
                  visitor_page: filters.visitor_page + 1,
                  page_number: filters.page_number,
                },
                preview,
              ) + "#visitors"
            }
          >
            Next 20 visitors →
          </Link>
        )}
      </nav>
    </section>
  );
}
