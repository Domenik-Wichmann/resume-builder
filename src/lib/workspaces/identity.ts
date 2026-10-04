import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { validateEnv } from "../env";
export const visitorCookie = "rb_workspace_visitor";
function sign(value: string) {
  return createHmac(
    "sha256",
    validateEnv(process.env).supabaseKey || "demo-visitor-cookie-key",
  )
    .update(`workspace:${value}`)
    .digest("base64url");
}
export function createVisitor() {
  const id = randomUUID();
  const payload = `${id}.${Date.now() + 90 * 86400000}`;
  return { id, cookie: `${payload}.${sign(payload)}` };
}
export function readVisitor(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const [id, expires, signature, ...rest] = cookie.split(".");
  if (
    rest.length ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id || "",
    ) ||
    !/^\d+$/.test(expires || "") ||
    Number(expires) <= Date.now() ||
    !signature
  )
    return null;
  const expected = Buffer.from(sign(`${id}.${expires}`)),
    actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual)
    ? id
    : null;
}
