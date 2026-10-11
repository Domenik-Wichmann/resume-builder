import { getCareer } from "@/lib/career/repository";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { IdentityHeader } from "@/components/identity-header";
import { WorkspaceList } from "@/components/workspace-list";
export const dynamic = "force-dynamic";
export default async function Workspaces({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const suggestedQuestion = (await searchParams).question?.slice(0, 1000) || "";
  const [career, presentation] = await Promise.all([
    getCareer(),
    currentMarket().then(getPresentation),
  ]);
  return (
    <>
      <IdentityHeader career={career} presentation={presentation} />
      <main id="main" className="wrap prose workspace-index">
        <p className="eyebrow">Your career exploration</p>
        <h1>Your saved chats.</h1>
        <p>
          Resume a saved exploration, or start with a job description or
          question. Chats belong to this browser on this website. Signing in
          does not move them between browsers or website domains.
        </p>
        <WorkspaceList question={suggestedQuestion} />
      </main>
    </>
  );
}
