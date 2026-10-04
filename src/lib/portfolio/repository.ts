import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
import { projectSchema, type Project, type ProjectMedia } from "./model";

export async function loadProjects(
  db: SupabaseClient,
  accountId: string,
  publicOnly = false,
): Promise<Project[]> {
  let query = db
    .from("projects")
    .select("*")
    .eq("account_id", accountId)
    .order("featured", { ascending: false })
    .order("display_order")
    .order("created_at");
  if (publicOnly) query = query.eq("is_public", true).is("archived_at", null);
  const result = await query;
  if (result.error) throw new Error("Cannot load projects.");
  const ids = (result.data || []).map((p) => p.id);
  if (!ids.length) return [];
  const relations = await Promise.all(
    ["project_skills", "project_achievements", "project_links"].map((t) =>
      db.from(t).select("*").eq("account_id", accountId).in("project_id", ids),
    ),
  );
  if (relations.some((r) => r.error))
    throw new Error("Cannot load project relationships.");
  return (result.data || []).map((row) => ({
    ...projectSchema.parse({
      id: row.id,
      baseline_version: row.updated_at,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle || "",
      summary: row.summary,
      description: row.description,
      organization: row.organization,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
      featured: row.featured,
      is_public: row.is_public,
      archived: Boolean(row.archived_at),
      display_order: row.display_order,
      skill_ids: (relations[0].data || [])
        .filter((r) => r.project_id === row.id)
        .map((r) => r.skill_id),
      achievement_ids: (relations[1].data || [])
        .filter((r) => r.project_id === row.id)
        .map((r) => r.achievement_id),
      links: (relations[2].data || [])
        .filter((r) => r.project_id === row.id && (!publicOnly || r.is_public))
        .sort((a, b) => a.display_order - b.display_order)
        .map(({ label, link_type, url, display_order, is_public }) => ({
          label,
          link_type,
          url,
          display_order,
          is_public,
        })),
    }),
    id: row.id,
    updated_at: row.updated_at,
  }));
}
export async function publicProjects() {
  if (validateEnv(process.env).mode === "demo") return [];
  return loadProjects(database(), primaryAccountId, true);
}
export async function projectMedia(
  db: SupabaseClient,
  accountId: string,
  projectId?: string,
): Promise<ProjectMedia[]> {
  let query = db
    .from("project_media")
    .select("id,project_id,alt,caption,display_order,is_cover")
    .eq("account_id", accountId)
    .order("display_order");
  if (projectId) query = query.eq("project_id", projectId);
  const result = await query;
  if (result.error) throw new Error("Cannot load media.");
  return result.data || [];
}
