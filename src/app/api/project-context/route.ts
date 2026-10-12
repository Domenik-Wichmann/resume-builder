import { z } from "zod";
import { readJson, errorResponse } from "@/lib/http";
import { publicProjectContext } from "@/lib/portfolio/showcase-server";

export async function POST(request: Request) {
  try {
    const input = await readJson(
      request,
      z
        .object({
          ids: z.array(z.uuid()).max(12),
          query: z.string().max(1000).default(""),
          browse: z.boolean().default(false),
        })
        .strict(),
      5000,
    );
    return Response.json(
      await publicProjectContext(input.ids, input.query, input.browse),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
