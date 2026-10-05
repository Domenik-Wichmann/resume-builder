import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { database } from "@/lib/db";
import { requireOrigin, readJson, errorResponse, HttpError } from "@/lib/http";
import { readAsset } from "@/lib/resume-design/uploads";
import { loadDesignStudio } from "@/lib/resume-design/server";
export async function GET() {
  try {
    await requireOwner();
    const a = await requireAccount();
    return Response.json(await loadDesignStudio(a.db, a.accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireOwner();
    const a = await requireAccount();
    requireOrigin(request);
    const url = new URL(request.url);
    const parsed = z
      .object({
        kind: z.enum(["PORTRAIT", "REFERENCE"]),
        name: z.string().trim().min(1).max(120),
      })
      .safeParse({
        kind: url.searchParams.get("kind"),
        name: url.searchParams.get("name"),
      });
    if (!parsed.success)
      throw new HttpError(
        400,
        "Choose the file type and a name up to 120 characters.",
      );
    const { kind, name } = parsed.data;
    const file = await readAsset(request, kind === "REFERENCE");
    const id = randomUUID(),
      path = `${a.accountId}/${id}.${file.extension}`;
    const storage = database().storage.from("owner-assets");
    const uploaded = await storage.upload(path, file.bytes, {
      contentType: file.mime,
      upsert: false,
    });
    if (uploaded.error) throw new HttpError(503, "Cannot upload file.");
    const saved = await a.db.from("owner_assets").insert({
      id,
      account_id: a.accountId,
      kind,
      name,
      mime_type: file.mime,
      storage_path: path,
    });
    if (saved.error) {
      await storage.remove([path]);
      throw new HttpError(
        400,
        "Cannot save file. Keep up to 40 files in the library.",
      );
    }
    return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    await requireOwner();
    const a = await requireAccount();
    const { id } = await readJson(
      request,
      z.object({ id: z.uuid() }).strict(),
      1000,
    );
    const row = await a.db
      .from("owner_assets")
      .select("storage_path")
      .eq("id", id)
      .eq("account_id", a.accountId)
      .maybeSingle();
    if (row.error || !row.data) throw new HttpError(404, "File not found.");
    const deleted = await a.db
      .from("owner_assets")
      .delete()
      .eq("id", id)
      .eq("account_id", a.accountId);
    if (deleted.error)
      throw new HttpError(
        409,
        "This file is used by a portrait or saved template revision. Remove it from contact presentations first; saved template references are retained for history.",
      );
    const removed = await database()
      .storage.from("owner-assets")
      .remove([row.data.storage_path]);
    return Response.json(
      { deleted: true, cleanup_pending: Boolean(removed.error) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
