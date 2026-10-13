import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { fixedContentSchema } from "@/lib/resume-design/fixed-content";
import { applicationTemplate } from "@/lib/resume-design/server";
import { loadCaseStudies } from "@/lib/portfolio/case-study-server";
import { showcaseTitle } from "@/lib/portfolio/selection";
export async function GET() {
  try {
    await requireOwner();
    const a = await requireAccount();
    return Response.json(await applicationTemplate(a.db, a.accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireOwner();
    const a = await requireAccount();
    const input = await readJson(
      request,
      z.object({ content: fixedContentSchema }).strict(),
      100000,
    );
    if (input.content.projects.some((p) => p.record_id)) {
      // This is the verified owner's JWT client. Missing and foreign IDs are
      // indistinguishable; never use privileged reads to repair a binding.
      const linked = await a.db
        .from("projects")
        .select("id,title,archived_at")
        .eq("account_id", a.accountId)
        .order("title");
      if (linked.error)
        throw new HttpError(
          503,
          "Cannot check project evidence links. Your draft has not been saved.",
        );
      const projects: {
        id: string;
        title: string;
        archived_at: string | null;
      }[] = linked.data || [];
      const found = new Set(projects.map((p) => p.id));
      const missing = input.content.projects.filter(
        (p) => p.record_id && !found.has(p.record_id),
      );
      if (missing.length) {
        const cases = await loadCaseStudies(a.db, a.accountId);
        return Response.json(
          {
            code: "INVALID_PROJECT",
            error:
              "An evidence record_id does not match a project in your Career Brain. Choose the correct project below, or explicitly save the approved text without an evidence link.",
            invalid_bindings: missing.map((p) => ({
              id: p.id,
              title: p.title,
              record_id: p.record_id,
            })),
            project_options: projects
              .filter((p) => !p.archived_at)
              .map((p) => {
                const display =
                  cases.find((c) => c.project_id === p.id)?.content.title ||
                  showcaseTitle(p);
                // Display aliases help the owner find the app; the canonical
                // title stays visible so similarly named projects cannot be confused.
                return {
                  id: p.id,
                  title:
                    display === p.title ? display : `${display} — ${p.title}`,
                };
              }),
          },
          { status: 422, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const saved = await a.db.rpc("save_resume_fixed_content", {
      p_account: a.accountId,
      p_spec: input.content,
    });
    if (saved.error) {
      if (saved.error.message.includes("STALE_CONTENT"))
        return Response.json(
          {
            code: "STALE_CONTENT",
            error:
              "The saved template revision changed. Review the latest saved content below; your draft is still here and nothing was overwritten.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      if (saved.error.message.includes("INVALID_PROJECT"))
        throw new HttpError(
          422,
          "A linked project changed while saving. Save again to review its evidence link; your draft is still here.",
        );
      if (saved.error.message.includes("INVALID_CONTENT"))
        throw new HttpError(
          422,
          "The database rejected the content. Check that project IDs are unique, every project has a bullet, and links use HTTPS. Very large templates must stay under 100 KB.",
        );
      if (saved.error.message.includes("ACCOUNT_REQUIRED"))
        throw new HttpError(
          403,
          "Sign in as the owner again. Your draft has not been saved.",
        );
      throw new HttpError(
        503,
        "The template could not be saved. Your draft is still here; try again.",
      );
    }
    return Response.json({
      content: { ...input.content, version: saved.data },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
