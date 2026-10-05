import { handleAI } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleAI(request, "match");
}
