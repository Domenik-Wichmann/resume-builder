import { expect, it } from "vitest";
import {
  extractSourceSchema,
  completeSource,
  careerSourceBodyLimit,
} from "../src/lib/career-brain/source";
import { contentHash } from "../src/lib/embeddings/content";
import { ground } from "../src/lib/career-brain/model";

it.each([39999, 50543, 99999, 100000])(
  "accepts intact %i-character source documents",
  (size) => {
    const text = " " + "x".repeat(size - 2) + " ";
    for (const kind of ["MASTER", "MANUAL"] as const) {
      const input = extractSourceSchema.parse({
        action: "extract",
        text,
        kind,
      });
      expect(input.text).toBe(text);
      expect(contentHash(input.text)).toBe(contentHash(text));
    }
  },
);
it("rejects oversized sources and preserves unrelated interview limits", () => {
  for (const kind of ["MASTER", "MANUAL", "INTERVIEW"]) {
    expect(
      extractSourceSchema.safeParse({
        action: "extract",
        kind,
        text: "x".repeat(100001),
      }).success,
    ).toBe(false);
  }
  expect(
    extractSourceSchema.safeParse({
      action: "extract",
      kind: "INTERVIEW",
      text: "x".repeat(40001),
    }).success,
  ).toBe(false);
  expect(completeSource("MASTER")).toBe(true);
  expect(completeSource("MANUAL")).toBe(false);
  expect(completeSource("INTERVIEW")).toBe(false);
  expect(
    Buffer.byteLength(
      JSON.stringify({
        action: "extract",
        kind: "MASTER",
        text: "\u0001".repeat(100000),
        context: "\u0001".repeat(8000),
      }),
    ),
  ).toBeLessThan(careerSourceBodyLimit);
});
it("grounds late-document spans without truncating or rebasing them", () => {
  const quote = "I wrote SQL checks.";
  const source = "Synthetic capacity fixture.\n".padEnd(50500, " ") + quote;
  const record = ground(
    [
      {
        kind: "project",
        key: "checks",
        title: "Checks",
        subtitle: "",
        summary: "Wrote SQL checks",
        organization: null,
        start_date: null,
        end_date: null,
        skill_keys: [],
        achievement_keys: [],
        category_key: null,
        source_quote: quote,
        uncertainties: [],
        aliases: [],
        claims: [
          {
            attribute: "action",
            value: "Wrote SQL checks",
            attribution: "PERSONAL",
            evidence: [{ quote, start: null, end: null }],
          },
        ],
      },
    ],
    source,
  )[0];
  expect(record.uncertainties).toEqual([]);
  expect(record.claims[0].evidence[0]).toEqual({
    quote,
    start: 50500,
    end: 50519,
  });
});
