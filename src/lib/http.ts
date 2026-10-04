import "server-only";
import { z } from "zod";
import { validateEnv } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireOrigin(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(validateEnv(process.env).siteUrl).origin
  )
    throw new HttpError(403, "Requests must originate from this site.");
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 50000,
): Promise<T> {
  requireOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Expected JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export function errorResponse(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "Service temporarily unavailable.",
    },
    {
      status: error instanceof HttpError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function reserveAIQuota() {
  if (validateEnv(process.env).mode === "demo") return;
  const { database } = await import("./db");
  const { data, error } = await database().rpc("consume_ai_quota");
  if (error) throw new HttpError(503, "AI quota service unavailable.");
  if (!data)
    throw new HttpError(429, "AI request limit reached. Please try later.");
}
