import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { loadProjects, projectMedia } from "@/lib/portfolio/repository";
import { loadCanonical } from "@/lib/ingestion/repository";
import { ProjectManager } from "@/components/project-manager";
import { requireOwner } from "@/lib/admin";
import { demoProject } from "@/lib/portfolio/demo";
import { loadCaseStudies } from "@/lib/portfolio/case-study-server";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Project manager · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function ProjectsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  if (process.env.APP_MODE === "demo" && (await searchParams).preview === "1")
    return (
      <main className="wrap portfolio-main">
        <p className="demo-banner">
          FICTIONAL PROJECT MANAGER PREVIEW · sample facts are not owner
          evidence
        </p>
        <AdminPageHeader
          section="Portfolio"
          title="Project showcase"
          description="Choose a project to edit its case study, screenshots, links and public visibility. Fill a private draft from your stored career evidence, then review it before publishing."
        />
        <ProjectManager
          initialProjects={[demoProject]}
          initialMedia={[]}
          records={[]}
        />
      </main>
    );
  let account;
  try {
    await requireOwner();
    account = await requireAccount();
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    return (
      <main className="wrap prose">
        <h1>Project manager</h1>
        <Link href="/auth/login">Sign in to manage your projects</Link>
      </main>
    );
  }
  const [projects, media, records, cases] = await Promise.all([
    loadProjects(account.db, account.accountId),
    projectMedia(account.db, account.accountId),
    loadCanonical(account.db, account.accountId),
    loadCaseStudies(account.db, account.accountId),
  ]);
  return (
    <main id="main" className="wrap admin-main">
      <AdminPageHeader
        section="Portfolio"
        title="Project showcase"
        description="Choose a project to edit its case study, screenshots, links and public visibility. Fill a private draft from your stored career evidence, then review it before publishing."
      />
      <ProjectManager
        initialProjects={projects}
        initialMedia={media}
        records={records}
        initialSelection={Object.fromEntries(
          cases.map((value) => [value.project_id, value.selected]),
        )}
      />
    </main>
  );
}
