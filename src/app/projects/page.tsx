import Link from "next/link";
import Image from "next/image";
import { publicProjects, projectMedia } from "@/lib/portfolio/repository";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { PortfolioHeader } from "@/components/portfolio-shell";
export const dynamic = "force-dynamic";
export const metadata = { title: "Projects · Resume Builder" };
export default async function Projects() {
  const projects = await publicProjects();
  const media = projects.length
    ? await projectMedia(database(), primaryAccountId)
    : [];
  return (
    <>
      <PortfolioHeader />
      <main className="wrap portfolio-main">
        <p className="eyebrow">Work, in context</p>
        <h1>Projects & case studies.</h1>
        <p className="lead">
          Approved work, the ideas behind it, and the evidence it contributes.
        </p>
        {!projects.length ? (
          <div className="empty-state">
            <h2>No projects published yet.</h2>
            <p>
              Projects appear here after their owner reviews and publishes them.
            </p>
            <Link href="/explore">Explore published skills →</Link>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              const cover = media.find(
                (m) => m.project_id === p.id && m.is_cover,
              );
              return (
                <Link
                  href={`/projects/${p.slug}`}
                  className="project-card"
                  key={p.id}
                >
                  {cover && (
                    <Image
                      unoptimized
                      width={1200}
                      height={800}
                      src={`/media/${cover.id}`}
                      alt={cover.alt}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <p className="eyebrow">
                      {p.featured ? "Featured · " : ""}
                      {p.status.toLowerCase()}
                    </p>
                    <h2>{p.title}</h2>
                    <p>{p.summary}</p>
                    <span className="text-link">View project ↗</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
