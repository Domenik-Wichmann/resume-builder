import { NextRequest, NextResponse } from "next/server";
import { oauthClient } from "@/lib/oauth";
import { validateEnv } from "@/lib/env";
export async function GET(request: NextRequest) {
  const base = validateEnv(process.env).siteUrl;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(base + "/auth/login");
  const { data, error } = await (
    await oauthClient()
  ).auth.exchangeCodeForSession(code);
  if (error || !data.session)
    return NextResponse.redirect(base + "/auth/login");
  const response = NextResponse.redirect(base + "/account");
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
