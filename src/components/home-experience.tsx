"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PortfolioIntro, type IntroStory } from "./portfolio-intro";
import { CareerChat, type HeroSubmission } from "./career-chat";
import type { Presentation } from "@/lib/markets";
import type { ResumeDesign } from "@/lib/resume-design/model";
import type { PortfolioProjectCard } from "@/lib/portfolio/selection";
import {
  initialInputKind,
  submitComposerOnEnter,
} from "@/lib/workspaces/input";

export function HomeExperience({
  story,
  presentation,
  design,
  projects = [],
}: {
  story: IntroStory;
  presentation: Presentation;
  design?: ResumeDesign;
  projects?: PortfolioProjectCard[];
}) {
  const [input, setInput] = useState("");
  const heroMessage = useRef<HTMLTextAreaElement>(null);
  const [request, setRequest] = useState<HeroSubmission>();
  const [busy, setBusy] = useState(false);
  const kind = initialInputKind(input);
  const tooLong = kind === "ask" && input.length > 1000;
  const canSubmit = !busy && input.trim().length >= 3 && !tooLong;
  useEffect(() => {
    const conversation = document.querySelector<HTMLElement>(
      ".homepage-conversation",
    );
    if (!conversation) return;
    let accumulated = 0;
    let previousTime = 0;
    let settling = false;
    let release = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (!delta) return;
      // Replies and panels keep their own scrolling until their edge is reached.
      for (
        let node = event.target instanceof Element ? event.target : null;
        node && node !== document.body;
        node = node.parentElement
      ) {
        if (
          /auto|scroll/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1 &&
          (delta > 0
            ? node.scrollTop + node.clientHeight < node.scrollHeight - 1
            : node.scrollTop > 1)
        )
          return;
      }
      const chatTop = window.scrollY + conversation.getBoundingClientRect().top;
      const heroEnd = Math.max(0, chatTop - innerHeight);
      const forward =
        delta > 0 && scrollY >= heroEnd - 2 && scrollY < chatTop - 2;
      const backward = delta < 0 && Math.abs(scrollY - chatTop) < 2;
      if (!settling && !forward && !backward) {
        accumulated = 0;
        return;
      }
      event.preventDefault();
      if (settling) return;
      const now = performance.now();
      if (
        now - previousTime > 250 ||
        Math.sign(accumulated) !== Math.sign(delta)
      )
        accumulated = 0;
      previousTime = now;
      accumulated += delta;
      if (Math.abs(accumulated) < 100) return;
      accumulated = 0;
      settling = true;
      window.scrollTo({
        top: forward ? chatTop : heroEnd,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      release = window.setTimeout(() => {
        settling = false;
      }, 800);
    };
    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", wheel);
      window.clearTimeout(release);
    };
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setRequest((previous) => ({ id: (previous?.id || 0) + 1, input, kind }));
    setInput("");
    const conversation = document.getElementById("ask");
    if (conversation)
      window.scrollTo({
        top: window.scrollY + conversation.getBoundingClientRect().top,
        behavior: "instant",
      });
  }
  return (
    <>
      <PortfolioIntro
        story={story}
        presentation={presentation}
        projects={projects}
        composer={
          <form
            className="hero-composer wrap"
            onSubmit={submit}
            aria-label="Start a career conversation"
          >
            <label htmlFor="hero-message" className="hero-knowledge-label">
              Chat directly with my <span>career knowledge base</span>
            </label>
            <div className="hero-input-shell">
              <textarea
                ref={heroMessage}
                id="hero-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => submitComposerOnEnter(event, canSubmit)}
                placeholder="Ask about my projects, skills, or experience—or paste a job description to compare."
                aria-describedby="hero-message-help"
                rows={2}
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
                    : "Explore my experience"
                }
                data-analytics-action={
                  kind === "match" ? "create_workspace" : "question"
                }
              >
                <span>{busy ? "Opening chat" : "Explore my experience"}</span>
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
            <div
              className="hero-question-examples"
              role="group"
              aria-label="Example career questions"
            >
              <span>Try asking:</span>
              {[
                [
                  "Where has he used SQL?",
                  "In which implementations has he used SQL, and what did he build with it?",
                ],
                [
                  "What languages does he speak?",
                  "Which languages does he speak, and how has he used them professionally?",
                ],
                [
                  "What has he automated?",
                  "What operational workflows has he automated? Show concrete examples.",
                ],
              ].map(([label, question]) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setInput(question);
                    heroMessage.current?.focus({ preventScroll: true });
                  }}
                >
                  {label}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
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
