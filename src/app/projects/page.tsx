import Link from "next/link";
import { publicShowcase } from "@/lib/portfolio/showcase-server";
import { PortfolioHeader } from "@/components/portfolio-shell";
import { ProjectCards } from "@/components/project-cards";
export const dynamic = "force-dynamic";
export const metadata = { title: "Projects · Domenik Wichmann" };
export default async function Projects() {
  const projects = await publicShowcase();
  return (
    <>
      <PortfolioHeader homeOnly />
      <main className="wrap portfolio-main">
        <p className="eyebrow">Projects</p>
        <h1>Projects worth exploring.</h1>
        <p className="lead">
          Go behind the work. Explore the ideas, systems, skill stacks and
          details that bring each project to life.
        </p>
        {!projects.length ? (
          <div className="empty-state">
            <h2>No projects published yet.</h2>
            <p>Selected apps appear here after owner review and publication.</p>
            <Link href="/explore">Explore published skills →</Link>
          </div>
        ) : (
          <ProjectCards projects={projects} />
        )}
      </main>
    </>
  );
}
