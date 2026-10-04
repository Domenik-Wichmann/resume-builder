import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError, reserveAIQuota } from "@/lib/http";
import { candidateSchema, tableFor, type Change } from "@/lib/ingestion/model";
import { loadCanonical } from "@/lib/ingestion/repository";
import { diffCareer, identity, semanticHash } from "@/lib/ingestion/diff";
import { extractCareer, ingestionModel } from "@/lib/ingestion/extract";
import { interviewQuestions } from "@/lib/interview/questions";
import { reindexCareer } from "@/lib/embeddings/indexer";
import { contentHash } from "@/lib/embeddings/content";
export const maxDuration = 60;
const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("extract"),
      text: z.string().trim().min(10).max(40000),
      kind: z.enum(["MASTER", "INTERVIEW"]),
      context: z.string().max(8000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("revise"),
      id: z.uuid(),
      index: z.number().int().min(0),
      candidate: candidateSchema,
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
    const [records, imports] = await Promise.all([
      loadCanonical(db, accountId),
      db
        .from("career_imports")
        .select("id,status,model,created_at,candidates")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (imports.error) throw new Error("Cannot load imports.");
    return Response.json(
      { records, imports: imports.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, accountId } = await requireAccount();
    const input = await readJson(request, inputSchema, 200000);
    if (input.action === "reindex")
      return Response.json(await reindexCareer(accountId));
    const current = await loadCanonical(db, accountId);
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
      const result = await db
        .from(tableFor[input.kind])
        .update({ is_public: input.published })
        .eq("id", row.id)
        .eq("account_id", accountId);
      if (result.error) throw new Error("Cannot change publication.");
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
      const source =
        input.kind === "INTERVIEW"
          ? `${input.context ? `Interview context (questions, not career evidence):\n${input.context}\n` : ""}Owner answers:\n${input.text}`
          : input.text;
      if (source.length > 40000)
        throw new HttpError(
          400,
          "Answers and interview context must fit within 40,000 characters.",
        );
      const candidates = await extractCareer(
        source,
        current.map(identity),
        accountId,
      );
      // A quotation from interview questions alone is not owner evidence.
      const checked =
        input.kind === "INTERVIEW"
          ? candidates.map((row) => ({
              ...row,
              uncertainties: [
                ...row.uncertainties,
                ...(!input.text.includes(row.source_quote)
                  ? ["Quotation is not from the owner's answer."]
                  : []),
              ],
            }))
          : candidates;
      const changes = diffCareer(checked, current, input.kind === "MASTER");
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
          model: ingestionModel(),
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
      if (!source.data.evidence_text.includes(input.candidate.source_quote))
        throw new HttpError(400, "Provide a quotation from the stored source.");
      const incoming = changes.flatMap((change, index) =>
        index === input.index
          ? [input.candidate]
          : change.after
            ? [change.after]
            : [],
      );
      const revised = diffCareer(incoming, current, false);
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
    const patches = accepted
      .filter((change) => change.status !== "UNCHANGED")
      .map((change) => ({
        ...(change.after || change.before!),
        skill_keys: [...new Set((change.after || change.before!).skill_keys)],
        achievement_keys: [
          ...new Set((change.after || change.before!).achievement_keys),
        ],
        action: change.status === "REMOVED" ? "ARCHIVE" : "UPSERT",
        baseline_hash: change.before?.hash || null,
        baseline_version: change.before?.updated_at || null,
        hash: change.after ? semanticHash(change.after) : change.before!.hash,
      }));
    const applied = await db.rpc("apply_career_import", {
      p_import: input.id,
      p_changes: patches,
    });
    if (applied.error) {
      if (applied.error.message.includes("STALE_IMPORT"))
        throw new HttpError(
          409,
          "Career data changed since this review. Re-import to compare again.",
        );
      throw new HttpError(
        409,
        "Import was not applied. Check accepted relationship references and draft state.",
      );
    }
    let indexing;
    try {
      indexing = await reindexCareer(accountId);
    } catch {
      indexing = {
        pending: true,
        message: "Canonical changes saved; retry indexing.",
      };
    }
    return Response.json({ applied: applied.data, indexing });
  } catch (error) {
    return errorResponse(error);
  }
}
