import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse, HttpError } from "@/lib/http";
import { fixedContentSchema } from "@/lib/resume-design/fixed-content";
import { applicationTemplate } from "@/lib/resume-design/server";
export async function GET() {
  try {
    await requireOwner();
    const a = await requireAccount();
    return Response.json(await applicationTemplate(a.db, a.accountId), {
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
    const input = await readJson(
      request,
      z.object({ content: fixedContentSchema }).strict(),
      16000,
    );
    const saved = await a.db.rpc("save_resume_fixed_content", {
      p_account: a.accountId,
      p_spec: input.content,
    });
    if (saved.error)
      throw new HttpError(
        409,
        "Fixed content changed or is invalid. Refresh before saving; nothing was overwritten.",
      );
    return Response.json({
      content: { ...input.content, version: saved.data },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
