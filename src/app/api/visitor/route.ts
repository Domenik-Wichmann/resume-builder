import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import {
  createVisitor,
  readVisitor,
  visitorCookie,
} from "@/lib/workspaces/identity";
import { verificationStatus } from "@/lib/access/service";
import { accessConfig } from "@/lib/access/config";
import { validateEnv } from "@/lib/env";
export async function GET(request: NextRequest) {
  try {
    const s = await verificationStatus(request);
    return Response.json(
      { required: s.required, siteKey: s.siteKey, mode: s.mode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const action = await readJson(
      request,
      z.object({ token: z.string().min(1).max(2048).optional() }).strict(),
    );
    const existing = readVisitor(request.cookies.get(visitorCookie)?.value),
      created = existing ? null : createVisitor(),
      visitor = existing || created!.id;
    const db = database();
    if (validateEnv(process.env).mode === "live") {
      const saved = await db.from("anonymous_visitors").upsert(
        {
          id: visitor,
          account_id: primaryAccountId,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (saved.error) throw new Error("Cannot create visitor session.");
      if (action.token) {
        const config = accessConfig(process.env);
        if (!config.configured)
          throw new HttpError(409, "Human verification is not configured.");
        const result = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: config.secret,
              response: action.token,
              idempotency_key: randomUUID(),
            }),
          },
        );
        const verified = z
          .object({
            success: z.boolean(),
            hostname: z.string().optional(),
            action: z.string().optional(),
          })
          .parse(await result.json());
        if (
          !result.ok ||
          !verified.success ||
          verified.hostname !==
            new URL(validateEnv(process.env).siteUrl).hostname ||
          verified.action !== "ai_access"
        )
          throw new HttpError(
            403,
            "Human verification failed. Try a fresh challenge.",
          );
        const marked = await db
          .from("anonymous_visitors")
          .update({
            verified_until: new Date(Date.now() + 86400000).toISOString(),
          })
          .eq("account_id", primaryAccountId)
          .eq("id", visitor);
        if (marked.error) throw new Error("Cannot save verification.");
      }
    }
    const response = NextResponse.json({ ready: true });
    if (created)
      response.cookies.set(visitorCookie, created.cookie, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 86400,
      });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
