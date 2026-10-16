"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";
import { finalStoryStep, storyScenes } from "@/lib/portfolio/story-scenes";
import { CaseStudyArt } from "./portfolio-case-study-art";
import { PortfolioQuestionExamples } from "./portfolio-question-examples";
import { useStoryNavigation } from "./story-navigation";

const firstStep = 1;
const chapters = storyScenes.slice(firstStep);

export function PortfolioStoryHero({ story }: { story: PortfolioStory }) {
  const {
    root,
    step,
    navigate,
    chat: continueToDetails,
    mobile,
  } = useStoryNavigation({ firstStep, targetId: "project-details" });
  return (
    <div
      ref={root}
      className="story-runway project-story-runway"
      style={
        {
          "--story-scroll-height": `${100 + 55 * (finalStoryStep - firstStep)}svh`,
        } as CSSProperties
      }
    >
      <div className="story-pin">
        {story.demo && (
          <div className="demo-banner">
            DEMO PROJECT WALKTHROUGH · Fictional career facts.
          </div>
        )}
        <header className="site-header wrap story-header">
          <Link className="wordmark" href="/">
            Domenik Wichmann
          </Link>
          <Link className="story-header-context" href="/projects">
            ← All projects
          </Link>
        </header>
        <section
          className="story-stage wrap"
          aria-label="Resume Builder project walkthrough"
        >
          {chapters.map((scene, position) => {
            const index = position + firstStep;
            const Heading = index === firstStep ? "h1" : "h2";
            return (
              <div
                className={`story-scene story-scene-${index}`}
                key={scene.chapter}
                hidden={!mobile && step !== index}
              >
                <div className="story-copy">
                  <p className="eyebrow">
                    <span className="status-dot" /> Resume Builder /{" "}
                    {scene.chapter}
                  </p>
                  <Heading>{scene.title}</Heading>
                  <p className="story-description">{scene.description}</p>
                  <p className="story-footnote">{scene.footnote}</p>
                </div>
                <div className={`story-art story-art-${index}`}>
                  {index < finalStoryStep ? (
                    <CaseStudyArt step={index} story={story} />
                  ) : (
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
            );
          })}
        </section>
        {step === finalStoryStep && (
          <div className="story-handoff story-final-handoff wrap">
            <Link
              className="button story-projects-cta"
              href="/#ask"
              data-analytics-action="open_chat"
            >
              Explore my experience <span aria-hidden="true">↗</span>
            </Link>
            <a
              className="button story-cta"
              href="#project-details"
              onClick={(event) => {
                event.preventDefault();
                continueToDetails();
              }}
            >
              Read the project details <span aria-hidden="true">↓</span>
            </a>
            <p>Continue scrolling for the full case study.</p>
          </div>
        )}
        <div className="story-navigation wrap">
          <span className="story-count" aria-live="polite">
            {String(step - firstStep + 1).padStart(2, "0")}{" "}
            <span>/ {String(chapters.length).padStart(2, "0")}</span>
          </span>
          <nav aria-label="Story chapters">
            {chapters.map((scene, position) => {
              const index = position + firstStep;
              return (
                <button
                  type="button"
                  key={scene.chapter}
                  data-analytics-action="story_scene"
                  aria-label={`${position + 1}. ${scene.chapter}`}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => navigate(index)}
                >
                  <span className="chapter-line" />
                  <span className="chapter-name">{scene.chapter}</span>
                </button>
              );
            })}
          </nav>
          <div className="story-arrows">
            <button
              type="button"
              aria-label="Previous chapter"
              data-analytics-action="story_previous"
              disabled={step === firstStep}
              onClick={() => navigate(step - 1)}
            >
              <span aria-hidden="true">←</span> <span>Previous</span>
            </button>
            <button
              type="button"
              aria-label={
                step === finalStoryStep
                  ? "Continue to project details"
                  : "Next chapter"
              }
              data-analytics-action="story_next"
              onClick={() =>
                step === finalStoryStep
                  ? continueToDetails()
                  : navigate(step + 1)
              }
            >
              <span>
                {step === finalStoryStep ? "Project details" : "Next chapter"}
              </span>{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <noscript>
          <style>{`.project-story-runway { height: auto; } .project-story-runway .story-pin { position: relative; height: auto; } .project-story-runway .story-scene[hidden] { display: grid; }`}</style>
          <p className="wrap">
            Scroll through the project walkthrough and case study.
          </p>
        </noscript>
      </div>
    </div>
  );
}
