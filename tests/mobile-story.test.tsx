// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useStoryNavigation } from "../src/components/story-navigation";

it("starts phones at the introduction and uses native chapter scrolling without capturing wheel gestures", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(max-width: 800px)",
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }));
  const scroll = vi.spyOn(window, "scrollTo");
  const intoView = vi
    .spyOn(HTMLElement.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        top: this.hidden ? 0 : Number(this.dataset.top || 0),
      } as DOMRect;
    },
  );
  const host = document.createElement("div");
  document.body.append(host);
  const reactRoot = createRoot(host);
  function Story() {
    const { root, step, mobile, navigate } = useStoryNavigation();
    return (
      <div ref={root}>
        <div />
        <output>{step}</output>
        {[0, 1, 2].map((index) => (
          <section
            key={index}
            className="story-scene"
            data-top={index * 1000}
            hidden={!mobile && step !== index}
          />
        ))}
        <button onClick={() => navigate(1)}>Next</button>
      </div>
    );
  }
  try {
    await act(async () => reactRoot.render(<Story />));
    expect(host.querySelector("output")?.textContent).toBe("0");
    expect(host.querySelectorAll("section[hidden]")).toHaveLength(0);
    await act(async () => host.querySelector("button")!.click());
    expect(intoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
    });
    expect(scroll).not.toHaveBeenCalled();
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    host.querySelector("section")!.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  } finally {
    await act(async () => reactRoot.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
