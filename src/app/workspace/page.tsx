import { getCareer } from "@/lib/career/repository";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { IdentityHeader } from "@/components/identity-header";
import { WorkspaceList } from "@/components/workspace-list";
export const dynamic = "force-dynamic";
export default async function Workspaces() {
  const career = await getCareer(),
    presentation = await getPresentation(await currentMarket());
  return (
    <>
      <IdentityHeader career={career} presentation={presentation} />
      <main id="main" className="wrap prose workspace-index">
        <p className="eyebrow">Your career exploration</p>
        <h1>Two spaces to find the fit.</h1>
        <p>
          Resume a saved exploration, or start with a job description or
          question. No recruiter account is needed.
        </p>
        <WorkspaceList />
      </main>
    </>
  );
}
