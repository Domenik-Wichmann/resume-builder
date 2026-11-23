import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";
import type { Presentation } from "@/lib/markets";
import type { PortfolioProjectCard } from "@/lib/portfolio/selection";
import {
  portfolioIntroDescription,
  portfolioIntroTitle,
} from "@/lib/portfolio/story-scenes";

export type IntroStory = Pick<
  PortfolioStory,
  "profile" | "highlights" | "demo"
>;
export function PortfolioIntro({
  story,
  presentation,
  composer,
  projects = [],
}: {
  story: IntroStory;
  presentation: Presentation;
  composer?: ReactNode;
  projects?: PortfolioProjectCard[];
}) {
  return (
    <section
      className="hero-screen personal-hero"
      aria-labelledby="personal-intro-heading"
    >
      {story.demo && (
        <div className="demo-banner">
          DEMO PORTFOLIO · Fictional career facts. The display name is Domenik
          Wichmann.
        </div>
      )}
      <section
        className="hero-projects-panel wrap"
        aria-labelledby="selected-projects-heading"
      >
        <header className="hero-projects-heading">
          <h2 id="selected-projects-heading">Selected projects</h2>
          <p>What I built, how it works, and the skills behind it.</p>
          <Link className="hero-more-projects" href="/projects">
            More Projects
          </Link>
        </header>
        <nav className="hero-projects" aria-label="Selected projects">
          {projects.map((project) => {
            const image =
              project.previewSrc ||
              (project.cover ? `/media/${project.cover.id}` : null);
            return (
              <Link
                className="hero-project-card"
                href={`/projects/${project.slug}`}
                key={project.slug}
              >
                {image && (
                  <Image
                    unoptimized
                    className="hero-project-preview"
                    src={image}
                    width={160}
                    height={110}
                    alt=""
                  />
                )}
                <span className="hero-project-copy">
                  <strong>{project.title}</strong>
                  <span>{project.subtitle}</span>
                  <small>
                    Explore project <span aria-hidden="true">↗</span>
                  </small>
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
      <div className="profile-hero wrap">
        <div className="personal-intro-copy">
          <p className="eyebrow">
            <span className="status-dot" /> The person behind the work
          </p>
          <h1 id="personal-intro-heading">
            {story.profile.name || "Career profile pending publication."}
            <span>{portfolioIntroTitle}</span>
          </h1>
          <p className="hero-intro">{portfolioIntroDescription}</p>
          <div className="personal-highlights">
            {story.highlights.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
          <div className="hero-contact">
            {[
              presentation.location,
              presentation.address,
              presentation.work_authorization,
            ]
              .filter(Boolean)
              .map((text) => (
                <span key={text}>{text}</span>
              ))}
            {presentation.contact_email && (
              <a href={`mailto:${presentation.contact_email}`}>
                {presentation.contact_email}
              </a>
            )}
            {presentation.phone && (
              <a href={`tel:${presentation.phone.replace(/[^+\d]/g, "")}`}>
                {presentation.phone}
              </a>
            )}
            <Link className="personal-resume-link" href="/resume">
              View résumé ↗
            </Link>
          </div>
        </div>
        <div className="hero-portrait personal-portrait">
          <div className="portrait-orbit" />
          <div className="portrait-frame">
            {presentation.photo_url ? (
              <Image
                src={presentation.photo_url}
                alt={`Portrait of ${story.profile.name}`}
                width={600}
                height={720}
                unoptimized
                preload
              />
            ) : (
              <div className="portrait-initials">
                <span>
                  {story.profile.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("") || "DW"}
                </span>
                <small>Portrait coming soon</small>
              </div>
            )}
          </div>
          <div className="portrait-caption">
            <span className="status-dot" />{" "}
            {story.demo
              ? "Illustrative demo profile"
              : "The person behind the work"}
          </div>
        </div>
      </div>
      {composer || (
        <a
          className="personal-scroll-cue"
          href="#ask"
          data-analytics-action="open_chat"
        >
          Scroll to explore my experience <span aria-hidden="true">↓</span>
        </a>
      )}
    </section>
  );
}
