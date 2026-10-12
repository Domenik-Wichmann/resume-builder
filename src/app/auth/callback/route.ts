import { NextRequest, NextResponse } from "next/server";
import { oauthClient } from "@/lib/oauth";
import { validateEnv } from "@/lib/env";
import { adminReturnPath } from "@/lib/auth-navigation";
import { writeSession } from "@/lib/auth-session";
export async function GET(request: NextRequest) {
  const base = validateEnv(process.env).siteUrl;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(base + "/auth/login");
  const { data, error } = await (
    await oauthClient()
  ).auth.exchangeCodeForSession(code);
  if (error || !data.session)
    return NextResponse.redirect(base + "/auth/login");
  const owner = data.user?.id === process.env.OWNER_USER_ID;
  const response = NextResponse.redirect(
    base +
      (owner
        ? adminReturnPath(request.cookies.get("rb_auth_next")?.value)
        : "/account"),
  );
  response.cookies.delete("rb_auth_next");
  if (owner) {
    writeSession(response, data.session, new URL(base).protocol === "https:");
    response.cookies.delete("rb_pkce");
    return response;
  }
  response.cookies.set("rb_account", data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.min(data.session.expires_in, 3600),
  });
  response.cookies.delete("rb_pkce");
  return response;
}
