import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, errorResponse, HttpError, requireOrigin } from "@/lib/http";
import { ownerAuthClient } from "@/lib/admin";
import { clearSession, writeSession } from "@/lib/auth-session";
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
    writeSession(response, data.session, request.nextUrl.protocol === "https:");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    requireOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    clearSession(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
