import "server-only";
import { z } from "zod";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
export type UsageContext = {
  accountId?: string;
  workspaceId?: string;
  applicationId?: string;
  operation?: string;
};
const quantity = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .optional();
export const openRouterUsage = z.object({
  prompt_tokens: quantity,
  completion_tokens: quantity,
  cost: z.number().finite().nonnegative().max(1000000).optional(),
});
export const cohereUsage = z.object({
  billed_units: z.object({ input_tokens: quantity }).optional(),
});
export function dollarsToMicro(value: number) {
  return Math.ceil(value * 1000000);
}
export async function recordUsage(
  provider: "OPENROUTER" | "COHERE",
  model: string,
  context: UsageContext,
  usage: { input?: number; output?: number; units?: number; cost?: number },
  status: "SUCCESS" | "FAILED",
) {
  if (validateEnv(process.env).mode === "demo") return;
  const saved = await database()
    .from("provider_usage_events")
    .insert({
      account_id: context.accountId || primaryAccountId,
      provider,
      model,
      operation_type: context.operation || "provider_call",
      input_tokens: usage.input ?? null,
      output_tokens: usage.output ?? null,
      units: usage.units ?? null,
      provider_cost_micro:
        usage.cost === undefined ? null : dollarsToMicro(usage.cost),
      platform_charge_micro: null,
      workspace_id: context.workspaceId || null,
      application_id: context.applicationId || null,
      status,
    });
  if (saved.error) throw new Error("Provider usage could not be recorded.");
}
// No signup/UI invokes this. Eligibility is a trusted service decision; configuration alone never enables grants.
export async function grantTrialCredit(accountId: string, eligible: boolean) {
  if (!eligible || process.env.TRIAL_CREDIT_ENABLED !== "true") return null;
  const amount = z
    .string()
    .regex(/^[1-9][0-9]{0,14}$/)
    .parse(process.env.TRIAL_CREDIT_MICRO);
  const days = z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .parse(process.env.TRIAL_CREDIT_DAYS);
  const account = await database()
    .from("accounts")
    .select("kind,billing_mode")
    .eq("id", accountId)
    .single();
  if (
    account.error ||
    account.data.kind !== "NORMAL" ||
    account.data.billing_mode !== "PLATFORM_CREDITS"
  )
    return null;
  const txn = await database().rpc("append_credit", {
    p_account: accountId,
    p_amount: amount,
    p_reason: "TRIAL_GRANT",
    p_key: "initial-trial",
    p_expires: new Date(Date.now() + days * 86400000).toISOString(),
  });
  if (txn.error) throw new Error("Cannot grant trial credit.");
  return txn.data;
}
