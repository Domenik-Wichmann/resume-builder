import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError, reserveAIQuota } from "@/lib/http";
import {
  applicationInput,
  families,
  outcomes,
  strategies,
} from "@/lib/applications/model";
import { getCareer } from "@/lib/career/repository";
import { retrieveCareerEvidence } from "@/lib/embeddings/retrieval";
import { jobQueries } from "@/lib/embeddings/content";
import { compileResumeIR } from "@/lib/resume-ir";
import { newWorkspace } from "@/lib/workspaces/model";
import { getPresentation } from "@/lib/market-server";
import { createTrackingCode } from "@/lib/tracking/codes";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
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
    if (action.action === "prepare") {
      const p = action.application;
      await reserveAIQuota();
      const career = await getCareer(a.accountId);
      const evidence = await retrieveCareerEvidence(
        jobQueries(p.job_description),
        career,
        { accountId: a.accountId, operation: "application_preview" },
      );
      if (!evidence.length || !career.profile.name)
        throw new HttpError(
          409,
          "Publish a career profile and relevant supporting evidence before preparing an application.",
        );
      const presentation = await getPresentation(
        p.metadata.market,
        a.accountId,
      );
      const workspace = {
        ...newWorkspace(randomUUID(), p.metadata.market, career.demo),
        job_description: p.job_description,
        requirements: p.job_description
          .split(/\n/)
          .filter(Boolean)
          .slice(0, 30),
      };
      const options = Object.fromEntries(
        strategies.map((strategy) => {
          const ranked = [...evidence]
            .sort((x, y) => {
              const boost = (id: string) =>
                strategy === "PROJECT_FORWARD" &&
                career.projects.some((r) => r.id === id)
                  ? 10
                  : strategy === "OUTCOME_FORWARD" &&
                      career.achievements.some((r) => r.id === id)
                    ? 10
                    : strategy === "TRADITIONAL" &&
                        career.experiences.some((r) => r.id === id)
                      ? 10
                      : 0;
              return boost(y.id) - boost(x.id);
            })
            .slice(0, 12);
          return [
            strategy,
            compileResumeIR(
              career,
              { ...workspace, evidence: ranked },
              presentation,
              strategy,
            ),
          ];
        }),
      );
      await a.db
        .from("application_previews")
        .delete()
        .eq("account_id", a.accountId)
        .lt("expires_at", new Date().toISOString());
      const saved = await a.db
        .from("application_previews")
        .insert({ account_id: a.accountId, ...p, resume_options: options })
        .select("id")
        .single();
      if (saved.error) throw new Error("Cannot save private preview.");
      return Response.json({ preview_id: saved.data.id, options });
    }
    if (action.action === "save") {
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
    return errorResponse(e);
  }
}
