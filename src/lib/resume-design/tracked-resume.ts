import "server-only";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
import { readSession } from "../tracking/service";
import { resumeIRSchema } from "../resume-ir";
import { withTrackingUrl } from "./fixed-content";

/** An active signed link grants only its assigned résumé, never application notes. */
export async function trackedResume(cookie: string | undefined) {
  const session = readSession(cookie || "");
  if (!session || validateEnv(process.env).mode === "demo") return null;
  const db = database();
  const link = await db
    .from("tracking_links")
    .select("application_id")
    .eq("account_id", primaryAccountId)
    .eq("code", session.code)
    .eq("active", true)
    .maybeSingle();
  if (link.error) throw new Error("Cannot load the linked résumé.");
  if (!link.data?.application_id) return null;
  const snapshot = await db
    .from("application_snapshots")
    .select("resume_ir")
    .eq("account_id", primaryAccountId)
    .eq("application_id", link.data.application_id)
    .eq("tracking_code", session.code)
    .maybeSingle();
  if (snapshot.error) throw new Error("Cannot load the saved résumé.");
  if (!snapshot.data) return null;
  return withTrackingUrl(
    resumeIRSchema.parse(snapshot.data.resume_ir),
    session.code,
  );
}
