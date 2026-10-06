import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  database: () => ({
    rpc: () => ({
      data: { canonical: [], evidence: [], sources: [] },
      error: null,
    }),
    from: () => {
      const query = {
        data: [],
        error: null,
        select: () => query,
        eq: () => query,
        is: () => query,
        order: () => query,
      };
      return query;
    },
  }),
}));

import { getCareer } from "../src/lib/career/repository";
import { analyze } from "../src/lib/ai/service";
import { reindexCareer } from "../src/lib/embeddings/indexer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps an empty live database truthful and skips unnecessary provider calls", async () => {
  for (const [key, value] of Object.entries({
    APP_MODE: "live",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret",
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_MODEL: "openai/gpt-6-luna",
    COHERE_API_KEY: "test-key",
  }))
    vi.stubEnv(key, value);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const career = await getCareer();
  expect(career.demo).toBe(false);
  expect(career.profile.name).toBe("");
  expect(career.projects).toEqual([]);
  expect(await analyze("ask", "What have you built?")).toMatchObject({
    mode: "live",
    evidence: [],
    result: { answer: "No relevant evidence is currently stored." },
  });
  expect(await analyze("match", "SQL reporting role")).toMatchObject({
    mode: "live",
    evidence: [],
    result: { overall_summary: "No relevant evidence is currently stored." },
  });
  expect(await reindexCareer()).toEqual({
    mode: "live",
    indexed: 0,
    unchanged: 0,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
