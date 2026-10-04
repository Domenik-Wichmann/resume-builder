import { randomBytes } from "node:crypto";
export function createTrackingCode() {
  return randomBytes(6).toString("base64url");
}
export function validTrackingCode(code: string) {
  return /^[A-Za-z0-9_-]{8}$/.test(code);
}
