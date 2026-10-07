"use client";
import { useEffect, useRef, useState } from "react";
import { finalStoryStep } from "@/lib/portfolio/story-scenes";
import { deliberateStoryExit, storyStep } from "@/lib/portfolio/story";

export function useStoryNavigation() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  const bypass = useRef(false);
  const stride = useRef(400);
  const current = useRef(0);
  function chat() {
    bypass.current = true;
    if (location.hash !== "#ask") history.pushState(null, "", "#ask");
    document
      .getElementById("ask")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  function navigate(next: number) {
    setStep(next);
    current.current = next;
    if (reduced) return;
    bypass.current = false;
    const element = root.current;
    if (element)
      window.scrollTo({
        top:
          window.scrollY +
          element.getBoundingClientRect().top +
          next * stride.current,
        behavior: "instant",
      });
  }
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-height: 680px), (max-width: 800px) and (max-height: 780px)",
    );
    let entered = 0,
      lastGesture = 0,
      armed = false,
      frame = 0;
    let previousOffset = 0;
    const preference = () => setReduced(media.matches);
    preference();
    const position = () => {
      frame = 0;
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
        finalStoryStep;
      const top = window.scrollY + element.getBoundingClientRect().top;
      const offset = window.scrollY - top;
      const final = finalStoryStep * stride.current;
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
      const next = storyStep(offset, stride.current);
      if (next !== current.current) {
        current.current = next;
        setStep(next);
      }
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(position);
    };
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
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
    if (location.hash === "#ask") bypass.current = true;
    position();
    const anchor = () => {
      frame = 0;
      if (location.hash !== "#ask") {
        bypass.current = false;
        return;
      }
      bypass.current = true;
      entered = 0;
      document
        .getElementById("ask")
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    if (location.hash === "#ask") frame = requestAnimationFrame(anchor);
    window.addEventListener("hashchange", anchor);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", intent, { passive: true });
    window.addEventListener("pointerdown", intent, { passive: true });
    window.addEventListener("keydown", key);
    media.addEventListener("change", preference);
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
    };
  }, []);
  return { root, step, navigate, chat, reduced };
}
