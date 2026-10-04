import Link from "next/link";
import Image from "next/image";
import { SafeMarkdown } from "./safe-markdown";
import type { Project, ProjectMedia } from "@/lib/portfolio/model";
export function ProjectDisplay({
  project,
  media,
  skills,
  outcomes,
}: {
  project: Project;
  media: ProjectMedia[];
  skills: string[];
  outcomes: string[];
}) {
  const cover = media.find((m) => m.is_cover);
  return (
    <article className="project-detail">
      <p className="eyebrow">
        {project.status.replaceAll("_", " ")}
        {project.organization ? ` · ${project.organization}` : ""}
      </p>
      <h1>{project.title}</h1>
      <p className="lead">{project.summary}</p>
      {cover && (
        <figure>
          <Image
            unoptimized
            width={1200}
            height={800}
            className="project-cover"
            src={`/media/${cover.id}`}
            alt={cover.alt}
          />
          {cover.caption && <figcaption>{cover.caption}</figcaption>}
        </figure>
      )}
      {(project.start_date || project.end_date) && (
        <p className="muted">
          {project.start_date || "Start date not recorded"} —{" "}
          {project.end_date || "End date not recorded"}
        </p>
      )}
      <div className="project-layout">
        <div>
          <SafeMarkdown text={project.description} />
          {outcomes.length > 0 && (
            <section>
              <h2>Selected outcomes</h2>
              <ul>
                {outcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>
          )}
          {media
            .filter((m) => !m.is_cover)
            .map((m) => (
              <figure key={m.id}>
                <Image
                  unoptimized
                  width={1200}
                  height={800}
                  className="project-cover"
                  src={`/media/${m.id}`}
                  alt={m.alt}
                  loading="lazy"
                />
                {m.caption && <figcaption>{m.caption}</figcaption>}
              </figure>
            ))}
        </div>
        <aside className="surface">
          <h2>Supporting skills</h2>
          {skills.length ? (
            <div className="chips">
              {skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          ) : (
            <p>No published skill associations yet.</p>
          )}
          <div className="stack">
            {project.links.map((l, i) => (
              <a
                className="text-link"
                href={l.url}
                key={i}
                rel={
                  l.url.startsWith("https:") ? "noopener noreferrer" : undefined
                }
              >
                {l.label} ↗
              </a>
            ))}
            <Link href="/explore">Explore career evidence →</Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
