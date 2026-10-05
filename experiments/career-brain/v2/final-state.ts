import { writeFile } from "node:fs/promises";
import { database } from "../../../src/lib/db";
import { primaryAccountId } from "../../../src/lib/account-id";
const db = database();
const tables = [
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
];
const counts: Record<string, number | null> = {};
for (const table of tables) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  if (count === null) throw new Error(`${table}: count header absent`);
  counts[table] = count;
}
const users = await db.auth.admin.listUsers({ perPage: 1000 });
if (users.error) throw users.error;
const temporaryUsers = users.data.users.filter((u) =>
  /^qualification(?:-v2)?-/.test(u.email || ""),
).length;
const ownerUsage = await db
  .from("provider_usage_events")
  .select("*", { count: "exact", head: true })
  .eq("account_id", primaryAccountId);
if (ownerUsage.error) throw ownerUsage.error;
const report = {
  counts,
  authUsers: users.data.users.length,
  temporaryUsers,
  primaryUsageEvents: ownerUsage.count,
  scope:
    "Read-only final state; no owner emails or credentials in this artifact",
};
await writeFile(
  "experiments/career-brain/v2/results/final-state.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
