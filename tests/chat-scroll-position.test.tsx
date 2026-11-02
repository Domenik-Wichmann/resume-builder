// @vitest-environment happy-dom
import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useConversationPosition } from "../src/components/use-conversation-position";

it("holds a new turn through late older previews, ignores its own growth, and releases on manual scrolling", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const observers: { callback: () => void; targets: Element[] }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      item: (typeof observers)[number];
      constructor(callback: () => void) {
        this.item = { callback, targets: [] };
        observers.push(this.item);
      }
      observe(target: Element) {
        this.item.targets.push(target);
      }
      disconnect() {
        this.item.targets = [];
      }
    },
  );
  let viewport = 620,
    turnOffset = 800;
  const scroll = vi.fn<(options: ScrollToOptions) => void>();
  function View({
    request,
    answer,
  }: {
    request: { input: string; kind: string } | null;
    answer: string;
  }) {
    const container = useRef<HTMLDivElement>(null),
      turn = useRef<HTMLElement>(null);
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
            el.scrollTo = (options) => {
              const value = options as ScrollToOptions;
              scroll(value);
              el.scrollTop = value.top || 0;
            };
          }
        }}
      >
        <article className="previous">Previous answer</article>
        <article
          ref={(el) => {
            turn.current = el;
            if (el)
              el.getBoundingClientRect = () =>
                ({
                  top: 100 + turnOffset - (container.current?.scrollTop || 0),
                }) as DOMRect;
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
      top: 800,
      behavior: "instant",
    });
    const scroller = host.firstElementChild as HTMLDivElement;
    expect(scroller.style.getPropertyValue("--turn-min-height")).toBe("620px");
    const contentObserver = observers.find((item) =>
      item.targets.includes(host.querySelector(".previous")!),
    )!;
    expect(contentObserver.targets).not.toContain(
      host.querySelector("article:last-child"),
    );
    await act(async () =>
      root.render(
        <View request={request} answer={"Completed answer ".repeat(600)} />,
      ),
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    turnOffset = 1100;
    contentObserver.callback();
    expect(scroll).toHaveBeenLastCalledWith({ top: 1100, behavior: "instant" });
    scroller.dispatchEvent(new Event("wheel"));
    scroller.scrollTop = 500;
    turnOffset = 1300;
    contentObserver.callback();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroller.scrollTop).toBe(500);
    viewport = 500;
    observers[0].callback();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroller.style.getPropertyValue("--turn-min-height")).toBe("500px");
    await act(async () =>
      root.render(
        <View
          request={{ input: "Another question", kind: "ask" }}
          answer="Waiting"
        />,
      ),
    );
    expect(scroll).toHaveBeenLastCalledWith({ top: 1300, behavior: "instant" });
    expect(scroll).toHaveBeenCalledTimes(3);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
