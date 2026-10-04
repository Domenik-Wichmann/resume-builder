import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { database } from "./db";
import { ownerAuthClient, ownerCookie } from "./admin";
import { HttpError } from "./http";
export async function requireAccount() {
  const jar = await cookies();
  const token = jar.get(ownerCookie)?.value || jar.get("rb_account")?.value;
  if (!token) throw new HttpError(403, "Account authentication required.");
  const { data, error } = await ownerAuthClient().auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(403, "Account authentication required.");
  const bootstrap = await database().rpc("bootstrap_account", {
    p_user: data.user.id,
    p_primary: data.user.id === process.env.OWNER_USER_ID,
  });
  if (bootstrap.error || !bootstrap.data)
    throw new HttpError(503, "Account bootstrap unavailable.");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return { accountId: String(bootstrap.data), userId: data.user.id, db };
}
