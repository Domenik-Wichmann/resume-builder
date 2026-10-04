import { z } from "zod";
export const strategies = [
  "TRADITIONAL",
  "PROJECT_FORWARD",
  "OUTCOME_FORWARD",
] as const;
export const families = [
  "ENGINEERING",
  "DATA",
  "OPERATIONS",
  "PRODUCT",
  "BUSINESS",
  "OTHER",
] as const;
export const outcomes = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "REJECTED",
  "INTERVIEW",
  "SECOND_INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "WITHDRAWN",
] as const;
export const metadataSchema = z
  .object({
    job_family: z.enum(families),
    seniority: z.enum(["ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE", "OTHER"]),
    market: z.enum(["US", "BG"]),
    industry: z.enum([
      "TECHNOLOGY",
      "FINANCE",
      "HEALTH",
      "RETAIL",
      "INDUSTRIAL",
      "OTHER",
    ]),
    work_mode: z.enum(["REMOTE", "HYBRID", "ONSITE", "OTHER"]),
    application_source: z.enum([
      "DIRECT",
      "JOB_BOARD",
      "REFERRAL",
      "RECRUITER",
      "OTHER",
    ]),
  })
  .strict();
export type JobMetadata = z.infer<typeof metadataSchema>;
export const applicationInput = z
  .object({
    organization: z.string().trim().min(1).max(200),
    role: z.string().trim().min(1).max(200),
    job_description: z.string().trim().min(3).max(12000),
    metadata: metadataSchema,
  })
  .strict();
export function suggestedMetadata(
  text: string,
  market: "US" | "BG",
): JobMetadata {
  const t = text.toLowerCase();
  return {
    market,
    job_family: /\b(data|analyst|analytics)\b/.test(t)
      ? "DATA"
      : /\b(engineer|developer)\b/.test(t)
        ? "ENGINEERING"
        : /\b(operations|logistics)\b/.test(t)
          ? "OPERATIONS"
          : /\bproduct\b/.test(t)
            ? "PRODUCT"
            : /\b(sales|business)\b/.test(t)
              ? "BUSINESS"
              : "OTHER",
    seniority: /\b(lead|head)\b/.test(t)
      ? "LEAD"
      : /\bsenior\b/.test(t)
        ? "SENIOR"
        : /\b(junior|entry)\b/.test(t)
          ? "ENTRY"
          : "OTHER",
    industry: "OTHER",
    work_mode: /\bhybrid\b/.test(t)
      ? "HYBRID"
      : /\bremote\b/.test(t)
        ? "REMOTE"
        : /\b(on.?site)\b/.test(t)
          ? "ONSITE"
          : "OTHER",
    application_source: "OTHER",
  };
}
export function outcomeAllowed(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    DRAFT: ["SENT", "WITHDRAWN"],
    SENT: [
      "VIEWED",
      "REJECTED",
      "INTERVIEW",
      "SECOND_INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "WITHDRAWN",
    ],
    VIEWED: [
      "REJECTED",
      "INTERVIEW",
      "SECOND_INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "WITHDRAWN",
    ],
    INTERVIEW: [
      "SECOND_INTERVIEW",
      "OFFER",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
    ],
    SECOND_INTERVIEW: ["OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN"],
    OFFER: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  };
  return from === to || Boolean(allowed[from]?.includes(to));
}
export function rawRates(sent: number, interviews: number, offers: number) {
  return {
    sent,
    interviews,
    offers,
    interview_rate: sent ? interviews / sent : null,
    offer_rate: sent ? offers / sent : null,
    signal: sent < 10 ? "Insufficient data" : "Early signal",
  };
}
