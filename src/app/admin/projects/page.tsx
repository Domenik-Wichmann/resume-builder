import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { loadProjects, projectMedia } from "@/lib/portfolio/repository";
import { loadCanonical } from "@/lib/ingestion/repository";
import { ProjectManager } from "@/components/project-manager";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Project manager · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function ProjectsAdmin() {
  let account;
  try {
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
  const [projects, media, records] = await Promise.all([
    loadProjects(account.db, account.accountId),
    projectMedia(account.db, account.accountId),
    loadCanonical(account.db, account.accountId),
  ]);
  return (
    <main className="wrap portfolio-main">
      <Link href="/account">← Account</Link>
      <h1>Project showcase.</h1>
      <ProjectManager
        initialProjects={projects}
        initialMedia={media}
        records={records}
      />
    </main>
  );
}
