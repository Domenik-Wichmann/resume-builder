import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { applicationInput, families, outcomes } from "@/lib/applications/model";
import {
  startGeneration,
  advanceGeneration,
  generationStatus,
} from "@/lib/applications/generation";
import { requireOwner } from "@/lib/admin";
import { createTrackingCode } from "@/lib/tracking/codes";
import { ProviderError } from "@/lib/ai/openrouter";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    await requireOwner();
    const a = await requireAccount();
    const action = await readJson(
      request,
      z.discriminatedUnion("action", [
        z
          .object({
            action: z.literal("prepare"),
            application: applicationInput,
          })
          .strict(),
        z
          .object({
            action: z.literal("generate"),
            preview_id: z.uuid(),
            stage: z.number().int().min(0).max(3),
          })
          .strict(),
        z
          .object({ action: z.literal("status"), preview_id: z.uuid() })
          .strict(),
        z.object({ action: z.literal("save"), preview_id: z.uuid() }).strict(),
        z
          .object({
            action: z.literal("outcome"),
            id: z.uuid(),
            status: z.enum(outcomes),
          })
          .strict(),
        z
          .object({
            action: z.literal("experiment"),
            name: z.string().trim().min(1).max(200),
            job_family: z.enum(families).nullable(),
            market: z.enum(["US", "BG"]).nullable(),
          })
          .strict(),
        z
          .object({
            action: z.literal("experiment_status"),
            id: z.uuid(),
            status: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED"]),
          })
          .strict(),
      ]),
    );
    if (action.action === "prepare")
      return Response.json(await startGeneration(a, action.application), {
        headers: { "Cache-Control": "no-store" },
      });
    if (action.action === "status")
      return Response.json(await generationStatus(a, action.preview_id), {
        headers: { "Cache-Control": "no-store" },
      });
    if (action.action === "generate")
      return Response.json(
        await advanceGeneration(a, action.preview_id, action.stage),
        { headers: { "Cache-Control": "no-store" } },
      );
    if (action.action === "save") {
      const state = await generationStatus(a, action.preview_id);
      if (state.stage !== 4)
        throw new HttpError(
          409,
          "Finish generation before saving this application.",
        );
      for (let attempt = 0; attempt < 3; attempt++) {
        const saved = await a.db.rpc("finalize_application", {
          p_account: a.accountId,
          p_preview: action.preview_id,
          p_code: createTrackingCode(),
        });
        if (!saved.error) return Response.json({ id: saved.data });
        if (saved.error.code !== "23505")
          throw new HttpError(
            409,
            "Application was not saved. Refresh or prepare a new preview.",
          );
      }
      throw new Error("Cannot allocate tracking code.");
    }
    if (action.action === "outcome") {
      const saved = await a.db.rpc("record_application_outcome", {
        p_application: action.id,
        p_status: action.status,
      });
      if (saved.error)
        throw new HttpError(
          409,
          "That outcome does not follow the current application state.",
        );
      return Response.json({ saved: true });
    }
    if (action.action === "experiment") {
      const saved = await a.db.rpc("create_resume_experiment", {
        p_account: a.accountId,
        p_name: action.name,
        p_family: action.job_family,
        p_market: action.market,
      });
      if (saved.error) throw new HttpError(400, "Cannot create experiment.");
      return Response.json({ id: saved.data });
    }
    const result = await a.db
      .from("resume_experiments")
      .update({ status: action.status })
      .eq("account_id", a.accountId)
      .eq("id", action.id)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      throw new HttpError(404, "Experiment not found.");
    return Response.json({ saved: true });
  } catch (e) {
    if (e instanceof ProviderError)
      return errorResponse(new HttpError(503, e.message));
    return errorResponse(e);
  }
}
