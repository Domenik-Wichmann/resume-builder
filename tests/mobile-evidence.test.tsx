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
    expect(
      host.querySelector('[aria-label="Collapse graph"]')?.textContent,
    ).toBe("Collapse graph");
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
