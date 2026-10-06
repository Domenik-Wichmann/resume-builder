import { getCareer } from "@/lib/career/repository";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { IdentityHeader } from "@/components/identity-header";
import { WorkspaceView } from "@/components/workspace-view";
import { publicResumeDesign } from "@/lib/resume-design/server";
export const dynamic = "force-dynamic";
export default async function WorkspaceExport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [career, presentation, design] = await Promise.all([
    getCareer(),
    currentMarket().then(getPresentation),
    publicResumeDesign(),
  ]);
  return (
    <>
      <IdentityHeader career={career} presentation={presentation} />
      <WorkspaceView
        id={(await params).id}
        market={presentation.market}
        design={design}
        exportView
      />
    </>
  );
}
