import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { database } from "./db";
import { verifiedSessionUser, ownerCookie } from "./admin";
import { HttpError } from "./http";
export async function requireAccount() {
  const jar = await cookies();
  const token = jar.get(ownerCookie)?.value || jar.get("rb_account")?.value;
  if (!token) throw new HttpError(403, "Account authentication required.");
  const user = await verifiedSessionUser(token);
  if (!user) throw new HttpError(403, "Account authentication required.");
  const bootstrap = await database().rpc("bootstrap_account", {
    p_user: user.id,
    p_primary: user.id === process.env.OWNER_USER_ID,
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
  return { accountId: String(bootstrap.data), userId: user.id, db };
}
