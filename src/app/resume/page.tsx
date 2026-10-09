import Link from "next/link";
import { getResume } from "@/lib/resume";
import { PrintButton } from "@/components/print-button";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { publicResumeTemplate } from "@/lib/resume-design/server";
import { generalResumeIR } from "@/lib/resume-design/from-career";
import { ResumeRenderer } from "@/components/resume-renderer";
export const dynamic = "force-dynamic";
export default async function Resume() {
  const [career, template, presentation] = await Promise.all([
    getResume(),
    publicResumeTemplate(),
    currentMarket().then(getPresentation),
  ]);
  return (
    <main id="main" className="resume-page">
      <div className="resume-toolbar">
        <Link href="/">Back to portfolio</Link>
        <PrintButton />
      </div>
      <ResumeRenderer
        ir={generalResumeIR(career, presentation, template.fixed)}
        design={template.design}
      />
    </main>
  );
}
