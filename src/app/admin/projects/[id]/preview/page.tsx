import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { loadProjects, projectMedia } from "@/lib/portfolio/repository";
import { loadCanonical } from "@/lib/ingestion/repository";
import { ProjectDisplay } from "@/components/project-display";
import { requireOwner } from "@/lib/admin";
import {
  loadCaseStudies,
  fillCaseStudy,
} from "@/lib/portfolio/case-study-server";
import { loadBrain } from "@/lib/career-brain/repository";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const a = await requireAccount(),
    { id } = await params;
  const project = (await loadProjects(a.db, a.accountId)).find(
    (p) => p.id === id,
  );
  if (!project) notFound();
  const records = await loadCanonical(a.db, a.accountId);
  const [cases, brain] = await Promise.all([
    loadCaseStudies(a.db, a.accountId),
    loadBrain(a.db, a.accountId),
  ]);
  const record = brain.find((r) => r.id === id && r.kind === "project");
  const content =
    cases.find((value) => value.project_id === id)?.content ||
    (record ? fillCaseStudy(project, record).content : undefined);
  return (
    <main className="wrap portfolio-main">
      <Link href="/admin/projects">← Project manager</Link>
      <p className="demo-banner">
        PRIVATE PREVIEW · includes unpublished content
      </p>
      <ProjectDisplay
        project={project}
        content={content}
        media={await projectMedia(a.db, a.accountId, id)}
        skills={records
          .filter((r) => project.skill_ids.includes(r.id))
          .map((r) => r.title)}
        outcomes={records
          .filter((r) => project.achievement_ids.includes(r.id))
          .map((r) => r.summary || r.title)}
      />
    </main>
  );
}
