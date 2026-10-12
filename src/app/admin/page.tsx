import { loadAnalytics } from "@/lib/analytics/server";
import Link from "next/link";
import { isOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { OwnerLogin, TrackingLinkForm } from "@/components/admin-controls";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AnalyticsTrend } from "@/components/analytics-chart";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  if (!(await isOwner()))
    return (
      <main id="main" className="wrap prose">
        <Link href="/">← Portfolio</Link>
        <OwnerLogin />
      </main>
    );
  const { db } = await requireAccount();
  const [landing, workspaces, questions, events, links, career] =
    await Promise.all([
      db
        .from("tracking_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "page_view"),
      db
        .from("workspaces")
        .select("id,title,market,updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(20),
      db
        .from("workspace_questions")
        .select("id", { count: "exact", head: true }),
      db
        .from("workspace_events")
        .select("event_type")
        .order("created_at", { ascending: false })
        .in("event_type", ["resume_preview", "workspace_export"])
        .limit(10000),
      db
        .from("tracking_links")
        .select("code,label,market,active")
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("projects").select("title,is_public").limit(20),
    ]);
  if (
    [landing, workspaces, questions, events, links, career].some(
      (result) => result.error,
    )
  )
    throw new Error("Cannot load owner overview.");
  const analytics = await loadAnalytics(30, false);
  return (
    <main id="main" className="wrap admin-main">
      <AdminPageHeader
        section="Your workspace"
        title="Overview"
        description="Manage your career evidence, public portfolio and job applications. See recent interest here, or open a tool to pick up your work."
      />
      <section
        className="admin-shortcuts"
        aria-label="Manage your career workspace"
      >
        <Link href="/admin/applications">
          <strong>Résumé generator & history</strong>
          <span>
            Create a tailored résumé, export it and review its activity
          </span>
        </Link>
        <Link href="/admin/interviews">
          <strong>Career Interviews</strong>
          <span>
            Discover career evidence through a private, persistent conversation
          </span>
        </Link>
        <Link href="/admin/presentation">
          <strong>Profile & contact</strong>
          <span>Name, introduction, contact details and portrait library</span>
        </Link>
        <Link href="/admin/templates">
          <strong>Resume design & templates</strong>
          <span>Upload a reference, draft a design, preview and reuse it</span>
        </Link>
        <Link href="/admin/explore">
          <strong>Career records</strong>
          <span>Review evidence, edit connected records and publish</span>
        </Link>
        <Link href="/admin/projects">
          <strong>Project showcase</strong>
          <span>Manage project pages, links and project images</span>
        </Link>
      </section>
      <section id="overview" className="admin-metrics">
        {[
          ["Tracked page views", landing.count || 0],
          ["Saved workspaces", workspaces.count || 0],
          ["Questions saved", questions.count || 0],
          [
            "Résumé previews (latest 10k events)",
            events.data?.filter(
              (event) => event.event_type === "resume_preview",
            ).length || 0,
          ],
          [
            "Export opens (latest 10k events)",
            events.data?.filter(
              (event) => event.event_type === "workspace_export",
            ).length || 0,
          ],
        ].map(([label, value]) => (
          <article className="project-card" key={label}>
            <strong>{value}</strong>
            <p>{label}</p>
          </article>
        ))}
      </section>
      <details className="admin-count-notes">
        <summary>How activity is counted</summary>
        <p className="muted">
          Public page views are tracked from the analytics update onward, except
          when privacy signals or signed-in owner access disable tracking.
          Historical visits reflect short-link landings only. Completed browser
          PDF saves are not measured. Export opens do not prove a file was
          downloaded. Counts reflect retained records.
        </p>
      </details>
      <section
        className="analytics-grid section"
        aria-label="Last 30 days of activity"
      >
        <AnalyticsTrend
          title="Page views · last 30 days"
          rows={analytics.summary.daily.map((day) => ({
            label: day.label,
            count: day.views,
          }))}
        />
        <AnalyticsTrend
          title="Questions · last 30 days"
          rows={analytics.summary.daily.map((day) => ({
            label: day.label,
            count: day.questions,
          }))}
        />
      </section>
      <nav className="admin-section-links" aria-label="Overview sections">
        <a href="#questions">Questions & topics</a>
        <a href="#applications">Tracking links</a>
        <a href="#workspaces">Recruiter workspaces</a>
        <Link href="/admin/analytics">All analytics →</Link>
      </nav>
      <section id="applications" className="section admin-grid">
        <TrackingLinkForm />
        <div>
          <h2>Recent tracking links</h2>
          {!links.data?.length && (
            <p className="muted">
              No tracking links yet. Create one for an application to follow its
              portfolio activity.
            </p>
          )}
          {links.data?.map((link) => (
            <p key={link.code}>
              {link.label} · {link.market} ·{" "}
              {link.active ? "Active" : "Inactive"}
              <br />
              <code>/r/{link.code}</code>
            </p>
          ))}
        </div>
      </section>
      <details id="workspaces" className="admin-overview-details">
        <summary>
          Recent recruiter workspaces · {workspaces.count || 0} saved
        </summary>
        <p className="muted">
          These are recruiter-owned workspaces. The list shows recent activity;
          private browser ownership controls access to their contents.
        </p>
        {!workspaces.data?.length && <p>No recruiter workspaces saved yet.</p>}
        {workspaces.data?.map((workspace) => (
          <p key={workspace.id}>
            {workspace.title} · {workspace.market} ·{" "}
            {new Date(workspace.updated_at).toISOString().slice(0, 10)}
          </p>
        ))}
      </details>
      <section id="questions" className="section">
        <div className="workspace-top">
          <div>
            <h2>Questions & topic signals</h2>
            <p className="muted">A quick look at the last 30 days.</p>
          </div>
          <Link className="text-link" href="/admin/analytics">
            View all analytics →
          </Link>
        </div>
        <div className="admin-grid">
          <article className="project-card">
            <h3>Most asked questions</h3>
            {analytics.summary.questions.length ? (
              <ol>
                {analytics.summary.questions.slice(0, 3).map((q) => (
                  <li key={q.label}>
                    {q.label} <span className="muted">· {q.count} asked</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No questions saved yet.</p>
            )}
          </article>
          <article className="project-card">
            <h3>Top topics</h3>
            {analytics.summary.topics.length ? (
              <ol>
                {analytics.summary.topics.slice(0, 3).map((t) => (
                  <li key={t.label}>
                    {t.label}{" "}
                    <span className="muted">· {t.count} questions</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No topic signals yet.</p>
            )}
          </article>
        </div>
        {analytics.truncated && (
          <p className="muted">Highlights use up to 10,000 rows per source.</p>
        )}
      </section>
      <details id="career" className="admin-overview-details">
        <summary>Project publication status</summary>
        <p>
          <Link href="/admin/career">
            Import, review and publish career records.
          </Link>
          Indexing updates only changed published evidence.
        </p>
        {career.data?.map((project, index) => (
          <p key={index}>
            {project.title} · {project.is_public ? "Published" : "Private"}
          </p>
        ))}
      </details>
    </main>
  );
}
