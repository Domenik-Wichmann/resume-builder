import { publicShowcase } from "@/lib/portfolio/showcase-server";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    return Response.json(
      { projects: await publicShowcase() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
