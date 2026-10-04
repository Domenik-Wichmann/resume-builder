import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { readJson, errorResponse } from "@/lib/http";
import { marketSchema } from "@/lib/markets";
import { requireAccount } from "@/lib/accounts";
import { createTrackingCode } from "@/lib/tracking/codes";
import { validateEnv } from "@/lib/env";
export async function POST(request: NextRequest) {
  try {
    await requireOwner();
    const input = await readJson(
      request,
      z
        .object({
          label: z.string().trim().min(1).max(100),
          company: z.string().trim().max(100),
          role: z.string().trim().max(100),
          market: marketSchema,
        })
        .strict(),
    );
    const { db, accountId } = await requireAccount();
    const application = await db
      .from("job_applications")
      .insert({
        account_id: accountId,
        organization: input.company || input.label,
        role: input.role,
        market: input.market,
      })
      .select("id")
      .single();
    if (application.error || !application.data)
      throw new Error("Cannot create application.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = createTrackingCode();
      const { error } = await db.from("tracking_links").insert({
        account_id: accountId,
        code,
        label: input.label,
        market: input.market,
        application_id: application.data.id,
      });
      if (!error)
        return Response.json({
          url: `${validateEnv(process.env).siteUrl}/r/${code}`,
        });
      if (error.code !== "23505") break;
    }
    await db.from("job_applications").delete().eq("id", application.data.id);
    throw new Error("Cannot create tracking link.");
  } catch (error) {
    return errorResponse(error);
  }
}
