import "server-only";
import type { requireAccount } from "../accounts";
import { HttpError } from "../http";
import { applicationInput } from "./model";
import { startGeneration } from "./generation";

export async function regenerateApplication(
  account: Awaited<ReturnType<typeof requireAccount>>,
  id: string,
) {
  // Read the original job through the verified owner's JWT/RLS. Browser input
  // chooses a source version; it cannot supply account authority or private text.
  const [application, preview] = await Promise.all([
    account.db
      .from("job_applications")
      .select("organization,role,job_description,metadata")
      .eq("account_id", account.accountId)
      .eq("id", id)
      .maybeSingle(),
    account.db
      .from("application_previews")
      .select("learning_demo")
      .eq("account_id", account.accountId)
      .eq("saved_application_id", id)
      .maybeSingle(),
  ]);
  if (application.error || preview.error)
    throw new HttpError(
      503,
      "Cannot load this application's job details. Try again.",
    );
  if (!application.data) throw new HttpError(404, "Application not found.");
  const input = applicationInput.safeParse({
    ...application.data,
    learning_demo: preview.data?.learning_demo || null,
  });
  if (!input.success)
    throw new HttpError(
      409,
      "This legacy application is missing job details. Create a new résumé with the complete job description.",
    );
  // A new preview uses current evidence and template settings. The old snapshot,
  // tracking link, outcomes and analytics remain attached to the sent version.
  return startGeneration(account, input.data);
}
