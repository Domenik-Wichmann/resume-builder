import "server-only";
import { z } from "zod";
import type { requireAccount } from "../accounts";
import { HttpError } from "../http";
import { createTrackingCode } from "../tracking/codes";
import type { reuseInput } from "./reuse-input";

const resultSchema = z.object({
  id: z.uuid(),
  tracking_code: z.string().regex(/^[A-Za-z0-9_-]{8}$/),
});
export async function reuseApplication(
  account: Awaited<ReturnType<typeof requireAccount>>,
  input: z.infer<typeof reuseInput>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await account.db.rpc("reuse_saved_resume", {
      p_account: account.accountId,
      p_source: input.id,
      p_request: input.request_id,
      p_organization: input.organization,
      p_role: input.role,
      p_job_description: input.job_description,
      p_learning_demo: input.learning_demo,
      p_code: createTrackingCode(),
    });
    if (!result.error) return resultSchema.parse(result.data);
    if (result.error.code === "23505") continue;
    const errors: Record<string, [number, string]> = {
      SOURCE_NOT_FOUND: [404, "This saved résumé could not be found."],
      ACCOUNT_FORBIDDEN: [403, "Account access required."],
      INVALID_REUSE_INPUT: [400, "Check the company and role, then try again."],
      INVALID_LEARNING_LINK: [
        400,
        "Enter an HTTPS learning link without credentials.",
      ],
      LEARNING_LINK_IS_HOMEPAGE: [
        400,
        "Use the personal learning demo link, separate from the LMS homepage.",
      ],
      LMS_PROJECT_MISSING: [
        409,
        "This résumé has no LMS demo slot. Leave the link blank to reuse it, or generate a new résumé with the LMS project.",
      ],
      TOO_MANY_PROJECT_LINKS: [
        409,
        "This résumé already has too many LMS links. Generate a new résumé to update its project links.",
      ],
      REUSE_REQUEST_CHANGED: [
        409,
        "These details changed after saving. Open the saved copy or start another copy.",
      ],
    };
    const known = errors[result.error.message];
    if (known) throw new HttpError(...known);
    throw new HttpError(
      503,
      "Could not save the copy. Retry with the same details to safely finish saving.",
    );
  }
  throw new HttpError(
    503,
    "Could not allocate a new tracking link. Please retry.",
  );
}
