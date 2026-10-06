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
export async function isOwner(request?: Request) {
  try {
    const jar = request ? null : await cookies();
    for (const name of [ownerCookie, "rb_account"]) {
      const token = request
        ? request.headers
            .get("cookie")
            ?.split(";")
            .map((value) => value.trim())
            .find((value) => value.startsWith(`${name}=`))
            ?.slice(name.length + 1)
        : jar?.get(name)?.value;
      if (!token) continue;
      const { data, error } = await ownerAuthClient().auth.getUser(token);
      if (!error && data.user?.id === process.env.OWNER_USER_ID) return true;
    }
    return false;
  } catch {
    return false;
  }
}
export async function requireOwner() {
  if (!(await isOwner()))
    throw new HttpError(403, "Owner authentication required.");
}
