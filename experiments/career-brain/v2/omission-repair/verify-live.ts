import { writeFile } from "node:fs/promises";
import { database } from "../../../../src/lib/db";
import { primaryAccountId } from "../../../../src/lib/account-id";
import { loadCanonical } from "../../../../src/lib/ingestion/repository";
import { checked } from "../claim-repair/database";
import { root } from "./fixtures";
const db = database();
const users = [];
for (let page = 1; ; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (result.error) throw new Error("Cannot verify temporary Auth cleanup");
  users.push(...result.data.users);
  if (result.data.users.length < 1000) break;
}
const remainingSyntheticAuth = users.filter((u) =>
  /^(?:omission-repair|claim-repair|career-qualification|career-repair|continuation)-/.test(
    u.email || "",
  ),
).length;
const state = await loadCanonical(db, primaryAccountId);
const evidence = await checked(
  await db.from("career_record_evidence").select("account_id"),
);
const usage = await checked(
  await db
    .from("provider_usage_events")
    .select("id")
    .eq("account_id", primaryAccountId),
);
if (remainingSyntheticAuth || state.length || evidence?.length)
  throw new Error("Live cleanup or primary-data preservation check failed");
const result = {
  verifiedAt: new Date().toISOString(),
  remainingSyntheticAuth,
  primaryCanonicalRecords: state.length,
  totalEvidenceRows: evidence?.length || 0,
  primaryUsageEvents: usage?.length || 0,
  migration: "202610050009_career_evidence",
  privateSmokeCleaned: true,
};
await writeFile(
  `${root}/live-verification.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
