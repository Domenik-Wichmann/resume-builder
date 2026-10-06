import { NextRequest, NextResponse } from "next/server";
import { readJson, errorResponse } from "@/lib/http";
import { isOwner } from "@/lib/admin";
import { validateEnv } from "@/lib/env";
import { database } from "@/lib/db";
import { pageViewSchema } from "@/lib/tracking/paths";
import {
  createSession,
  readSession,
  resolveLink,
  trackingDisabled,
} from "@/lib/tracking/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const { path } = await readJson(request, pageViewSchema, 256);
    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    if (trackingDisabled(request.headers)) {
      response.cookies.delete("rb_site_visit");
      response.cookies.delete("rb_visit");
      return response;
    }
    if (validateEnv(process.env).mode === "demo" || (await isOwner(request)))
      return response;
    const attributed = readSession(
      request.cookies.get("rb_visit")?.value || "",
    );
    const linkId = attributed ? await resolveLink(attributed.code) : null;
    const existing = readSession(
      request.cookies.get("rb_site_visit")?.value || "",
    );
    const created = createSession("siteView");
    const sessionId =
      linkId && attributed
        ? attributed.sessionId
        : existing?.code === "siteView"
          ? existing.sessionId
          : created.sessionId;
    const result = await database().rpc("record_portfolio_page_view", {
      p_session: sessionId,
      p_path: path,
      p_link: linkId,
    });
    if (result.error) throw new Error("Cannot record page view.");
    if (!linkId && existing?.code !== "siteView")
      response.cookies.set("rb_site_visit", created.cookie, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 86400,
      });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
