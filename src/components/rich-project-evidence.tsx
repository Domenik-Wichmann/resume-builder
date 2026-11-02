"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProjectContext } from "@/lib/portfolio/project-context";
import styles from "./rich-project-evidence.module.css";

type Projects = ProjectContext["projects"];
export function RichProjectEvidence({ projects }: { projects: Projects }) {
  const [view, setView] = useState<"cards" | "connections">("cards");
  const [skill, setSkill] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const skills = [...new Set(projects.flatMap((p) => p.skills))].slice(0, 8);
  const shown = projects.filter(
    (p) =>
      (!skill || p.skills.includes(skill)) &&
      (!projectUrl || p.url === projectUrl),
  );
  const reset = () => {
    setSkill("");
    setProjectUrl("");
  };
  const height = Math.max(projects.length, skills.length) * 64 + 12;
  return (
    <section
      className={styles.evidence}
      aria-label="Projects connected to this answer"
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Explore the work</p>
          <h3>Projects behind the answer</h3>
        </div>
        {skills.length > 0 && (
          <div
            className={styles.switch}
            role="group"
            aria-label="Project evidence view"
          >
            <button
              type="button"
              aria-pressed={view === "cards"}
              onClick={() => {
                setView("cards");
                reset();
              }}
            >
              Cards
            </button>
            <button
              type="button"
              aria-pressed={view === "connections"}
              onClick={() => setView("connections")}
            >
              Connections
            </button>
          </div>
        )}
      </div>
      {view === "connections" && (
        <div className={styles.connections}>
          <p>
            Follow a project or skill. Lines show published project–skill links.
          </p>
          <div
            className={styles.graph}
            style={{ height }}
            aria-label="Project and skill connection map"
          >
            <svg
              viewBox={`0 0 700 ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {projects.flatMap((project, i) =>
                skills.map((name, j) =>
                  project.skills.includes(name) ? (
                    <path
                      key={`${i}-${j}`}
                      d={`M245 ${i * 64 + 30} C350 ${i * 64 + 30},350 ${j * 64 + 30},455 ${j * 64 + 30}`}
                      className={
                        (!skill || skill === name) &&
                        (!projectUrl || projectUrl === project.url)
                          ? styles.activeEdge
                          : styles.edge
                      }
                    />
                  ) : null,
                ),
              )}
            </svg>
            {projects.map((p, i) => (
              <button
                type="button"
                key={p.url}
                className={styles.projectNode}
                style={{ top: i * 64 + 6 }}
                aria-pressed={projectUrl === p.url}
                onClick={() => {
                  setProjectUrl(projectUrl === p.url ? "" : p.url);
                  setSkill("");
                }}
              >
                {p.title}
              </button>
            ))}
            {skills.map((name, i) => (
              <button
                type="button"
                key={name}
                className={styles.skillNode}
                style={{ top: i * 64 + 6 }}
                aria-pressed={skill === name}
                onClick={() => {
                  setSkill(skill === name ? "" : name);
                  setProjectUrl("");
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
      {(skill || projectUrl) && (
        <div className={styles.filter} role="status">
          Showing{" "}
          {skill ? `projects linked to ${skill}` : "the selected project"}
          <button type="button" onClick={reset}>
            Show all
          </button>
        </div>
      )}
      <div className={styles.cards}>
        {shown.map((project) => (
          <article className={styles.card} key={project.url}>
            <Link
              href={project.url}
              className={styles.preview}
              aria-label={`Explore ${project.title}`}
            >
              {project.preview ? (
                <Image
                  unoptimized
                  src={project.preview.src}
                  alt={project.preview.alt}
                  width={640}
                  height={400}
                  loading="lazy"
                />
              ) : (
                <span className={styles.placeholder} aria-hidden="true">
                  ↗
                </span>
              )}
              {project.preview && (
                <span className={styles.imageLabel}>
                  {project.preview.label}
                </span>
              )}
            </Link>
            <div className={styles.copy}>
              <Link href={project.url} className={styles.title}>
                {project.title} <span aria-hidden="true">↗</span>
              </Link>
              {project.summary && (
                <p className={styles.summary}>{project.summary}</p>
              )}
              {project.skills.length > 0 && (
                <ul
                  className={styles.skills}
                  aria-label="Published skill links"
                >
                  {project.skills.slice(0, 4).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
              {(project.highlights.length > 0 || project.links.length > 0) && (
                <details className={styles.details}>
                  <summary>Look inside the project</summary>
                  {project.highlights.length > 0 && (
                    <ul>
                      {project.highlights.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <div className={styles.links}>
                    {project.links.map((link) => (
                      <a
                        href={link.url}
                        key={`${link.label}:${link.url}`}
                        rel="noopener noreferrer"
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </details>
              )}
              {project.images.length > 0 && (
                <details className={styles.details}>
                  <summary>
                    View related screens ({project.images.length})
                  </summary>
                  {project.images.map((image) => (
                    <figure key={image.id}>
                      <Link href={`${project.url}#screenshot-${image.id}`}>
                        <Image
                          unoptimized
                          src={`/media/${image.id}`}
                          alt={image.alt}
                          width={640}
                          height={400}
                          loading="lazy"
                        />
                      </Link>
                      <figcaption>{image.caption || image.alt}</figcaption>
                    </figure>
                  ))}
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        Project links and skill associations come from the published portfolio.
        They provide context, not a proficiency score.
      </p>
    </section>
  );
}
