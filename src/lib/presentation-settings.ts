import "server-only";
import { requireOwner } from "./admin";
import { requireAccount } from "./accounts";
import { HttpError } from "./http";
import { presentationSettingsSchema, type Market } from "./markets";

export async function presentationAccount() {
  await requireOwner();
  const account = await requireAccount();
  const profile = await account.db
    .from("profile")
    .select("id")
    .eq("account_id", account.accountId)
    .is("archived_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (profile.error) throw new HttpError(503, "Cannot load profile.");
  if (!profile.data)
    throw new HttpError(
      409,
      "Create a canonical profile in Import & interview first.",
    );
  return { ...account, profileId: String(profile.data.id) };
}
export async function loadPresentationSettings(
  account: Awaited<ReturnType<typeof presentationAccount>>,
) {
  const result = await account.db
    .from("profile_presentations")
    .select("*")
    .eq("account_id", account.accountId)
    .eq("profile_id", account.profileId);
  if (result.error)
    throw new HttpError(503, "Cannot load contact presentations.");
  return (["US", "BG"] as Market[]).map((market) => {
    const row = result.data?.find((value) => value.market === market);
    return presentationSettingsSchema.parse({
      market,
      location: row?.location || "",
      address: row?.address || "",
      contact_email: row?.contact_email || "",
      phone: row?.phone || "",
      work_authorization: row?.work_authorization || "",
      photo_url: row?.photo_url || "",
      is_public: row?.is_public || false,
      version: row?.version || 0,
    });
  });
}
