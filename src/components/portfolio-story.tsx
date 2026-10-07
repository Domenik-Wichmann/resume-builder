"use client";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";
import type { Presentation } from "@/lib/markets";
import {
  finalStoryStep,
  storyScenes,
  portfolioIntroTitle,
  portfolioIntroDescription,
} from "@/lib/portfolio/story-scenes";
import { CaseStudyArt } from "./portfolio-case-study-art";
import { PortfolioQuestionExamples } from "./portfolio-question-examples";
import { useStoryNavigation } from "./story-navigation";

export function PortfolioStoryHero({
  story,
  presentation,
}: {
  story: PortfolioStory;
  presentation: Presentation;
}) {
  const { root, step, navigate, chat } = useStoryNavigation();
  return (
    <div
      ref={root}
      className="story-runway"
      style={
        {
          "--story-scroll-height": `${100 + 55 * finalStoryStep}svh`,
        } as CSSProperties
      }
    >
      <div className="story-pin">
        {story.demo && (
          <div className="demo-banner">
            DEMO PORTFOLIO{" "}
            <span>
              Fictional career facts. The display name is Domenik Wichmann.
            </span>
          </div>
        )}
        <header className="site-header wrap story-header">
          <Link className="wordmark" href="/">
            career<span> / </span>connected.
          </Link>
          <span className="story-header-context">
            {step === 0
              ? `Portfolio / ${story.profile.name}`
              : "Resume Builder / project walkthrough"}
          </span>
        </header>
        <section
          className="story-stage wrap"
          aria-label="Domenik and the portfolio project"
        >
          {storyScenes.map((scene, index) => (
            <div
              className={`story-scene story-scene-${index}`}
              key={scene.chapter}
              hidden={step !== index}
            >
              <div className="story-copy">
                <p className="eyebrow">
                  <span className="status-dot" />{" "}
                  {index === 0
                    ? "The person behind the work"
                    : `Resume Builder / ${scene.chapter}`}
                </p>
                {index === 0 ? (
                  <>
                    <h1>
                      {story.profile.name ||
                        "Career profile pending publication."}
                      <span>{portfolioIntroTitle}</span>
                    </h1>
                    <p className="story-description story-profile-intro">
                      {portfolioIntroDescription}
                    </p>
                    <p className="story-personal-invitation">
                      Explore the work and projects behind my skills.
                    </p>
                    <div className="story-highlights">
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
                        <a
                          href={`tel:${presentation.phone.replace(/[^+\d]/g, "")}`}
                        >
                          {presentation.phone}
                        </a>
                      )}
                    </div>
                    <div className="story-links">
                      <Link href="/resume">View résumé</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>{scene.title}</h2>
                    <p className="story-description">{scene.description}</p>
                    <p className="story-footnote">{scene.footnote}</p>
                  </>
                )}
              </div>
              <div className={`story-art story-art-${index}`}>
                {index === 0 && (
                  <div className="portrait-layout">
                    <div className="hero-portrait">
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
                )}
                {index > 0 && index < finalStoryStep && (
                  <CaseStudyArt step={index} story={story} />
                )}
                {index === finalStoryStep && (
                  <div className="invitation-art">
                    <div className="artifact-label">
                      Example questions / expand to read
                    </div>
                    <PortfolioQuestionExamples
                      examples={story.questionExamples}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
        {step === 0 && (
          <div className="story-handoff story-intro-handoff wrap">
            <button
              type="button"
              className="story-intro-next"
              onClick={() => navigate(1)}
            >
              More about me &amp; this project{" "}
              <span aria-hidden="true">{"\u2193"}</span>
            </button>
          </div>
        )}
        {step === finalStoryStep && (
          <div className="story-handoff wrap">
            <a
              className="button story-cta"
              href="#ask"
              onClick={(event) => {
                event.preventDefault();
                chat();
              }}
            >
              Explore my experience <span aria-hidden="true">{"\u2193"}</span>
            </a>
            <p>Or continue scrolling to the conversation.</p>
          </div>
        )}
        <div className="story-navigation wrap">
          <span className="story-count" aria-live="polite">
            {String(step + 1).padStart(2, "0")}{" "}
            <span>/ {String(storyScenes.length).padStart(2, "0")}</span>
          </span>
          <nav aria-label="Story chapters">
            {storyScenes.map((scene, index) => (
              <button
                type="button"
                key={scene.chapter}
                aria-label={`${index + 1}. ${scene.chapter}`}
                aria-current={step === index ? "step" : undefined}
                onClick={() => navigate(index)}
              >
                <span className="chapter-line" />
                <span className="chapter-name">{scene.chapter}</span>
              </button>
            ))}
          </nav>
          <div className="story-arrows">
            <button
              type="button"
              aria-label="Previous chapter"
              disabled={step === 0}
              onClick={() => navigate(step - 1)}
            >
              {"\u2191"}
            </button>
            <button
              type="button"
              aria-label={
                step === finalStoryStep
                  ? "Continue to the conversation"
                  : "Next chapter"
              }
              onClick={() =>
                step === finalStoryStep ? chat() : navigate(step + 1)
              }
            >
              {"\u2193"}
            </button>
          </div>
        </div>
        <noscript>
          <style>{`.story-runway { height: auto; } .story-pin { position: relative; height: auto; min-height: 100svh; }`}</style>
          <p className="wrap">
            Enable JavaScript for the interactive project walkthrough.
          </p>
        </noscript>
      </div>
    </div>
  );
}
