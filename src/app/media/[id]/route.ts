import { z } from "zod";
import { database } from "@/lib/db";
import { primaryAccountId } from "@/lib/account-id";
import { requireAccount } from "@/lib/accounts";
import { errorResponse, HttpError } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = z.uuid().safeParse((await params).id);
    if (!parsed.success) throw new HttpError(404, "Image not found.");
    const db = database();
    const row = await db
      .from("project_media")
      .select("account_id,project_id,storage_path,mime_type")
      .eq("id", parsed.data)
      .maybeSingle();
    if (row.error || !row.data) throw new HttpError(404, "Image not found.");
    const project = await db
      .from("projects")
      .select("is_public,archived_at")
      .eq("id", row.data.project_id)
      .eq("account_id", row.data.account_id)
      .maybeSingle();
    const isPublic =
      row.data.account_id === primaryAccountId &&
      project.data?.is_public &&
      !project.data.archived_at;
    if (!isPublic) {
      const account = await requireAccount();
      if (account.accountId !== row.data.account_id)
        throw new HttpError(404, "Image not found.");
    }
    const file = await db.storage
      .from("project-media")
      .download(row.data.storage_path);
    if (file.error || !file.data) throw new HttpError(404, "Image not found.");
    return new Response(file.data, {
      headers: {
        "Content-Type": row.data.mime_type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
