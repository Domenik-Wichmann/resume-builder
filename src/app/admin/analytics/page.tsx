import { isOwner } from "@/lib/admin";
import { OwnerLogin } from "@/components/admin-controls";
import { loadAnalytics } from "@/lib/analytics/server";
import {
  parseAnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsQuery,
} from "@/lib/analytics/filters";
import { fictionalAnalytics } from "@/lib/analytics/demo";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { AnalyticsFiltersForm } from "@/components/analytics-filters";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<AnalyticsQuery>;
}) {
  const query = await searchParams;
  const preview = process.env.APP_MODE === "demo" && query.preview === "1";
  if (!preview && !(await isOwner()))
    return (
      <main id="main" className="wrap prose">
        <h1>Private analytics</h1>
        <OwnerLogin />
      </main>
    );
  const parsed = parseAnalyticsFilters(query);
  if (!parsed.success)
    return (
      <main id="main" className="wrap admin-main analytics-main">
        <AdminPageHeader
          section="Insights"
          title="Visitor analytics"
          description="Filter portfolio visits, questions and recruiter activity."
        />
        <p className="record-notice error" role="alert">
          Check your filters: use valid dates in a range of up to 90 days, hours
          from 00 to 23, an eight-character tracking code or its full link, a
          two-letter country code (or unknown), and ordered active-time limits
          from 0 to 14,400 seconds. Visitor and session IDs must come from the
          analytics report.
        </p>
        <AnalyticsFiltersForm
          filters={defaultAnalyticsFilters()}
          links={[]}
          preview={preview}
        />
      </main>
    );
  const filters = parsed.data;
  const data = preview
    ? fictionalAnalytics(filters)
    : await loadAnalytics(filters);
  return (
    <main id="main" className="wrap admin-main analytics-main">
      {preview && (
        <p className="demo-banner">
          FICTIONAL ANALYTICS PREVIEW · sample activity is not real visitor data
        </p>
      )}
      <AdminPageHeader
        section="Insights"
        title="Visitor analytics"
        description="Investigate when people visit, which resume links bring interest, and what they explore or ask. Filter the data or click a chart, day, hour or tracking code to go deeper."
      />
      <AnalyticsDashboard data={data} filters={filters} preview={preview} />
    </main>
  );
}
