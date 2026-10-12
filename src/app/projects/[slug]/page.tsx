import Link from "next/link";
import { notFound } from "next/navigation";
import { publicProjectDetails } from "@/lib/portfolio/showcase-server";
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
  const item = (await publicProjectDetails({ slug }))[0];
  if (!item) notFound();
  const { project: p, content, skills, media } = item;
  return (
    <>
      <PortfolioHeader />
      <main className="wrap portfolio-main">
        <Link href="/projects">← Selected projects</Link>
        <ProjectDisplay
          project={p}
          media={media}
          skills={skills}
          outcomes={content.outcomes}
          content={content}
        />
        <ExploreSignal kind="project" id={p.id} />
      </main>
    </>
  );
}
