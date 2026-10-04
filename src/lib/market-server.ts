import "server-only";
import { cookies, headers } from "next/headers";
import {
  resolveMarket,
  presentationSchema,
  type Market,
  type Presentation,
} from "./markets";
import { validateEnv } from "./env";
import { database } from "./db";
import { primaryAccountId } from "./account-id";
export async function getPresentation(
  market: Market,
  accountId = primaryAccountId,
): Promise<Presentation> {
  if (validateEnv(process.env).mode === "demo")
    return {
      market,
      location:
        market === "US"
          ? "United States · demo presentation"
          : "Bulgaria · demo presentation",
      contact_email: "",
      phone: "",
      work_authorization: "",
    };
  const db = database();
  const profile = await db
    .from("profile")
    .select("id")
    .eq("account_id", accountId)
    .is("archived_at", null)
    .eq("is_public", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (profile.error) throw new Error("Cannot load profile presentation.");
  const result = await db
    .from("profile_presentations")
    .select("*")
    .eq("account_id", accountId)
    .eq(
      "profile_id",
      profile.data?.id || "00000000-0000-0000-0000-000000000000",
    )
    .eq("market", market)
    .eq("is_public", true)
    .maybeSingle();
  if (result.error) throw new Error("Cannot load profile presentation.");
  return result.data
    ? presentationSchema.parse(result.data)
    : {
        market,
        location: "",
        contact_email: "",
        phone: "",
        work_authorization: "",
      };
}
export async function currentMarket() {
  const jar = await cookies(),
    requestHeaders = await headers();
  return resolveMarket(
    jar.get("rb_link_market")?.value,
    jar.get("rb_market")?.value,
    process.env.VERCEL === "1"
      ? requestHeaders.get("x-vercel-ip-country")
      : null,
  );
}
