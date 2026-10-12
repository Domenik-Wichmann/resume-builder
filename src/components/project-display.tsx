import Link from "next/link";
import Image from "next/image";
import { SafeMarkdown } from "./safe-markdown";
import type { Project, ProjectMedia } from "@/lib/portfolio/model";
import { showcaseTitle } from "@/lib/portfolio/selection";
import type { CaseContent } from "@/lib/portfolio/case-study";
export function ProjectDisplay({
  project,
  media,
  skills,
  outcomes,
  content,
}: {
  project: Project;
  media: ProjectMedia[];
  skills: string[];
  outcomes: string[];
  content?: CaseContent;
}) {
  const cover = media.find((m) => m.is_cover);
  const links = content
    ? content.links.filter((link) => link.is_public)
    : project.links;
  return (
    <article className="project-detail case-study">
      <p className="eyebrow">
        {project.status === "OTHER"
          ? "Project case study"
          : project.status.replaceAll("_", " ")}
        {project.organization ? ` · ${project.organization}` : ""}
      </p>
      <h1>{content?.title || showcaseTitle(project)}</h1>
      {(content?.tagline || project.subtitle) && (
        <p className="case-tagline">{content?.tagline || project.subtitle}</p>
      )}
      <p className="lead">{content?.summary || project.summary}</p>
      <div className="case-primary-links">
        {links.map((link, index) => (
          <a
            className="button"
            key={index}
            href={link.url}
            rel="noopener noreferrer"
          >
            {link.label} <span aria-hidden="true">↗</span>
          </a>
        ))}
        <a className="secondary-button" href="#project-screenshots">
          Explore screenshots <span aria-hidden="true">↓</span>
        </a>
      </div>
      {cover && (
        <figure className="case-cover" id={`screenshot-${cover.id}`}>
          <a
            href={`/media/${cover.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full screenshot: ${cover.alt}`}
          >
            <Image
              unoptimized
              width={1200}
              height={800}
              className="project-cover"
              src={`/media/${cover.id}`}
              alt={cover.alt}
            />
          </a>
          {cover.caption && <figcaption>{cover.caption}</figcaption>}
        </figure>
      )}
      {(project.start_date || project.end_date) && (
        <p className="muted">
          {project.start_date || "Start date not recorded"} —{" "}
          {project.end_date || "End date not recorded"}
        </p>
      )}
      <div className="project-layout case-layout">
        <div>
          <section className="case-section" id="project-overview">
            <p className="eyebrow">The project</p>
            <h2>Overview</h2>
            <SafeMarkdown
              text={content?.overview || project.description || project.summary}
            />
          </section>
          {Boolean(content?.highlights.length) && (
            <section className="case-section">
              <p className="eyebrow">What’s involved</p>
              <h2>Capabilities &amp; features</h2>
              <ul className="case-highlights">
                {content!.highlights.map((value, index) => (
                  <li key={index}>
                    <SafeMarkdown text={value} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {content?.implementation && (
            <section className="case-section">
              <p className="eyebrow">Under the hood</p>
              <h2>How it works</h2>
              <SafeMarkdown text={content.implementation} />
            </section>
          )}
          {outcomes.length > 0 && (
            <section className="case-section">
              <h2>Outcomes</h2>
              <ul>
                {outcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>
          )}
          {Boolean(content?.limitations.length) && (
            <section className="case-section">
              <h2>Scope &amp; limitations</h2>
              <ul>
                {content!.limitations.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </section>
          )}
          <section
            className="case-section case-gallery"
            id="project-screenshots"
          >
            <p className="eyebrow">A closer look</p>
            <h2>Screenshots</h2>
            {!media.length && (
              <p className="muted">Screenshots will be added here.</p>
            )}
            {media
              .filter((m) => !m.is_cover)
              .map((m) => (
                <figure key={m.id} id={`screenshot-${m.id}`}>
                  <a
                    href={`/media/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open full screenshot: ${m.alt}`}
                  >
                    <Image
                      unoptimized
                      width={1200}
                      height={800}
                      className="project-cover"
                      src={`/media/${m.id}`}
                      alt={m.alt}
                      loading="lazy"
                    />
                  </a>
                  <figcaption>{m.caption || m.alt}</figcaption>
                </figure>
              ))}
            {cover && (
              <p>
                <a className="text-link" href={`#screenshot-${cover.id}`}>
                  View featured screenshot ↑
                </a>
              </p>
            )}
          </section>
        </div>
        <aside className="surface case-stack">
          <p className="eyebrow">Tools &amp; techniques</p>
          <h2>Skill stack</h2>
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
            {links.map((l, i) => (
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
