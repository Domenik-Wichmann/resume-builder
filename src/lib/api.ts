import "server-only";
import { z } from "zod";
import { validateEnv } from "./env";
import { database } from "./db";
import { analyze } from "./ai/service";
const payload = z
  .object({ input: z.string().trim().min(3).max(12000) })
  .strict();
export async function handleAI(request: Request, task: "ask" | "match") {
  try {
    const env = validateEnv(process.env);
    if (request.headers.get("origin") !== new URL(env.siteUrl).origin)
      return Response.json(
        { error: "Requests must originate from this site." },
        { status: 403 },
      );
    if (!request.headers.get("content-type")?.includes("application/json"))
      return Response.json({ error: "Expected JSON." }, { status: 415 });
    // Read a bounded stream rather than trusting a client-supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "Missing request body." }, { status: 400 });
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 50000) {
        await reader.cancel();
        return Response.json({ error: "Request too large." }, { status: 413 });
      }
      chunks.push(value);
    }
    const parsed = payload.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!parsed.success || (task === "ask" && parsed.data.input.length > 1000))
      return Response.json(
        {
          error:
            "Enter a question (3–1,000 characters) or job description (3–12,000 characters).",
        },
        { status: 400 },
      );
    if (env.mode === "live") {
      // Atomic global quota: durable across serverless instances, no IP analytics or Redis.
      const { data, error } = await database().rpc("consume_ai_quota");
      if (error) throw new Error("Quota service unavailable.");
      if (!data)
        return Response.json(
          { error: "AI request limit reached. Please try later." },
          { status: 429 },
        );
    }
    return Response.json(await analyze(task, parsed.data.input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    // Never log recruiter input or provider response bodies.
    return Response.json(
      { error: "Unable to complete this request. Please try later." },
      { status: 503 },
    );
  }
}
