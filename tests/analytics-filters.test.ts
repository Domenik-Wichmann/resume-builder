import { expect, it } from "vitest";
import {
  parseAnalyticsFilters,
  analyticsHref,
  defaultAnalyticsFilters,
} from "../src/lib/analytics/filters";
import { fictionalAnalytics } from "../src/lib/analytics/demo";
const now = new Date("2026-10-13T12:00:00Z");
it("uses inclusive UTC calendar days and extracts a pasted tracking link without trusting its host", () => {
  const parsed = parseAnalyticsFilters(
    {
      days: "7",
      code: "https://portfolio.test/r/Ab12_-34",
      hour_from: "22",
      hour_to: "2",
    },
    now,
  );
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(parsed.data).toMatchObject({
    from: "2026-10-07",
    to: "2026-10-13",
    code: "Ab12_-34",
    hour_from: 22,
    hour_to: 2,
  });
});
it.each([
  { from: "2026-02-30" },
  { from: "2026-10-14", to: "2026-10-13" },
  { from: "2025-01-01", to: "2026-10-13" },
  { hour_from: "24" },
  { code: "abc' OR TRUE--" },
  { region: "precise-gps" },
  { event: "private-record" },
  { page_number: "0" },
  { search: "x".repeat(201) },
  { code: ["demoLink", "demoBGbg"] },
  { country: "USA" },
  { device: "fingerprint" },
  { referrer: "https://private.example" },
  { action: "private text" },
  { min_seconds: "100", max_seconds: "20" },
  { max_seconds: "14401" },
  { session: "forged" },
])("rejects malformed or unbounded analytics filters: %j", (query) =>
  expect(parseAnalyticsFilters(query, now).success).toBe(false),
);
it("preserves the selection when drilling down and resets pagination", () => {
  const filters = {
    ...defaultAnalyticsFilters(30, now),
    code: "demoLink",
    region: "US" as const,
    source: "tracked" as const,
    page_number: 4,
    search: "RAG & automation",
    country: "DE",
    device: "mobile" as const,
    referrer: "linkedin" as const,
    min_seconds: 30,
  };
  const href = analyticsHref(filters, { from: "2026-10-12", to: "2026-10-12" });
  const query = new URL(href, "https://portfolio.test").searchParams;
  expect(query.get("code")).toBe("demoLink");
  expect(query.get("region")).toBe("US");
  expect(query.get("search")).toBe("RAG & automation");
  expect(query.get("page_number")).toBe("1");
  expect(query.get("country")).toBe("DE");
  expect(query.get("device")).toBe("mobile");
  expect(query.get("referrer")).toBe("linkedin");
  expect(query.get("min_seconds")).toBe("30");
});

it("keeps fictional visitor totals consistent and shows a selected journey chronologically", () => {
  const filters = {
    ...defaultAnalyticsFilters(30, now),
    country: "DE",
    device: "mobile" as const,
  };
  const data = fictionalAnalytics(filters, now);
  expect(data.totals.sessions).toBeGreaterThan(0);
  expect(data.countries).toEqual([
    { label: "DE", count: data.totals.sessions },
  ]);
  expect(
    data.events.every(
      (row) => row.device === "mobile" && row.visitor_country === "DE",
    ),
  ).toBe(true);
  const journey = fictionalAnalytics(
    { ...filters, session: data.journeys[0].session_id },
    now,
  );
  expect(journey.events.map((row) => row.created_at)).toEqual(
    journey.events.map((row) => row.created_at).sort(),
  );
});
