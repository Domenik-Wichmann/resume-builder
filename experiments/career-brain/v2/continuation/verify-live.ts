import { writeFile, readFile } from "node:fs/promises";
import { database } from "../../../../src/lib/db";
import { primaryAccountId } from "../../../../src/lib/account-id";
import { root } from "./fixtures";

if (!process.argv.includes("--live") || process.env.APP_MODE !== "live")
  throw new Error("Read-only live verification requires explicit live mode");
const db = database();
const counts: Record<string, number> = {};
for (const table of [
  "accounts",
  "account_members",
  "career_sources",
  "career_imports",
  "profile",
  "experiences",
  "projects",
  "achievements",
  "skills",
  "skill_categories",
  "education",
  "certifications",
  "languages",
  "career_embeddings",
  "project_media",
  "workspaces",
  "job_applications",
]) {
  const result = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (result.error || result.count === null)
    throw new Error(`Cannot verify ${table}`);
  counts[table] = result.count;
}
const users = await db.auth.admin.listUsers({ perPage: 1000 });
if (users.error) throw users.error;
const temporaryUsers = users.data.users.filter((u) =>
  /^qualification(?:-v2)?-/.test(u.email || ""),
).length;
const usage = await db
  .from("provider_usage_events")
  .select("*", { count: "exact", head: true })
  .eq("account_id", primaryAccountId);
if (usage.error || usage.count === null)
  throw new Error("Cannot verify primary usage");
const prior = JSON.parse(
  await readFile(
    "experiments/career-brain/v2/results/final-state.json",
    "utf8",
  ),
);
const report = {
  counts,
  authUsers: users.data.users.length,
  temporaryUsers,
  primaryUsageEvents: usage.count,
  primaryUsageUnchanged: usage.count === prior.primaryUsageEvents,
  scope:
    "Independent read-only verification after all continuation stages; no owner emails, credentials or career text exported.",
};
await writeFile(
  `${root}/final-state.json`,
  JSON.stringify(report, null, 2) + "\n",
);
if (temporaryUsers) throw new Error("Temporary qualification user remains");
console.log(JSON.stringify(report));
