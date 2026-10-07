"use client";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";
import type { Presentation } from "@/lib/markets";
import {
  finalStoryStep,
  portfolioPremise,
  portfolioPremiseDescription,
  portfolioPayoff,
  storyScenes,
} from "@/lib/portfolio/story-scenes";
import { CaseStudyArt } from "./portfolio-case-study-art";
import { useStoryNavigation } from "./story-navigation";

export function PortfolioStoryHero({
  story,
  presentation,
}: {
  story: PortfolioStory;
  presentation: Presentation;
}) {
  const { root, step, navigate, chat } = useStoryNavigation();
  const ask = (question: string) => {
    chat();
    window.dispatchEvent(
      new CustomEvent("portfolio-question", { detail: question }),
    );
  };
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
              Fictional career data. Product visuals are demonstrations.
            </span>
          </div>
        )}
        <header className="site-header wrap story-header">
          <Link className="wordmark" href="/">
            career<span> / </span>connected.
          </Link>
          <span className="story-header-context">
            Resume Builder / project case study
          </span>
        </header>
        <section
          className="story-stage wrap"
          aria-label="The person and the product"
        >
          {storyScenes.map((scene, index) => (
            <div
              className="story-scene"
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
                      {story.profile.name || "A story taking shape."}
                      <span>
                        {story.profile.title ||
                          "Career profile pending publication."}
                      </span>
                    </h1>
                    <p className="story-premise">{portfolioPremise}</p>
                    <p className="story-description story-product-intro">
                      {portfolioPremiseDescription}
                    </p>
                    <p className="story-recursive-payoff">{portfolioPayoff}</p>
                    <p className="story-description story-profile-intro">
                      {story.profile.introduction}
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
                      <button type="button" onClick={() => navigate(1)}>
                        See how I built it <span aria-hidden="true">→</span>
                      </button>
                      <Link href="/resume">View résumé ↗</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>{scene.title}</h2>
                    <p className="story-description">{scene.description}</p>
                    {index === finalStoryStep && (
                      <>
                        <a
                          className="button story-cta"
                          href="#ask"
                          onClick={(event) => {
                            event.preventDefault();
                            chat();
                          }}
                        >
                          Explore my experience ↗
                        </a>
                        <p className="story-hint">
                          Or scroll once more to start exploring.
                        </p>
                      </>
                    )}
                    <p className="story-footnote">{scene.footnote}</p>
                  </>
                )}
              </div>
              <div className={`story-art story-art-${index}`}>
                {index === 0 && (
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
                              .join("") || "✧"}
                          </span>
                          <small>Portrait coming soon</small>
                        </div>
                      )}
                    </div>
                    <div className="portrait-caption">
                      <span className="status-dot" />{" "}
                      {story.demo
                        ? "Fictional demo profile"
                        : "Evidence behind the experience"}
                      <span>↗</span>
                    </div>
                  </div>
                )}
                {index > 0 && index < finalStoryStep && (
                  <CaseStudyArt step={index} story={story} />
                )}
                {index === finalStoryStep && (
                  <div className="invitation-art">
                    <div className="invitation-mark" aria-hidden="true">
                      ✧
                    </div>
                    <div className="artifact-label">
                      A conversation shaped around your team
                    </div>
                    <div className="story-questions">
                      {story.questions.map((question) => (
                        <button
                          key={question}
                          onClick={() => ask(question)}
                          aria-label={`Draft question: ${question}`}
                        >
                          <span>{question}</span>
                          <span aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                    <small>Choose a question to draft it in chat.</small>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
        <div className="story-navigation wrap">
          <span className="story-count" aria-live="polite">
            0{step + 1} <span>/ 0{storyScenes.length}</span>
          </span>
          <nav aria-label="Story chapters">
            {storyScenes.map((scene, index) => (
              <button
                key={scene.chapter}
                aria-current={step === index ? "step" : undefined}
                onClick={() => navigate(index)}
              >
                <span className="chapter-line" />
                <span>{scene.chapter}</span>
              </button>
            ))}
          </nav>
          <div className="story-arrows">
            <button
              aria-label="Previous chapter"
              disabled={step === 0}
              onClick={() => navigate(step - 1)}
            >
              ←
            </button>
            <button
              aria-label={
                step === finalStoryStep
                  ? "Explore my experience in chat"
                  : "Next chapter"
              }
              onClick={() =>
                step === finalStoryStep ? chat() : navigate(step + 1)
              }
            >
              →
            </button>
          </div>
        </div>
        <noscript>
          <style>{`.story-runway { height: auto; } .story-pin { position: relative; height: auto; min-height: 100svh; }`}</style>
          <p className="wrap">
            This portfolio is a working Resume Builder application. Enable
            JavaScript for its interactive project tour.
          </p>
        </noscript>
      </div>
    </div>
  );
}
