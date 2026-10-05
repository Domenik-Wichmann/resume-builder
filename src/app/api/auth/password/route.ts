import { NextRequest, NextResponse } from "next/server";
import { ownerAuthClient, ownerCookie } from "@/lib/admin";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import {
  newPasswordSchema,
  recoveryAccessCookie,
  recoveryRefreshCookie,
} from "@/lib/password-recovery";
export async function POST(request: NextRequest) {
  try {
    const { password } = await readJson(request, newPasswordSchema, 4096);
    const access_token = request.cookies.get(recoveryAccessCookie)?.value;
    const refresh_token = request.cookies.get(recoveryRefreshCookie)?.value;
    if (!access_token || !refresh_token)
      throw new HttpError(
        401,
        "Your reset link has expired. Request a new one.",
      );
    const client = ownerAuthClient();
    const verified = await client.auth.getUser(access_token);
    if (verified.error || !verified.data.user)
      throw new HttpError(
        401,
        "Your reset link has expired. Request a new one.",
      );
    const session = await client.auth.setSession({
      access_token,
      refresh_token,
    });
    if (session.error || session.data.user?.id !== verified.data.user.id)
      throw new HttpError(
        401,
        "Your reset link has expired. Request a new one.",
      );
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password")
        throw new HttpError(
          400,
          "Choose a password different from your old password.",
        );
      if (error.code === "weak_password")
        throw new HttpError(
          400,
          "Choose a stronger password with letters, numbers, and symbols.",
        );
      throw new HttpError(
        503,
        "Unable to update your password. Please try again.",
      );
    }
    await client.auth.signOut({ scope: "global" });
    const response = NextResponse.json(
      { updated: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    for (const name of [
      recoveryAccessCookie,
      recoveryRefreshCookie,
      ownerCookie,
      "rb_account",
    ])
      response.cookies.delete(name);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
