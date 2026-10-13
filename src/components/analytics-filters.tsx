import Form from "next/form";
import Link from "next/link";
import {
  analyticsHref,
  analyticsEvents,
  analyticsEventLabels,
  defaultAnalyticsFilters,
  type AnalyticsFilters,
} from "@/lib/analytics/filters";
import { outcomes } from "@/lib/applications/model";
import type { AnalyticsReport } from "@/lib/analytics/report";
export function AnalyticsFiltersForm({
  filters,
  links,
  preview = false,
}: {
  filters: AnalyticsFilters;
  links: AnalyticsReport["links"];
  preview?: boolean;
}) {
  return (
    <section
      className="surface analytics-filter-panel"
      aria-label="Analytics filters"
    >
      <div className="analytics-filter-heading">
        <div>
          <h2>Explore your activity</h2>
          <p className="muted">
            Every filter applies to totals, charts, links and the activity log.
            Dates and hours use UTC.
          </p>
        </div>
        <nav className="analytics-periods" aria-label="Quick date ranges">
          {[1, 7, 30, 90].map((days) => (
            <Link
              key={days}
              href={analyticsHref(
                filters,
                {
                  from: defaultAnalyticsFilters(days).from,
                  to: defaultAnalyticsFilters(days).to,
                },
                preview,
              )}
            >
              {days === 1 ? "Today" : `${days} days`}
            </Link>
          ))}
        </nav>
      </div>
      <Form action="/admin/analytics" key={analyticsHref(filters)}>
        {preview && <input type="hidden" name="preview" value="1" />}
        <div className="analytics-filter-fields">
          <label>
            From date (UTC)
            <input
              type="date"
              name="from"
              required
              defaultValue={filters.from}
            />
          </label>
          <label>
            Through date (UTC)
            <input type="date" name="to" required defaultValue={filters.to} />
          </label>
          <label>
            Tracking code or link
            <input
              name="code"
              aria-label="Tracking code or link"
              defaultValue={filters.code}
              list="analytics-tracking-codes"
              maxLength={2000}
              placeholder="Code or /r/ link"
              spellCheck={false}
            />
            <datalist id="analytics-tracking-codes">
              {links.map((link) => (
                <option key={link.code} value={link.code}>
                  {link.label} · {link.market}
                  {link.active ? "" : " · inactive"}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            Contact region
            <select
              aria-label="Contact region"
              name="region"
              defaultValue={filters.region}
            >
              <option value="all">All contact profiles</option>
              <option value="US">United States</option>
              <option value="BG">Bulgaria</option>
              <option value="unknown">Unknown / not recorded</option>
            </select>
          </label>
          <label>
            Application attribution
            <select
              aria-label="Application attribution"
              name="source"
              defaultValue={filters.source}
            >
              <option value="all">With and without a link</option>
              <option value="tracked">Application link</option>
              <option value="untracked">Without application link</option>
            </select>
          </label>
          <label>
            Activity type
            <select
              aria-label="Activity type"
              name="event"
              defaultValue={filters.event}
            >
              {analyticsEvents.map((event) => (
                <option key={event} value={event}>
                  {analyticsEventLabels[event]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details
          className="analytics-more-filters"
          open={
            filters.hour_from !== 0 ||
            filters.hour_to !== 23 ||
            filters.page !== "all" ||
            filters.status !== "all" ||
            filters.active !== "all" ||
            Boolean(filters.search)
          }
        >
          <summary>Hours, pages, application status &amp; text search</summary>
          <div className="analytics-filter-fields">
            <label>
              From hour (UTC)
              <select
                aria-label="From hour (UTC)"
                name="hour_from"
                defaultValue={filters.hour_from}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <label>
              Through hour (UTC)
              <select
                aria-label="Through hour (UTC)"
                name="hour_to"
                defaultValue={filters.hour_to}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:59
                  </option>
                ))}
              </select>
            </label>
            <label>
              Page
              <select aria-label="Page" name="page" defaultValue={filters.page}>
                {[
                  "all",
                  "/",
                  "/projects",
                  "/explore",
                  "/answers",
                  "/workspace",
                  "/resume",
                  "legacy",
                ].map((page) => (
                  <option key={page} value={page}>
                    {page === "all"
                      ? "All pages"
                      : page === "legacy"
                        ? "Historical short-link landing"
                        : page === "/"
                          ? "Main page"
                          : page}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Application status (current)
              <select
                aria-label="Application status (current)"
                name="status"
                defaultValue={filters.status}
              >
                <option value="all">All application statuses</option>
                {outcomes.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Link status (current)
              <select
                aria-label="Link status (current)"
                name="active"
                defaultValue={filters.active}
              >
                <option value="all">Active and inactive / no link</option>
                <option value="active">Active links</option>
                <option value="inactive">Inactive links</option>
              </select>
            </label>
            <label>
              Search activity
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                maxLength={200}
                placeholder="Question, topic, project, employer or role"
              />
            </label>
          </div>
          <p className="muted">
            Hours repeat on each selected date. An overnight range such as 22–02
            includes hours 22, 23, 00, 01 and 02. Choose up to 90 calendar days.
          </p>
        </details>
        <div className="analytics-filter-actions">
          <button type="submit">Apply filters</button>
          <Link
            className="text-link"
            href={preview ? "/admin/analytics?preview=1" : "/admin/analytics"}
          >
            Reset filters
          </Link>
        </div>
      </Form>
    </section>
  );
}
