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

/** Pin a new turn once. Response growth and image loads must never chase the reader. */
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
  const aligned = useRef<{ request: object; element: HTMLElement } | null>(
    null,
  );
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
    const element = turn.current;
    if (!request || !element || !container.current || panel !== "chat") return;
    if (
      aligned.current?.request === request &&
      aligned.current.element === element
    )
      return;
    positionConversationTurn(container.current, element);
    aligned.current = { request, element };
  }, [request, contextKey, panel, container, turn]);
}
