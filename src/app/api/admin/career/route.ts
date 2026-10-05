import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError, reserveAIQuota } from "@/lib/http";
import { candidateSchema, tableFor, type Change } from "@/lib/ingestion/model";
import {
  explorerData,
  manageRecords,
} from "@/lib/career-brain/record-management";
import { selectionFor } from "@/lib/career-brain/record-view";
import { identity, semanticHash } from "@/lib/ingestion/diff";
import {
  loadBrain,
  reviewedSchema,
  applyBrain,
  actorFor,
} from "@/lib/career-brain/repository";
import { proposeBrain } from "@/lib/career-brain/propose";
import { stateDiff } from "@/lib/career-brain/equivalence";
import { interviewQuestions } from "@/lib/interview/questions";
import { reindexCareer } from "@/lib/embeddings/indexer";
import { contentHash } from "@/lib/embeddings/content";
export const maxDuration = 300;
import {
  extractSourceSchema,
  careerSourceLimit,
  careerSourceBodyLimit,
  completeSource,
} from "@/lib/career-brain/source";
const inputSchema = z.discriminatedUnion("action", [
  extractSourceSchema,
  z
    .object({
      action: z.literal("revise"),
      id: z.uuid(),
      index: z.number().int().min(0),
      candidate: z.union([reviewedSchema.strip(), candidateSchema]),
    })
    .strict(),
  z
    .object({
      action: z.literal("apply"),
      id: z.uuid(),
      accepted: z.array(z.number().int().min(0)).max(150),
    })
    .strict(),
  z
    .object({
      action: z.literal("publish"),
      kind: z.enum(
        Object.keys(tableFor) as [
          keyof typeof tableFor,
          ...(keyof typeof tableFor)[],
        ],
      ),
      key: z.string().max(100),
      published: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("interview"),
      mode: z.enum(["general", "job", "record"]),
      job: z.string().max(12000),
      key: z.string().nullable(),
      asked: z.array(z.string()).max(100),
    })
    .strict(),
  z.object({ action: z.literal("reindex") }).strict(),
  z.object({ action: z.literal("reject"), id: z.uuid() }).strict(),
]);
export async function GET() {
  try {
    const { db, accountId } = await requireAccount();
    const [data, imports] = await Promise.all([
      explorerData(db, accountId),
      db
        .from("career_imports")
        .select("id,status,model,created_at,candidates")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (imports.error) throw new Error("Cannot load imports.");
    return Response.json(
      { ...data, imports: imports.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_IMPORT")
      return errorResponse(
        new HttpError(
          409,
          "Career evidence changed since this review. Re-import to compare again.",
        ),
      );
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, accountId } = await requireAccount();
    const input = await readJson(request, inputSchema, careerSourceBodyLimit);
    if (input.action === "reindex")
      return Response.json(await reindexCareer(accountId));
    const current = await loadBrain(db, accountId);
    if (input.action === "interview") {
      if (
        input.mode === "record" &&
        !current.some((row) => identity(row) === input.key)
      )
        throw new HttpError(404, "Career record not found.");
      return Response.json({
        questions: interviewQuestions(
          current,
          input.mode,
          input.job,
          input.key,
          input.asked,
        ),
      });
    }
    if (input.action === "publish") {
      const row = current.find(
        (row) => row.kind === input.kind && row.key === input.key,
      );
      if (!row || row.archived)
        throw new HttpError(404, "Active career record not found.");
      await manageRecords(
        db,
        accountId,
        {
          action: input.published ? "publish" : "unpublish",
          records: [selectionFor(row)],
        },
        current,
      );
      let indexing;
      try {
        indexing = await reindexCareer(accountId);
      } catch {
        indexing = {
          pending: true,
          message:
            "Publication saved. Indexing needs a retry; stale vectors cannot supply facts.",
        };
      }
      return Response.json({ published: input.published, indexing });
    }
    if (input.action === "extract") {
      await reserveAIQuota();
      const source = input.text;
      if (source.length > careerSourceLimit)
        throw new HttpError(
          400,
          "Career source documents must fit within 100,000 characters.",
        );
      const { changes } = await proposeBrain(
        db,
        accountId,
        source,
        current,
        completeSource(input.kind),
      );
      const savedSource = await db
        .from("career_sources")
        .insert({
          account_id: accountId,
          kind: input.kind,
          content: source,
          evidence_text: input.text,
          content_hash: contentHash(source),
        })
        .select("id")
        .single();
      if (savedSource.error) throw new Error("Cannot save import source.");
      const batch = await db
        .from("career_imports")
        .insert({
          account_id: accountId,
          source_id: savedSource.data.id,
          candidates: changes,
          model: "openai/gpt-6-luna-pro:career-brain-owner-review",
        })
        .select("id,candidates,status")
        .single();
      if (batch.error) {
        await db.from("career_sources").delete().eq("id", savedSource.data.id);
        throw new Error("Cannot save review draft.");
      }
      return Response.json({ import: batch.data });
    }
    const batch = await db
      .from("career_imports")
      .select("*")
      .eq("id", input.id)
      .eq("account_id", accountId)
      .single();
    if (batch.error || !batch.data || batch.data.status !== "DRAFT")
      throw new HttpError(409, "This draft is unavailable or already applied.");
    const changes = batch.data.candidates as Change[];
    if (input.action === "reject") {
      const result = await db
        .from("career_imports")
        .update({ status: "REJECTED" })
        .eq("id", input.id)
        .eq("status", "DRAFT");
      if (result.error) throw new Error("Cannot reject draft.");
      return Response.json({ rejected: true });
    }
    if (input.action === "revise") {
      if (!changes[input.index]?.after)
        throw new HttpError(400, "Only candidate records can be edited.");
      const source = await db
        .from("career_sources")
        .select("evidence_text")
        .eq("id", batch.data.source_id)
        .single();
      if (source.error) throw new Error("Cannot load provenance.");
      const prior = current.find(
        (r) => identity(r) === changes[input.index].identity,
      );
      const historicalOnly =
        prior &&
        input.candidate.source_quote === prior.source_quote &&
        semanticHash(input.candidate) === prior.hash;
      if (
        !source.data.evidence_text.includes(input.candidate.source_quote) &&
        !historicalOnly
      )
        throw new HttpError(400, "Provide a quotation from the stored source.");
      const incoming = changes.flatMap((change, index) =>
        index === input.index
          ? [input.candidate]
          : change.after
            ? [change.after]
            : [],
      );
      // Explicit owner revisions are intentional edits, not extractor omissions.
      // Basic legacy edits retain pending evidence until a rich source backfill.
      const rich = incoming.map((r) => ({
        ...r,
        aliases: ("aliases" in r ? r.aliases : []) as string[],
        claims: ("claims" in r
          ? r.claims
          : []) as (typeof current)[number]["claims"],
      }));
      const revised = stateDiff(rich, current, actorFor(current), false);
      const priorPresentationEdits = new Set(
        changes.filter((c) => c.presentation_edit).map((c) => c.identity),
      );
      for (const change of revised)
        if (
          change.identity === changes[input.index].identity ||
          priorPresentationEdits.has(change.identity)
        )
          change.presentation_edit = true;
      revised.push(
        ...changes.filter(
          (change) =>
            change.status === "REMOVED" &&
            !incoming.some((row) => identity(row) === change.identity),
        ),
      );
      const result = await db
        .from("career_imports")
        .update({ candidates: revised })
        .eq("id", input.id)
        .eq("status", "DRAFT");
      if (result.error) throw new Error("Cannot save revision.");
      return Response.json({
        import: { id: input.id, candidates: revised, status: "DRAFT" },
      });
    }
    const accepted = [...new Set(input.accepted)].map(
      (index) => changes[index],
    );
    if (accepted.some((change) => !change))
      throw new HttpError(400, "Invalid selected change.");
    if (accepted.some((change) => change.status === "REVIEW"))
      throw new HttpError(
        400,
        "Resolve review items by editing and saving their candidate first.",
      );
    const sourceResult = await db
      .from("career_sources")
      .select("evidence_text")
      .eq("id", batch.data.source_id)
      .eq("account_id", accountId)
      .single();
    if (sourceResult.error) throw new Error("Cannot load approved source");
    // Compare against the proposal's baseline, including metadata-only state.
    for (const change of accepted) {
      const now = current.find((r) => identity(r) === change.identity);
      const before = change.before as (typeof current)[number] | null;
      if (
        now?.hash !== before?.hash ||
        now?.updated_at !== before?.updated_at ||
        now?.evidence_version !== before?.evidence_version
      )
        throw new HttpError(
          409,
          "Career evidence changed since this review. Re-import to compare again.",
        );
    }
    const applied = await applyBrain(
      db,
      accountId,
      input.id,
      batch.data.source_id,
      sourceResult.data.evidence_text,
      accepted,
      current,
    );
    let indexing;
    try {
      indexing = await reindexCareer(accountId);
    } catch {
      indexing = {
        pending: true,
        message: "Canonical changes saved; retry indexing.",
      };
    }
    return Response.json({ applied, indexing });
  } catch (error) {
    return errorResponse(error);
  }
}
