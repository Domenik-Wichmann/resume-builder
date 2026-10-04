import Link from "next/link";
import { isOwner } from "@/lib/admin";
import { database } from "@/lib/db";
import {
  OwnerLogin,
  OwnerLogout,
  TrackingLinkForm,
} from "@/components/admin-controls";
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
  const db = database();
  const [landing, workspaces, questions, events, links, topics, career] =
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
        .select("question,answer,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("workspace_events")
        .select("event_type")
        .in("event_type", ["resume_preview", "workspace_export"])
        .limit(10000),
      db
        .from("tracking_links")
        .select("code,label,market,active")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("question_topics")
        .select("topic,evidence_strength,question_id")
        .limit(10000),
      db.from("projects").select("title,is_public").limit(20),
    ]);
  if (
    [landing, workspaces, questions, events, links, topics, career].some(
      (result) => result.error,
    )
  )
    throw new Error("Cannot load owner overview.");
  const topicCounts = new Map<
    string,
    { asked: number; none: number; partial: number; strong: number }
  >();
  for (const row of topics.data || []) {
    const value = topicCounts.get(row.topic) || {
      asked: 0,
      none: 0,
      partial: 0,
      strong: 0,
    };
    value.asked++;
    if (row.evidence_strength === "NONE") value.none++;
    if (row.evidence_strength === "PARTIAL") value.partial++;
    if (row.evidence_strength === "STRONG") value.strong++;
    topicCounts.set(row.topic, value);
  }
  return (
    <main id="main" className="wrap admin-main">
      <div className="workspace-top">
        <div>
          <p className="eyebrow">Private owner area</p>
          <h1>Portfolio overview.</h1>
        </div>
        <OwnerLogout />
      </div>
      <nav className="admin-nav">
        <a href="#overview">Overview</a>
        <a href="#applications">Applications / Links</a>
        <a href="#workspaces">Workspaces</a>
        <a href="#questions">Questions</a>
        <a href="#career">Career Data</a>
      </nav>
      <section id="overview" className="admin-metrics">
        {[
          ["Tracked landing events", landing.count || 0],
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
      <p className="muted">
        Ordinary site visits and completed browser PDF saves are not measured.
        Export opens do not prove a file was downloaded. Counts reflect retained
        records.
      </p>
      <section id="applications" className="section admin-grid">
        <TrackingLinkForm />
        <div>
          <h2>Recent tracking links</h2>
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
      <section id="workspaces" className="section">
        <h2>Recent workspaces</h2>
        {workspaces.data?.map((workspace) => (
          <p key={workspace.id}>
            {workspace.title} · {workspace.market} ·{" "}
            {new Date(workspace.updated_at).toISOString().slice(0, 10)}
          </p>
        ))}
      </section>
      <section id="questions" className="section">
        <h2>Questions & topic signals</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Asked</th>
                <th>Strong</th>
                <th>Partial</th>
                <th>No evidence</th>
              </tr>
            </thead>
            <tbody>
              {[...topicCounts]
                .sort((a, b) => b[1].asked - a[1].asked)
                .map(([topic, count]) => (
                  <tr key={topic}>
                    <td>{topic}</td>
                    <td>{count.asked}</td>
                    <td>{count.strong}</td>
                    <td>{count.partial}</td>
                    <td>{count.none}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          These are evidence signals in up to 10,000 retained topic rows, not
          proof of skill gaps.
        </p>
        {questions.data?.map((question, index) => (
          <article className="question-answer" key={index}>
            <h3>{question.question}</h3>
            <p>{question.answer}</p>
          </article>
        ))}
      </section>
      <section id="career" className="section">
        <h2>Career data foundation</h2>
        <p>
          Maintain approved records in Supabase, then run{" "}
          <code>npm run reindex</code>. Structured ingestion remains planned.
        </p>
        {career.data?.map((project, index) => (
          <p key={index}>
            {project.title} · {project.is_public ? "Published" : "Private"}
          </p>
        ))}
      </section>
    </main>
  );
}
