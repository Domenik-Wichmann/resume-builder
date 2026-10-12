import { NextRequest, NextResponse } from "next/server";
import { oauthClient } from "@/lib/oauth";
import { validateEnv } from "@/lib/env";
import { adminReturnPath } from "@/lib/auth-navigation";
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (
    (provider !== "google" && provider !== "github") ||
    process.env[`AUTH_${provider.toUpperCase()}_ENABLED`] !== "true"
  )
    return Response.json(
      { error: "OAuth provider is not configured." },
      { status: 404 },
    );
  const { data, error } = await (
    await oauthClient()
  ).auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: validateEnv(process.env).siteUrl + "/auth/callback",
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url)
    return Response.json(
      { error: "Unable to start authentication." },
      { status: 503 },
    );
  const response = NextResponse.redirect(data.url);
  response.cookies.set(
    "rb_auth_next",
    adminReturnPath(request.nextUrl.searchParams.get("next")),
    {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    },
  );
  return response;
}
