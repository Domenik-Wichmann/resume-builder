import "server-only";
import { z } from "zod";
import { validateEnv } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
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
      headers: {
        "Cache-Control": "no-store",
        ...(error instanceof HttpError && error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : {}),
      },
    },
  );
}
export async function reserveAIQuota() {
  if (validateEnv(process.env).mode === "demo") return;
  // Next's request cookies carry owner authority through nested provider calls.
  // Scripts without a request context and unverified sessions remain quota-bound.
  const { isOwner } = await import("./admin");
  if (await isOwner()) return;
  const { database } = await import("./db");
  const { data, error } = await database().rpc("consume_ai_quota");
  if (error) throw new HttpError(503, "AI quota service unavailable.");
  if (!data) {
    const quota = await database()
      .from("ai_quota")
      .select("day,daily_count")
      .eq("id", 1)
      .single();
    const now = new Date();
    const daily =
      !quota.error &&
      quota.data?.day === now.toISOString().slice(0, 10) &&
      quota.data.daily_count >= 100;
    if (daily) {
      const reset = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      );
      throw new HttpError(
        429,
        "The site's daily AI allowance is used up. It resets at 00:00 UTC. Published career content is still available to browse. The signed-in site owner is exempt from this limit.",
        Math.max(1, Math.ceil((reset - now.getTime()) / 1000)),
      );
    }
    throw new HttpError(
      429,
      quota.error
        ? "The site's shared AI allowance is temporarily exhausted. Please try again later."
        : "The site's AI requests are arriving too quickly. Please try again in one minute.",
      quota.error ? undefined : 60,
    );
  }
}
