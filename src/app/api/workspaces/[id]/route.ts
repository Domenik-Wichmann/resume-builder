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
import { getCareer } from "@/lib/career/repository";
import { compileResumeIR, expansionQueries } from "@/lib/resume-ir";
import { retrieveCareerEvidence } from "@/lib/embeddings/retrieval";
import { deduplicate } from "@/lib/embeddings/content";
import { getPresentation, currentMarket } from "@/lib/market-server";
import { reservePublicAction } from "@/lib/access/service";
export const maxDuration = 60;
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
    let workspace = await loadWorkspace(id, visitorId);
    const db = database();
    const lease = await db.rpc("begin_workspace_action", {
      p_workspace_id: id,
      p_visitor_id: visitorId,
    });
    if (lease.error) throw new Error("Cannot lock workspace.");
    if (!lease.data)
      throw new HttpError(
        409,
        "Another workspace action is running. Try again shortly.",
      );
    lockedId = id;
    // Read after the lease to avoid applying an action to an obsolete concurrent snapshot.
    workspace = await loadWorkspace(id, visitorId);
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
    const career = await getCareer();
    release = await reservePublicAction(request, action.action, id);
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
      const ir = compileResumeIR(
        career,
        workspace,
        await getPresentation(workspace.market),
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
    const result = await analyze(action.action, action.input, workspace, {
      workspaceId: id,
      operation: action.action,
    });
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
    await saveWorkspace(workspace, visitorId, previousQuestionCount);
    return Response.json(
      { workspace },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    await release?.();
    if (lockedId)
      await database()
        .from("workspaces")
        .update({ lease_until: null })
        .eq("id", lockedId);
  }
}
