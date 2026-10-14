import { z } from "zod";

export const deviceTypes = ["desktop", "mobile", "tablet", "unknown"] as const;
export const browserTypes = [
  "Chrome",
  "Edge",
  "Firefox",
  "Safari",
  "Opera",
  "Samsung Internet",
  "other",
  "unknown",
] as const;
export const operatingSystems = [
  "Windows",
  "macOS",
  "Linux",
  "Android",
  "iOS",
  "other",
  "unknown",
] as const;
export const arrivalSources = [
  "direct",
  "search",
  "linkedin",
  "github",
  "social",
  "referral",
  "internal",
  "unknown",
] as const;
export const arrivalLabels: Record<(typeof arrivalSources)[number], string> = {
  direct: "Direct / no referrer",
  search: "Search engine",
  linkedin: "LinkedIn",
  github: "GitHub",
  social: "Other social",
  referral: "Other website",
  internal: "Same site",
  unknown: "Not recorded",
};
export const interactionLabels = {
  home: "Open main page",
  projects: "Open projects",
  project: "Open project details",
  explore: "Open career explorer",
  answers: "Open Quick Answers",
  workspace: "Open saved chat",
  resume: "Open résumé",
  email: "Email contact",
  phone: "Phone contact",
  outbound: "Open external link",
  question: "Submit question",
  create_workspace: "Start workspace",
  preview_resume: "Preview résumé",
  export_resume: "Export résumé",
  example: "Toggle example answer",
  story_next: "Next story scene",
  story_previous: "Previous story scene",
  story_scene: "Select story scene",
  open_chat: "Open chat",
} as const;
export const interactionActions = Object.keys(
  interactionLabels,
) as (keyof typeof interactionLabels)[];
export const interactionSchema = z.enum(interactionActions);
export type InteractionAction = z.infer<typeof interactionSchema>;

// Classify locally: no referring URL, query, path, or hostname is sent or stored.
export function arrivalSource(
  referrer: string,
  origin: string,
): (typeof arrivalSources)[number] {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    if (!/^https?:$/.test(url.protocol)) return "unknown";
    if (url.origin === origin) return "internal";
    const host = url.hostname.toLowerCase();
    const matches = (domain: string) =>
      host === domain || host.endsWith("." + domain);
    if (matches("linkedin.com") || matches("lnkd.in")) return "linkedin";
    if (matches("github.com")) return "github";
    if (
      /^(www\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(
        host,
      ) ||
      [
        "bing.com",
        "duckduckgo.com",
        "search.yahoo.com",
        "ecosia.org",
        "search.brave.com",
      ].some(matches)
    )
      return "search";
    if (
      [
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "t.co",
        "reddit.com",
        "youtube.com",
      ].some(matches)
    )
      return "social";
    return "referral";
  } catch {
    return "unknown";
  }
}

export function countryLabel(code: string) {
  if (code === "unknown") return "Unknown / not recorded";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export function durationLabel(seconds: number | null) {
  if (seconds === null) return "Not measured";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
