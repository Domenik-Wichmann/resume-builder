import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import config from "../next.config";

function model<T>(name: string): T {
  const sandboxModule = { exports: {} };
  runInNewContext(
    readFileSync(
      new URL(`../public/demos/sonaway/assets/${name}.js`, import.meta.url),
      "utf8",
    ),
    { module: sandboxModule },
  );
  return sandboxModule.exports as T;
}
type Answers = Record<string, string>;
type Intake = {
  keys: string[];
  step(answers: Answers, index: number): { options: { id: string }[] };
  validate(answers: Answers): boolean;
  plan(answers: Answers): {
    property: string;
    venue: string;
    guest: string;
    staff: string;
    manager: string;
    period: string;
    owner: string;
  };
};
type Property = {
  createState(): Answers;
  edit(state: Answers, id: string, time: string): Answers;
  inherit(state: Answers, id: string): Answers;
  valueFor(id: string, state: Answers): string;
  sourceFor(id: string, state: Answers): string;
};

it("keeps group propagation, local exceptions and source ownership separate", () => {
  const p = model<Property>("property-model");
  const before = p.createState();
  let state = p.edit(before, "garden", "12:30");
  state = p.edit(state, "core", "14:00");
  expect(p.valueFor("lake", state)).toBe("14:00");
  expect(p.valueFor("rooms", state)).toBe("12:30");
  expect(p.sourceFor("rooms", state)).toBe("garden");
  expect(p.valueFor("alpine", state)).toBe("10:00");
  state = p.inherit(state, "garden");
  expect(p.valueFor("rooms", state)).toBe("14:00");
  expect(p.sourceFor("rooms", state)).toBe("core");
  expect(before.core).toBe("11:00");
  expect(() => p.edit(state, "core", "25:00")).toThrow();
});

it("resolves event-specific policy values while retaining ancestor fallback", () => {
  const m = model<{
    resolve(
      date: string,
      policy: string,
    ): { leaf: string; source: string; value: string } | null;
  }>("knowledge-model");
  expect(m.resolve("2026-12-18", "buffet")?.source).toBe("wedding");
  expect(m.resolve("2026-12-18", "room")?.source).toBe("winter");
  expect(m.resolve("2026-04-16", "buffet")?.source).toBe("festival");
  expect(m.resolve("2026-02-30", "room")).toBeNull();
});

it("every offered conversational route yields complete scoped guidance", () => {
  const m = model<Intake>("intake-model");
  let routes = 0;
  const visit = (answers: Answers, index: number) => {
    if (index === m.keys.length) {
      expect(m.validate(answers)).toBe(true);
      const result = m.plan(answers);
      for (const value of Object.values(result))
        expect(String(value)).not.toContain("undefined");
      expect(result.guest).toContain(result.period);
      expect(result.manager).toContain(result.owner);
      routes++;
      return;
    }
    for (const option of m.step(answers, index).options)
      visit({ ...answers, [m.keys[index]]: option.id }, index + 1);
  };
  visit({}, 0);
  expect(routes).toBeGreaterThan(500);
  expect(m.validate({})).toBe(false);
  expect(() => m.plan({})).toThrow();
});

it("keeps embedded documents local and preserves framing protection on the rest of the app", async () => {
  const rules = await config.headers!();
  expect(rules[0].headers).toContainEqual({
    key: "X-Frame-Options",
    value: "DENY",
  });
  const demoRule = rules.find(
    (rule) => rule.source === "/demos/sonaway/:demo.html",
  )!;
  expect(demoRule.headers).toContainEqual({
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  });
  expect(
    demoRule.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value,
  ).toContain("frame-ancestors 'self'");
  for (const name of ["intake", "projections"]) {
    const html = readFileSync(
      new URL(`../public/demos/sonaway/${name}.html`, import.meta.url),
      "utf8",
    );
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toMatch(/(?:src|href)=["']https?:/);
    for (const match of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
      expect(
        readFileSync(
          new URL(`../public/demos/sonaway/${match[1]}`, import.meta.url),
        ).length,
      ).toBeGreaterThan(0);
    }
  }
});
