import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { loadProjects } from "@/lib/portfolio/repository";
import { loadBrain } from "@/lib/career-brain/repository";
import { caseStudySchema } from "@/lib/portfolio/case-study";
import {
  loadCaseStudies,
  fillCaseStudy,
  caseEvidenceHash,
} from "@/lib/portfolio/case-study-server";

export async function POST(request: Request) {
  try {
    await requireOwner();
    const { db, accountId } = await requireAccount();
    const action = await readJson(
      request,
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("load"), project_id: z.uuid() }).strict(),
        z.object({ action: z.literal("fill"), project_id: z.uuid() }).strict(),
        z
          .object({ action: z.literal("save"), draft: caseStudySchema })
          .strict(),
      ]),
      60000,
    );
    const id =
      action.action === "save" ? action.draft.project_id : action.project_id;
    const [projects, brain, cases] = await Promise.all([
      loadProjects(db, accountId),
      loadBrain(db, accountId),
      loadCaseStudies(db, accountId),
    ]);
    const project = projects.find((p) => p.id === id && !p.archived);
    const record = brain.find(
      (r) => r.kind === "project" && r.id === id && !r.archived,
    );
    if (!project || !record) throw new HttpError(404, "Project not found.");
    const stored = cases.find((c) => c.project_id === id);
    const draft = fillCaseStudy(project, record);
    draft.baseline_version = stored?.baseline_version || null;
    draft.selected = stored?.selected ?? draft.selected;
    if (action.action !== "save")
      return Response.json(
        {
          draft:
            action.action === "load" && stored
              ? { ...stored, project_version: project.updated_at }
              : draft,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (
      action.draft.source_hash !== caseEvidenceHash(record) ||
      action.draft.project_version !== project.updated_at
    )
      throw new HttpError(
        409,
        "Project evidence changed. Reload or fill the draft again before saving.",
      );
    const value = action.draft;
    for (const key of ["highlights", "outcomes", "limitations"] as const)
      value.content[key] = value.content[key]
        .map((text) => text.trim())
        .filter(Boolean);
    const result = await db.rpc("save_project_case_study", {
      p_account: accountId,
      p_project: id,
      p_project_version: value.project_version,
      p_baseline: value.baseline_version,
      p_content: value.content,
      p_hash: caseEvidenceHash(record),
      p_selected: value.selected,
      p_public: value.is_public,
    });
    if (result.error)
      throw new HttpError(
        result.error.message.includes("STALE") ? 409 : 400,
        "Case study was not saved. Check that the project is published and reload the latest draft.",
      );
    return Response.json(
      { draft: { ...value, baseline_version: result.data } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
