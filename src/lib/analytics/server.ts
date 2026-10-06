import "server-only";
import { requireOwner } from "../admin";
import { requireAccount } from "../accounts";
import { HttpError } from "../http";
import {
  summarizeAnalytics,
  type Visit,
  type Question,
  type Topic,
  type Activity,
} from "./model";
const rowLimit = 10000;
type PageResult = {
  data: unknown[] | null;
  count: number | null;
  error: unknown;
};
async function retainedRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
) {
  const rows: T[] = [];
  let total = 0;
  for (let from = 0; from < rowLimit; from += 1000) {
    const result = await fetchPage(from, from + 999);
    if (result.error) throw new Error("Cannot load owner analytics.");
    total = result.count || 0;
    rows.push(...((result.data || []) as T[]));
    if (rows.length >= total || !result.data?.length) break;
  }
  return { rows, total, truncated: total > rows.length };
}
export async function loadAnalytics(days: number, includeDetails = true) {
  // Verify the configured owner, then read with their JWT and membership RLS.
  await requireOwner();
  const { db, accountId, userId } = await requireAccount();
  if (userId !== process.env.OWNER_USER_ID)
    throw new HttpError(403, "Owner authentication required.");
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  const since = start.toISOString();
  const until = now.toISOString();
  const [visits, questions, topics, activities] = await Promise.all([
    retainedRows<Visit>((from, to) =>
      db
        .from("tracking_events")
        .select("id,session_id,link_id,page_path,created_at", {
          count: "exact",
        })
        .eq("account_id", accountId)
        .eq("event_type", "page_view")
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    retainedRows<Question>((from, to) =>
      db
        .from("workspace_questions")
        .select("id,question,created_at", { count: "exact" })
        .eq("account_id", accountId)
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    retainedRows<Topic>((from, to) =>
      db
        .from("question_topics")
        .select(
          "topic,question_id,evidence_strength,workspace_questions!inner(created_at)",
          { count: "exact" },
        )
        .eq("account_id", accountId)
        .gte("workspace_questions.created_at", since)
        .lte("workspace_questions.created_at", until)
        .order("created_at", { ascending: false })
        .order("question_id")
        .order("topic")
        .range(from, to),
    ),
    retainedRows<Activity>((from, to) =>
      db
        .from("workspace_events")
        .select("id,event_type,created_at", { count: "exact" })
        .eq("account_id", accountId)
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);
  const recent = includeDetails
    ? await db
        .from("workspace_questions")
        .select("question,answer,created_at")
        .eq("account_id", accountId)
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(50)
    : { data: [], error: null };
  if (recent.error) throw new Error("Cannot load recent questions.");
  return {
    recentQuestions: (recent.data || []) as Question[],
    visits,
    questions,
    topics,
    activities,
    summary: summarizeAnalytics(
      visits.rows,
      questions.rows,
      topics.rows,
      activities.rows,
      days,
      now,
    ),
    truncated: [visits, questions, topics, activities].some((r) => r.truncated),
  };
}
