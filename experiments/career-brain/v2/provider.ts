import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { complete as productionComplete } from "../../../src/lib/ai/openrouter";

// Single-process harness only. Observe metadata without recording source, prompts,
// credentials or completion text; the production adapter still accounts for usage.
export async function complete<T>(
  system: string,
  input: string,
  schema: z.ZodType<T>,
  options: Parameters<typeof productionComplete>[3] = {},
): Promise<T> {
  const original = globalThis.fetch;
  let detail = "";
  globalThis.fetch = async (request, init) => {
    const response = await original(request, init);
    if (
      String(request).startsWith(
        "https://openrouter.ai/api/v1/chat/completions",
      )
    ) {
      const raw = await response
        .clone()
        .json()
        .catch(() => null);
      let message =
        typeof raw?.error?.message === "string" ? raw.error.message : "";
      if (process.env.OPENROUTER_API_KEY)
        message = message.replaceAll(
          process.env.OPENROUTER_API_KEY,
          "[redacted]",
        );
      if (message.includes("SYNTHETIC") || message.length > 1000)
        message = "Provider rejected the request; detailed response omitted.";
      detail = message.slice(0, 700);
      const path =
        process.env.CAREER_QUALIFICATION_OMISSION_REPAIR === "1"
          ? "experiments/career-brain/v2/omission-repair/results/provider-responses.json"
          : process.env.CAREER_QUALIFICATION_CLAIM_REPAIR === "1"
            ? "experiments/career-brain/v2/claim-repair/results/provider-responses.json"
            : process.env.CAREER_QUALIFICATION_CONTINUATION === "1"
              ? "experiments/career-brain/v2/continuation/results/provider-responses.json"
              : "experiments/career-brain/v2/results/provider-responses.json";
      let observed: unknown[] = [];
      try {
        observed = JSON.parse(await readFile(path, "utf8"));
      } catch {}
      observed.push({
        model: options?.model,
        status: response.status,
        finishReason: raw?.choices?.[0]?.finish_reason || null,
        outputTokens: raw?.usage?.completion_tokens || null,
        error: detail || null,
        ...(process.env.CAREER_QUALIFICATION_OMISSION_REPAIR === "1"
          ? { syntheticResponse: raw?.choices?.[0]?.message?.content || null }
          : {}),
      });
      await writeFile(path, JSON.stringify(observed, null, 2) + "\n");
    }
    return response;
  };
  try {
    return await productionComplete(system, input, schema, options);
  } catch (e) {
    if (detail) throw new Error(`Provider rejection: ${detail}`);
    throw e;
  } finally {
    globalThis.fetch = original;
  }
}
