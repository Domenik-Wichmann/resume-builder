import { presentationAccount } from "@/lib/presentation-settings";
import { presentationSettingsSchema } from "@/lib/markets";
import { readJson, errorResponse, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const account = await presentationAccount();
    const settings = await readJson(request, presentationSettingsSchema, 10000);
    if (settings.photo_url.startsWith("/assets/")) {
      const asset = await account.db
        .from("owner_assets")
        .select("id")
        .eq("id", settings.photo_url.slice(8))
        .eq("account_id", account.accountId)
        .eq("kind", "PORTRAIT")
        .maybeSingle();
      if (asset.error || !asset.data)
        throw new HttpError(400, "Choose a portrait from your photo library.");
    }
    const saved = await account.db.rpc("save_profile_presentation", {
      p_account: account.accountId,
      p_profile: account.profileId,
      p_settings: settings,
    });
    if (saved.error)
      throw new HttpError(
        saved.error.message.includes("STALE_PRESENTATION") ? 409 : 400,
        "Contact details were not saved. Refresh to load the latest version and try again.",
      );
    return Response.json(
      { version: saved.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
