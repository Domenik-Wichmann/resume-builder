import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kinds, tableFor, type Canonical } from "./model";
export async function loadCanonical(
  db: SupabaseClient,
  accountId: string,
  publicOnly = false,
): Promise<Canonical[]> {
  const results = await Promise.all(
    kinds.map((kind) => {
      let query = db
        .from(tableFor[kind])
        .select("*")
        .eq("account_id", accountId);
      if (publicOnly)
        query = query.eq("is_public", true).is("archived_at", null);
      return query;
    }),
  );
  if (results.some((result) => result.error))
    throw new Error("Cannot load canonical career records.");
  const skillRows = results[kinds.indexOf("skill")].data || [];
  const links = await Promise.all(
    [
      "experience_skills",
      "project_skills",
      "achievement_skills",
      "experience_achievements",
      "project_achievements",
    ].map((table) => db.from(table).select("*").eq("account_id", accountId)),
  );
  if (links.some((result) => result.error))
    throw new Error("Cannot load canonical relationships.");
  return kinds.flatMap((kind, index) =>
    (results[index].data || []).map((row) => {
      const junction = ["experience", "project", "achievement"].indexOf(kind);
      return {
        id: row.id,
        kind,
        key: row.slug,
        title:
          kind === "profile"
            ? row.name
            : kind === "skill"
              ? row.name
              : row.title,
        subtitle: kind === "profile" ? row.title : row.subtitle || "",
        summary:
          kind === "profile"
            ? row.introduction
            : kind === "skill"
              ? row.description
              : row.summary,
        organization: row.organization || null,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        skill_keys:
          junction < 0
            ? []
            : (links[junction].data || [])
                .filter((link) => link[kind + "_id"] === row.id)
                .flatMap((link) =>
                  skillRows
                    .filter((skill) => skill.id === link.skill_id)
                    .map((skill) => skill.slug),
                ),
        source_quote: row.source_quote || "Legacy record; provenance pending",
        achievement_keys: ["experience", "project"].includes(kind)
          ? (links[kind === "experience" ? 3 : 4].data || [])
              .filter((link) => link[kind + "_id"] === row.id)
              .flatMap((link) =>
                (results[kinds.indexOf("achievement")].data || [])
                  .filter(
                    (achievement) => achievement.id === link.achievement_id,
                  )
                  .map((achievement) => achievement.slug),
              )
          : [],
        category_key:
          kind === "skill"
            ? (results[kinds.indexOf("category")].data || []).find(
                (category) => category.id === row.category_id,
              )?.slug || null
            : null,
        uncertainties: [],
        hash: row.semantic_hash,
        published: row.is_public,
        archived: Boolean(row.archived_at),
        updated_at: row.updated_at,
      };
    }),
  );
}
