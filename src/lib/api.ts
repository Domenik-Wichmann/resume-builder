import "server-only";
import { z } from "zod";
import { analyze } from "./ai/service";
import { readJson, errorResponse } from "./http";
import { reservePublicAction } from "./access/service";
export async function handleAI(request: Request, task: "ask" | "match") {
  let release: (() => Promise<void>) | undefined;
  try {
    const { input } = await readJson(
      request,
      z
        .object({
          input: z
            .string()
            .trim()
            .min(3)
            .max(task === "ask" ? 1000 : 12000),
        })
        .strict(),
    );
    release = await reservePublicAction(request, task);
    return Response.json(
      await analyze(task, input, undefined, { operation: task }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  } finally {
    await release?.();
  }
}
