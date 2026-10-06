import "server-only";
import { createHash } from "node:crypto";
import { embed } from "./cohere";
import { validateEnv } from "../env";
import { primaryAccountId } from "../account-id";
import type { UsageContext } from "../usage/service";

const cache = new Map<string, { expires: number; vectors: number[][] }>();
const ttl = 5 * 60_000;
const capacity = 128;

// Cache only query vectors, never evidence or publication decisions. Every hit
// still performs a fresh, account-scoped vector search and canonical hash check.
export async function queryVectors(texts: string[], usage: UsageContext = {}) {
  const env = validateEnv(process.env);
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        usage.accountId || primaryAccountId,
        env.embeddingModel,
        env.dimension,
        texts,
      ]),
    )
    .digest("hex");
  const found = cache.get(key);
  if (found && found.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, found);
    return found.vectors;
  }
  cache.delete(key);
  const vectors = await embed(texts, "search_query", usage);
  // Failed provider calls and failed usage writes never populate the cache.
  for (const [oldKey, entry] of cache) {
    if (entry.expires <= Date.now()) cache.delete(oldKey);
  }
  if (cache.size >= capacity) cache.delete(cache.keys().next().value!);
  cache.set(key, { vectors, expires: Date.now() + ttl });
  return vectors;
}
