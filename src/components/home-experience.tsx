"use client";
import { useState, type FormEvent } from "react";
import { PortfolioIntro, type IntroStory } from "./portfolio-intro";
import { CareerChat, type HeroSubmission } from "./career-chat";
import type { Presentation } from "@/lib/markets";
import type { ResumeDesign } from "@/lib/resume-design/model";
import {
  initialInputKind,
  submitComposerOnEnter,
} from "@/lib/workspaces/input";

export function HomeExperience({
  story,
  presentation,
  design,
}: {
  story: IntroStory;
  presentation: Presentation;
  design?: ResumeDesign;
}) {
  const [input, setInput] = useState("");
  const [request, setRequest] = useState<HeroSubmission>();
  const [busy, setBusy] = useState(false);
  const kind = initialInputKind(input);
  const tooLong = kind === "ask" && input.length > 1000;
  const canSubmit = !busy && input.trim().length >= 3 && !tooLong;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setRequest((previous) => ({ id: (previous?.id || 0) + 1, input, kind }));
    setInput("");
    document.getElementById("ask")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  return (
    <>
      <PortfolioIntro
        story={story}
        presentation={presentation}
        composer={
          <form
            className="hero-composer wrap"
            onSubmit={submit}
            aria-label="Start a career conversation"
          >
            <label htmlFor="hero-message">What do you want to know?</label>
            <div className="hero-input-shell">
              <textarea
                id="hero-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => submitComposerOnEnter(event, canSubmit)}
                placeholder="Ask about my career, skills & experience. Or paste a job description to compare."
                aria-describedby="hero-message-help"
                rows={3}
                maxLength={12000}
                readOnly={busy}
              />
              <button
                className="hero-send"
                type="submit"
                disabled={!canSubmit}
                aria-busy={busy}
                aria-label={
                  kind === "match"
                    ? "Compare job in chat"
                    : "Send question to chat"
                }
                data-analytics-action={
                  kind === "match" ? "create_workspace" : "question"
                }
              >
                <span>{busy ? "Opening chat" : "Let’s talk"}</span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12h14M13 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="hero-composer-footer">
              <p id="hero-message-help">
                {tooLong ? (
                  "Questions can be up to 1,000 characters. Job descriptions are detected automatically."
                ) : (
                  <>
                    {story.demo
                      ? "Fictional demo; saved in this browser."
                      : "Saved privately; visible to me."}{" "}
                    <a href="/privacy">Privacy</a>
                  </>
                )}
              </p>
            </div>
          </form>
        }
      />
      <div className="homepage-conversation">
        <CareerChat
          design={design}
          heroSubmission={request}
          onBusyChange={setBusy}
        />
      </div>
    </>
  );
}
