import Image from "next/image";
import Link from "next/link";
import type { ShowcaseCard } from "@/lib/portfolio/selection";

export function ProjectCards({ projects }: { projects: ShowcaseCard[] }) {
  return (
    <div className="selected-project-grid">
      {projects.map((project, index) => (
        <Link
          href={`/projects/${project.slug}`}
          className="selected-project-card"
          key={project.slug}
        >
          {project.cover ? (
            <Image
              unoptimized
              width={1200}
              height={800}
              src={`/media/${project.cover.id}`}
              alt={project.cover.alt}
              loading="lazy"
            />
          ) : (
            <div className="selected-project-art" aria-hidden="true">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{project.title}</strong>
              <span>↗</span>
            </div>
          )}
          <div className="selected-project-copy">
            <h3>{project.title}</h3>
            {project.subtitle && (
              <p className="selected-project-subtitle">{project.subtitle}</p>
            )}
            <p className="selected-project-summary">{project.summary}</p>
            <span className="selected-project-link">
              Explore project <span aria-hidden="true">↗</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
