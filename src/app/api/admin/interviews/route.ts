import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { errorResponse, readJson } from "@/lib/http";
import { actionSchema } from "@/lib/interview/model";
import {
  listInterviews,
  readInterview,
  interviewAction,
} from "@/lib/interview/repository";
export const maxDuration = 300;
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  try {
    await requireOwner();
    const { db, accountId } = await requireAccount();
    const id = request.nextUrl.searchParams.get("id");
    const before = request.nextUrl.searchParams.get("before");
    const data = id
      ? await readInterview(
          db,
          accountId,
          z.uuid().parse(id),
          before ? z.coerce.number().int().positive().parse(before) : undefined,
        )
      : {
          sessions: await listInterviews(
            db,
            accountId,
            z.coerce
              .number()
              .int()
              .min(0)
              .max(100000)
              .parse(request.nextUrl.searchParams.get("offset") || "0"),
          ),
        };
    return Response.json(data, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await requireOwner();
    const { db, accountId } = await requireAccount();
    const input = await readJson(request, actionSchema, 110000);
    return Response.json(await interviewAction(db, accountId, input), {
      headers: privateHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
