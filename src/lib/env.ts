import { z } from "zod";
import { accessConfig } from "./access/config";

export function validateEnv(env: Record<string, string | undefined>) {
  accessConfig(env);
  const mode = env.APP_MODE || (env.NODE_ENV === "production" ? "" : "demo");
  if (mode !== "demo" && mode !== "live")
    throw new Error("Set APP_MODE explicitly to demo or live in production.");
  const siteUrl = z
    .url()
    .parse(env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(new URL(siteUrl).protocol))
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) URL.");
  if (mode === "live") {
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "OPENROUTER_API_KEY",
      "OPENROUTER_MODEL",
      "COHERE_API_KEY",
      "NEXT_PUBLIC_SITE_URL",
    ]) {
      if (!env[key]?.trim()) throw new Error(`Live mode requires ${key}.`);
    }
    z.url().parse(env.NEXT_PUBLIC_SUPABASE_URL);
    if (
      !["http:", "https:"].includes(
        new URL(env.NEXT_PUBLIC_SUPABASE_URL!).protocol,
      )
    )
      throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTP(S) URL.");
  }
  const dimension = Number(env.COHERE_EMBED_DIMENSION || 1024);
  if (dimension !== 1024)
    throw new Error(
      "COHERE_EMBED_DIMENSION must match the committed vector(1024) schema. Add a dimension migration before changing it.",
    );
  return {
    mode,
    siteUrl,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: env.SUPABASE_SECRET_KEY,
    openrouterKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    cohereKey: env.COHERE_API_KEY,
    embeddingModel: env.COHERE_EMBED_MODEL || "embed-v4.0",
    dimension,
  };
}
