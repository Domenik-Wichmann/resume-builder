import Link from "next/link";
import { isOwner } from "@/lib/admin";
import { OwnerLogin } from "@/components/admin-controls";
import { AnalyticsChart, AnalyticsTrend } from "@/components/analytics-chart";
import { loadAnalytics } from "@/lib/analytics/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Analytics ? Resume Builder",
  robots: { index: false, follow: false },
};
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  if (!(await isOwner()))
    return (
      <main id="main" className="wrap prose">
        <h1>Private analytics</h1>
        <OwnerLogin />
      </main>
    );
  const { days: selected } = await searchParams;
  const days = selected === "7" ? 7 : selected === "90" ? 90 : 30;
  const data = await loadAnalytics(days),
    summary = data.summary;
  return (
    <main id="main" className="wrap admin-main">
      <Link href="/admin">? Overview</Link>
      <div className="workspace-top">
        <div>
          <p className="eyebrow">Private owner analytics</p>
          <h1>Interest, in context.</h1>
          <p className="muted">
            Visits, questions and workspace activity over the last {days} UTC
            calendar days.
          </p>
        </div>
        <nav className="analytics-periods" aria-label="Analytics period">
          {[7, 30, 90].map((period) => (
            <Link
              key={period}
              href={"/admin/analytics?days=" + period}
              aria-current={days === period ? "page" : undefined}
            >
              {period} days
            </Link>
          ))}
        </nav>
      </div>
      <section className="admin-metrics" aria-label="Activity totals">
        {[
          ["Page views", data.visits.total],
          ["Browser sessions", summary.sessions],
          ["Questions saved", data.questions.total],
          ["R?sum? previews", summary.previews],
          ["Export opens", summary.exports],
        ].map(([label, value]) => (
          <article className="project-card" key={label}>
            <strong>{value}</strong>
            <p>{label}</p>
          </article>
        ))}
      </section>
      {data.truncated && (
        <p role="status">
          Detailed charts and session counts use at most the latest 10,000 rows
          per source. Page-view and question totals include all records in the
          selected period.
        </p>
      )}
      <section className="section analytics-grid" aria-label="Visit trends">
        <AnalyticsTrend
          title="Page views by day"
          rows={summary.daily.map((d) => ({ label: d.label, count: d.views }))}
        />
        <AnalyticsTrend
          title="Questions by day"
          rows={summary.daily.map((d) => ({
            label: d.label,
            count: d.questions,
          }))}
        />
        <AnalyticsChart title="Pages explored" rows={summary.pages} />
        <AnalyticsChart
          title="Visit source"
          rows={[
            {
              label: "Application short links",
              count: summary.attributedViews,
            },
            {
              label: "Without application attribution",
              count: data.visits.rows.length - summary.attributedViews,
            },
          ]}
        />
      </section>
      <p className="muted">
        Browser sessions use a random identifier lasting 24 hours; they do not
        identify people. Privacy signals, blocked scripts and signed-in owner
        activity are excluded. Historical short-link landings were measured at
        redirect time; new views are measured when public pages open. Export
        opens do not prove a PDF was saved.
      </p>
      <section id="questions" className="section analytics-grid">
        <AnalyticsChart
          title="Most asked questions"
          rows={summary.questions.slice(0, 10)}
        />
        <AnalyticsChart
          title="Most asked topics"
          rows={summary.topics.slice(0, 10)}
        />
      </section>
      <section className="section">
        <h2>Topic evidence signals</h2>
        <p className="muted">
          Evidence strength describes the stored answer support. These signals
          are not proof of skill gaps.
        </p>
        {summary.topics.length ? (
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
                {summary.topics.map((t) => (
                  <tr key={t.label}>
                    <td>{t.label}</td>
                    <td>{t.count}</td>
                    <td>{t.strong}</td>
                    <td>{t.partial}</td>
                    <td>{t.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No topic signals recorded in this period.</p>
        )}
      </section>
      <section className="section">
        <h2>Recent questions & answers</h2>
        <p className="muted">
          The latest 50 saved questions in this period. Question wording is
          grouped only by case and whitespace, without model inference.
        </p>
        {data.recentQuestions.map((q, index) => (
          <details className="question-answer" key={index}>
            <summary>
              {q.question} <small>{q.created_at.slice(0, 10)}</small>
            </summary>
            <p>{q.answer}</p>
          </details>
        ))}
        {!data.recentQuestions.length && (
          <p>No questions saved in this period.</p>
        )}
      </section>
      <p className="muted">
        Counts reflect retained records. Visit tracking retains up to 90 days;
        deleting a workspace removes its questions and activity.
      </p>
    </main>
  );
}
