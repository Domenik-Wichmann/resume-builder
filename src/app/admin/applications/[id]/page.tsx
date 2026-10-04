import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/accounts";
import { resumeIRSchema } from "@/lib/resume-ir";
import { ResumeRenderer } from "@/components/resume-renderer";
import { PrintButton } from "@/components/print-button";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Application({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  return (
    <main className="wrap portfolio-main">
      <div className="resume-toolbar">
        <Link href="/admin/applications">← Applications</Link>
        <PrintButton />
      </div>
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
      </div>
      {snapshot.data ? (
        <ResumeRenderer ir={resumeIRSchema.parse(snapshot.data.resume_ir)} />
      ) : (
        <p>No immutable résumé snapshot exists for this legacy application.</p>
      )}
    </main>
  );
}
