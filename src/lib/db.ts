import "server-only";
import { createClient } from "@supabase/supabase-js";
import { validateEnv } from "./env";
export function database() {
  const env = validateEnv(process.env);
  if (!env.supabaseUrl || !env.supabaseKey)
    throw new Error("Supabase server configuration is missing.");
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
