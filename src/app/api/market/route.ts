import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { marketSchema } from "@/lib/markets";
import { readJson, errorResponse } from "@/lib/http";
export async function POST(request: NextRequest) {
  try {
    const { market } = await readJson(
      request,
      z.object({ market: marketSchema }).strict(),
    );
    const response = NextResponse.json({ market });
    response.cookies.set("rb_market", market, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 90 * 86400,
    });
    response.cookies.delete("rb_link_market");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
