import { NextRequest, NextResponse } from "next/server";
import {
  resolveTrackingLink,
  recordLanding,
  createSession,
  trackingDisabled,
} from "@/lib/tracking/service";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const link = await resolveTrackingLink(code);
  if (!link)
    return new NextResponse("Link not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  // Necessary access cookie is separate from optional visit analytics, including DNT/GPC visitors.
  response.cookies.set("rb_ai_access", createSession(code).cookie, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  // Market selection is a functional preference, independent of analytics consent/signals.
  response.cookies.set("rb_link_market", link.market, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  if (!trackingDisabled(request.headers)) {
    const session = createSession(code);
    await recordLanding(link.id, session.sessionId);
    response.cookies.set("rb_visit", session.cookie, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
  } else {
    response.cookies.delete("rb_visit");
  }
  return response;
}
