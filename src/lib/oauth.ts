import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function oauthClient() {
  const jar = await cookies();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) =>
            key.endsWith("code-verifier")
              ? jar.get("rb_pkce")?.value || null
              : null,
          setItem: (key, value) => {
            if (key.endsWith("code-verifier"))
              jar.set("rb_pkce", value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 600,
              });
          },
          removeItem: (key) => {
            if (key.endsWith("code-verifier")) jar.delete("rb_pkce");
          },
        },
      },
    },
  );
}
