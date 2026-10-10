import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/accounts";
import { resumeIRSchema } from "@/lib/resume-ir";
import { ResumeRenderer } from "@/components/resume-renderer";
import { PrintButton } from "@/components/print-button";
import { withTrackingUrl } from "@/lib/resume-design/fixed-content";
import { requireOwner } from "@/lib/admin";
import { ResumeLengthNotice } from "@/components/resume-length-notice";
import { defaultDesign } from "@/lib/resume-design/model";
import { applicationDashboard } from "@/lib/applications/repository";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Application({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const a = await requireAccount(),
    { id } = await params;
  const [app, snapshot] = await Promise.all([
    a.db
      .from("job_applications")
      .select("organization,role,status")
      .eq("account_id", a.accountId)
      .eq("id", id)
      .maybeSingle(),
    a.db
      .from("application_snapshots")
      .select("*")
      .eq("account_id", a.accountId)
      .eq("application_id", id)
      .maybeSingle(),
  ]);
  if (app.error || snapshot.error || !app.data) notFound();
  const dashboard = await applicationDashboard(a.db, a.accountId);
  const saved = dashboard.applications.find(
    (application) => application.id === id,
  );
  return (
    <main className="wrap portfolio-main">
      <div className="resume-toolbar">
        <Link href="/admin/applications">← Applications</Link>
        {snapshot.data && (
          <PrintButton
            filename={`${app.data.organization}-${app.data.role}-${snapshot.data.tracking_code}-${snapshot.data.generated_at}`.replace(
              /[^a-zA-Z0-9_-]/g,
              "-",
            )}
          />
        )}
      </div>
      <section
        className="surface snapshot-note resume-activity"
        aria-labelledby="resume-activity-title"
      >
        <h2 id="resume-activity-title">Activity for this résumé</h2>
        <p className="muted">
          {saved?.market === "US"
            ? "United States contact profile · Letter"
            : saved?.market === "BG"
              ? "Bulgaria contact profile · A4"
              : "Legacy tracking application"}
        </p>
        {saved && (
          <div className="resume-activity-grid">
            {[
              [
                "Visits",
                saved.activity.visits,
                "Distinct browser sessions per tracking link",
              ],
              [
                "Workspaces",
                saved.activity.workspaces,
                "Workspaces started from this application",
              ],
              [
                "Questions",
                saved.activity.questions,
                "Questions saved in attributed workspaces",
              ],
              [
                "Explorations",
                saved.activity.engagement,
                "Explorer interactions in attributed workspaces",
              ],
              [
                "Résumé previews",
                saved.activity.previews,
                "Recruiter workspace preview opens",
              ],
              [
                "Export opens",
                saved.activity.exports,
                "Export opens do not prove a PDF was saved",
              ],
            ].map(([label, value, hint]) => (
              <article key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
                <small>{hint}</small>
              </article>
            ))}
          </div>
        )}
        <p className="muted">
          Counts reflect retained, attributed activity. Privacy settings and
          blocked tracking can reduce counts.{" "}
          {dashboard.truncated &&
            "At least one source reached the 1,000-record limit; counts may be partial."}
        </p>
      </section>
      <div className="snapshot-note">
        <h1>
          {app.data.organization} · {app.data.role}
        </h1>
        <p>
          {app.data.status}
          {snapshot.data
            ? ` · ${snapshot.data.strategy} · Saved ${new Date(snapshot.data.generated_at).toLocaleDateString("en-US")}`
            : " · Legacy tracking application"}
        </p>
        {snapshot.data && (
          <p>
            Historical snapshot ·{" "}
            <a className="text-link" href={`/r/${snapshot.data.tracking_code}`}>
              Tracking link ↗
            </a>
          </p>
        )}
        {snapshot.data?.generation_record?.review?.length > 0 && (
          <details>
            <summary>Private draft review</summary>
            <ul>
              {(snapshot.data.generation_record.review as string[]).map(
                (note, i) => (
                  <li key={i}>{note}</li>
                ),
              )}
            </ul>
          </details>
        )}
      </div>
      {snapshot.data && (
        <ResumeLengthNotice
          design={
            resumeIRSchema.parse(snapshot.data.resume_ir).design ||
            defaultDesign
          }
        />
      )}
      {snapshot.data ? (
        <ResumeRenderer
          ir={withTrackingUrl(
            resumeIRSchema.parse(snapshot.data.resume_ir),
            snapshot.data.tracking_code,
          )}
        />
      ) : (
        <p>No immutable résumé snapshot exists for this legacy application.</p>
      )}
    </main>
  );
}
