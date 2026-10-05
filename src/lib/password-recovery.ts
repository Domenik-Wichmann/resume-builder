import "server-only";
import { z } from "zod";
export const recoveryVerifierCookie = "rb_recovery_pkce";
export const recoveryAccessCookie = "rb_recovery_access";
export const recoveryRefreshCookie = "rb_recovery_refresh";
export const recoveryRequestSchema = z
  .object({ email: z.email().max(254) })
  .strict();
export const newPasswordSchema = z
  .object({ password: z.string().min(12).max(256) })
  .strict();
export const recoveryMessage =
  "If an account exists for that email, a reset link will arrive shortly. Check your spam folder too. Open the link in this browser.";
