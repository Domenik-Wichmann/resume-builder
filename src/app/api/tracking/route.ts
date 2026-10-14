import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readJson, errorResponse } from "@/lib/http";
import { isOwner } from "@/lib/admin";
import { validateEnv } from "@/lib/env";
import { database } from "@/lib/db";
import { trackingEventSchema } from "@/lib/tracking/paths";
import { visitorContext } from "@/lib/tracking/visitor-context";
import { currentMarket } from "@/lib/market-server";
import {
  createSession,
  readSession,
  resolveLink,
  trackingDisabled,
} from "@/lib/tracking/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const event = await readJson(request, trackingEventSchema, 256);
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
    const context = visitorContext(request.headers);
    if (context.bot) return response;
    const attributed = readSession(
      request.cookies.get("rb_visit")?.value || "",
    );
    const linkId = attributed ? await resolveLink(attributed.code) : null;
    const existing = readSession(
      request.cookies.get("rb_site_visit")?.value || "",
    );
    // Follow-up telemetry may only update a view in an already signed session.
    if (event.kind !== "page_view" && !linkId && existing?.code !== "siteView")
      return response;
    const created = createSession("siteView");
    const sessionId =
      linkId && attributed
        ? attributed.sessionId
        : existing?.code === "siteView"
          ? existing.sessionId
          : created.sessionId;
    const result = await database().rpc("record_portfolio_activity", {
      p_session: sessionId,
      p_view: event.view_id || randomUUID(),
      p_path: event.path,
      p_kind: event.kind,
      p_link: linkId,
      p_market: await currentMarket(),
      p_country: context.visitor_country,
      p_device: context.device,
      p_browser: context.browser,
      p_os: context.os,
      p_referrer: event.kind === "page_view" ? event.referrer : "unknown",
      p_action: event.kind === "interaction" ? event.action : null,
      p_seconds: event.kind === "engagement" ? event.active_seconds : null,
      p_scroll: event.kind === "engagement" ? event.scroll_depth : null,
    });
    if (result.error) throw new Error("Cannot record portfolio activity.");
    if (result.data === true) response.headers.set("X-Analytics-Recorded", "1");
    if (event.kind === "page_view" && !linkId && existing?.code !== "siteView")
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
