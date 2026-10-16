"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { finalStoryStep } from "@/lib/portfolio/story-scenes";
import { deliberateStoryExit, storyStep } from "@/lib/portfolio/story";

const completionKey = "resume-builder-story-completed-v1";
function savedCompletion() {
  try {
    return localStorage.getItem(completionKey) === "true";
  } catch {
    return false;
  }
}
function watchCompletion(changed: () => void) {
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
}
const serverCompletion = () => false;

export function useStoryNavigation({
  firstStep = 0,
  targetId = "ask",
}: { firstStep?: number; targetId?: string } = {}) {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(firstStep);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [completedHere, setCompleted] = useState(false);
  const completed =
    useSyncExternalStore(watchCompletion, savedCompletion, serverCompletion) ||
    completedHere;
  const [inStory, setInStory] = useState(true);
  const visited = useRef(new Set([firstStep]));
  const completionRecorded = useRef(false);
  const bypass = useRef(false);
  const stride = useRef(400);
  const current = useRef(firstStep);
  function visit(next: number, scrolled = false) {
    if (scrolled) {
      for (
        let i = Math.min(current.current, next);
        i <= Math.max(current.current, next);
        i++
      )
        visited.current.add(i);
    } else visited.current.add(next);
    current.current = next;
    setStep(next);
    if (
      visited.current.size === finalStoryStep - firstStep + 1 &&
      !completionRecorded.current
    ) {
      completionRecorded.current = true;
      setCompleted(true);
      try {
        localStorage.setItem(completionKey, "true");
      } catch {
        // Completion still works for this visit when browser storage is blocked.
      }
    }
  }
  function chat() {
    bypass.current = true;
    if (location.hash !== `#${targetId}`)
      history.pushState(null, "", `#${targetId}`);
    document.getElementById(targetId)?.scrollIntoView({
      behavior: reduced || targetId === "ask" ? "instant" : "smooth",
      block: "start",
    });
  }
  function navigate(next: number) {
    visit(next);
    if (mobile) {
      root.current
        ?.querySelectorAll<HTMLElement>(".story-scene")
        [next - firstStep]?.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      return;
    }
    if (reduced) return;
    bypass.current = false;
    const element = root.current;
    if (element)
      window.scrollTo({
        top:
          window.scrollY +
          element.getBoundingClientRect().top +
          (next - firstStep) * stride.current,
        behavior: "instant",
      });
  }
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-height: 680px), (max-width: 800px) and (max-height: 780px)",
    );
    const phone = window.matchMedia("(max-width: 800px)");
    let entered = 0,
      lastGesture = 0,
      armed = false,
      frame = 0;
    let previousOffset = 0;
    let positioned = false;
    const preference = () => {
      setReduced(media.matches);
      setMobile(phone.matches);
    };
    preference();
    const position = () => {
      frame = 0;
      const bounds = element.getBoundingClientRect();
      const visible =
        bounds.top < window.innerHeight &&
        bounds.bottom > window.innerHeight * 0.5;
      setInStory(visible);
      if (phone.matches) {
        const scenes = [
          ...element.querySelectorAll<HTMLElement>(".story-scene"),
        ];
        const next = scenes.reduce(
          (active, scene, index) =>
            !scene.hidden &&
            scene.getBoundingClientRect().top <= window.innerHeight * 0.4
              ? index + firstStep
              : active,
          firstStep,
        );
        if (visible) visit(next, positioned);
        else {
          current.current = next;
          setStep(next);
        }
        positioned = visible;
        return;
      }
      if (
        media.matches ||
        getComputedStyle(element.firstElementChild as Element).position !==
          "sticky"
      )
        return;
      stride.current =
        (element.offsetHeight -
          (element.firstElementChild?.clientHeight || window.innerHeight) -
          140) /
        (finalStoryStep - firstStep);
      const top = window.scrollY + element.getBoundingClientRect().top;
      const offset = window.scrollY - top;
      const final = (finalStoryStep - firstStep) * stride.current;
      if (offset < final - 10) {
        entered = 0;
        armed = false;
        bypass.current = false;
      }
      // Direct anchors and restored positions beyond the story must remain native.
      if (
        !bypass.current &&
        offset >= final &&
        previousOffset < final &&
        !entered
      ) {
        entered = performance.now();
        window.scrollTo({ top: top + final, behavior: "instant" });
      } else if (
        entered &&
        !armed &&
        !bypass.current &&
        offset > final &&
        offset < element.offsetHeight
      ) {
        window.scrollTo({ top: top + final, behavior: "instant" });
      } else if (armed && !bypass.current && offset >= final + 120) {
        chat();
      }
      previousOffset = offset;
      const next = Math.min(
        finalStoryStep,
        firstStep + storyStep(offset, stride.current),
      );
      if (next !== current.current) {
        if (visible) visit(next, positioned);
        else {
          current.current = next;
          setStep(next);
        }
      }
      positioned = visible;
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(position);
    };
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        phone.matches ||
        event.deltaY <= 0 ||
        bypass.current ||
        !entered ||
        armed
      )
        return;
      const now = performance.now();
      if (deliberateStoryExit(now, entered, lastGesture)) armed = true;
      else event.preventDefault();
      lastGesture = now;
    };
    const intent = () => {
      if (entered && performance.now() - entered >= 700) armed = true;
    };
    const key = (event: KeyboardEvent) => {
      if (
        ["PageDown", "ArrowDown", " ", "End"].includes(event.key) &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable]")
        )
      )
        intent();
    };
    previousOffset = -element.getBoundingClientRect().top;
    if (location.hash === `#${targetId}`) bypass.current = true;
    position();
    const anchor = () => {
      frame = 0;
      if (location.hash !== `#${targetId}`) {
        bypass.current = false;
        return;
      }
      bypass.current = true;
      entered = 0;
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    if (location.hash === `#${targetId}`) frame = requestAnimationFrame(anchor);
    window.addEventListener("hashchange", anchor);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", intent, { passive: true });
    window.addEventListener("pointerdown", intent, { passive: true });
    window.addEventListener("keydown", key);
    media.addEventListener("change", preference);
    phone.addEventListener("change", preference);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", anchor);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", intent);
      window.removeEventListener("pointerdown", intent);
      window.removeEventListener("keydown", key);
      media.removeEventListener("change", preference);
      phone.removeEventListener("change", preference);
    };
  }, [firstStep, targetId]);
  return { root, step, navigate, chat, reduced, mobile, completed, inStory };
}
