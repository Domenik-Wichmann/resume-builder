import "server-only";
import type { Session } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ownerAuthClient, verifiedSessionUser } from "./admin";
import { HttpError } from "./http";

export const accessCookie = "rb_account";
export const refreshCookie = "rb_refresh";
// Browsers bound persistent cookies; renew this window rather than timing out an idle owner.
export const sessionLifetime = 400 * 24 * 60 * 60;
const sessionCookies = [accessCookie, "rb_owner", refreshCookie];

export function clearSession(response: NextResponse) {
  for (const name of sessionCookies) response.cookies.delete(name);
  response.headers.set("Cache-Control", "private, no-store");
}

export function writeSession(
  response: NextResponse,
  session: Pick<Session, "access_token" | "refresh_token" | "expires_in">,
  secure: boolean,
) {
  const options = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
  };
  response.cookies.delete("rb_owner");
  response.cookies.set(accessCookie, session.access_token, {
    ...options,
    maxAge: Math.min(session.expires_in, 3600),
  });
  if (session.refresh_token)
    response.cookies.set(refreshCookie, session.refresh_token, {
      ...options,
      maxAge: sessionLifetime,
    });
  else response.cookies.delete(refreshCookie);
  response.headers.set("Cache-Control", "private, no-store");
}

/** Expiry is an optimization only. Supabase still verifies every private read/write. */
export function accessSeconds(token?: string, now = Date.now()) {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token?.split(".")[1] || "", "base64url").toString(),
    );
    if (!payload || typeof payload !== "object" || !("exp" in payload))
      return 0;
    return typeof payload.exp === "number" ? payload.exp - now / 1000 : 0;
  } catch {
    return 0;
  }
}

export async function renewSession(request: NextRequest) {
  const refresh = request.cookies.get(refreshCookie)?.value;
  if (!refresh || refresh.length > 4096)
    throw new HttpError(401, "Your session ended. Sign in to continue.");
  const auth = ownerAuthClient().auth;
  const { data, error } = await auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) {
    if (error && (error.status === 0 || Number(error.status) >= 500))
      throw new HttpError(
        503,
        "Sign-in service is temporarily unavailable. Try again.",
      );
    throw new HttpError(401, "Your session ended. Sign in to continue.");
  }
  await verifyOwnerSession(data.session.access_token);
  return data.session;
}

export async function verifyOwnerSession(token?: string) {
  if (!token)
    throw new HttpError(401, "Your session ended. Sign in to continue.");
  const user = await verifiedSessionUser(token);
  if (user?.id !== process.env.OWNER_USER_ID)
    throw new HttpError(401, "Sign in with the portfolio owner account.");
}
