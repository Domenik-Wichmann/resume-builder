import "server-only";
import type { browserTypes, deviceTypes, operatingSystems } from "./dimensions";

export function visitorContext(headers: Headers) {
  const agent = (headers.get("user-agent") || "").slice(0, 1024);
  const bot =
    /bot\b|crawler|spider|slurp|headless|preview|facebookexternalhit/i.test(
      agent,
    );
  const country =
    process.env.VERCEL === "1"
      ? headers.get("x-vercel-ip-country")?.toUpperCase()
      : null;
  const visitor_country =
    country && /^[A-Z]{2}$/.test(country) && !["XX", "ZZ"].includes(country)
      ? country
      : null;
  let device: (typeof deviceTypes)[number] = "unknown";
  if (/iPad|Tablet|Kindle|Silk|Android(?!.*Mobile)/i.test(agent))
    device = "tablet";
  else if (/Mobile|iPhone|iPod/i.test(agent)) device = "mobile";
  else if (/Windows NT|Macintosh|X11|CrOS/i.test(agent)) device = "desktop";
  let browser: (typeof browserTypes)[number] = agent ? "other" : "unknown";
  if (/Edg(e|A|iOS)?\//.test(agent)) browser = "Edge";
  else if (/OPR\/|Opera/.test(agent)) browser = "Opera";
  else if (/SamsungBrowser\//.test(agent)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS\//.test(agent)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(agent)) browser = "Chrome";
  else if (/Safari\//.test(agent)) browser = "Safari";
  let os: (typeof operatingSystems)[number] = agent ? "other" : "unknown";
  if (/iPhone|iPad|iPod/.test(agent)) os = "iOS";
  else if (/Android/.test(agent)) os = "Android";
  else if (/Windows NT/.test(agent)) os = "Windows";
  else if (/Macintosh/.test(agent)) os = "macOS";
  else if (/Linux|X11/.test(agent)) os = "Linux";
  // Keep only coarse categories. Raw user-agent and IP headers never enter storage.
  return { visitor_country, device, browser, os, bot };
}
