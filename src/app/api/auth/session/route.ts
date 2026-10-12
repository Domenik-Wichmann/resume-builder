import { NextRequest, NextResponse } from "next/server";
import {
  accessCookie,
  accessSeconds,
  renewSession,
  writeSession,
} from "@/lib/auth-session";
import { requireOwner } from "@/lib/admin";
import { requireOrigin, errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    if (accessSeconds(request.cookies.get(accessCookie)?.value) > 300) {
      await requireOwner();
      return NextResponse.json(
        { active: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const session = await renewSession(request);
    const response = NextResponse.json({ active: true });
    writeSession(response, session, request.nextUrl.protocol === "https:");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
