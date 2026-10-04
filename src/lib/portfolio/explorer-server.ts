import "server-only";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { getCareer } from "../career/repository";
import { deriveExplorer } from "./explorer";
export async function getExplorer() {
  const career = await getCareer();
  if (career.demo) return deriveExplorer(career, [], []);
  const db = database();
  const [categories, skills] = await Promise.all([
    db
      .from("skill_categories")
      .select("id,title,summary")
      .eq("account_id", primaryAccountId)
      .eq("is_public", true)
      .is("archived_at", null),
    db
      .from("skills")
      .select("id,category_id")
      .eq("account_id", primaryAccountId)
      .eq("is_public", true)
      .is("archived_at", null),
  ]);
  if (categories.error || skills.error)
    throw new Error("Cannot load explorer.");
  return deriveExplorer(career, categories.data || [], skills.data || []);
}
