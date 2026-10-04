import { reindexCareer } from "../src/lib/embeddings/indexer";
try {
  console.log(await reindexCareer());
} catch (error) {
  console.error(error instanceof Error ? error.message : "Indexing failed.");
  process.exitCode = 1;
}
