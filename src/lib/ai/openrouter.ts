import "server-only";
import { z } from "zod";
import { validateEnv } from "../env";
export class ProviderError extends Error {}
export async function complete<T>(
  system: string,
  input: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const env = validateEnv(process.env);
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${env.openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || env.siteUrl,
        "X-Title": process.env.OPENROUTER_APP_NAME || "Resume Builder",
      },
      body: JSON.stringify({
        model: env.model,
        temperature: 0,
        max_tokens: 1800,
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
  );
  if (!response.ok)
    throw new ProviderError(
      "AI provider is unavailable. Please try again later.",
    );
  const envelope = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
    })
    .parse(await response.json());
  return schema.parse(JSON.parse(envelope.choices[0].message.content));
}
