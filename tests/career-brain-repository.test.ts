import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanonical } from "../src/lib/ingestion/repository";
import {
  loadBrain,
  sourceRevision,
  applyBrain,
} from "../src/lib/career-brain/repository";
import { stateDiff } from "../src/lib/career-brain/equivalence";
import { readFile } from "node:fs/promises";
import { semanticHash } from "../src/lib/ingestion/diff";
import type { BrainRecord } from "../src/lib/career-brain/repository";
vi.mock("../src/lib/ingestion/repository", () => ({ loadCanonical: vi.fn() }));
async function sample(): Promise<BrainRecord> {
  const data = JSON.parse(
    await readFile(
      "experiments/career-brain/v2/omission-repair/results/repeat-state.json",
      "utf8",
    ),
  );
  return { ...data.current[0], evidence_version: null };
}
function database(tables: Record<string, unknown[]>) {
  return {
    from: (table: string) => {
      const query = {
        data: tables[table] || [],
        error: null,
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
      };
      return query;
    },
  } as unknown as SupabaseClient;
}
it("persists explicit owner presentation corrections without calling wording a factual update or rewriting native unchanged imports", async () => {
  const source = "Synthetic fixture: Sam built validation checks.";
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const proof = {
    quote: source,
    start: 0,
    end: source.length,
    source_id: sourceId,
  };
  const r: BrainRecord = {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "project",
    key: "checks",
    title: "Checks",
    subtitle: "",
    summary: "Overstated display wording",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: source,
    uncertainties: [],
    aliases: [],
    claims: [
      {
        attribute: "action",
        value: "Built validation checks",
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [proof],
      },
    ],
    hash: "",
    published: false,
    archived: false,
    updated_at: "2026-10-05T00:00:00Z",
    evidence_version: null,
  };
  r.hash = semanticHash(r);
  const after = { ...r, summary: "Built validation checks" };
  const changes = stateDiff(
    [after],
    [r],
    { name: "Sam", aliases: [], firstPersonOwner: true },
    false,
  );
  expect(changes[0].status).toBe("UNCHANGED");
  const db = database({
    career_sources: [{ id: sourceId, evidence_text: source }],
  });
  const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
  db.rpc = rpc;
  await applyBrain(db, "tenant", "batch", sourceId, source, changes, [r]);
  expect(rpc.mock.calls[0][1].p_changes).toEqual([]);
  await applyBrain(
    db,
    "tenant",
    "batch",
    sourceId,
    source,
    changes.map((c) => ({ ...c, presentation_edit: true })),
    [r],
  );
  const patch = rpc.mock.calls[1][1].p_changes[0];
  expect(patch).toMatchObject({
    key: r.key,
    summary: after.summary,
    hash: semanticHash(after),
    baseline_hash: r.hash,
    baseline_version: r.updated_at,
    action: "UPSERT",
  });
  expect(rpc.mock.calls[1][1].p_states[0].claims[0].availability).toBe(
    "CONFIRMED",
  );
  await expect(
    applyBrain(
      db,
      "tenant",
      "batch",
      sourceId,
      "Different current source",
      changes.map((c) => ({ ...c, presentation_edit: true })),
      [r],
    ),
  ).rejects.toThrow(
    "Changed canonical fields require current primary evidence",
  );
});
it("withholds legacy and stale canonical claims instead of fabricating evidence", async () => {
  const r = await sample();
  vi.mocked(loadCanonical).mockResolvedValue([r]);
  expect((await loadBrain(database({}), "tenant"))[0].claims).toEqual([]);
  const db = database({
    career_record_evidence: [
      {
        kind: r.kind,
        entity_id: r.id,
        canonical_version: "stale",
        canonical_hash: "stale",
        claims: r.claims,
        aliases: [],
      },
    ],
  });
  expect((await loadBrain(db, "tenant"))[0].claims).toEqual([]);
});
it("downgrades wrong-offset source spans even if the quote occurs elsewhere in the source", async () => {
  const r = await sample();
  const quote = r.claims[0].evidence[0].quote;
  const sourceId = "11111111-1111-4111-8111-111111111111";
  vi.mocked(loadCanonical).mockResolvedValue([r]);
  const db = database({
    career_record_evidence: [
      {
        kind: r.kind,
        entity_id: r.id,
        canonical_version: r.updated_at,
        canonical_hash: r.hash,
        aliases: [],
        claims: [
          {
            ...r.claims[0],
            availability: "CONFIRMED",
            evidence: [
              { quote, start: 0, end: quote.length, source_id: sourceId },
            ],
          },
        ],
      },
    ],
    career_sources: [{ id: sourceId, evidence_text: `🙂 ${quote}` }],
  });
  expect((await loadBrain(db, "tenant"))[0].claims[0].availability).toBe(
    "PENDING_REVIEW",
  );
});
it("does not mistake a partially accepted source revision for reviewed proof of every older component", async () => {
  const r = await sample();
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const db = database({
    career_imports: [{ source_id: sourceId }],
    career_sources: [
      {
        id: sourceId,
        evidence_text: "Latest correction with older passage still present",
      },
    ],
  });
  expect(await sourceRevision(db, "tenant", undefined, [r])).toBe("");
  const current = {
    ...r,
    claims: r.claims.map((c) => ({
      ...c,
      availability: "CONFIRMED" as const,
      evidence: c.evidence.map((s) => ({ ...s, source_id: sourceId })),
    })),
  };
  expect(await sourceRevision(db, "tenant", undefined, [current])).toContain(
    "Latest correction",
  );
});
it("retains approved proof after publication timestamp changes and rejects an actual edit carrying the old stored hash", async () => {
  const r = await sample();
  const row = {
    ...r,
    hash: semanticHash(r),
    updated_at: "2026-10-05T00:00:00Z",
    published: true,
  };
  const quote = r.claims[0].evidence[0].quote;
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const db = database({
    career_record_evidence: [
      {
        kind: r.kind,
        entity_id: r.id,
        canonical_version: r.updated_at,
        canonical_hash: row.hash,
        aliases: [],
        claims: [
          {
            ...r.claims[0],
            availability: "CONFIRMED",
            evidence: [
              { quote, start: 0, end: quote.length, source_id: sourceId },
            ],
          },
        ],
      },
    ],
    career_sources: [{ id: sourceId, evidence_text: quote }],
  });
  vi.mocked(loadCanonical).mockResolvedValue([row]);
  expect((await loadBrain(db, "tenant", true))[0].claims[0].availability).toBe(
    "CONFIRMED",
  );
  vi.mocked(loadCanonical).mockResolvedValue([
    { ...row, summary: "Unreviewed implementation with the old stored hash" },
  ]);
  expect((await loadBrain(db, "tenant", true))[0].claims).toEqual([]);
});
