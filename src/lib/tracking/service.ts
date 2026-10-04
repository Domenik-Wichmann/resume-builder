import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { database } from "../db";
import { validateEnv } from "../env";
import { validTrackingCode } from "./codes";
import { primaryAccountId } from "../account-id";
export function trackingDisabled(headers: Headers) {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}
export async function resolveTrackingLink(
  code: string,
): Promise<{ id: string; market: "US" | "BG" } | null> {
  if (!validTrackingCode(code)) return null;
  if (validateEnv(process.env).mode === "demo")
    return code === "demoLink"
      ? { id: "demo-link", market: "US" }
      : code === "demoBGbg"
        ? { id: "demo-bg-link", market: "BG" }
        : null;
  const { data, error } = await database()
    .from("tracking_links")
    .select("id,market")
    .eq("account_id", primaryAccountId)
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (error) return null;
  return data && (data.market === "US" || data.market === "BG")
    ? { id: data.id, market: data.market }
    : null;
}
export async function resolveLink(code: string) {
  return (await resolveTrackingLink(code))?.id || null;
}
export async function recordLanding(linkId: string, sessionId: string) {
  if (validateEnv(process.env).mode === "demo") return;
  // Analytics are best effort; a database outage must not interrupt the portfolio visit.
  try {
    const db = database();
    await db.rpc("prune_tracking_events");
    await db.from("tracking_events").insert({
      link_id: linkId,
      session_id: sessionId,
      event_type: "page_view",
    });
  } catch {
    // Transport failures also preserve the redirect; no visitor data is logged.
  }
}
function signature(payload: string) {
  return createHmac(
    "sha256",
    validateEnv(process.env).supabaseKey || "local-demo-cookie-key",
  )
    .update(payload)
    .digest("base64url");
}
export function createSession(code: string) {
  const sessionId = randomUUID();
  const payload = `${code}.${sessionId}.${Date.now() + 86400000}`;
  return { sessionId, cookie: `${payload}.${signature(payload)}` };
}
export function readSession(cookie: string) {
  const parts = cookie.split(".");
  if (
    parts.length !== 4 ||
    !validTrackingCode(parts[0]) ||
    !/^[0-9a-f-]{36}$/.test(parts[1]) ||
    !/^\d+$/.test(parts[2]) ||
    Number(parts[2]) < Date.now()
  )
    return null;
  const expected = Buffer.from(signature(parts.slice(0, 3).join(".")));
  const actual = Buffer.from(parts[3]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  return { code: parts[0], sessionId: parts[1] };
}
