import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, errorResponse, HttpError, requireOrigin } from "@/lib/http";
import { ownerAuthClient, ownerCookie } from "@/lib/admin";
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
    if (error || !data.session || data.user?.id !== process.env.OWNER_USER_ID)
      throw new HttpError(401, "Invalid owner credentials.");
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ownerCookie, data.session.access_token, {
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
    response.cookies.delete(ownerCookie);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
