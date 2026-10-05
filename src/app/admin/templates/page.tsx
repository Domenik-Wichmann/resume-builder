import Link from "next/link";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { loadDesignStudio } from "@/lib/resume-design/server";
import { designPreview } from "@/lib/resume-design/preview";
import { ResumeTemplateStudio } from "@/components/resume-template-studio";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Resume design & templates",
  robots: { index: false, follow: false },
};
export default async function TemplatesPage() {
  let data;
  try {
    await requireOwner();
    const a = await requireAccount();
    data = await loadDesignStudio(a.db, a.accountId);
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
      <p className="eyebrow">Design once. Reuse reliably.</p>
      <h1>Resume design & templates</h1>
      <p className="muted">
        Upload a reference image or PDF, describe your preferred design, and
        review the AI interpretation. Save the layout for consistent future
        resumes. Your career facts remain in the Career Brain.
      </p>
      <ResumeTemplateStudio
        initialAssets={data.assets}
        initialTemplates={data.templates}
        preview={designPreview}
      />
    </main>
  );
}
