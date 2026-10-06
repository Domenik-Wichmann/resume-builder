import { afterEach, expect, it, vi } from "vitest";
import type { BrainRecord } from "../src/lib/career-brain/repository";
const mocks = vi.hoisted(() => ({ load: vi.fn(), db: {} }));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.load,
}));
vi.mock("../src/lib/db", () => ({ database: () => mocks.db }));
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
import { getCareer } from "../src/lib/career/repository";
import { primaryAccountId } from "../src/lib/account-id";
import { semanticEntities } from "../src/lib/embeddings/content";

afterEach(() => vi.clearAllMocks());
function record(
  id: string,
  kind: BrainRecord["kind"],
  extra: Partial<BrainRecord> = {},
): BrainRecord {
  return {
    id,
    kind,
    key: id,
    title: `Fictional ${id}`,
    subtitle: "",
    summary: "Synthetic test evidence",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: "Synthetic test evidence",
    uncertainties: [],
    hash: "test",
    published: true,
    archived: false,
    updated_at: "2026-10-06",
    evidence_version: null,
    aliases: [],
    claims: [
      {
        attribute: "action",
        value: "Synthetic test evidence",
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [{ quote: "Synthetic test evidence", start: 0, end: 23 }],
      },
    ],
    ...extra,
  };
}

it("projects only published, active, usable relationship endpoints and leaves embedding content unchanged", async () => {
  mocks.load.mockResolvedValue([
    record("role", "experience", {
      skill_keys: ["sql", "private", "archived", "unapproved"],
      achievement_keys: ["outcome"],
    }),
    record("sql", "skill"),
    record("outcome", "achievement"),
    record("private", "skill", { published: false }),
    record("archived", "skill", { archived: true }),
    record("unapproved", "skill", { claims: [] }),
  ]);
  const career = await getCareer();
  expect(mocks.load).toHaveBeenCalledWith(mocks.db, primaryAccountId, true);
  expect(career.experiences[0].related_ids).toEqual(["sql", "outcome"]);
  expect(career.skill_records.map((r) => r.id)).toEqual(["sql"]);
  const original = semanticEntities(career).map((e) => e.hash);
  career.experiences[0].related_ids = [];
  expect(semanticEntities(career).map((e) => e.hash)).toEqual(original);
});
