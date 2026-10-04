import "server-only";
import { database } from "../db";
import { getCareer } from "../career/repository";
import { semanticEntities, needsEmbedding } from "./content";
import { embed } from "./cohere";
import { validateEnv } from "../env";
import { primaryAccountId } from "../account-id";
export async function reindexCareer(accountId = primaryAccountId) {
  const env = validateEnv(process.env);
  const career = await getCareer(accountId);
  const entities = semanticEntities(career);
  if (career.demo)
    return {
      mode: "demo",
      indexed: 0,
      unchanged: entities.length,
      message:
        "Fixture retrieval uses local keywords; no synthetic vectors or provider calls.",
    };
  const db = database();
  const { data: existing, error } = await db
    .from("career_embeddings")
    .select("id,entity_type,entity_id,content_hash,embedding_model")
    .eq("account_id", accountId);
  if (error)
    throw new Error("Unable to read embedding state. Apply migrations first.");
  const stored = new Map(
    (existing || []).map((row) => [`${row.entity_type}:${row.entity_id}`, row]),
  );
  const changed = entities.filter((entity) =>
    needsEmbedding(
      entity,
      stored.get(`${entity.type}:${entity.record.id}`),
      env.embeddingModel,
    ),
  );
  for (let offset = 0; offset < changed.length; offset += 32) {
    const batch = changed.slice(offset, offset + 32);
    const vectors = await embed(
      batch.map((entity) => entity.content),
      "search_document",
    );
    const rows = batch.map((entity, i) => ({
      account_id: accountId,
      [`${entity.type}_id`]: entity.record.id,
      content: entity.content,
      content_hash: entity.hash,
      embedding: JSON.stringify(vectors[i]),
      embedding_model: env.embeddingModel,
    }));
    const { error: writeError } = await db
      .from("career_embeddings")
      .upsert(rows, { onConflict: "entity_type,entity_id" });
    if (writeError) throw new Error("Unable to save career embeddings.");
  }
  // Unpublished vectors are not searchable even before this cleanup runs.
  const obsolete = (existing || []).filter(
    (row) =>
      !entities.some(
        (entity) =>
          entity.type === row.entity_type && entity.record.id === row.entity_id,
      ),
  );
  for (let offset = 0; offset < obsolete.length; offset += 100) {
    const { error: deleteError } = await db
      .from("career_embeddings")
      .delete()
      .eq("account_id", accountId)
      .in(
        "id",
        obsolete.slice(offset, offset + 100).map((row) => row.id),
      );
    if (deleteError)
      throw new Error("Unable to remove unpublished embeddings.");
  }
  return {
    mode: "live",
    indexed: changed.length,
    unchanged: entities.length - changed.length,
  };
}
