import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kinds, tableFor, type Canonical } from "./model";
export async function loadCanonical(
  db: SupabaseClient,
  accountId: string,
  publicOnly = false,
): Promise<Canonical[]> {
  const resultsPromise = Promise.all(
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
  // Hashes describe the full canonical relationships, regardless of whether a
  // linked record is published. Read only account-scoped identity keys here;
  // public mappers still resolve labels from published, verified records only.
  const referenceKinds = ["skill", "achievement", "category"] as const;
  const referencesPromise = publicOnly
    ? Promise.all(
        referenceKinds.map((kind) =>
          db.from(tableFor[kind]).select("id,slug").eq("account_id", accountId),
        ),
      )
    : resultsPromise.then((results) =>
        referenceKinds.map((kind) => results[kinds.indexOf(kind)]),
      );
  const linksPromise = Promise.all(
    [
      "experience_skills",
      "project_skills",
      "achievement_skills",
      "experience_achievements",
      "project_achievements",
    ].map((table) => db.from(table).select("*").eq("account_id", accountId)),
  );
  const [results, references, links] = await Promise.all([
    resultsPromise,
    referencesPromise,
    linksPromise,
  ]);
  if (results.some((result) => result.error))
    throw new Error("Cannot load canonical career records.");
  if (references.some((result) => result.error))
    throw new Error("Cannot verify canonical relationship identities.");
  const [skillRows, achievementRows, categoryRows] = references.map(
    (result) => result.data || [],
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
                achievementRows
                  .filter(
                    (achievement) => achievement.id === link.achievement_id,
                  )
                  .map((achievement) => achievement.slug),
              )
          : [],
        category_key:
          kind === "skill"
            ? categoryRows.find((category) => category.id === row.category_id)
                ?.slug || null
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
