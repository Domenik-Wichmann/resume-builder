import { NextRequest, NextResponse } from "next/server";
import {
  accessCookie,
  accessSeconds,
  clearSession,
  refreshCookie,
  renewSession,
  writeSession,
} from "@/lib/auth-session";
import { adminSignInPath } from "@/lib/auth-navigation";
import { HttpError } from "@/lib/http";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  // Overwrite browser-supplied values. The layout uses this only for a local return URL.
  headers.set("x-admin-path", path + request.nextUrl.search);
  const next = () =>
    NextResponse.next({
      request: { headers },
      headers: { "Cache-Control": "private, no-store" },
    });
  if (process.env.APP_MODE === "demo" || path === "/api/admin/login")
    return next();
  const token =
    request.cookies.get(accessCookie)?.value ||
    request.cookies.get("rb_owner")?.value;
  if (accessSeconds(token) > 60) return next();
  if (!request.cookies.has(refreshCookie)) {
    if (!token && (path.startsWith("/admin") || path === "/account"))
      return NextResponse.redirect(
        new URL(adminSignInPath(path + request.nextUrl.search), request.url),
      );
    return next();
  }
  // Rotation must not occur for cross-site API writes. Route handlers enforce origin too.
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return next();
  try {
    const session = await renewSession(request);
    request.cookies.set(accessCookie, session.access_token);
    request.cookies.delete("rb_owner");
    headers.set("cookie", request.cookies.toString());
    const response = next();
    writeSession(response, session, request.nextUrl.protocol === "https:");
    return response;
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 401)
      return NextResponse.json(
        { error: "Sign-in service is temporarily unavailable. Please retry." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const response = path.startsWith("/api/")
      ? NextResponse.json({ error: error.message }, { status: 403 })
      : NextResponse.redirect(
          new URL(adminSignInPath(path + request.nextUrl.search), request.url),
        );
    clearSession(response);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/account", "/api/admin/:path*"],
};
