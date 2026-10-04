import "server-only";
import { z } from "zod";
import { validateEnv } from "../env";
export class EmbeddingError extends Error {}
export async function embed(
  texts: string[],
  inputType: "search_document" | "search_query",
) {
  const env = validateEnv(process.env);
  if (!env.cohereKey)
    throw new EmbeddingError(
      "COHERE_API_KEY is required for real embeddings. Use APP_MODE=demo for offline development.",
    );
  if (!texts.length || texts.length > 32)
    throw new EmbeddingError("Embedding batches must contain 1–32 texts.");
  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${env.cohereKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.embeddingModel,
      texts,
      input_type: inputType,
      output_dimension: env.dimension,
      embedding_types: ["float"],
      truncate: "END",
    }),
  });
  if (!response.ok)
    throw new EmbeddingError("Cohere embedding request failed.");
  const parsed = z
    .object({
      embeddings: z.object({
        float: z
          .array(z.array(z.number().finite()).length(env.dimension))
          .length(texts.length),
      }),
    })
    .parse(await response.json());
  if (
    parsed.embeddings.float.some((vector) =>
      vector.every((value) => value === 0),
    )
  )
    throw new EmbeddingError("Cohere returned a zero vector.");
  return parsed.embeddings.float;
}
