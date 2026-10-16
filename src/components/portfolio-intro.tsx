import Image from "next/image";
import Link from "next/link";
import type { PortfolioStory } from "@/lib/portfolio/story";
import type { Presentation } from "@/lib/markets";
import {
  portfolioIntroDescription,
  portfolioIntroTitle,
} from "@/lib/portfolio/story-scenes";

export function PortfolioIntro({
  story,
  presentation,
}: {
  story: PortfolioStory;
  presentation: Presentation;
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
          <div className="personal-hero-actions">
            <a className="button" href="#ask" data-analytics-action="open_chat">
              Explore my experience <span aria-hidden="true">↓</span>
            </a>
            <Link className="button secondary-button" href="/projects">
              Explore my projects <span aria-hidden="true">↗</span>
            </Link>
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
      <a
        className="personal-scroll-cue"
        href="#ask"
        data-analytics-action="open_chat"
      >
        Scroll to explore my experience <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}
