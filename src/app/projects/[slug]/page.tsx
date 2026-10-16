import Link from "next/link";
import { notFound } from "next/navigation";
import { publicProjectDetails } from "@/lib/portfolio/showcase-server";
import { ProjectDisplay } from "@/components/project-display";
import { PortfolioHeader } from "@/components/portfolio-shell";
import { ExploreSignal } from "@/components/explore-signal";
import { PortfolioStoryHero } from "@/components/portfolio-story";
import { getPortfolioStory } from "@/lib/portfolio/story-server";
import { selectedProjectNames } from "@/lib/portfolio/selection";
import { demoProject } from "@/lib/portfolio/demo";
import "../../portfolio-story.css";
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
  const walkthrough =
    selectedProjectNames[p.id] === "Resume Builder" ||
    (process.env.APP_MODE === "demo" && p.id === demoProject.id);
  if (walkthrough)
    return (
      <div className="public-experience project-walkthrough">
        <main id="main">
          <PortfolioStoryHero story={await getPortfolioStory()} />
          <section
            className="wrap portfolio-main project-case-details"
            id="project-details"
            aria-label="Resume Builder case study"
          >
            <Link href="/projects">← Selected projects</Link>
            <ProjectDisplay
              project={p}
              media={media}
              skills={skills}
              outcomes={content.outcomes}
              content={content}
              headingLevel={2}
            />
            <Link
              className="button"
              href="/#ask"
              data-analytics-action="open_chat"
            >
              Explore my experience →
            </Link>
            <ExploreSignal kind="project" id={p.id} />
          </section>
        </main>
      </div>
    );
  return (
    <>
      <PortfolioHeader homeOnly />
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
