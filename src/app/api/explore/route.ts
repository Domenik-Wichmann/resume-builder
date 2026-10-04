import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { readVisitor, visitorCookie } from "@/lib/workspaces/identity";
import { loadWorkspace } from "@/lib/workspaces/repository";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { trackingDisabled } from "@/lib/tracking/service";
export async function POST(request: NextRequest) {
  try {
    const a = await readJson(
      request,
      z
        .object({
          kind: z.enum(["skill", "category", "project"]),
          id: z.uuid(),
          workspace_id: z.uuid(),
        })
        .strict(),
    );
    const visitor = readVisitor(request.cookies.get(visitorCookie)?.value);
    if (!visitor) throw new HttpError(404, "Workspace not found.");
    await loadWorkspace(a.workspace_id, visitor);
    if (trackingDisabled(request.headers))
      return Response.json({ recorded: false });
    const table = {
      skill: "skills",
      category: "skill_categories",
      project: "projects",
    }[a.kind];
    const db = database();
    const entity = await db
      .from(table)
      .select("id")
      .eq("account_id", primaryAccountId)
      .eq("id", a.id)
      .eq("is_public", true)
      .is("archived_at", null)
      .maybeSingle();
    if (entity.error || !entity.data)
      throw new HttpError(404, "Published evidence not found.");
    // Debounce repeat selections on the server, including direct API callers.
    const field = a.kind + "_id";
    const recent = await db
      .from("explorer_events")
      .select("id")
      .eq("account_id", primaryAccountId)
      .eq("workspace_id", a.workspace_id)
      .eq(field, a.id)
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .limit(1);
    if (recent.error) throw new Error("Cannot check signals.");
    if (!recent.data?.length) {
      const saved = await db.from("explorer_events").insert({
        account_id: primaryAccountId,
        workspace_id: a.workspace_id,
        event_type: {
          skill: "skill_explored",
          category: "category_explored",
          project: "project_viewed",
        }[a.kind],
        [field]: a.id,
      });
      if (saved.error) throw new Error("Cannot save signal.");
    }
    return Response.json({ recorded: true });
  } catch (e) {
    return errorResponse(e);
  }
}
