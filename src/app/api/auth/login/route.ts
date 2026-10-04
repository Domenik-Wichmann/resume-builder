import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, errorResponse, HttpError, requireOrigin } from "@/lib/http";
import { ownerAuthClient } from "@/lib/admin";
export async function POST(request: NextRequest) {
  try {
    const credentials = await readJson(
      request,
      z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(256),
        })
        .strict(),
    );
    const { data, error } =
      await ownerAuthClient().auth.signInWithPassword(credentials);
    if (error || !data.session)
      throw new HttpError(401, "Invalid account credentials.");
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set("rb_account", data.session.access_token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: Math.min(data.session.expires_in, 3600),
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    requireOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.delete("rb_account");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
