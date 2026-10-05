import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyBrain,
  loadBrain,
} from "../../../../src/lib/career-brain/repository";
import { reconcile } from "../../../../src/lib/career-brain/model";
import { semanticHash } from "../../../../src/lib/ingestion/diff";
import { contentHash } from "../../../../src/lib/embeddings/content";
import { checked } from "../claim-repair/database";
import { fixture, type Inputs } from "./fixtures";
export async function publicationSmoke(
  owner: SupabaseClient,
  accountId: string,
  inputs: Inputs,
  write: (name: string, value: unknown) => Promise<void>,
) {
  const source = fixture("A-clean-v1").source;
  const records = reconcile(
    inputs.richV1.records
      .filter((r) => r.kind === "profile" || r.kind === "project")
      .map((r) => ({ ...r, skill_keys: [], achievement_keys: [] })),
    [],
  ).records.map((r) => ({
    ...r,
    claims: r.claims.map((c) => ({ ...c, availability: "CONFIRMED" as const })),
  }));
  const s = await checked(
    await owner
      .from("career_sources")
      .insert({
        account_id: accountId,
        kind: "MASTER",
        content: source,
        evidence_text: source,
        content_hash: contentHash(source),
      })
      .select("id")
      .single(),
  );
  const batch = await checked(
    await owner
      .from("career_imports")
      .insert({
        account_id: accountId,
        source_id: s!.id,
        candidates: records,
        model: "explicit-reviewed-private-fingerprint-smoke",
      })
      .select("id")
      .single(),
  );
  await applyBrain(
    owner,
    accountId,
    batch!.id,
    s!.id,
    source,
    records.map((after) => ({ before: null, after, status: "ADDED" })),
    [],
  );
  const before = await loadBrain(owner, accountId);
  if (
    before.length !== 2 ||
    before.some(
      (r) => !r.claims.length || r.published || semanticHash(r) !== r.hash,
    )
  )
    throw new Error("Private baseline fingerprint failed");
  const project = before.find((r) => r.kind === "project")!;
  // A no-op PRIVATE visibility update exercises the timestamp side effect of
  // publication. No synthetic content is ever set public, even transiently.
  await checked(
    await owner
      .from("projects")
      .update({ is_public: false })
      .eq("account_id", accountId)
      .eq("id", project.id),
  );
  const visibility = await loadBrain(owner, accountId);
  const same = visibility.find((r) => r.id === project.id)!;
  if (
    same.updated_at === project.updated_at ||
    same.claims.length !== project.claims.length ||
    same.claims.some((c) => c.availability !== "CONFIRMED")
  )
    throw new Error("Visibility metadata invalidated approved proof");
  await checked(
    await owner
      .from("projects")
      .update({ title: "Unreviewed warning implementation" })
      .eq("account_id", accountId)
      .eq("id", project.id),
  );
  const edited = await loadBrain(owner, accountId);
  if (
    edited.find((r) => r.id === project.id)!.claims.length ||
    edited.some((r) => r.published)
  )
    throw new Error(
      "Unreviewed edit bypassed fingerprint or synthetic publication guard",
    );
  await write("publication-smoke", {
    providerCalls: 0,
    reviewedRecords: before.length,
    originalClaims: project.claims.length,
    preservedClaimsAfterVisibilityTimestamp: same.claims.length,
    unpublishedThroughout: true,
    changedCanonicalFieldsWithOldStoredHashBlocked: true,
    primaryUntouched: true,
  });
}
