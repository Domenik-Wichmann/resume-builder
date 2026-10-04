import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAccount } from "@/lib/accounts";
import { database } from "@/lib/db";
import { readJson, requireOrigin, errorResponse, HttpError } from "@/lib/http";
import { mediaSchema, projectImageLimit } from "@/lib/portfolio/model";
import { imageType } from "@/lib/portfolio/images";
export async function POST(request: Request) {
  try {
    const { db, accountId } = await requireAccount();
    requireOrigin(request);
    const id = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("project"));
    const alt = z
      .string()
      .trim()
      .min(1)
      .max(300)
      .safeParse(new URL(request.url).searchParams.get("alt"));
    if (!id.success || !alt.success)
      throw new HttpError(400, "Select a saved project and provide alt text.");
    const parent = await db
      .from("projects")
      .select("id")
      .eq("id", id.data)
      .eq("account_id", accountId)
      .is("archived_at", null)
      .maybeSingle();
    if (parent.error || !parent.data)
      throw new HttpError(404, "Project not found.");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Missing image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > projectImageLimit) {
        await reader.cancel();
        throw new HttpError(413, "Image limit is 4 MB.");
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks),
      type = imageType(bytes);
    if (!type) throw new HttpError(415, "Use a PNG, JPEG, WebP or GIF image.");
    const mediaId = randomUUID(),
      path = `${accountId}/${id.data}/${mediaId}.${type.extension}`;
    const storage = database().storage.from("project-media");
    const uploaded = await storage.upload(path, bytes, {
      contentType: type.mime,
      upsert: false,
    });
    if (uploaded.error) throw new Error("Cannot upload image.");
    const result = await db.from("project_media").insert({
      id: mediaId,
      account_id: accountId,
      project_id: id.data,
      storage_path: path,
      mime_type: type.mime,
      alt: alt.data,
    });
    if (result.error) {
      await storage.remove([path]);
      throw new Error("Cannot save media metadata.");
    }
    return Response.json({ id: mediaId });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db, accountId } = await requireAccount();
    const media = await readJson(request, mediaSchema);
    const { id, ...fields } = media;
    const result = await db
      .from("project_media")
      .update(fields)
      .eq("account_id", accountId)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (result.error)
      throw new HttpError(
        400,
        "Cannot update image. Only one cover is allowed; unset the current cover first.",
      );
    if (!result.data) throw new HttpError(404, "Image not found.");
    return Response.json({ saved: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db, accountId } = await requireAccount();
    const { id } = await readJson(request, z.object({ id: z.uuid() }).strict());
    const row = await db
      .from("project_media")
      .select("storage_path")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();
    if (row.error || !row.data) throw new HttpError(404, "Image not found.");
    const removed = await database()
      .storage.from("project-media")
      .remove([row.data.storage_path]);
    if (removed.error) throw new Error("Cannot remove image.");
    const result = await db
      .from("project_media")
      .delete()
      .eq("account_id", accountId)
      .eq("id", id);
    if (result.error) throw new Error("Cannot remove media.");
    return Response.json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
