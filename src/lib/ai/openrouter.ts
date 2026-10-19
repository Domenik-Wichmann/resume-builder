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
      | "UNAVAILABLE"
      | "TIMEOUT"
      | "TRUNCATED"
      | "INVALID_RESPONSE" = "UNAVAILABLE",
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
  const started = performance.now();
  const timeoutMs = options.timeoutMs || 25000;
  const signal = AbortSignal.timeout(timeoutMs);
  const operations = {
    application_plan: "understanding the job",
    application_write: "writing the resume",
    application_verify: "reviewing resume statements",
    application_recovery: "revising the resume",
  } as const;
  const operation = options.usage?.operation;
  const knownOperation =
    operation && Object.hasOwn(operations, operation)
      ? (operation as keyof typeof operations)
      : undefined;
  const failure = (
    message: string,
    reason: ProviderError["reason"],
    status?: number,
  ) => {
    // Fixed categories and numeric timing only. Never log provider messages,
    // prompts, source text, resume content, account IDs or credentials.
    console.error("ai_provider_failed", {
      operation: knownOperation || "other",
      reason,
      status,
      elapsed_ms: Math.round(performance.now() - started),
      timeout_ms: timeoutMs,
    });
    return new ProviderError(message, reason);
  };
  const interrupted = (error: unknown) => {
    const timedOut =
      signal.aborted ||
      (error instanceof Error && error.name === "TimeoutError");
    const context = knownOperation
      ? ` while ${operations[knownOperation]}`
      : "";
    const resume = knownOperation
      ? " Your draft is saved. Continue the saved generation to retry the unfinished step."
      : " Please try again.";
    return failure(
      timedOut
        ? `The AI timed out${context} after ${Math.round(timeoutMs / 1000)} seconds.${resume}`
        : `The AI connection was interrupted${context}.${resume}`,
      timedOut ? "TIMEOUT" : "UNAVAILABLE",
    );
  };
  const response = await measure("llm", () =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
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
  ).catch(async (error: unknown) => {
    await recordUsage(
      "OPENROUTER",
      options.model || env.model!,
      options.usage || {},
      {},
      "FAILED",
    );
    throw interrupted(error);
  });
  if (!response.ok) {
    await recordUsage(
      "OPENROUTER",
      options.model || env.model!,
      options.usage || {},
      {},
      "FAILED",
    );
    throw failure(
      response.status === 429
        ? `The AI provider is rate-limiting requests. Wait briefly, then ${knownOperation ? "continue the saved generation" : "try again"}.`
        : response.status === 402
          ? "The AI provider has insufficient credits. Check the provider balance, then retry."
          : "The AI provider rejected the request. Please try again later.",
      "UNAVAILABLE",
      response.status,
    );
  }
  const raw: unknown = await measure("llm_body", () => response.json()).catch(
    async (error: unknown) => {
      // Fetch can resolve headers before the response body times out or disconnects.
      await recordUsage(
        "OPENROUTER",
        options.model || env.model!,
        options.usage || {},
        {},
        "FAILED",
      );
      throw interrupted(error);
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
  let resultFailure: ProviderError | undefined;
  if (envelope.success && envelope.data.choices[0].finish_reason === "length") {
    resultFailure = failure(
      "The AI response reached its output limit before completing. Retry the saved generation; no partial draft was accepted.",
      "TRUNCATED",
    );
  } else if (
    !envelope.success ||
    (envelope.data.choices[0].finish_reason &&
      envelope.data.choices[0].finish_reason !== "stop")
  ) {
    resultFailure = failure(
      "The AI response did not complete. Retry the saved generation.",
      "INVALID_RESPONSE",
    );
  } else {
    try {
      parsed = schema.parse(
        JSON.parse(envelope.data.choices[0].message.content || ""),
      );
    } catch {
      resultFailure = failure(
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
    resultFailure ? "FAILED" : "SUCCESS",
  );
  if (resultFailure) throw resultFailure;
  return parsed as T;
}
