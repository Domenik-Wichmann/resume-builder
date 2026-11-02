import { portfolioEmail } from "@/lib/portfolio/contact";
import Link from "next/link";
import { ProjectGuide } from "@/components/project-guide";
import { projectGuideForSlug } from "@/lib/portfolio/project-guides";
import { notFound } from "next/navigation";
import { publicProjectDetails } from "@/lib/portfolio/showcase-server";
import { ProjectDisplay } from "@/components/project-display";
import { PortfolioHeader } from "@/components/portfolio-shell";
import { ExploreSignal } from "@/components/explore-signal";
import { PortfolioStoryHero } from "@/components/portfolio-story";
import { getPortfolioStory } from "@/lib/portfolio/story-server";
import { selectedProjectNames } from "@/lib/portfolio/selection";
import { demoProject } from "@/lib/portfolio/demo";
import {
  SonawayCaseStudy,
  sonawayIntroduction,
} from "@/components/sonaway-case-study";
import "../../portfolio-story.css";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = projectGuideForSlug(slug);
  if (guide)
    return (
      <main id="main">
        <ProjectGuide guide={guide} />
        {guide.key !== "kernel" && (
          <ExploreSignal
            kind="project"
            id={
              {
                babycat: "937f2379-7dbc-4eae-a12f-5c3dacc13b0c",
                lms: "1ba79f8b-7379-41b1-94d2-7268a7e66b51",
                sonaway: "c05d7b83-2c3d-412c-918a-d468e27adee3",
              }[guide.key as "babycat" | "lms" | "sonaway"]
            }
          />
        )}
      </main>
    );
  const item = (await publicProjectDetails({ slug }))[0];
  if (!item) notFound();
  const { project: p, content, skills, media } = item;
  const sonaway = selectedProjectNames[p.id] === "Sonaway";
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
            <p>
              Email me:{" "}
              <a
                className="portfolio-email-link"
                href={`mailto:${portfolioEmail}`}
              >
                {portfolioEmail}
              </a>
            </p>
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
          content={sonaway ? { ...content, ...sonawayIntroduction } : content}
          editorial={sonaway ? <SonawayCaseStudy /> : undefined}
        />
        <ExploreSignal kind="project" id={p.id} />
      </main>
    </>
  );
}
