import { z } from "zod";
export function accessConfig(env: Record<string, string | undefined>) {
  const number = (key: string, fallback: number) =>
    z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(env[key] || fallback);
  const siteKey = env.TURNSTILE_SITE_KEY?.trim(),
    secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (Boolean(siteKey) !== Boolean(secret))
    throw new Error("Configure both Turnstile keys or neither.");
  return {
    siteKey,
    secret,
    spacing: number("AI_VISITOR_SPACING_SECONDS", 5),
    daily: number("AI_VISITOR_DAILY_LIMIT", 25),
    weekly: number("AI_VISITOR_WEEKLY_LIMIT", 50),
    configured: Boolean(siteKey && secret),
  };
}
export function requiresVerification(
  configured: boolean,
  validTrackedLink: boolean,
  verifiedUntil: string | null,
  now = Date.now(),
) {
  return (
    configured &&
    !validTrackedLink &&
    (!verifiedUntil || Date.parse(verifiedUntil) <= now)
  );
}
