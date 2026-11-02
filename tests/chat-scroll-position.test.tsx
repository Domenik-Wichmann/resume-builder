// @vitest-environment happy-dom
import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useConversationPosition } from "../src/components/use-conversation-position";

it("reserves room for a new turn, aligns it once, and does not chase a growing answer", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resize: (() => void) | undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  const scroll = vi.fn();
  let viewport = 620;
  function View({
    request,
    answer,
  }: {
    request: { input: string; kind: string } | null;
    answer: string;
  }) {
    const container = useRef<HTMLDivElement>(null);
    const turn = useRef<HTMLElement>(null);
    useConversationPosition({
      container,
      turn,
      request,
      contextKey: "owned:3",
      panel: "chat",
    });
    return (
      <div
        ref={(el) => {
          container.current = el;
          if (el) {
            Object.defineProperty(el, "clientHeight", {
              get: () => viewport,
              configurable: true,
            });
            el.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
            el.scrollTo = scroll;
            el.scrollTop = 120;
          }
        }}
      >
        <article
          ref={(el) => {
            turn.current = el;
            if (el) el.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
          }}
        >
          {answer}
        </article>
      </div>
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const request = { input: "A new question", kind: "ask" };
  try {
    await act(async () =>
      root.render(<View request={request} answer="Waiting" />),
    );
    expect(scroll).toHaveBeenCalledExactlyOnceWith({
      top: 920,
      behavior: "instant",
    });
    expect(host.firstElementChild?.getAttribute("style")).toContain("620px");
    await act(async () =>
      root.render(
        <View request={request} answer={"Answer content ".repeat(300)} />,
      ),
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <View request={null} answer={"Completed answer ".repeat(600)} />,
      ),
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    viewport = 500;
    resize?.();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(host.firstElementChild?.getAttribute("style")).toContain("500px");
    await act(async () =>
      root.render(
        <View
          request={{ input: "Another question", kind: "ask" }}
          answer="Waiting"
        />,
      ),
    );
    expect(scroll).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
