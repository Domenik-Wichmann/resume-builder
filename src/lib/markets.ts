import { z } from "zod";
export const marketSchema = z.enum(["US", "BG"]);
export type Market = z.infer<typeof marketSchema>;
export const presentationSchema = z.object({
  market: marketSchema,
  location: z.string(),
  contact_email: z.string(),
  phone: z.string(),
  work_authorization: z.string(),
});
export type Presentation = z.infer<typeof presentationSchema>;
export function resolveMarket(
  tracking: unknown,
  preference: unknown,
  country: string | null,
): Market {
  const linked = marketSchema.safeParse(tracking);
  if (linked.success) return linked.data;
  const selected = marketSchema.safeParse(preference);
  if (selected.success) return selected.data;
  return country && country !== "US" ? "BG" : "US";
}
