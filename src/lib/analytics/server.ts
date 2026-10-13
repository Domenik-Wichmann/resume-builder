import "server-only";
import { requireOwner } from "../admin";
import { requireAccount } from "../accounts";
import { HttpError } from "../http";
import {
  analyticsFiltersSchema,
  defaultAnalyticsFilters,
  type AnalyticsFilters,
} from "./filters";
import { analyticsReportSchema } from "./report";
export async function loadAnalytics(
  selection: AnalyticsFilters | number,
  includeDetails = true,
) {
  await requireOwner();
  const { db, accountId, userId } = await requireAccount();
  if (userId !== process.env.OWNER_USER_ID)
    throw new HttpError(403, "Owner authentication required.");
  const parsed = analyticsFiltersSchema.safeParse(
    typeof selection === "number"
      ? defaultAnalyticsFilters(selection)
      : selection,
  );
  if (!parsed.success) throw new HttpError(400, "Invalid analytics filters.");
  const filters = parsed.data;
  // Filters run before aggregation and pagination in PostgreSQL. The owner's
  // verified JWT and membership RLS apply to every source in the private view.
  const result = await db.rpc("owner_analytics_report", {
    p_account: accountId,
    p_from: filters.from,
    p_to: filters.to,
    p_hour_from: filters.hour_from,
    p_hour_to: filters.hour_to,
    p_code: filters.code || null,
    p_region: filters.region === "all" ? null : filters.region,
    p_source: filters.source === "all" ? null : filters.source,
    p_event: filters.event === "all" ? null : filters.event,
    p_page: filters.page === "all" ? null : filters.page,
    p_status: filters.status === "all" ? null : filters.status,
    p_active: filters.active === "all" ? null : filters.active === "active",
    p_search: filters.search || null,
    p_offset: (filters.page_number - 1) * 50,
  });
  const report = analyticsReportSchema.safeParse(result.data);
  if (result.error || !report.success)
    throw new HttpError(503, "Cannot load owner analytics. Please retry.");
  return {
    ...report.data,
    events: includeDetails ? report.data.events : [],
    filters,
  };
}
