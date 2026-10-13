import { NextRequest, NextResponse } from "next/server";
import {
  accessCookie,
  accessSeconds,
  verifyOwnerSession,
} from "@/lib/auth-session";
import { requireOrigin, errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    // Proxy renews once and forwards the rotated session to this handler.
    // Verification failures from the provider keep their status: an outage is not a logout.
    const token =
      request.cookies.get(accessCookie)?.value ||
      request.cookies.get("rb_owner")?.value;
    await verifyOwnerSession(token);
    return NextResponse.json(
      { active: true, expiresIn: Math.max(0, accessSeconds(token)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
