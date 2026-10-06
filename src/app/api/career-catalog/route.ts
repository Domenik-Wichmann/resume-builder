import { getCareerCatalog } from "@/lib/career/catalog-server";
import { errorResponse } from "@/lib/http";
import { timedResponse, measure } from "@/lib/performance";

export async function GET() {
  return timedResponse(getCatalog);
}
async function getCatalog() {
  try {
    return Response.json(await measure("catalog", () => getCareerCatalog()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
