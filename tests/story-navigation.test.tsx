// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useStoryNavigation } from "../src/components/story-navigation";

it("continues updating chapters after a direct chat anchor and a return to the story", async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let scrollY = 0;
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("getComputedStyle", () => ({ position: "sticky" }));
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(5324);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(960);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top: -window.scrollY, bottom: 5324 - window.scrollY }) as DOMRect,
  );
  const scrollTo = vi
    .spyOn(window, "scrollTo")
    .mockImplementation((options: ScrollToOptions | number) => {
      if (typeof options === "object") {
        scrollY = options.top || 0;
        window.dispatchEvent(new Event("scroll"));
      }
    });
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {
    window.scrollTo({ top: 5324 });
  });
  const host = document.createElement("div");
  document.body.append(host);
  const reactRoot = createRoot(host);
  function Story() {
    const { root, step, completed } = useStoryNavigation();
    return (
      <>
        <div ref={root}>
          <div />
          <output data-completed={completed}>{step}</output>
        </div>
        <section id="ask" />
      </>
    );
  }
  async function flush() {
    await act(async () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(performance.now()));
    });
  }
  try {
    history.replaceState(null, "", "#ask");
    await act(async () => reactRoot.render(<Story />));
    await flush();
    await flush();
    expect(scrollTo).toHaveBeenCalledWith({ top: 5324 });
    expect(host.querySelector("output")?.textContent).toBe("8");
    expect(host.querySelector("output")?.getAttribute("data-completed")).toBe(
      "false",
    );
    window.scrollTo({ top: 0 });
    await flush();
    expect(host.querySelector("output")?.textContent).toBe("0");
    expect(host.querySelector("output")?.getAttribute("data-completed")).toBe(
      "false",
    );
    window.scrollTo({ top: 1056 });
    await flush();
    expect(host.querySelector("output")?.textContent).toBe("2");
  } finally {
    await act(async () => reactRoot.unmount());
    host.remove();
    history.replaceState(null, "", "/");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

it("unlocks the persistent chat shortcut only after visiting every story chapter", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  let navigation: ReturnType<typeof useStoryNavigation> | undefined;
  function Story() {
    navigation = useStoryNavigation();
    return (
      <div ref={navigation.root}>
        <div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="story-scene" />
          ))}
        </div>
      </div>
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  let root = createRoot(host);
  try {
    await act(async () => root.render(<Story />));
    await act(async () => navigation!.navigate(8));
    expect(navigation!.completed).toBe(false);
    for (let i = 1; i < 8; i++) await act(async () => navigation!.navigate(i));
    expect(navigation!.completed).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<Story />));
    expect(navigation!.completed).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
