import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
import { HttpError } from "../http";
import { clearSignalContent, fixedContentSchema } from "./fixed-content";
import {
  defaultDesign,
  designSchema,
  templateSchema,
  type OwnerAsset,
  clearSignalDesign,
} from "./model";
export async function applicationTemplate(
  db: SupabaseClient,
  accountId: string,
) {
  const [content, template] = await Promise.all([
    db
      .from("resume_fixed_content")
      .select("spec,version")
      .eq("account_id", accountId)
      .maybeSingle(),
    db
      .from("resume_templates")
      .select("spec,version")
      .eq("account_id", accountId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);
  if (content.error && ["PGRST205", "42P01"].includes(content.error.code))
    throw new HttpError(
      503,
      "Apply 202610060005_resume_generation.sql to enable v4 application generation and fixed-content settings.",
    );
  if (content.error || template.error)
    throw new Error(
      "Cannot load application template. Apply the résumé migrations first.",
    );
  return {
    fixed: content.data
      ? fixedContentSchema.parse({
          ...content.data.spec,
          version: content.data.version,
        })
      : accountId === primaryAccountId
        ? clearSignalContent
        : null,
    design: template.data
      ? designSchema.parse(template.data.spec)
      : clearSignalDesign,
    design_version: template.data?.version || 0,
  };
}
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

export async function publicResumeTemplate() {
  if (validateEnv(process.env).mode === "demo")
    return { fixed: null, design: defaultDesign };
  return applicationTemplate(database(), primaryAccountId);
}
