import Link from "next/link";
import { cookies } from "next/headers";
import { getResume } from "@/lib/resume";
import { PrintButton } from "@/components/print-button";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { publicResumeTemplate } from "@/lib/resume-design/server";
import { publicDefaultResume } from "@/lib/resume-design/public-content";
import { trackedResume } from "@/lib/resume-design/tracked-resume";
import { ResumeRenderer } from "@/components/resume-renderer";
import "./public-resume.css";
export const dynamic = "force-dynamic";
export default async function Resume() {
  const jar = await cookies();
  const saved = await trackedResume(jar.get("rb_ai_access")?.value);
  let ir = saved;
  let design = saved?.design;
  if (!ir) {
    const [career, template, presentation] = await Promise.all([
      getResume(),
      publicResumeTemplate(),
      currentMarket().then(getPresentation),
    ]);
    ir = publicDefaultResume(career, presentation, template.fixed);
    design = template.design;
  } else if (!design) {
    design = (await publicResumeTemplate()).design;
  }
  return (
    <main id="main" className="resume-page">
      <div className="resume-toolbar">
        <Link href="/">Back to portfolio</Link>
        <PrintButton />
      </div>
      <ResumeRenderer ir={ir} design={design} />
    </main>
  );
}
