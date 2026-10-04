import "server-only";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { readVisitor, visitorCookie } from "../workspaces/identity";
import { readSession, resolveLink } from "../tracking/service";
import { validateEnv } from "../env";
import { HttpError, reserveAIQuota } from "../http";
import { accessConfig, requiresVerification } from "./config";
function cookieValue(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export async function verificationStatus(request: Request) {
  const config = accessConfig(process.env),
    visitor = readVisitor(cookieValue(request, visitorCookie));
  const tracked = readSession(cookieValue(request, "rb_ai_access") || "");
  const link = tracked ? await resolveLink(tracked.code) : null;
  let verifiedUntil: string | null = null;
  if (visitor && validateEnv(process.env).mode === "live") {
    const row = await database()
      .from("anonymous_visitors")
      .select("verified_until")
      .eq("account_id", primaryAccountId)
      .eq("id", visitor)
      .maybeSingle();
    if (row.error) throw new Error("Verification state unavailable.");
    verifiedUntil = row.data?.verified_until || null;
  }
  return {
    visitor,
    required: requiresVerification(
      config.configured,
      Boolean(link),
      verifiedUntil,
    ),
    siteKey: config.siteKey,
    mode: config.configured ? "TURNSTILE" : "LIMITS_ONLY",
  };
}
export async function reservePublicAction(
  request: Request,
  operation: "ask" | "match" | "compile",
  workspaceId?: string,
) {
  if (validateEnv(process.env).mode === "demo") return async () => {};
  const state = await verificationStatus(request);
  if (!state.visitor)
    throw new HttpError(
      428,
      "Create a visitor session or workspace before using AI.",
    );
  if (state.required)
    throw new HttpError(
      403,
      "Complete human verification before your first AI operation.",
    );
  const c = accessConfig(process.env),
    db = database();
  const reserved = await db.rpc("reserve_visitor_ai", {
    p_account: primaryAccountId,
    p_visitor: state.visitor,
    p_workspace: workspaceId || null,
    p_operation: operation,
    p_spacing: c.spacing,
    p_daily: c.daily,
    p_weekly: c.weekly,
  });
  if (reserved.error) throw new Error("Visitor quota service unavailable.");
  if (reserved.data !== "OK")
    throw new HttpError(
      reserved.data === "WORKSPACE_FORBIDDEN" ? 404 : 429,
      reserved.data === "CONCURRENT"
        ? "Another AI operation is running. Please wait."
        : reserved.data === "SPACING"
          ? `Wait at least ${c.spacing} seconds between AI operations.`
          : "Visitor AI limit reached. Please try later.",
    );
  const release = async () => {
    await db
      .from("anonymous_visitors")
      .update({ ai_lease_until: null })
      .eq("id", state.visitor!)
      .eq("account_id", primaryAccountId);
  };
  try {
    await reserveAIQuota();
  } catch (e) {
    await release();
    throw e;
  }
  return release;
}
