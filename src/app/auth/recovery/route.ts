import { NextRequest, NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";
import { oauthClient } from "@/lib/oauth";
import {
  recoveryVerifierCookie,
  recoveryAccessCookie,
  recoveryRefreshCookie,
} from "@/lib/password-recovery";
export async function GET(request: NextRequest) {
  const base = validateEnv(process.env).siteUrl;
  const invalid = () => {
    const response = NextResponse.redirect(
      new URL("/auth/reset-password?error=expired", base),
    );
    response.cookies.delete(recoveryAccessCookie);
    response.cookies.delete(recoveryRefreshCookie);
    response.cookies.delete(recoveryVerifierCookie);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !request.cookies.get(recoveryVerifierCookie)?.value)
    return invalid();
  try {
    const { data, error } = await (
      await oauthClient(recoveryVerifierCookie)
    ).auth.exchangeCodeForSession(code);
    if (
      error ||
      !data.session ||
      !("redirectType" in data) ||
      data.redirectType !== "recovery"
    )
      return invalid();
    const response = NextResponse.redirect(
      new URL("/auth/reset-password", base),
    );
    const options = {
      httpOnly: true,
      secure: new URL(base).protocol === "https:",
      sameSite: "lax" as const,
      path: "/",
      maxAge: Math.min(data.session.expires_in, 600),
    };
    response.cookies.set(
      recoveryAccessCookie,
      data.session.access_token,
      options,
    );
    response.cookies.set(
      recoveryRefreshCookie,
      data.session.refresh_token,
      options,
    );
    response.cookies.delete(recoveryVerifierCookie);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return invalid();
  }
}
