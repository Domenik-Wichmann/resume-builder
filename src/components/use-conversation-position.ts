"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";

export function positionConversationTurn(
  container: HTMLDivElement,
  turn: HTMLElement,
) {
  container.style.setProperty(
    "--turn-min-height",
    `${container.clientHeight}px`,
  );
  container.scrollTo({
    top: Math.max(
      0,
      container.scrollTop +
        turn.getBoundingClientRect().top -
        container.getBoundingClientRect().top,
    ),
    behavior: "instant",
  });
}

/** Keep the new turn steady when older attachments load; never chase its own growth. */
export function useConversationPosition({
  container,
  turn,
  request,
  contextKey,
  panel,
}: {
  container: RefObject<HTMLDivElement | null>;
  turn: RefObject<HTMLElement | null>;
  request: { input: string; kind: string } | null;
  contextKey: string;
  panel: string;
}) {
  const anchor = useRef<{
    request: object;
    element: HTMLElement;
    following: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => {
      if (element.clientHeight > 0)
        element.style.setProperty(
          "--turn-min-height",
          `${element.clientHeight}px`,
        );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);
  useLayoutEffect(() => {
    const element = turn.current,
      scroller = container.current;
    if (!request || !element || !scroller || panel !== "chat") return;
    const fresh = anchor.current?.request !== request;
    const following = fresh || anchor.current?.following === true;
    if (following && (fresh || anchor.current?.element !== element))
      positionConversationTurn(scroller, element);
    anchor.current = { request, element, following };
    const stop = () => {
      if (anchor.current?.request === request) anchor.current.following = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        stop();
    };
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchstart", stop, { passive: true });
    scroller.addEventListener("pointerdown", stop, { passive: true });
    scroller.addEventListener("keydown", keydown);
    const observer = new ResizeObserver(() => {
      if (
        anchor.current?.request !== request ||
        !anchor.current.following ||
        !element.isConnected
      )
        return;
      const offset =
        element.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
      if (Math.abs(offset) > 1) positionConversationTurn(scroller, element);
    });
    // Observe only older siblings: new response tokens, cards and diagrams grow below the anchor.
    for (const sibling of scroller.children) {
      if (sibling === element) break;
      observer.observe(sibling);
    }
    return () => {
      observer.disconnect();
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
      scroller.removeEventListener("pointerdown", stop);
      scroller.removeEventListener("keydown", keydown);
    };
  }, [request, contextKey, panel, container, turn]);
}
