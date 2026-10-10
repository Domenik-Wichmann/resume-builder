import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  experimentAnalytics,
  applicationAnalytics,
  coverageSuggestions,
  type AnalyticsInput,
} from "./analytics";
import { getCareer } from "../career/repository";
import { resumeIRSchema } from "../resume-ir";
export async function applicationDashboard(
  db: SupabaseClient,
  accountId: string,
) {
  const tables = [
    "job_applications",
    "application_snapshots",
    "resume_experiments",
    "experiment_variants",
    "tracking_links",
    "tracking_events",
    "workspaces",
    "workspace_questions",
    "workspace_events",
    "explorer_events",
    "application_outcomes",
    "question_topics",
  ] as const;
  const results = await Promise.all(
    tables.map((t) =>
      db.from(t).select("*").eq("account_id", accountId).limit(1000),
    ),
  );
  if (results.some((r) => r.error))
    throw new Error("Cannot load application analytics.");
  const [
    apps,
    snapshots,
    experiments,
    variants,
    links,
    visits,
    workspaces,
    questions,
    events,
    explorer,
    outcomes,
    topics,
  ] = results.map((r) => r.data || []);
  const activity: AnalyticsInput = {
    applications: apps as { id: string; sent_at: string | null }[],
    snapshots: snapshots as {
      application_id: string;
      variant_id: string | null;
    }[],
    variants: variants as {
      id: string;
      label: string;
      experiment_id: string;
      strategy: string;
    }[],
    links: links as { id: string; application_id: string }[],
    visits: visits.filter((v) => v.event_type === "page_view") as {
      link_id: string;
      session_id: string;
    }[],
    workspaces: workspaces as { id: string; tracking_link_id: string | null }[],
    questions: questions as { workspace_id: string }[],
    events: events as { workspace_id: string; event_type: string }[],
    explorer: explorer as { workspace_id: string }[],
    outcomes: outcomes as { application_id: string; status: string }[],
  };
  const analytics = experimentAnalytics(activity);
  const career = await getCareer(accountId);
  const included = new Set<string>();
  for (const s of snapshots) {
    const ir = resumeIRSchema.safeParse(s.resume_ir);
    if (ir.success)
      for (const r of [
        ...ir.data.experiences,
        ...ir.data.projects,
        ...ir.data.supporting_sections,
      ])
        for (const id of r.evidence_ids) included.add(id);
  }
  return {
    applications: apps
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        id: a.id,
        organization: a.organization,
        role: a.role,
        status: a.status,
        market: a.metadata?.market as "US" | "BG" | undefined,
        generated_at: snapshots.find((s) => s.application_id === a.id)
          ?.generated_at as string | undefined,
        activity: applicationAnalytics(activity, a.id),
        code:
          snapshots.find((s) => s.application_id === a.id)?.tracking_code ||
          links.find((l) => l.application_id === a.id)?.code,
        strategy:
          snapshots.find((s) => s.application_id === a.id)?.strategy ||
          "Legacy tracking only",
      })),
    experiments: experiments.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      job_family: e.job_family,
      market: e.market,
    })),
    analytics,
    suggestions: coverageSuggestions(
      topics as {
        topic: string;
        evidence_strength: string;
        question_id: string;
      }[],
      explorer as { skill_id: string | null; project_id: string | null }[],
      [
        ...career.skill_records,
        ...career.projects,
        ...career.experiences,
        ...career.achievements,
      ],
      included,
    ),
    truncated: results.some((r) => r.data?.length === 1000),
  };
}
