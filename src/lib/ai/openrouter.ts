import "server-only";
import { z } from "zod";
import { validateEnv } from "../env";
import { measure } from "../performance";
import {
  recordUsage,
  openRouterUsage,
  type UsageContext,
} from "../usage/service";
export class ProviderError extends Error {
  constructor(
    message: string,
    public reason:
      "UNAVAILABLE" | "TRUNCATED" | "INVALID_RESPONSE" = "UNAVAILABLE",
  ) {
    super(message);
  }
}
export type CompletionPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };
export async function complete<T>(
  system: string,
  input: string | CompletionPart[],
  schema: z.ZodType<T>,
  options: {
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
    usage?: UsageContext;
    pdf?: boolean;
    reasoningEffort?: "low" | "medium" | "high";
  } = {},
): Promise<T> {
  const env = validateEnv(process.env);
  const response = await measure("llm", () =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs || 25000),
      headers: {
        Authorization: `Bearer ${env.openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || env.siteUrl,
        "X-Title": process.env.OPENROUTER_APP_NAME || "Resume Builder",
      },
      body: JSON.stringify({
        model: options.model || env.model,
        temperature: 0,
        max_tokens: options.maxTokens || 1800,
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort, exclude: true } }
          : {}),
        ...(options.pdf
          ? { plugins: [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }] }
          : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "career_response",
            strict: true,
            schema: z.toJSONSchema(schema),
          },
        },
      }),
    }),
  ).catch(async () => {
    await recordUsage(
      "OPENROUTER",
      options.model || env.model!,
      options.usage || {},
      {},
      "FAILED",
    );
    throw new ProviderError("AI provider request failed or timed out.");
  });
  if (!response.ok) {
    await recordUsage(
      "OPENROUTER",
      options.model || env.model!,
      options.usage || {},
      {},
      "FAILED",
    );
    throw new ProviderError(
      "AI provider is unavailable. Please try again later.",
    );
  }
  const raw: unknown = await measure("llm_body", () => response.json()).catch(
    async () => {
      // Fetch can resolve headers before the response body times out or disconnects.
      await recordUsage(
        "OPENROUTER",
        options.model || env.model!,
        options.usage || {},
        {},
        "FAILED",
      );
      throw new ProviderError("AI provider response failed or timed out.");
    },
  );
  const reported = openRouterUsage.safeParse(
    (raw as { usage?: unknown })?.usage,
  );
  const envelope = z
    .object({
      choices: z
        .array(
          z.object({
            finish_reason: z.string().nullable().optional(),
            message: z.object({ content: z.string().nullable() }),
          }),
        )
        .min(1),
    })
    .safeParse(raw);
  let parsed: T | undefined;
  let failure: ProviderError | undefined;
  if (envelope.success && envelope.data.choices[0].finish_reason === "length") {
    failure = new ProviderError(
      "The AI response reached its output limit before completing. Retry the saved generation; no partial draft was accepted.",
      "TRUNCATED",
    );
  } else if (
    !envelope.success ||
    (envelope.data.choices[0].finish_reason &&
      envelope.data.choices[0].finish_reason !== "stop")
  ) {
    failure = new ProviderError(
      "The AI response did not complete. Retry the saved generation.",
      "INVALID_RESPONSE",
    );
  } else {
    try {
      parsed = schema.parse(
        JSON.parse(envelope.data.choices[0].message.content || ""),
      );
    } catch {
      failure = new ProviderError(
        "The AI response was incomplete or invalid. Retry the saved generation; no partial draft was accepted.",
        "INVALID_RESPONSE",
      );
    }
  }
  // Provider billing still counts incomplete answers. Retain quantities, but
  // mark unusable responses failed rather than claiming a draft succeeded.
  await recordUsage(
    "OPENROUTER",
    options.model || env.model!,
    options.usage || {},
    reported.success
      ? {
          input: reported.data.prompt_tokens,
          output: reported.data.completion_tokens,
          cost: reported.data.cost,
        }
      : {},
    failure ? "FAILED" : "SUCCESS",
  );
  if (failure) throw failure;
  return parsed as T;
}
