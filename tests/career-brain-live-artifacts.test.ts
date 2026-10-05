import { readFile } from "node:fs/promises";
import { it, expect } from "vitest";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import { usable } from "../src/lib/career-brain/state";
import { semanticHash } from "../src/lib/ingestion/diff";
it("qualifies seven factual transitions using actual owner-reviewed production database states, without rewarding summary wording", async () => {
  const data = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/omission-repair/results/production-smoke.json",
      "utf8",
    ),
  ) as {
    v1: { state: BrainRecord[] };
    v2: { state: BrainRecord[] };
    v3: { state: BrainRecord[] };
  };
  const [v1, v2, v3] = [data.v1.state, data.v2.state, data.v3.state];
  for (const row of [...v1, ...v2, ...v3])
    expect(semanticHash(row)).toBe(row.hash);
  expect(v1.find((r) => r.kind === "experience")!.end_date).toBe("2024-05-31");
  expect(v2.find((r) => r.kind === "experience")!.end_date).toBe("2024-06-30");
  const cert = (records: BrainRecord[]) =>
    records.find((r) => r.kind === "certification")!;
  expect(cert(v1).id).toBe(cert(v3).id);
  expect(
    cert(v2).claims.every((c) => c.availability === "PENDING_REVIEW"),
  ).toBe(true);
  expect(cert(v3).claims.every((c) => c.availability === "CONFIRMED")).toBe(
    true,
  );
  const unavailableCounts = v3
    .flatMap((r) => r.claims)
    .filter(
      (c) => /\b12\b/.test(c.value) && /train|cowork|workshop/i.test(c.value),
    );
  expect(unavailableCounts.length).toBeGreaterThan(0);
  expect(unavailableCounts.every((c) => !usable(c))).toBe(true);
  for (const old of v1) {
    const now = v3.find((r) => r.id === old.id)!;
    for (const key of old.skill_keys) expect(now.skill_keys).toContain(key);
    for (const key of old.achievement_keys)
      expect(now.achievement_keys).toContain(key);
    expect(now.category_key).toBe(old.category_key);
  }
  const roster2 = v2.find((r) => r.title === "Roster Note")!;
  const roster3 = v3.find((r) => r.title === "Roster Note")!;
  expect(roster2).toBeDefined();
  expect(roster3.id).toBe(roster2.id);
  expect(
    roster3.claims.some(
      (c) => usable(c) && /documented.*handover/i.test(c.value),
    ),
  ).toBe(true);
  expect(
    v3
      .find((r) => r.title === "SQL")!
      .claims.some((c) => usable(c) && /extensive/i.test(c.value)),
  ).toBe(true);
  const docker = v3.find((r) => r.title === "Docker")!;
  expect(
    docker.claims.every(
      (c) => c.attribution === "EXPOSURE" && /one-off/i.test(c.value),
    ),
  ).toBe(true);
});
