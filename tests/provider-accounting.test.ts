import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("../src/lib/usage/service", async (original) => ({
  ...(await original<typeof import("../src/lib/usage/service")>()),
  recordUsage: vi.fn(),
}));
import { recordUsage } from "../src/lib/usage/service";
import { complete, ProviderError } from "../src/lib/ai/openrouter";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("records an unknown-cost failed call once when headers arrive but the response body aborts", async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna-pro");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.reject(new DOMException("body aborted", "AbortError")),
    }),
  );
  const usage = {
    accountId: "11111111-1111-4111-8111-111111111111",
    operation: "career_ingest",
  };
  await expect(
    complete("System", "Untrusted source", z.object({ answer: z.string() }), {
      usage,
    }),
  ).rejects.toBeInstanceOf(ProviderError);
  expect(recordUsage).toHaveBeenCalledExactlyOnceWith(
    "OPENROUTER",
    "openai/gpt-6-luna-pro",
    usage,
    {},
    "FAILED",
  );
});
it("keeps returned billing quantities on successful structured responses", async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna-pro");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 42, completion_tokens: 5, cost: 0.001 },
        choices: [{ message: { content: '{"answer":"Supported"}' } }],
      }),
    }),
  );
  expect(
    await complete("System", "Source", z.object({ answer: z.string() })),
  ).toEqual({ answer: "Supported" });
  expect(recordUsage).toHaveBeenCalledExactlyOnceWith(
    "OPENROUTER",
    "openai/gpt-6-luna-pro",
    {},
    { input: 42, output: 5, cost: 0.001 },
    "SUCCESS",
  );
});
