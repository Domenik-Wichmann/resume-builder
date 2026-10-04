import { database } from "../src/lib/db";
import { createTrackingCode } from "../src/lib/tracking/codes";
import { validateEnv } from "../src/lib/env";
import { z } from "zod";
async function main() {
  if (validateEnv(process.env).mode !== "live") {
    console.log("Demo link: /r/demoLink. Analytics are not persisted.");
    return;
  }
  const db = database();
  const applicationId = process.argv[2];
  if (applicationId) {
    z.uuid().parse(applicationId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = createTrackingCode();
      const { error } = await db
        .from("tracking_links")
        .insert({ code, application_id: applicationId });
      if (!error) {
        console.log(`${validateEnv(process.env).siteUrl}/r/${code}`);
        return;
      }
      if (error.code !== "23505")
        throw new Error(
          "Cannot create tracking link. Check the application ID and database configuration.",
        );
    }
    throw new Error("Unable to allocate a unique tracking code.");
  }
  const { data, error } = await db
    .from("tracking_events")
    .select("link_id,event_type,created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Cannot inspect tracking events.");
  console.table(data);
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Tracking command failed.",
  );
  process.exitCode = 1;
});
