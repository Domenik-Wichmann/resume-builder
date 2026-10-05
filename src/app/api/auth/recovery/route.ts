import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { oauthClient } from "@/lib/oauth";
import { validateEnv } from "@/lib/env";
import {
  recoveryRequestSchema,
  recoveryVerifierCookie,
  recoveryMessage,
} from "@/lib/password-recovery";
export async function POST(request: NextRequest) {
  try {
    const { email } = await readJson(request, recoveryRequestSchema, 2048);
    const env = validateEnv(process.env);
    if (
      env.mode !== "live" ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      throw new HttpError(503, "Password recovery is not configured.");
    const client = await oauthClient(recoveryVerifierCookie, 3600);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/auth/recovery", env.siteUrl).href,
    });
    if (error) {
      if (error.status === 429)
        throw new HttpError(
          429,
          "Please wait before requesting another reset link.",
        );
      throw new HttpError(
        503,
        "Unable to send a reset email. Please try again later.",
      );
    }
    return NextResponse.json(
      { message: recoveryMessage },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
