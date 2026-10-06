import { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, readJson, errorResponse, requireOrigin } from "@/lib/http";
import { readVisitor, visitorCookie } from "@/lib/workspaces/identity";
import { loadWorkspace, saveWorkspace } from "@/lib/workspaces/repository";
import {
  applyQuestion,
  applyMatch,
  deriveTopics,
} from "@/lib/workspaces/context";
import { analyze } from "@/lib/ai/service";
import { answerSchema, matchSchema } from "@/lib/ai/contracts";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { getCareer } from "@/lib/career/repository";
import { expansionQueries } from "@/lib/resume-ir";
import { compileGroundedResume } from "@/lib/career-brain/serving";
import { retrieveCareerEvidence } from "@/lib/embeddings/retrieval";
import { deduplicate } from "@/lib/embeddings/content";
import { getPresentation, currentMarket } from "@/lib/market-server";
import { reservePublicAction } from "@/lib/access/service";
import { measure, timedResponse } from "@/lib/performance";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
function visitor(request: NextRequest) {
  const id = readVisitor(request.cookies.get(visitorCookie)?.value);
  if (!id) throw new HttpError(404, "Workspace not found.");
  return id;
}
async function workspaceId(context: Context) {
  const result = z.uuid().safeParse((await context.params).id);
  if (!result.success) throw new HttpError(404, "Workspace not found.");
  return result.data;
}
export async function GET(request: NextRequest, context: Context) {
  return timedResponse(() => getWorkspace(request, context));
}
async function getWorkspace(request: NextRequest, context: Context) {
  try {
    return Response.json(
      {
        workspace: await loadWorkspace(
          await workspaceId(context),
          visitor(request),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    requireOrigin(request);
    const id = await workspaceId(context),
      visitorId = visitor(request);
    await loadWorkspace(id, visitorId);
    const { error } = await database()
      .from("workspaces")
      .delete()
      .eq("id", id)
      .eq("visitor_id", visitorId);
    if (error) throw new Error("Cannot delete workspace.");
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  return timedResponse(() => workspaceAction(request, context));
}
async function workspaceAction(request: NextRequest, context: Context) {
  let lockedId: string | null = null;
  let release: (() => Promise<void>) | undefined;
  try {
    const action = await readJson(
      request,
      z.discriminatedUnion("action", [
        z
          .object({
            action: z.literal("ask"),
            input: z.string().trim().min(3).max(1000),
          })
          .strict(),
        z
          .object({
            action: z.literal("match"),
            input: z.string().trim().min(3).max(12000),
          })
          .strict(),
        z.object({ action: z.literal("compile") }).strict(),
        z.object({ action: z.literal("export") }).strict(),
      ]),
    );
    const id = await workspaceId(context),
      visitorId = visitor(request);
    const db = database();
    // Verify ownership without loading the complete workspace before its lease.
    const owned = await measure("ownership", () =>
      Promise.resolve(
        db
          .from("workspaces")
          .select("id")
          .eq("id", id)
          .eq("visitor_id", visitorId)
          .eq("account_id", primaryAccountId)
          .maybeSingle(),
      ),
    );
    if (owned.error) throw new Error("Cannot load workspace.");
    if (!owned.data) throw new HttpError(404, "Workspace not found.");
    const lease = await measure("lease", () =>
      Promise.resolve(
        db.rpc("begin_workspace_action", {
          p_workspace_id: id,
          p_visitor_id: visitorId,
        }),
      ),
    );
    if (lease.error) throw new Error("Cannot lock workspace.");
    if (!lease.data)
      throw new HttpError(
        409,
        "Another workspace action is running. Try again shortly.",
      );
    lockedId = id;
    // Read after the lease to avoid applying an action to an obsolete concurrent snapshot.
    const careerPromise = measure("career", () => getCareer());
    let [workspace] = await Promise.all([
      measure("workspace", () => loadWorkspace(id, visitorId, careerPromise)),
      careerPromise,
    ]);
    workspace = { ...workspace, market: await currentMarket() };
    const previousQuestionCount = workspace.questions.length;
    if (action.action === "export") {
      const result = await db
        .from("workspace_events")
        .insert({ workspace_id: id, event_type: "workspace_export" });
      if (result.error) throw new Error("Cannot record export.");
      return Response.json(
        { workspace },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const career = await careerPromise;
    release = await measure("access", () =>
      reservePublicAction(
        request,
        action.action as "ask" | "match" | "compile",
        id,
      ),
    );
    if (action.action === "compile") {
      const categories = [career.experiences, career.projects].filter(
        (records) =>
          records.some((record) =>
            workspace.evidence.some((candidate) => candidate.id === record.id),
          ),
      ).length;
      if (workspace.evidence.length < 4 || categories < 2) {
        const related = await retrieveCareerEvidence(
          expansionQueries(workspace),
          career,
          { workspaceId: id, operation: "compile" },
        );
        workspace = {
          ...workspace,
          evidence: deduplicate([...workspace.evidence, ...related], 60),
        };
      }
      const ir = await compileGroundedResume(
        career,
        workspace,
        await getPresentation(workspace.market),
        "TRADITIONAL",
        { workspaceId: id, operation: "compile" },
      );
      await saveWorkspace(workspace, visitorId, previousQuestionCount);
      const saved = await db
        .from("workspace_projections")
        .upsert(
          { workspace_id: id, resume_ir: ir },
          { onConflict: "workspace_id" },
        );
      if (saved.error) throw new Error("Cannot save résumé projection.");
      const measured = await db
        .from("workspace_events")
        .insert({ workspace_id: id, event_type: "resume_preview" });
      if (measured.error) throw new Error("Cannot record preview.");
      return Response.json(
        { workspace, ir },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (action.action === "ask" && workspace.questions.length >= 50)
      throw new HttpError(
        409,
        "This workspace has reached its 50-question limit.",
      );
    // Prior explored topics influence selection without granting prior model text factual authority.
    const result = await analyze(
      action.action,
      action.input,
      workspace,
      {
        workspaceId: id,
        operation: action.action,
      },
      career,
    );
    workspace =
      action.action === "ask"
        ? applyQuestion(
            workspace,
            action.input,
            answerSchema.parse(result.result),
            result.evidence,
            deriveTopics(action.input, result.evidence, career.skills),
          )
        : applyMatch(
            workspace,
            action.input,
            matchSchema.parse(result.result),
            result.evidence,
          );
    await measure("persistence", () =>
      saveWorkspace(workspace, visitorId, previousQuestionCount),
    );
    return Response.json(
      { workspace },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    // Both leases must be released even if either cleanup fails.
    await measure("release", async () => {
      const cleanup = await Promise.allSettled([
        release?.(),
        lockedId
          ? database()
              .from("workspaces")
              .update({ lease_until: null })
              .eq("id", lockedId)
          : undefined,
      ]);
      const failed = cleanup.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    });
  }
}
