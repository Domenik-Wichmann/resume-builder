import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";
import type { Presentation } from "@/lib/markets";
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
}: {
  story: IntroStory;
  presentation: Presentation;
  composer?: ReactNode;
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
      <header className="site-header wrap">
        <Link className="wordmark" href="/">
          Domenik Wichmann
        </Link>
        <Link className="personal-resume-link" href="/resume">
          View résumé ↗
        </Link>
      </header>
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
      <nav className="hero-projects wrap" aria-label="Featured projects">
        <Link
          className="hero-project-card"
          href="/projects/configurable-excel-and-vba-rules-engine-78ff38898c"
        >
          <Image
            className="hero-project-preview"
            src="/images/projects/babycat-dashboard.jpg"
            width={160}
            height={110}
            alt=""
          />
          <span className="hero-project-copy">
            <strong>BabyCat</strong>
            <span>Catalogs, rules & automation</span>
            <small>
              Explore project <span aria-hidden="true">↗</span>
            </small>
          </span>
        </Link>
        <Link
          className="hero-project-card"
          href="/projects/multilingual-onboarding-and-mini-lms-51f0eca038"
        >
          <Image
            className="hero-project-preview"
            src="/images/projects/systemwright-lms.jpg"
            width={160}
            height={110}
            alt=""
          />
          <span className="hero-project-copy">
            <strong>SystemWright LMS</strong>
            <span>Interactive, multilingual learning</span>
            <small>
              Explore project <span aria-hidden="true">↗</span>
            </small>
          </span>
        </Link>
        <Link className="hero-project-card" href="/projects/kernel">
          <Image
            className="hero-project-preview"
            src="/images/projects/kernel-planner-preview.svg"
            width={160}
            height={110}
            alt=""
          />
          <span className="hero-project-copy">
            <strong>Kernel</strong>
            <span>Household meal planning</span>
            <small>
              Explore project <span aria-hidden="true">↗</span>
            </small>
          </span>
        </Link>
        <Link
          className="hero-project-card"
          href="/projects/sonaway-operational-knowledge-product-eb8c2d879b"
        >
          <Image
            className="hero-project-preview"
            src="/images/projects/sonaway-knowledge-preview.svg"
            width={160}
            height={110}
            alt=""
          />
          <span className="hero-project-copy">
            <strong>Sonaway</strong>
            <span>Connected operational knowledge</span>
            <small>
              Explore project <span aria-hidden="true">↗</span>
            </small>
          </span>
        </Link>
        <Link className="hero-more-projects" href="/projects">
          Explore more projects <span aria-hidden="true">↗</span>
        </Link>
      </nav>
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
