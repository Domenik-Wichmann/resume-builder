import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { validateEnv } from "./env";
import { z } from "zod";
import { HttpError } from "./http";
export const ownerCookie = "rb_owner";
export function ownerAuthClient() {
  const env = validateEnv(process.env);
  if (
    env.mode !== "live" ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !z.uuid().safeParse(process.env.OWNER_USER_ID).success
  )
    throw new HttpError(503, "Owner access is not configured.");
  return createClient(
    env.supabaseUrl!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function isOwner() {
  const token = (await cookies()).get(ownerCookie)?.value;
  if (!token) return false;
  try {
    const { data, error } = await ownerAuthClient().auth.getUser(token);
    return !error && data.user?.id === process.env.OWNER_USER_ID;
  } catch {
    return false;
  }
}
export async function requireOwner() {
  if (!(await isOwner()))
    throw new HttpError(403, "Owner authentication required.");
}
