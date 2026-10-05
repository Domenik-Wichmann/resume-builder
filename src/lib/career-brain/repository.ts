import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanonical } from "../ingestion/repository";
import { semanticHash } from "../ingestion/diff";
import { type Candidate, type Canonical } from "../ingestion/model";
import {
  claimSchema,
  richSchema,
  spanSchema,
  type RichCandidate,
} from "./model";
import { availability, type StateRecord } from "./state";

const storedClaim = claimSchema.safeExtend({
  availability,
  conflict: z.string().max(500).optional(),
  evidence: z
    .array(spanSchema.safeExtend({ source_id: z.uuid() }))
    .min(1)
    .max(6),
});
export const reviewedSchema = richSchema.safeExtend({
  claims: z
    .array(
      storedClaim.extend({
        evidence: z
          .array(spanSchema.safeExtend({ source_id: z.uuid().optional() }))
          .min(1)
          .max(6),
      }),
    )
    .max(100),
});
export type BrainRecord = StateRecord & { evidence_version: string | null };
export async function loadBrain(
  db: SupabaseClient,
  accountId: string,
  publicOnly = false,
): Promise<BrainRecord[]> {
  const current = await loadCanonical(db, accountId, publicOnly);
  const evidence = await db
    .from("career_record_evidence")
    .select(
      "kind,entity_id,canonical_version,canonical_hash,aliases,claims,updated_at",
    )
    .eq("account_id", accountId);
  if (evidence.error) throw new Error("Cannot load approved claim evidence");
  const selected = current.map((r) => ({
    r,
    e: evidence.data.find((e) => e.kind === r.kind && e.entity_id === r.id),
  }));
  const sourceIds = [
    ...new Set(
      selected.flatMap(({ e }) => {
        const parsed = z.array(storedClaim).max(100).safeParse(e?.claims);
        return parsed.success
          ? parsed.data.flatMap((c) => c.evidence.map((s) => s.source_id))
          : [];
      }),
    ),
  ];
  const sources = sourceIds.length
    ? await db
        .from("career_sources")
        .select("id,evidence_text")
        .eq("account_id", accountId)
        .in("id", sourceIds)
    : { data: [], error: null };
  if (sources.error)
    throw new Error("Cannot verify approved source provenance");
  return selected.map(({ r, e }) => {
    const claims = z.array(storedClaim).max(100).safeParse(e?.claims);
    const valid =
      claims.success &&
      e?.canonical_hash === r.hash &&
      // Publication changes updated_at without changing approved facts. Recompute
      // the actual canonical fields so a stale/forged stored hash cannot license edits.
      semanticHash(r) === r.hash;
    return {
      ...r,
      aliases:
        z.array(z.string().max(200)).max(12).safeParse(e?.aliases).data || [],
      claims: valid
        ? claims.data.map((c) => ({
            ...c,
            availability: c.evidence.every(
              (s) =>
                sources.data
                  ?.find((x) => x.id === s.source_id)
                  ?.evidence_text.slice(s.start!, s.end!) === s.quote,
            )
              ? c.availability
              : ("PENDING_REVIEW" as const),
          }))
        : [],
      evidence_version: e?.updated_at || null,
    };
  });
}
export async function sourceRevision(
  db: SupabaseClient,
  accountId: string,
  sourceId?: string,
  current: BrainRecord[] = [],
) {
  let query = db
    .from("career_sources")
    .select("id,evidence_text")
    .eq("account_id", accountId);
  if (sourceId) query = query.eq("id", sourceId);
  else {
    const applied = await db
      .from("career_imports")
      .select("source_id")
      .eq("account_id", accountId)
      .eq("status", "APPLIED")
      .order("applied_at", { ascending: false })
      .limit(1);
    if (applied.error) throw new Error("Cannot load reviewed source revision");
    if (!applied.data[0]) return "";
    // A partially accepted import is not a reviewed revision for every old fact.
    // Mixed historical proof must use bounded current-source adjudication.
    if (
      current.some((r) =>
        r.claims.some(
          (c) =>
            c.availability === "CONFIRMED" &&
            c.evidence.some(
              (s) =>
                (s as typeof s & { source_id?: string }).source_id !==
                applied.data[0].source_id,
            ),
        ),
      )
    )
      return "";
    query = query.eq("id", applied.data[0].source_id);
  }
  const result = await query;
  if (result.error) throw new Error("Cannot load source revision");
  return result.data[0]?.evidence_text || "";
}
export async function applyBrain(
  db: SupabaseClient,
  accountId: string,
  importId: string,
  sourceId: string,
  source: string,
  changes: {
    before: Canonical | null;
    after: Candidate | null;
    status: string;
    presentation_edit?: boolean;
  }[],
  current: BrainRecord[],
) {
  const approved = changes.map((c) => ({
    change: c,
    record: reviewedSchema.strip().parse(c.after || c.before),
  }));
  const patches = approved.flatMap(({ change, record }) => {
    const old = current.find(
      (r) => r.kind === record.kind && r.key === record.key,
    );
    const baseline = {
      baseline_hash: old?.hash ?? null,
      baseline_version: old?.updated_at || null,
    };
    if (change.status === "REMOVED")
      return [{ ...record, ...baseline, action: "ARCHIVE", hash: old!.hash }];
    if (!source.includes(record.source_quote)) {
      if (!old || semanticHash(record) !== old.hash)
        throw new Error(
          "Changed canonical fields require current primary evidence",
        );
      return [];
    }
    // Factual equivalence remains UNCHANGED. Only an explicit owner revision
    // may persist an editorial correction; generated rewording remains a no-op.
    if (
      change.status === "UNCHANGED" &&
      (!change.presentation_edit || semanticHash(record) === old?.hash)
    )
      return [];
    return [
      { ...record, ...baseline, action: "UPSERT", hash: semanticHash(record) },
    ];
  });
  const proofIds = [
    ...new Set(
      approved.flatMap(({ record }) =>
        record.claims.flatMap((c) =>
          c.evidence.flatMap((s) => (s.source_id ? [s.source_id] : [])),
        ),
      ),
    ),
  ];
  const prior = proofIds.length
    ? await db
        .from("career_sources")
        .select("id,evidence_text")
        .eq("account_id", accountId)
        .in("id", proofIds)
    : { data: [], error: null };
  if (prior.error) throw new Error("Cannot verify historical evidence");
  const states = approved.map(({ record }) => {
    const old = current.find(
      (r) => r.kind === record.kind && r.key === record.key,
    );
    const claims = record.claims.map((c) => ({
      ...c,
      evidence: c.evidence.map((s) => {
        if (source.slice(s.start!, s.end!) === s.quote)
          return { ...s, source_id: sourceId };
        if (
          !s.source_id ||
          prior.data
            ?.find((x) => x.id === s.source_id)
            ?.evidence_text.slice(s.start!, s.end!) !== s.quote
        )
          throw new Error("Invalid exact claim provenance");
        return s;
      }),
    }));
    return {
      kind: record.kind,
      key: record.key,
      aliases: record.aliases,
      claims,
      baseline_hash: old?.hash ?? null,
      baseline_version: old?.updated_at || null,
      evidence_version: old?.evidence_version || null,
    };
  });
  const result = await db.rpc("apply_career_brain_import", {
    p_import: importId,
    p_changes: patches,
    p_states: states,
  });
  if (result.error)
    throw new Error(
      result.error.message.includes("STALE")
        ? "STALE_IMPORT"
        : "Cannot commit reviewed career evidence",
    );
  return result.data;
}

export const legacyBrain = (r: Canonical): BrainRecord => ({
  ...r,
  aliases: [],
  claims: [],
  evidence_version: null,
});
export const actorFor = (records: RichCandidate[]) => {
  const profile = records.find((r) => r.kind === "profile");
  return {
    name: profile?.title || "",
    aliases: profile?.aliases || [],
    firstPersonOwner: true,
  };
};
