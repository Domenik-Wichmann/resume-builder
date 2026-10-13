import "server-only";
import { z } from "zod";
import type { requireAccount } from "../accounts";
import type { generationStatus } from "./generation";
import { createTrackingCode } from "../tracking/codes";
import { withTrackingUrl } from "../resume-design/fixed-content";
import { resumeIRSchema } from "../resume-ir";
import { strategies } from "./model";
import { HttpError } from "../http";

const snapshotSchema = z.object({
  tracking_code: z.string().regex(/^[A-Za-z0-9_-]{8}$/),
  strategy: z.enum(strategies),
  resume_ir: resumeIRSchema,
});

export async function completeApplication(
  account: Awaited<ReturnType<typeof requireAccount>>,
  state: Awaited<ReturnType<typeof generationStatus>>,
) {
  if (state.stage !== 4) return state;
  let id = state.id;
  // The database locks the preview and commits the application, immutable resume,
  // code and attribution link together. Retries return the original application.
  for (let attempt = 0; !id && attempt < 3; attempt++) {
    const result = await account.db.rpc("finalize_application", {
      p_account: account.accountId,
      p_preview: state.preview_id,
      p_code: createTrackingCode(),
    });
    if (!result.error) id = z.uuid().parse(result.data);
    else if (result.error.code !== "23505")
      throw new HttpError(
        409,
        "Your draft is ready, but its tracking link could not be saved. Retry the saved generation.",
      );
  }
  if (!id)
    throw new HttpError(
      503,
      "Cannot allocate a tracking link. Retry the saved generation.",
    );
  const saved = await account.db
    .from("application_snapshots")
    .select("tracking_code,strategy,resume_ir")
    .eq("account_id", account.accountId)
    .eq("application_id", id)
    .maybeSingle();
  const parsed = snapshotSchema.safeParse(saved.data);
  if (saved.error || !parsed.success)
    throw new HttpError(
      503,
      "The resume was saved, but could not be opened. Retry the saved generation.",
    );
  const snapshot = parsed.data;
  return {
    ...state,
    id,
    tracking_code: snapshot.tracking_code,
    strategy: snapshot.strategy,
    // Render and export the actual assigned snapshot, not a different preview variant.
    options: {
      [snapshot.strategy]: withTrackingUrl(
        snapshot.resume_ir,
        snapshot.tracking_code,
      ),
    },
  };
}
