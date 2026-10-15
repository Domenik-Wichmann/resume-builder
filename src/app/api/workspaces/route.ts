import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJson, errorResponse } from "@/lib/http";
import { validateEnv } from "@/lib/env";
import { database } from "@/lib/db";
import { newWorkspace } from "@/lib/workspaces/model";
import {
  createVisitor,
  readVisitor,
  visitorCookie,
} from "@/lib/workspaces/identity";
import { listWorkspaces } from "@/lib/workspaces/repository";
import { currentMarket } from "@/lib/market-server";
import {
  readSession,
  resolveLink,
  trackingDisabled,
} from "@/lib/tracking/service";
import { randomUUID } from "node:crypto";
import { isOwner } from "@/lib/admin";
import {
  analyticsVisitorCookie,
  readAnalyticsVisitor,
} from "@/lib/tracking/service";
export async function GET(request: NextRequest) {
  try {
    if (validateEnv(process.env).mode === "demo")
      return Response.json({ mode: "demo", workspaces: [] });
    const visitor = readVisitor(request.cookies.get(visitorCookie)?.value);
    return Response.json(
      {
        mode: "live",
        workspaces: visitor ? await listWorkspaces(visitor) : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await readJson(request, z.object({}).strict());
    const market = await currentMarket(),
      demo = validateEnv(process.env).mode === "demo";
    if (demo)
      return NextResponse.json({
        workspace: newWorkspace(randomUUID(), market, true),
      });
    const existing = readVisitor(request.cookies.get(visitorCookie)?.value),
      created = existing ? null : createVisitor(),
      visitorId = existing || created!.id;
    const session = trackingDisabled(request.headers)
      ? null
      : readSession(request.cookies.get("rb_visit")?.value || "");
    const link = session ? await resolveLink(session.code) : null;
    const db = database();
    await db.rpc("prune_workspaces");
    const analyticsVisitor =
      trackingDisabled(request.headers) || (await isOwner(request))
        ? null
        : readAnalyticsVisitor(
            request.cookies.get(analyticsVisitorCookie)?.value,
          );
    const { data, error } = await db.rpc("create_workspace_with_analytics", {
      p_visitor_id: visitorId,
      p_market: market,
      p_tracking_link_id: link,
      p_analytics_visitor_id: analyticsVisitor,
    });
    if (error) {
      if (error.message.includes("WORKSPACE_LIMIT"))
        return Response.json(
          {
            error:
              "Both workspace slots are occupied. Delete an old workspace to start a new one.",
          },
          { status: 409 },
        );
      throw new Error("Cannot create workspace.");
    }
    const response = NextResponse.json({
      workspace: newWorkspace(z.uuid().parse(data), market, false),
    });
    if (created)
      response.cookies.set(visitorCookie, created.cookie, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 86400,
      });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
