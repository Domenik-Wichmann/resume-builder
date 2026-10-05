import { z } from "zod";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { requireAccount } from "@/lib/accounts";
import { HttpError, errorResponse } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().safeParse((await params).id);
    if (!id.success) throw new HttpError(404, "File not found.");
    const db = database();
    const row = await db
      .from("owner_assets")
      .select("account_id,kind,storage_path,mime_type")
      .eq("id", id.data)
      .maybeSingle();
    if (row.error || !row.data) throw new HttpError(404, "File not found.");
    let visible = false;
    if (
      row.data.account_id === primaryAccountId &&
      row.data.kind === "PORTRAIT"
    ) {
      const contact = await db
        .from("profile_presentations")
        .select("profile_id")
        .eq("account_id", row.data.account_id)
        .eq("is_public", true)
        .eq("photo_url", `/assets/${id.data}`);
      if (contact.error) throw new Error("Cannot check portrait publication.");
      if (contact.data?.length) {
        const profile = await db
          .from("profile")
          .select("id")
          .eq("account_id", row.data.account_id)
          .eq("is_public", true)
          .is("archived_at", null)
          .in(
            "id",
            contact.data.map((c) => c.profile_id),
          );
        visible = !profile.error && Boolean(profile.data?.length);
      }
    }
    if (!visible) {
      const account = await requireAccount();
      if (account.accountId !== row.data.account_id)
        throw new HttpError(404, "File not found.");
    }
    const file = await db.storage
      .from("owner-assets")
      .download(row.data.storage_path);
    if (file.error || !file.data) throw new HttpError(404, "File not found.");
    return new Response(file.data, {
      headers: {
        "Content-Type": row.data.mime_type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="reference.${row.data.mime_type === "application/pdf" ? "pdf" : "image"}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
