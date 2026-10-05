import { NextRequest } from "next/server";
import { requireAccount } from "@/lib/accounts";
import { readJson, errorResponse } from "@/lib/http";
import {
  explorerData,
  managementSchema,
  manageRecords,
} from "@/lib/career-brain/record-management";
import { loadBrain } from "@/lib/career-brain/repository";
import { reindexCareer } from "@/lib/embeddings/indexer";
export const maxDuration = 300;
export async function GET() {
  try {
    const { db, accountId } = await requireAccount();
    return Response.json(await explorerData(db, accountId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, accountId } = await requireAccount();
    const input = await readJson(request, managementSchema, 100000);
    const current = await loadBrain(db, accountId);
    const changed = await manageRecords(db, accountId, input, current);
    let indexing;
    try {
      indexing = await reindexCareer(accountId);
    } catch {
      indexing = {
        pending: true,
        message:
          "Changes saved. Search indexing needs a retry; outdated evidence cannot supply facts.",
      };
    }
    return Response.json(
      { ...(await explorerData(db, accountId)), changed, indexing },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
