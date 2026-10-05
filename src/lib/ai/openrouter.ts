import "server-only";
import { z } from "zod";
import { validateEnv } from "../env";
import {
  recordUsage,
  openRouterUsage,
  type UsageContext,
} from "../usage/service";
export class ProviderError extends Error {}
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
  } = {},
): Promise<T> {
  const env = validateEnv(process.env);
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
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
    },
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
  const raw: unknown = await response.json().catch(async () => {
    // Fetch can resolve headers before the response body times out or disconnects.
    await recordUsage(
      "OPENROUTER",
      options.model || env.model!,
      options.usage || {},
      {},
      "FAILED",
    );
    throw new ProviderError("AI provider response failed or timed out.");
  });
  const reported = openRouterUsage.safeParse(
    (raw as { usage?: unknown })?.usage,
  );
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
    "SUCCESS",
  );
  const envelope = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
    })
    .parse(raw);
  return schema.parse(JSON.parse(envelope.choices[0].message.content));
}
