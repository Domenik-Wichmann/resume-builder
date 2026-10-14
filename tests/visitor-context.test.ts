import { afterEach, expect, it, vi } from "vitest";
import { visitorContext } from "../src/lib/tracking/visitor-context";
import { arrivalSource } from "../src/lib/tracking/dimensions";
afterEach(() => vi.unstubAllEnvs());
it.each([
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    "mobile",
    "Safari",
    "iOS",
  ],
  [
    "Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/120.0 Safari/537.36",
    "tablet",
    "Chrome",
    "Android",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0",
    "desktop",
    "Edge",
    "Windows",
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0",
    "desktop",
    "Firefox",
    "Linux",
  ],
  ["", "unknown", "unknown", "unknown"],
])(
  "categorizes browser hints without retaining the raw header",
  (agent, device, browser, os) => {
    expect(visitorContext(new Headers({ "user-agent": agent }))).toMatchObject({
      device,
      browser,
      os,
    });
  },
);
it("never trusts country headers off-platform and leaves absent or malformed countries unknown", () => {
  vi.stubEnv("VERCEL", "0");
  expect(
    visitorContext(new Headers({ "x-vercel-ip-country": "US" }))
      .visitor_country,
  ).toBeNull();
  vi.stubEnv("VERCEL", "1");
  for (const country of ["XX", "ZZ", "USA", "51.5,0.1", ""])
    expect(
      visitorContext(new Headers({ "x-vercel-ip-country": country }))
        .visitor_country,
    ).toBeNull();
  expect(
    visitorContext(new Headers({ "x-vercel-ip-country": "BG" }))
      .visitor_country,
  ).toBe("BG");
});
it.each([
  ["", "direct"],
  ["https://www.google.com/search?q=private", "search"],
  ["https://www.linkedin.com/private-profile", "linkedin"],
  ["https://github.com/private/repo?secret=yes", "github"],
  ["https://linkedin.com.evil.test/", "referral"],
  ["https://portfolio.test/admin", "internal"],
  ["invalid", "unknown"],
  ["file:///private", "unknown"],
])("reduces referrers to fixed categories: %s", (referrer, expected) => {
  expect(arrivalSource(referrer, "https://portfolio.test")).toBe(expected);
});
