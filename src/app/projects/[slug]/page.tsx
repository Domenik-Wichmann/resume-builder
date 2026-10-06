import Link from "next/link";
import { notFound } from "next/navigation";
import { publicProjects, projectMedia } from "@/lib/portfolio/repository";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { getCareer } from "@/lib/career/repository";
import { ProjectDisplay } from "@/components/project-display";
import { PortfolioHeader } from "@/components/portfolio-shell";
import { ExploreSignal } from "@/components/explore-signal";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [projects, career] = await Promise.all([publicProjects(), getCareer()]);
  const p = projects.find((p) => p.slug === slug);
  if (!p) notFound();
  const media = await projectMedia(database(), primaryAccountId, p.id);
  const record = career.projects.find((r) => r.id === p.id);
  return (
    <>
      <PortfolioHeader />
      <main className="wrap portfolio-main">
        <Link href="/projects">← All projects</Link>
        <ProjectDisplay
          project={p}
          media={media}
          skills={record?.skills || []}
          outcomes={record?.outcomes || []}
        />
        <ExploreSignal kind="project" id={p.id} />
      </main>
    </>
  );
}
