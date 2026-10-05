import { writeFile } from "node:fs/promises";
import { database } from "../../../../src/lib/db";
import { primaryAccountId } from "../../../../src/lib/account-id";
import { kinds, tableFor } from "../../../../src/lib/ingestion/model";
import { checked } from "./database";
import { root } from "./fixtures";

if (process.env.APP_MODE !== "live")
  throw new Error("Read-only live verification requires live mode");
const db = database();
const tables = [
  ...kinds.map((kind) => tableFor[kind]),
  "career_sources",
  "career_imports",
  "career_embeddings",
  "provider_usage_events",
];
const results = await Promise.allSettled(
  tables.map(async (table) => {
    const result = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("account_id", primaryAccountId);
    if (result.error) throw new Error(`Cannot verify ${table}`);
    return [table, result.count] as const;
  }),
);
const counts: Record<string, number | null> = {};
for (const result of results) {
  if (result.status === "rejected") throw result.reason;
  counts[result.value[0]] = result.value[1];
}
const auth = await checked(
  await db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
);
const remainingUsers = auth.users.filter((user) =>
  user.email?.startsWith("claim-repair-"),
).length;
const result = {
  primaryCounts: counts,
  remainingQualificationAuthUsers: remainingUsers,
  allPrimaryCareerTablesEmpty: kinds.every(
    (kind) => counts[tableFor[kind]] === 0,
  ),
  readOnly: true,
};
if (
  remainingUsers ||
  !result.allPrimaryCareerTablesEmpty ||
  counts.career_sources ||
  counts.career_imports ||
  counts.career_embeddings
)
  throw new Error("Unexpected remaining qualification content");
await writeFile(
  `${root}/final-live-state.json`,
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
