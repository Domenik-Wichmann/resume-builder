import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError, reserveAIQuota } from "@/lib/http";
import { cardSchema, cardVisible } from "@/lib/portfolio/answers";
import { loadCards } from "@/lib/portfolio/answers-server";
import { loadCanonical } from "@/lib/ingestion/repository";
import { getCareer } from "@/lib/career/repository";
import { retrieveCareerEvidence } from "@/lib/embeddings/retrieval";
import { complete } from "@/lib/ai/openrouter";
import { answerSchema, validateEvidence } from "@/lib/ai/contracts";
import { groundedPrompt } from "@/lib/ai/prompts";
export const maxDuration = 60;
export async function GET() {
  try {
    const a = await requireAccount();
    return Response.json(
      { cards: await loadCards(a.db, a.accountId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const a = await requireAccount();
    const action = await readJson(
      request,
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("save"), card: cardSchema }).strict(),
        z
          .object({
            action: z.literal("publish"),
            id: z.uuid(),
            published: z.boolean(),
          })
          .strict(),
        z
          .object({
            action: z.literal("generate"),
            question: z.string().trim().min(3).max(1000),
          })
          .strict(),
      ]),
    );
    const records = await loadCanonical(a.db, a.accountId);
    if (action.action === "generate") {
      await reserveAIQuota();
      const career = await getCareer(a.accountId);
      const evidence = (
        await retrieveCareerEvidence([action.question], career, {
          accountId: a.accountId,
          operation: "answer_draft",
        })
      ).slice(0, 8);
      if (!evidence.length)
        throw new HttpError(
          409,
          "Publish relevant career evidence before generating an answer draft.",
        );
      const draft = career.demo
        ? {
            answer: evidence.map((r) => r.summary).join(" "),
            evidence_ids: evidence.map((r) => r.id),
          }
        : await complete(
            groundedPrompt("ask", evidence),
            action.question,
            answerSchema,
            { usage: { accountId: a.accountId, operation: "answer_draft" } },
          );
      validateEvidence(
        draft.evidence_ids,
        evidence.map((r) => r.id),
      );
      if (!draft.evidence_ids.length)
        throw new HttpError(
          409,
          "No cited evidence. Write and review this answer manually.",
        );
      return Response.json({
        answer: draft.answer,
        sources: records
          .filter((r) => draft.evidence_ids.includes(r.id))
          .map((r) => ({ kind: r.kind, id: r.id })),
      });
    }
    if (action.action === "save") {
      const { sources, ...card } = action.card;
      if (
        sources.some(
          (s) =>
            !records.some(
              (r) => r.id === s.id && r.kind === s.kind && !r.archived,
            ),
        )
      )
        throw new HttpError(
          400,
          "Choose active career records from this account.",
        );
      const saved = await a.db.rpc("save_answer_card", {
        p_account: a.accountId,
        p_card: card,
        p_sources: sources,
      });
      if (saved.error)
        throw new HttpError(
          400,
          "Answer was not saved. Check its slug and sources.",
        );
      return Response.json({ id: saved.data });
    }
    const card = (await loadCards(a.db, a.accountId)).find(
      (c) => c.id === action.id,
    );
    if (!card) throw new HttpError(404, "Answer not found.");
    if (
      action.published &&
      !cardVisible(
        { ...card, is_public: true },
        new Set(
          records
            .filter((r) => r.published && !r.archived)
            .map((r) => `${r.kind}:${r.id}`),
        ),
      )
    )
      throw new HttpError(
        409,
        "Review stale or expired answers and publish every supporting record first.",
      );
    const updated = await a.db
      .from("answer_cards")
      .update({ is_public: action.published })
      .eq("account_id", a.accountId)
      .eq("id", action.id);
    if (updated.error) throw new Error("Cannot publish answer.");
    return Response.json({ saved: true });
  } catch (e) {
    return errorResponse(e);
  }
}
