import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { projectSchema } from "@/lib/portfolio/model";
import { loadProjects, projectMedia } from "@/lib/portfolio/repository";
import { loadCanonical } from "@/lib/ingestion/repository";
import { semanticHash } from "@/lib/ingestion/diff";
import { contentHash } from "@/lib/embeddings/content";
import { reindexCareer } from "@/lib/embeddings/indexer";
export const maxDuration = 60;
export async function GET() {
  try {
    const { db, accountId } = await requireAccount();
    return Response.json(
      {
        projects: await loadProjects(db, accountId),
        media: await projectMedia(db, accountId),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, accountId } = await requireAccount();
    const action = await readJson(
      request,
      z.discriminatedUnion("action", [
        z
          .object({ action: z.literal("save"), project: projectSchema })
          .strict(),
        z.object({ action: z.literal("reindex") }).strict(),
      ]),
      150000,
    );
    if (action.action === "reindex")
      return Response.json(await reindexCareer(accountId));
    const p = action.project;
    const records = await loadCanonical(db, accountId);
    const keys = (kind: string, ids: string[]) =>
      ids.map((id) => {
        const r = records.find(
          (r) => r.kind === kind && r.id === id && !r.archived,
        );
        if (!r)
          throw new HttpError(400, "Choose active records from this account.");
        return r.key;
      });
    const hash = contentHash(
      semanticHash({
        kind: "project",
        key: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        summary: p.summary,
        organization: p.organization,
        start_date: p.start_date,
        end_date: p.end_date,
        skill_keys: keys("skill", p.skill_ids),
        achievement_keys: keys("achievement", p.achievement_ids),
        category_key: null,
        source_quote: p.summary || p.title,
        uncertainties: [],
      }) + p.description,
    );
    const saved = await db.rpc("save_project", {
      p_account: accountId,
      p_project: p,
      p_hash: hash,
    });
    if (saved.error)
      throw new HttpError(
        saved.error.message.includes("STALE_PROJECT") ? 409 : 400,
        "Project was not saved. Refresh to check the latest version, slug and relationships.",
      );
    let indexing = "Published evidence is indexed.";
    try {
      await reindexCareer(accountId);
    } catch {
      indexing = "Saved. Embedding refresh is pending; use Retry indexing.";
    }
    return Response.json({ id: saved.data, indexing });
  } catch (e) {
    return errorResponse(e);
  }
}
