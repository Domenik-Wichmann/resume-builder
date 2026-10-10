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
it.each([null, '{"answer":"Looks complete"}', '{"answer":'])(
  "rejects output-limit responses, including parseable JSON, while retaining billing (%s)",
  async (content) => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("OPENROUTER_MODEL", "synthetic-reasoning-model");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          usage: {
            prompt_tokens: 72625,
            completion_tokens: 6500,
            cost: 0.03,
          },
          choices: [{ finish_reason: "length", message: { content } }],
        }),
      }),
    );
    await expect(
      complete(
        "System",
        "Private untrusted input",
        z.object({ answer: z.string() }),
      ),
    ).rejects.toMatchObject({ reason: "TRUNCATED" });
    expect(recordUsage).toHaveBeenCalledExactlyOnceWith(
      "OPENROUTER",
      "synthetic-reasoning-model",
      {},
      { input: 72625, output: 6500, cost: 0.03 },
      "FAILED",
    );
  },
);
it.each([null, "broken JSON", '{"answer":123}'])(
  "fails closed on invalid completed responses without exposing content (%s)",
  async (content) => {
    vi.stubEnv("APP_MODE", "demo");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          usage: { completion_tokens: 30 },
          choices: [{ finish_reason: "stop", message: { content } }],
        }),
      }),
    );
    await expect(
      complete(
        "System",
        "Private untrusted input",
        z.object({ answer: z.string() }),
      ),
    ).rejects.toMatchObject({ reason: "INVALID_RESPONSE" });
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordUsage).mock.calls[0][4]).toBe("FAILED");
  },
);
it("passes explicit reasoning settings without changing other callers' defaults", async () => {
  vi.stubEnv("APP_MODE", "demo");
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: { content: '{"answer":"Supported"}' },
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetcher);
  await complete("System", "Source", z.object({ answer: z.string() }), {
    maxTokens: 16000,
    reasoningEffort: "low",
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    max_tokens: 16000,
    reasoning: { effort: "low", exclude: true },
  });
  await complete("System", "Source", z.object({ answer: z.string() }));
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty(
    "reasoning",
  );
});
