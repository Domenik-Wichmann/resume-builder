import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  continuousExtract,
  reconcileOmissions,
  stateRecords,
} from "./continuity";
import { extractRich } from "./extract";
import { applyConflicts, detectConflicts } from "./state";
import { stateDiff, repairEquivalence } from "./equivalence";
import {
  actorFor,
  sourceRevision,
  reviewedSchema,
  type BrainRecord,
} from "./repository";
import { productionGate, type Gate } from "./provider";

export async function proposeBrain(
  db: SupabaseClient,
  accountId: string,
  source: string,
  current: BrainRecord[],
  full = true,
  gate: Gate = productionGate,
) {
  const actor = actorFor(current);
  const conflicts = await detectConflicts(current, source, accountId, gate);
  const masked = applyConflicts(current, conflicts, source);
  let result;
  if (full)
    result = await continuousExtract(
      source,
      await sourceRevision(db, accountId, undefined, current),
      masked,
      actor,
      accountId,
      gate,
    );
  else {
    // An interview is additional evidence. Silence in an answer never archives an
    // unrelated approved entity. Matched components still require current support.
    const extracted = await extractRich(
      source,
      masked,
      accountId,
      gate,
      false,
      true,
      false,
    );
    const matched = masked.filter((r) =>
      extracted.records.some((c) => c.kind === r.kind && c.key === r.key),
    );
    const guarded = await reconcileOmissions(
      extracted.records,
      matched,
      source,
      "",
      actor,
      accountId,
      gate,
    );
    const equivalent = await repairEquivalence(
      guarded.records,
      matched,
      actor,
      accountId,
      gate,
      true,
    );
    result = {
      records: [
        ...equivalent.records,
        ...masked
          .filter(
            (r) =>
              !equivalent.records.some(
                (c) => c.kind === r.kind && c.key === r.key,
              ) &&
              stateDiff(
                [r],
                current.filter((c) => c.id === r.id),
                actor,
                false,
              )[0]?.status !== "UNCHANGED",
          )
          .map((r) => ({
            ...r,
            review_required: true,
            uncertainties: [
              ...r.uncertainties,
              "New interview evidence conflicts with approved history; owner review required.",
            ],
          })),
      ],
      decisions: {
        identity: extracted.decisions,
        audit: extracted.audit,
        omissions: guarded.decisions,
        equivalence: equivalent.decisions,
      },
    };
  }
  const fresh = conflicts.conflicts.length
    ? await detectConflicts(
        stateRecords(result.records),
        source,
        accountId,
        gate,
      )
    : { conflicts: [] };
  const records = applyConflicts(stateRecords(result.records), fresh, source);
  const changes = stateDiff(records, masked, actor, full);
  // Availability changes are material even when other masked factual fields match.
  for (const change of changes) {
    const before = current.find(
      (r) => r.kind === change.after?.kind && r.key === change.after?.key,
    );
    if (before) change.before = before;
    if (
      change.status === "UNCHANGED" &&
      before &&
      stateDiff(
        [
          records.find(
            (r) => r.kind === change.after?.kind && r.key === change.after?.key,
          )!,
        ],
        [before],
        actor,
        false,
      )[0].status !== "UNCHANGED"
    )
      change.status = "UPDATED";
    if (change.after)
      change.after = reviewedSchema.strip().parse({
        ...change.after,
        uncertainties: change.after.uncertainties
          .slice(0, 10)
          .map((s) => s.slice(0, 300)),
      });
  }
  return { changes, decisions: result.decisions, conflicts, fresh };
}
