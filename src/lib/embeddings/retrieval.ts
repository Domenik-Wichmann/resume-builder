import "server-only";
import { z } from "zod";
import { queryVectors } from "./query-cache";
import {
  semanticEntities,
  expandMatches,
  deduplicate,
  entityTypes,
  type EntityType,
} from "./content";
import { retrieve } from "../career/retrieval";
import type { Career } from "../career/model";
import { database } from "../db";
import { validateEnv } from "../env";
import { primaryAccountId } from "../account-id";
import { measure } from "../performance";
const matchesSchema = z.array(
  z.object({
    entity_type: z.enum(entityTypes),
    entity_id: z.string(),
    content_hash: z.string(),
    similarity: z.number(),
  }),
);
export async function retrieveCareerEvidence(
  ...args: Parameters<typeof retrieveEvidence>
) {
  return measure("retrieval", () => retrieveEvidence(...args));
}
async function retrieveEvidence(
  queries: string[],
  career: Career,
  options: {
    entityTypes?: EntityType[];
    accountId?: string;
    workspaceId?: string;
    applicationId?: string;
    operation?: string;
  } = {},
) {
  if (career.demo)
    return deduplicate(queries.flatMap((query) => retrieve(career, query)));
  const entities = semanticEntities(career).filter(
    (entity) =>
      !options.entityTypes || options.entityTypes.includes(entity.type),
  );
  if (!entities.length) return [];
  const vectors = await measure("embedding", () =>
    queryVectors([...new Set(queries)], options),
  );
  const env = validateEnv(process.env);
  const db = database();
  const resultSets = await measure("vector_search", () =>
    Promise.all(
      vectors.map(async (vector) => {
        const { data, error } = await db.rpc("match_account_embeddings", {
          p_account_id: options.accountId || primaryAccountId,
          query_embedding: JSON.stringify(vector),
          requested_model: env.embeddingModel,
          match_count: 8,
          min_similarity: 0.25,
          entity_types: options.entityTypes || null,
        });
        if (error)
          throw new Error(
            "Semantic retrieval is unavailable. Apply migrations and reindex career evidence.",
          );
        return matchesSchema.parse(data);
      }),
    ),
  );
  const semantic = expandMatches(
    resultSets.flat().sort((a, b) => b.similarity - a.similarity),
    entities,
  );
  const deterministic = queries
    .flatMap((query) => retrieve(career, query))
    .filter((record) =>
      entities.some((entity) => entity.record.id === record.id),
    );
  return deduplicate([...semantic, ...deterministic]);
}
