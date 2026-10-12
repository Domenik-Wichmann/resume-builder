import Link from "next/link";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import {
  loadDesignStudio,
  applicationTemplate,
} from "@/lib/resume-design/server";
import { ResumeContentEditor } from "@/components/resume-content-editor";
import { getResume } from "@/lib/resume";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { generalResumeIR } from "@/lib/resume-design/from-career";
import { ResumeTemplateStudio } from "@/components/resume-template-studio";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resume design & templates",
  robots: { index: false, follow: false },
};
export default async function TemplatesPage() {
  let data;
  let fixed = null;
  let preview;
  let migrationMessage = "";
  try {
    await requireOwner();
    const a = await requireAccount();
    data = await loadDesignStudio(a.db, a.accountId);
    try {
      fixed = (await applicationTemplate(a.db, a.accountId)).fixed;
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== 503) throw e;
      migrationMessage = e.message;
    }
    const [career, presentation] = await Promise.all([
      getResume(a),
      currentMarket().then((market) => getPresentation(market, a.accountId)),
    ]);
    preview = generalResumeIR(career, presentation, fixed);
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    return (
      <main id="main" className="wrap prose">
        <h1>Resume design & templates</h1>
        <p>Sign in as the owner to manage your reusable designs.</p>
        <Link href="/admin">Owner sign in</Link>
      </main>
    );
  }
  return (
    <main id="main" className="wrap admin-main design-studio-page">
      <AdminPageHeader
        section="Applications"
        title="Résumé design & templates"
        description="Upload a reference image or PDF, describe your preferred design and preview it. Save reusable layouts here; generate job-specific résumés in the résumé library."
      />
      <ResumeTemplateStudio
        initialAssets={data.assets}
        initialTemplates={data.templates}
        preview={preview}
      />
      {migrationMessage ? (
        <p role="status">{migrationMessage}</p>
      ) : (
        <ResumeContentEditor initial={fixed} />
      )}
    </main>
  );
}
