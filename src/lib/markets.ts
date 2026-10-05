import { z } from "zod";
export const marketSchema = z.enum(["US", "BG"]);
export type Market = z.infer<typeof marketSchema>;
export const presentationSchema = z.object({
  market: marketSchema,
  address: z.string().max(500).optional(),
  photo_url: z.string().max(2000).optional(),
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

export const presentationSettingsSchema = presentationSchema
  .extend({
    location: z.string().trim().max(200),
    contact_email: z.union([z.literal(""), z.email().max(254)]),
    phone: z.string().trim().max(80),
    work_authorization: z.string().trim().max(500),
    address: z.string().trim().max(500),
    photo_url: z
      .string()
      .max(2000)
      .refine(
        (value) =>
          !value ||
          /^\/(media|assets)\/[0-9a-f-]{36}$/.test(value) ||
          (() => {
            try {
              const url = new URL(value);
              return (
                url.protocol === "https:" && !url.username && !url.password
              );
            } catch {
              return false;
            }
          })(),
        "Use an HTTPS image URL or an existing /media/ image.",
      ),
    is_public: z.boolean(),
    version: z.number().int().min(0),
  })
  .strict();
export type PresentationSettings = z.infer<typeof presentationSettingsSchema>;
