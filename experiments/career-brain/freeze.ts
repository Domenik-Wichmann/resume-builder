import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { extractionSchema } from "../../src/lib/ingestion/model";
import { fixtures } from "./fixtures";
const directory = "experiments/career-brain/baseline";
if (
  await stat(`${directory}/manifest.json`).then(
    () => true,
    () => false,
  )
)
  throw new Error(
    "A frozen baseline already exists. Preserve it; use a separate experiment directory for another baseline.",
  );
await mkdir(directory, { recursive: true });
const paths = [
  "src/lib/ingestion/extract.ts",
  "src/lib/ingestion/model.ts",
  "src/lib/ingestion/diff.ts",
  "src/lib/embeddings/content.ts",
  "src/lib/embeddings/indexer.ts",
  "src/lib/embeddings/retrieval.ts",
  "src/lib/embeddings/cohere.ts",
  "src/lib/career/retrieval.ts",
  "src/lib/ai/openrouter.ts",
  "src/lib/usage/service.ts",
  "supabase/migrations/202610040004_accounts.sql",
];
const hashes: Record<string, string> = {};
const normalizedHashes: Record<string, string> = {};
for (const path of paths) {
  const source = await readFile(path, "utf8");
  hashes[path] = createHash("sha256").update(source).digest("hex");
  normalizedHashes[path] = createHash("sha256")
    .update(source.replaceAll("\r\n", "\n"))
    .digest("hex");
  await writeFile(
    `${directory}/${path.replaceAll("/", "__")}.snapshot`,
    source,
  );
}
await writeFile(
  `${directory}/manifest.json`,
  JSON.stringify(
    {
      commit: "56a286e6750be96dccfa35f378862f1d7d33507a",
      frozenBeforeRuns: true,
      date: "2026-10-05",
      model: "openai/gpt-6-luna-pro",
      maxTokens: 12000,
      timeoutMs: 55000,
      embeddingModel: "embed-v4.0",
      dimension: 1024,
      minSimilarity: 0.25,
      matchCount: 8,
      schema: z.toJSONSchema(extractionSchema),
      hashes,
      normalizedHashes,
      budget: {
        usdCeiling: 5,
        maxInferenceCalls: 40,
        maxEmbeddingCalls: 20,
        reserveUsdPerInference: 0.1,
        reserveUsdPerEmbedding: 0.05,
        retries: 0,
      },
      limitations: [
        "Similarity is cosine. Semantic results precede lexical results; lexical substring matching includes stopwords and excludes skill records.",
        "Identity is exact kind:key. Title collision requires REVIEW. Content hash is normalized byte equality, not semantic equivalence.",
        "Cohere cost is not returned by current usage accounting; unknown is never treated as zero.",
      ],
    },
    null,
    2,
  ) + "\n",
);
await mkdir("experiments/career-brain/corpus", { recursive: true });
for (const fixture of fixtures) {
  if (fixture.source.length > 40000)
    throw new Error(`Fixture exceeds body bound: ${fixture.id}`);
  await writeFile(
    `experiments/career-brain/corpus/${fixture.id}.txt`,
    fixture.source + "\n",
  );
  await writeFile(
    `experiments/career-brain/corpus/${fixture.id}.gold.json`,
    JSON.stringify(
      {
        ...fixture,
        source: undefined,
        sourceCharacters: fixture.source.length,
        sourceHash: createHash("sha256").update(fixture.source).digest("hex"),
        provenance: fixture.gold.map((r) => ({
          key: `${r.kind}:${r.key}`,
          start: fixture.source.indexOf(r.source_quote),
          quote: r.source_quote,
        })),
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  JSON.stringify(
    fixtures.map((f) => ({
      id: f.id,
      characters: f.source.length,
      goldRecords: f.gold.length,
    })),
  ),
);
