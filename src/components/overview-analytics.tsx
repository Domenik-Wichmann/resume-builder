import Link from "next/link";
import {
  AnalyticsMetrics,
  TrackingPerformance,
  contactRegionLabel,
} from "./analytics-dashboard";
import { AnalyticsChart, AnalyticsTrend } from "./analytics-chart";
import { analyticsHref, type AnalyticsFilters } from "@/lib/analytics/filters";
import type { AnalyticsReport } from "@/lib/analytics/report";
export function OverviewAnalytics({
  data,
  filters,
}: {
  data: AnalyticsReport;
  filters: AnalyticsFilters;
}) {
  const today = data.daily.at(-1);
  const week = data.daily.slice(-7);
  return (
    <section
      className="overview-analytics"
      aria-labelledby="overview-analytics-heading"
    >
      <div className="workspace-top">
        <div>
          <h2 id="overview-analytics-heading">Portfolio activity</h2>
          <p className="muted">Last 30 UTC calendar days · today is partial.</p>
        </div>
        <Link className="button" href="/admin/analytics">
          Explore all analytics →
        </Link>
      </div>
      <div className="overview-pulse">
        {[
          ["Page views today", today?.views || 0],
          [
            "Page views · last 7 days",
            week.reduce((n, day) => n + day.views, 0),
          ],
          [
            "Questions · last 7 days",
            week.reduce((n, day) => n + day.questions, 0),
          ],
        ].map(([label, value]) => (
          <Link
            key={label}
            href={analyticsHref(filters, {
              from:
                label === "Page views today"
                  ? filters.to
                  : week[0]?.label || filters.from,
              to: filters.to,
              event:
                label === "Questions · last 7 days" ? "question" : "page_view",
            })}
          >
            <strong>{value}</strong>
            <span>{label}</span>
            <small>Inspect activity ↗</small>
          </Link>
        ))}
      </div>
      <AnalyticsMetrics data={data} />
      <section
        className="analytics-grid section"
        aria-label="Last 30 days of activity"
      >
        <AnalyticsTrend
          title="Page views · last 30 days"
          rows={data.daily.map((day) => ({
            label: day.label,
            count: day.views,
            href: analyticsHref(filters, { from: day.label, to: day.label }),
          }))}
        />
        <AnalyticsTrend
          title="Questions · last 30 days"
          rows={data.daily.map((day) => ({
            label: day.label,
            count: day.questions,
            href: analyticsHref(filters, {
              from: day.label,
              to: day.label,
              event: "question",
            }),
          }))}
        />
      </section>
      <TrackingPerformance data={data} filters={filters} compact />
      <details className="admin-overview-details">
        <summary>Popular pages &amp; contact regions</summary>
        <div className="analytics-grid section">
          <AnalyticsChart title="Pages viewed" rows={data.pages} />
          <AnalyticsChart
            title="Activity by contact profile"
            rows={data.regions.map((region) => ({
              ...region,
              label: contactRegionLabel(region.label),
            }))}
          />
        </div>
      </details>
    </section>
  );
}
