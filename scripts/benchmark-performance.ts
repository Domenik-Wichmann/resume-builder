import { performance } from "node:perf_hooks";

// Only fixed operation labels and durations are emitted, never URLs, input or rows.
const originalFetch = globalThis.fetch;
const spans: { stage: string; ms: number }[] = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const start = performance.now();
  try {
    return await originalFetch(input, init);
  } finally {
    spans.push({
      stage:
        url.hostname === "api.cohere.com"
          ? "embedding"
          : url.hostname === "openrouter.ai"
            ? "llm"
            : url.pathname.split("/").pop() || "database",
      ms: Math.round((performance.now() - start) * 10) / 10,
    });
  }
};
const { getCareer } = await import("../src/lib/career/repository");
const { timedResponse } = await import("../src/lib/performance");
const runs = Number(process.env.PERF_RUNS || 5);
for (let i = 0; i < runs; i++) {
  spans.length = 0;
  const start = performance.now();
  const response = await timedResponse(async () => {
    await getCareer();
    return new Response();
  });
  console.log(
    JSON.stringify({
      run: i + 1,
      mode: process.env.APP_MODE,
      total_ms: Math.round(performance.now() - start),
      timing: response.headers.get("server-timing"),
      spans,
    }),
  );
}
if (process.argv.includes("--reads")) {
  if (process.env.APP_MODE !== "live")
    throw new Error(
      "Public database benchmarks require explicit APP_MODE=live",
    );
  const { getCareerCatalog } = await import("../src/lib/career/catalog-server");
  const { getPresentation } = await import("../src/lib/market-server");
  const { publicResumeDesign } =
    await import("../src/lib/resume-design/server");
  const { publicAnswers } = await import("../src/lib/portfolio/answers-server");
  const { publishedPackets } = await import("../src/lib/career-brain/serving");
  const { database } = await import("../src/lib/db");
  const { validateEnv } = await import("../src/lib/env");
  const { primaryAccountId } = await import("../src/lib/account-id");
  const career = await getCareer();
  const operations: [string, () => Promise<unknown>][] = [
    [
      "vector_search_synthetic",
      async () => {
        const env = validateEnv(process.env);
        const result = await database().rpc("match_account_embeddings", {
          p_account_id: primaryAccountId,
          query_embedding: JSON.stringify([
            1,
            ...Array<number>(env.dimension - 1).fill(0),
          ]),
          requested_model: env.embeddingModel,
          match_count: 8,
          min_similarity: 0.25,
          entity_types: null,
        });
        if (result.error) throw new Error("Vector search benchmark failed");
      },
    ],
    ["catalog", getCareerCatalog],
    ["presentation", () => getPresentation("US")],
    ["design", publicResumeDesign],
    ["answer_cards", publicAnswers],
    [
      "evidence_recheck",
      () => publishedPackets(career.projects.slice(0, 8).map((r) => r.id)),
    ],
  ];
  for (const [stage, operation] of operations) {
    for (let i = 0; i < runs; i++) {
      spans.length = 0;
      const response = await timedResponse(async () => {
        await operation();
        return new Response();
      });
      console.log(
        JSON.stringify({
          stage,
          run: i + 1,
          mode: process.env.APP_MODE,
          timing: response.headers.get("server-timing"),
          spans,
        }),
      );
    }
  }
}
if (process.argv.includes("--ai")) {
  const { timedResponse, measure } = await import("../src/lib/performance");
  const { analyze } = await import("../src/lib/ai/service");
  const { reserveAIQuota, errorResponse } = await import("../src/lib/http");
  spans.length = 0;
  const response = await timedResponse(async () => {
    try {
      await measure("quota", () => reserveAIQuota());
      await analyze(
        "ask",
        "What software engineering experience is supported by the published evidence?",
      );
      return Response.json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  });
  console.log(
    JSON.stringify({
      stage: "full_answer",
      status: response.status,
      timing: response.headers.get("server-timing"),
      spans,
    }),
  );
}
