// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { EvidenceMap } from "../src/components/evidence-map";

it("keeps the full animated graph visible on phones and expands without losing records", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("max-width"),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const expand = vi.fn();
  const records = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    slug: String(i),
    title: `Fictional source ${i}`,
    subtitle: "",
    summary: "Test fixture",
    skills: [],
  }));
  const render = (expanded: boolean) =>
    root.render(
      <EvidenceMap
        records={records}
        busy={false}
        collapsed
        expanded={expanded}
        onExpand={expand}
        onToggle={() => {}}
      />,
    );
  try {
    await act(async () => render(false));
    expect(host.querySelectorAll(".evidence-node")).toHaveLength(12);
    expect(
      host.querySelector("#evidence-panel-content")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(host.querySelector(".evidence-rail.is-preview")).not.toBeNull();
    expect(host.querySelector(".graph-preview-caption")).toBeNull();
    const node = host.querySelector<HTMLButtonElement>(".evidence-node")!;
    const canvas = host.querySelector<HTMLElement>(".evidence-canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 280, 160),
    );
    let captured = false;
    node.setPointerCapture = () => {
      captured = true;
    };
    node.hasPointerCapture = () => captured;
    node.releasePointerCapture = () => {
      captured = false;
    };
    const initialLeft = node.style.left;
    await act(async () =>
      node.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerId: 1,
          clientX: 100,
          clientY: 60,
        }),
      ),
    );
    expect(captured).toBe(true);
    await act(async () =>
      node.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 140,
          clientY: 90,
        }),
      ),
    );
    expect(node.style.left).not.toBe(initialLeft);
    await act(async () => {
      node.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
      );
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(expand).not.toHaveBeenCalled();
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    host.querySelector(".evidence-canvas")!.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    await act(async () =>
      (host.querySelector(".evidence-node") as HTMLButtonElement).click(),
    );
    expect(expand).toHaveBeenCalledOnce();
    await act(async () => render(true));
    expect(host.querySelectorAll(".evidence-node")).toHaveLength(12);
    const collapse = host.querySelector('[aria-label="Collapse graph"]');
    expect(collapse?.textContent).toBe("");
    expect(collapse?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(expand).toHaveBeenCalledTimes(2);
    await act(async () => render(false));
    expect(host.querySelectorAll(".evidence-node")).toHaveLength(12);
    expect(records).toHaveLength(12);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
