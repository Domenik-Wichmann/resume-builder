import type { SupabaseClient } from "@supabase/supabase-js";
import { contentHash } from "../../../../src/lib/embeddings/content";
import { semanticHash } from "../../../../src/lib/ingestion/diff";
import { richDatabaseState } from "../database-state";
import { reconcile, type RichCandidate } from "../evidence";
import { kinds, tableFor } from "../../../../src/lib/ingestion/model";
import { hydrateClaims, type StateRecord } from "./claims";

export async function checked<
  R extends { data: unknown; error: { message: string } | null },
>(r: R): Promise<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
export async function readState(owner: SupabaseClient, accountId: string) {
  const rows = await richDatabaseState(owner, accountId);
  const imports = await checked(
    await owner
      .from("career_imports")
      .select("candidates")
      .eq("account_id", accountId)
      .eq("status", "APPLIED")
      .order("applied_at", { ascending: false }),
  );
  return rows.map((r) => {
    const metadata = imports
      ?.flatMap((b) => b.candidates as RichCandidate[])
      .find((c) => c.kind === r.kind && c.key === r.key);
    return hydrateClaims(
      metadata
        ? { ...r, aliases: metadata.aliases, claims: metadata.claims }
        : r,
    );
  });
}
export async function applyState(
  owner: SupabaseClient,
  accountId: string,
  sourceText: string,
  approved: RichCandidate[],
) {
  const before = await readState(owner, accountId);
  const source = await checked(
    await owner
      .from("career_sources")
      .insert({
        account_id: accountId,
        kind: "MASTER",
        content: sourceText,
        evidence_text: sourceText,
        content_hash: contentHash(sourceText),
      })
      .select("id")
      .single(),
  );
  const reviewed = reconcile(approved, before).records.map((r) => ({
    ...r,
    claims: r.claims.map((c) => ({
      ...c,
      evidence: c.evidence.map((s) => {
        // Exact current spans receive this source ID. Retained historical references
        // keep their actual original source; omitted certificate text is never forged.
        if (sourceText.slice(s.start!, s.end!) === s.quote)
          return { ...s, source_id: source!.id };
        if (!(s as typeof s & { source_id?: string }).source_id)
          throw new Error(`Missing historical provenance: ${r.title}`);
        return s;
      }),
    })),
  }));
  const batch = await checked(
    await owner
      .from("career_imports")
      .insert({
        account_id: accountId,
        source_id: source!.id,
        candidates: reviewed,
        model: "explicit-owner-reviewed-claim-repair",
      })
      .select("id")
      .single(),
  );
  const patches = reviewed.flatMap((r) => {
    const old = before.find((c) => c.kind === r.kind && c.key === r.key);
    if (!sourceText.includes(r.source_quote)) {
      if (!old)
        throw new Error(
          "New canonical record requires exact current primary evidence",
        );
      return [];
    }
    return [
      {
        ...r,
        action: "UPSERT",
        baseline_hash: old?.hash || null,
        baseline_version: old?.updated_at || null,
        hash: semanticHash(r),
      },
    ];
  });
  await checked(
    await owner.rpc("apply_career_import", {
      p_import: batch!.id,
      p_changes: patches,
    }),
  );
  const after = await readState(owner, accountId);
  return {
    sourceId: source!.id,
    before: before.length,
    after: after.length,
    preserved: before.filter((b) => after.some((a) => a.id === b.id)).length,
    state: after,
    metadataOnly: reviewed
      .filter((r) => !sourceText.includes(r.source_quote))
      .map((r) => `${r.kind}:${r.key}`),
  };
}
export async function provenance(
  owner: SupabaseClient,
  accountId: string,
  records: StateRecord[],
) {
  const sources = await checked(
    await owner
      .from("career_sources")
      .select("id,evidence_text")
      .eq("account_id", accountId),
  );
  const spans = records.flatMap((r) => r.claims.flatMap((c) => c.evidence));
  const primary = (
    await Promise.all(
      kinds.map(async (kind) =>
        checked(
          await owner
            .from(tableFor[kind])
            .select("source_id,source_quote")
            .eq("account_id", accountId),
        ),
      ),
    )
  ).flatMap((rows) => rows || []);
  return {
    total: spans.length,
    valid: spans.filter(
      (s) =>
        sources
          ?.find(
            (x) => x.id === (s as typeof s & { source_id?: string }).source_id,
          )
          ?.evidence_text?.slice(s.start!, s.end!) === s.quote,
    ).length,
    primaryTotal: primary.length,
    primaryValid: primary.filter(
      (r) =>
        r.source_quote &&
        sources
          ?.find((s) => s.id === r.source_id)
          ?.evidence_text?.includes(r.source_quote),
    ).length,
  };
}
