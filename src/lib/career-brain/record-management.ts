import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateSchema, kinds } from "../ingestion/model";
import { semanticHash } from "../ingestion/diff";
import { contentHash } from "../embeddings/content";
import { HttpError } from "../http";
import { claimSchema } from "./model";
import { availability } from "./state";
import { loadBrain, type BrainRecord } from "./repository";
import {
  publishable,
  type RecordEdit,
  type RecordSelection,
} from "./record-view";
export const selectionSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(kinds),
    hash: z.string().length(64),
    updated_at: z.string().min(1).max(60),
    evidence_version: z.string().max(60).nullable(),
  })
  .strict();
const fields = candidateSchema.shape;
const editSchema = z
  .object({
    title: fields.title,
    subtitle: fields.subtitle,
    summary: fields.summary,
    organization: fields.organization,
    start_date: fields.start_date,
    end_date: fields.end_date,
    skill_keys: fields.skill_keys,
    achievement_keys: fields.achievement_keys,
    category_key: fields.category_key,
    aliases: z.array(z.string().min(1).max(200)).max(12),
    claims: z
      .array(
        claimSchema.omit({ evidence: true }).safeExtend({
          index: z.number().int().min(0).max(99).nullable(),
          availability,
          conflict: z.string().max(500),
        }),
      )
      .max(100),
    note: z.string().trim().min(10).max(500),
    confirmed: z.literal(true),
    description_attribution: claimSchema.shape.attribution,
  })
  .strict();
export const managementSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("edit"),
      record: selectionSchema,
      edit: editSchema,
    })
    .strict(),
  z
    .object({
      action: z.enum(["publish", "unpublish", "archive", "restore"]),
      records: z.array(selectionSchema).min(1).max(150),
    })
    .strict(),
]);
export async function explorerData(db: SupabaseClient, accountId: string) {
  const [records, sources] = await Promise.all([
    loadBrain(db, accountId),
    db
      .from("career_sources")
      .select("id,kind,created_at")
      .eq("account_id", accountId),
  ]);
  if (sources.error) throw new Error("Cannot load source information.");
  return { records, sources: sources.data || [] };
}
export function checkSelection(
  records: BrainRecord[],
  selection: RecordSelection,
) {
  const row = records.find(
    (r) => r.id === selection.id && r.kind === selection.kind,
  );
  if (!row) throw new HttpError(404, "Record not found.");
  if (
    row.hash !== selection.hash ||
    row.updated_at !== selection.updated_at ||
    row.evidence_version !== selection.evidence_version
  )
    throw new HttpError(
      409,
      "This record changed in another view. Refresh before trying again.",
    );
  return row;
}
export function prepareManualEdit(
  row: BrainRecord,
  edit: RecordEdit,
  records: BrainRecord[],
) {
  if (row.archived)
    throw new HttpError(400, "Restore this record before editing it.");
  const candidate = candidateSchema.strip().parse({
    ...row,
    ...edit,
    kind: row.kind,
    key: row.key,
    source_quote: row.source_quote,
    uncertainties: [],
  });
  if (
    ["skill", "category"].includes(row.kind) &&
    candidate.subtitle !== row.subtitle
  )
    throw new HttpError(400, "This record type does not have a subtitle.");
  // Parse only canonical fields; browser metadata cannot become patch authority.
  for (const [kind, keys] of [
    ["skill", candidate.skill_keys],
    ["achievement", candidate.achievement_keys],
    ["category", candidate.category_key ? [candidate.category_key] : []],
  ] as const)
    if (
      keys.some(
        (key) =>
          !records.some((r) => r.kind === kind && r.key === key && !r.archived),
      )
    )
      throw new HttpError(
        400,
        "A connected record is unavailable. Refresh the connections.",
      );
  if (
    new Set(candidate.skill_keys).size !== candidate.skill_keys.length ||
    new Set(candidate.achievement_keys).size !==
      candidate.achievement_keys.length
  )
    throw new HttpError(400, "Connections must be unique.");
  const sourceId = randomUUID();
  let source = `Owner-reviewed manual edit\n${row.kind}: ${edit.title}\nTitle: ${edit.title}\nSubtitle: ${edit.subtitle}\nOrganization: ${edit.organization || "Not specified"}\nStart: ${edit.start_date || "Not specified"}\nEnd: ${edit.end_date || "Not specified"}\nDescription: ${edit.summary}\nConnected skills: ${edit.skill_keys.map((k) => records.find((r) => r.kind === "skill" && r.key === k)?.title).join(", ")}\nConnected achievements: ${edit.achievement_keys.map((k) => records.find((r) => r.kind === "achievement" && r.key === k)?.title).join(", ")}\nCategory: ${records.find((r) => r.kind === "category" && r.key === edit.category_key)?.title || "None"}\nOwner correction: ${edit.note}\nI confirm the edited facts and their ownership/review qualifiers below.\n`;
  const claims: BrainRecord["claims"] = [];
  const used = new Set<number>();
  function ownerClaim(c: Omit<BrainRecord["claims"][number], "evidence">) {
    if (c.availability === "CONFIRMED" && c.attribution === "UNCERTAIN")
      throw new HttpError(
        400,
        "An uncertain fact must remain pending or disputed.",
      );
    const start = source.length;
    source += c.value;
    const end = source.length;
    source += `\nAttribution: ${c.attribution}; review: ${c.availability}${c.conflict ? "; uncertainty: " + c.conflict : ""}\n`;
    const proof = {
      ...c,
      evidence: [{ quote: c.value, start, end, source_id: sourceId }],
    };
    claims.push(proof);
  }
  for (const editClaim of edit.claims) {
    const { index, ...next } = editClaim;
    if (index !== null) {
      if (used.has(index) || !row.claims[index])
        throw new HttpError(
          400,
          "A fact was selected more than once or is unavailable.",
        );
      used.add(index);
      const old = row.claims[index];
      const unchanged =
        old.attribute === next.attribute &&
        old.value === next.value &&
        old.attribution === next.attribution &&
        old.availability === next.availability &&
        (old.conflict || "") === next.conflict;
      if (unchanged) {
        claims.push(old);
        continue;
      }
      if (
        next.availability === "REMOVED" &&
        old.value === next.value &&
        old.attribute === next.attribute &&
        old.attribution === next.attribution
      ) {
        claims.push({
          ...old,
          availability: "REMOVED",
          conflict: next.conflict,
        });
        continue;
      }
      claims.push({ ...old, availability: "SUPERSEDED" });
    }
    ownerClaim(next);
  }
  if (used.size !== row.claims.length)
    throw new HttpError(
      400,
      "Keep historical facts in the review; mark removed facts instead of deleting their evidence.",
    );
  if (edit.summary !== row.summary && edit.summary.trim()) {
    let chunk = "";
    for (const character of edit.summary) {
      if (chunk.length + character.length > 500) {
        ownerClaim({
          attribute: "context",
          value: chunk,
          attribution: edit.description_attribution,
          availability:
            edit.description_attribution === "UNCERTAIN"
              ? "PENDING_REVIEW"
              : "CONFIRMED",
        });
        chunk = "";
      }
      chunk += character;
    }
    if (chunk)
      ownerClaim({
        attribute: "context",
        value: chunk,
        attribution: edit.description_attribution,
        availability:
          edit.description_attribution === "UNCERTAIN"
            ? "PENDING_REVIEW"
            : "CONFIRMED",
      });
  }
  if (claims.length > 100)
    throw new HttpError(
      400,
      "This edit exceeds the fact limit. Keep the existing history and make a smaller correction.",
    );
  if (
    edit.summary !== row.summary &&
    claims.some(
      (c) =>
        c.availability === "CONFIRMED" &&
        c.attribution === "TEAM" &&
        ["action", "metric", "ownership"].includes(c.attribute),
    ) &&
    !/\b(team|we|shared|collective|supervisors?|coworkers?|operators?)\b/i.test(
      edit.summary,
    )
  )
    throw new HttpError(
      400,
      "The description must preserve team attribution, or the affected facts must be corrected explicitly.",
    );
  const primary = `${row.kind}: ${edit.title}`;
  return {
    sourceId,
    source,
    sourceHash: contentHash(source),
    patch: {
      ...candidate,
      source_quote: primary,
      hash: semanticHash(candidate),
      action: "UPSERT",
      baseline_hash: row.hash,
      baseline_version: row.updated_at,
    },
    state: {
      kind: row.kind,
      key: row.key,
      aliases: edit.aliases,
      claims,
      baseline_hash: row.hash,
      baseline_version: row.updated_at,
      evidence_version: row.evidence_version,
    },
  };
}
export async function manageRecords(
  db: SupabaseClient,
  accountId: string,
  input: z.infer<typeof managementSchema>,
  current: BrainRecord[],
) {
  let result;
  if (input.action === "edit") {
    const row = checkSelection(current, input.record);
    const prepared = prepareManualEdit(row, input.edit, current);
    result = await db.rpc("save_career_record", {
      p_account: accountId,
      p_record: input.record,
      p_source_id: prepared.sourceId,
      p_source: prepared.source,
      p_source_hash: prepared.sourceHash,
      p_patch: prepared.patch,
      p_state: prepared.state,
    });
  } else {
    if (new Set(input.records.map((r) => r.id)).size !== input.records.length)
      throw new HttpError(400, "Select each record only once.");
    for (const selected of input.records) {
      const row = checkSelection(current, selected);
      if (input.action === "publish" && !publishable(row))
        throw new HttpError(
          400,
          `${row.title} needs confirmed evidence before publication.`,
        );
    }
    result = await db.rpc("change_career_records", {
      p_account: accountId,
      p_action: input.action,
      p_records: input.records,
    });
  }
  if (result.error)
    throw new HttpError(
      result.error.message.includes("STALE") ? 409 : 400,
      result.error.message.includes("STALE")
        ? "A selected record changed. Refresh before trying again; nothing was applied."
        : "Cannot save these changes. Refresh the records and check their evidence.",
    );
  return result.data;
}
