// @vitest-environment happy-dom
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
import { PageTracker } from "../src/components/page-tracker";
import { clickAction, startPageTracking } from "../src/lib/tracking/browser";
import type { TrackingEvent } from "../src/lib/tracking/paths";
const view = "11111111-1111-4111-8111-111111111111";
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchMock = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: { "X-Analytics-Recorded": "1" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 500,
  });
  Object.defineProperty(navigator, "doNotTrack", {
    configurable: true,
    value: "0",
  });
  Object.defineProperty(navigator, "globalPrivacyControl", {
    configurable: true,
    value: false,
  });
  route.path = "/";
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function events(): TrackingEvent[] {
  return fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
}

it("records one page view, cumulative active time and scroll; ignores hidden tabs and idle time", async () => {
  const stop = startPageTracking("/projects", view);
  try {
    await vi.advanceTimersByTimeAsync(15000);
    expect(events().filter((event) => event.kind === "page_view")).toHaveLength(
      1,
    );
    expect(events().at(-1)).toMatchObject({
      kind: "engagement",
      active_seconds: 15,
      scroll_depth: 50,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(events().at(-1)).toMatchObject({ active_seconds: 15 });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(events().at(-1)).toMatchObject({ active_seconds: 45 });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "private keystroke" }),
    );
    await vi.advanceTimersByTimeAsync(15000);
    window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();
    expect(events().at(-1)).toMatchObject({ active_seconds: 60 });
    expect(JSON.stringify(events())).not.toContain("private keystroke");
    expect(events().filter((event) => event.kind === "page_view")).toHaveLength(
      1,
    );
  } finally {
    stop();
    await Promise.resolve();
  }
});
it("records fixed action names without text, links, private paths, queries, or form values", async () => {
  const host = document.createElement("div");
  host.innerHTML =
    '<button data-analytics-action="example"><span>Private message</span></button><a href="/projects/private-slug?secret=hidden">Private title</a><a href="/admin/analytics">Admin</a><button data-analytics-action="arbitrary text">Other</button><button data-analytics-action="question" disabled>Disabled</button>';
  document.body.append(host);
  const stop = startPageTracking("/", view);
  try {
    host
      .querySelector("span")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(500);
    expect(events().at(-1)).toMatchObject({
      kind: "interaction",
      action: "example",
    });
    expect(clickAction(host.querySelector("a"))).toBe("project");
    expect(clickAction(host.querySelectorAll("a")[1])).toBeNull();
    expect(clickAction(host.querySelectorAll("button")[1])).toBeNull();
    expect(clickAction(host.querySelectorAll("button")[2])).toBeNull();
    expect(JSON.stringify(events())).not.toMatch(
      /Private|secret|private-slug|hidden|arbitrary/,
    );
  } finally {
    stop();
    host.remove();
    await Promise.resolve();
  }
});
it("honors both privacy signals and stops follow-up telemetry when the server excludes the owner", async () => {
  Object.defineProperty(navigator, "doNotTrack", {
    configurable: true,
    value: "1",
  });
  startPageTracking("/", view)();
  expect(fetchMock).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "doNotTrack", {
    configurable: true,
    value: "0",
  });
  Object.defineProperty(navigator, "globalPrivacyControl", {
    configurable: true,
    value: true,
  });
  startPageTracking("/", view)();
  expect(fetchMock).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "globalPrivacyControl", {
    configurable: true,
    value: false,
  });
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  const stop = startPageTracking("/", view);
  await vi.advanceTimersByTimeAsync(60000);
  stop();
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledOnce();
});
it("never tracks admin or sign-in pages, and repeated React mounts reuse the view identity", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    for (const path of [
      "/admin",
      "/admin/analytics",
      "/auth/login",
      "/account",
    ]) {
      route.path = path;
      await act(async () => root.render(<PageTracker />));
    }
    expect(fetchMock).not.toHaveBeenCalled();
    route.path = "/";
    await act(async () =>
      root.render(
        <StrictMode>
          <PageTracker />
        </StrictMode>,
      ),
    );
    const views = events().filter((event) => event.kind === "page_view");
    expect(views.length).toBeGreaterThan(0);
    expect(new Set(views.map((event) => event.view_id)).size).toBe(1);
    route.path = "/projects/public-slug";
    await act(async () =>
      root.render(
        <StrictMode>
          <PageTracker />
        </StrictMode>,
      ),
    );
    expect(
      events()
        .filter((event) => event.kind === "page_view")
        .at(-1),
    ).toMatchObject({ path: "/projects" });
    expect(JSON.stringify(events())).not.toContain("public-slug");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("waits for the first session cookie before recording a fast subsequent navigation", async () => {
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const first = startPageTracking("/", view);
  await vi.advanceTimersByTimeAsync(1);
  const second = startPageTracking(
    "/projects",
    "22222222-2222-4222-8222-222222222222",
  );
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledOnce();
  finish(
    new Response(null, {
      status: 204,
      headers: { "X-Analytics-Recorded": "1" },
    }),
  );
  await vi.advanceTimersByTimeAsync(1);
  expect(
    events()
      .filter((event) => event.kind === "page_view")
      .map((event) => event.path),
  ).toEqual(["/", "/projects"]);
  first();
  second();
  await vi.advanceTimersByTimeAsync(1);
});
