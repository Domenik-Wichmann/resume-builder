"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  projectContextSchema,
  type ProjectContext,
} from "@/lib/portfolio/project-context";

export function ProjectEvidence({
  ids,
  query = "",
  browse = false,
}: {
  ids: string[];
  query?: string;
  browse?: boolean;
}) {
  const [data, setData] = useState<ProjectContext>({ projects: [] });
  const key = ids
    .filter((id) => /^[a-f0-9-]{36}$/i.test(id))
    .slice(0, 12)
    .join(",");
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch("/api/project-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: key.split(","),
        query: query.slice(0, 1000),
        browse,
      }),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok) {
          const result = projectContextSchema.parse(await response.json());
          if (!controller.signal.aborted) setData(result);
        }
      })
      .catch(() => {
        /* An attachment failure must not hide the grounded answer. */
      });
    return () => controller.abort();
  }, [key, query, browse]);
  if (!data.projects.length) return null;
  return (
    <div
      className="project-evidence"
      aria-label="Related project pages and screenshots"
    >
      {data.projects.map((project) => (
        <section key={project.url}>
          <Link className="project-evidence-link" href={project.url}>
            {project.title} <span aria-hidden="true">↗</span>
          </Link>
          {project.links.length > 0 && (
            <ul>
              {project.links.map((link) => (
                <li key={`${link.label}:${link.url}`}>
                  <a href={link.url} rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="project-evidence-images">
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
          </div>
        </section>
      ))}
    </div>
  );
}
