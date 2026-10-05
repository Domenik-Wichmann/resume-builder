import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
import {
  defaultDesign,
  designSchema,
  templateSchema,
  type OwnerAsset,
} from "./model";
export async function loadDesignStudio(db: SupabaseClient, accountId: string) {
  const [assets, templates] = await Promise.all([
    db
      .from("owner_assets")
      .select("id,kind,name,mime_type,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
    db
      .from("resume_templates")
      .select("id,name,version,spec,reference_id,notes,limitations,is_default")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false }),
  ]);
  if (assets.error || templates.error)
    throw new Error("Cannot load design studio. Apply its migrations first.");
  return {
    assets: (assets.data || []) as OwnerAsset[],
    templates: (templates.data || []).map((row) => templateSchema.parse(row)),
  };
}
export async function publicResumeDesign() {
  if (validateEnv(process.env).mode === "demo") return defaultDesign;
  const result = await database()
    .from("resume_templates")
    .select("spec")
    .eq("account_id", primaryAccountId)
    .eq("is_default", true)
    .maybeSingle();
  if (result.error) throw new Error("Cannot load resume design.");
  return result.data ? designSchema.parse(result.data.spec) : defaultDesign;
}
