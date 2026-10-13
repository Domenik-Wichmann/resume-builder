// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/projects",
  useSearchParams: () => new URLSearchParams("edit=fixture"),
}));
import { AdminSession } from "../src/components/admin-session";
it("checks immediately, renews every minute and retains the editor through network and provider outages", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AdminSession />));
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockResolvedValue(new Response(null, { status: 503 }));
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(host.textContent).toBe("");
    fetch.mockRejectedValue(new Error("Network unavailable"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(host.textContent).toBe("");
    fetch.mockResolvedValue(new Response(null, { status: 401 }));
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(host.textContent).toContain("This page stays open");
    expect(host.querySelector("a")?.getAttribute("href")).toContain(
      encodeURIComponent("/admin/projects?edit=fixture"),
    );
    fetch.mockResolvedValue(new Response(null, { status: 200 }));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(host.textContent).toBe("");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
