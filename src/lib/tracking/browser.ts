import { analyticsPath, type TrackingEvent } from "./paths";
import {
  arrivalSource,
  interactionSchema,
  type InteractionAction,
} from "./dimensions";

// Let the first response establish the signed cookie before a fast navigation
// or repeated mount can create a competing session in this tab.
let precedingView: Promise<boolean> | undefined;

function privacyDisabled() {
  return (
    navigator.doNotTrack === "1" ||
    ("globalPrivacyControl" in navigator &&
      navigator.globalPrivacyControl === true)
  );
}

export function clickAction(
  target: EventTarget | null,
): InteractionAction | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest("[data-analytics-action],a[href]");
  if (
    !element ||
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  )
    return null;
  const annotated = element.getAttribute("data-analytics-action");
  if (annotated) return interactionSchema.safeParse(annotated).data ?? null;
  const href = element.getAttribute("href");
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol === "mailto:") return "email";
    if (url.protocol === "tel:") return "phone";
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.origin !== window.location.origin) return "outbound";
    const path = analyticsPath(url.pathname);
    if (!path || (url.pathname === window.location.pathname && url.hash))
      return null;
    if (path === "/") return "home";
    if (path === "/projects" && url.pathname !== "/projects") return "project";
    return interactionSchema.safeParse(path.slice(1)).data ?? null;
  } catch {
    return null;
  }
}

export function startPageTracking(path: TrackingEvent["path"], viewId: string) {
  if (privacyDisabled()) return () => {};
  const send = async (event: TrackingEvent) => {
    if (privacyDisabled()) return false;
    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      });
      return (
        response.ok && response.headers.get("X-Analytics-Recorded") === "1"
      );
    } catch {
      return false;
    }
  };
  const view: TrackingEvent = {
    kind: "page_view",
    path,
    view_id: viewId,
    referrer: arrivalSource(document.referrer, window.location.origin),
  };
  const ready = precedingView
    ? precedingView.then(() => send(view))
    : send(view);
  precedingView = ready;
  const base = { path, view_id: viewId };
  let tick = performance.now(),
    lastInput = tick,
    activeMs = 0,
    sentAt = tick;
  let foreground =
    document.visibilityState === "visible" && document.hasFocus();
  let scroll: 0 | 25 | 50 | 75 | 100 = 0,
    lastSent = "",
    lastClick = -Infinity;
  const sample = () => {
    const now = performance.now();
    if (foreground && !privacyDisabled()) {
      // Ignore background/idle time and cap suspended timer gaps; no input values are read.
      activeMs = Math.min(
        14400000,
        activeMs +
          Math.max(0, Math.min(5000, Math.min(now, lastInput + 30000) - tick)),
      );
    }
    tick = now;
  };
  const measureScroll = () => {
    if (document.visibilityState !== "visible") return;
    const height = document.documentElement.scrollHeight;
    if (height <= 0) return;
    const percent = Math.min(
      100,
      Math.floor(((window.scrollY + window.innerHeight) / height) * 4) * 25,
    );
    scroll = Math.max(scroll, percent) as typeof scroll;
  };
  const flush = () => {
    const seconds = Math.floor(activeMs / 1000);
    const signature = `${seconds}:${scroll}`;
    if (signature === lastSent) return;
    lastSent = signature;
    sentAt = performance.now();
    void ready.then(
      (enabled) =>
        enabled &&
        send({
          ...base,
          kind: "engagement",
          active_seconds: seconds,
          scroll_depth: scroll,
        }),
    );
  };
  const activity = () => {
    sample();
    lastInput = performance.now();
    measureScroll();
  };
  const visibility = () => {
    sample();
    foreground = document.visibilityState === "visible" && document.hasFocus();
    if (foreground) lastInput = performance.now();
    else flush();
  };
  const click = (event: MouseEvent) => {
    const action = clickAction(event.target);
    if (!action || performance.now() - lastClick < 300) return;
    lastClick = performance.now();
    void ready.then(
      (enabled) => enabled && send({ ...base, kind: "interaction", action }),
    );
  };
  const leave = () => {
    sample();
    flush();
    foreground = false;
  };
  const timer = window.setInterval(() => {
    sample();
    measureScroll();
    if (performance.now() - sentAt >= 15000) flush();
  }, 5000);
  measureScroll();
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("click", click, true);
  for (const event of ["pointerdown", "keydown", "scroll", "touchstart"])
    document.addEventListener(event, activity, {
      passive: true,
      capture: true,
    });
  window.addEventListener("focus", visibility);
  window.addEventListener("blur", visibility);
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", visibility);
  return () => {
    leave();
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("click", click, true);
    for (const event of ["pointerdown", "keydown", "scroll", "touchstart"])
      document.removeEventListener(event, activity, true);
    window.removeEventListener("focus", visibility);
    window.removeEventListener("blur", visibility);
    window.removeEventListener("pagehide", leave);
    window.removeEventListener("pageshow", visibility);
  };
}
