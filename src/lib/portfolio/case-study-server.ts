import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caseStudySchema, type CaseStudy } from "./case-study";
import type { Project } from "./model";
import { safeProjectUrl } from "./model";
import type { BrainRecord } from "../career-brain/repository";
import { usable } from "../career-brain/state";
import { showcaseTitle, selectedProjectNames } from "./selection";

export function caseEvidenceHash(record: BrainRecord) {
  return createHash("sha256")
    .update(JSON.stringify({ hash: record.hash, claims: record.claims }))
    .digest("hex");
}

export function fillCaseStudy(
  project: Project,
  record: BrainRecord,
): CaseStudy {
  const claims = record.claims.filter(usable);
  const values = (attributes: string[]) => [
    ...new Set(
      claims
        .filter((c) => attributes.includes(c.attribute))
        .map((c) => {
          const value = c.value.replace(
            /^Project exposure:\s*/i,
            "Project tooling: ",
          );
          return c.attribution === "TEAM"
            ? `Team contribution: ${value}`
            : c.attribution === "EXPOSURE" &&
                !/^project (tooling|exposure)|exposure/i.test(value)
              ? `Project context: ${value}`
              : value;
        }),
    ),
  ];
  const overview = values(["context", "ownership"]);
  const actions = values(["action"]);
  const technical = values([
    "tool",
    "scope",
    "depth",
    "language",
    "credential",
  ]);
  const links = [...project.links];
  if (
    selectedProjectNames[project.id] === "Resume Builder" &&
    !links.some((link) => link.url === "/")
  )
    links.unshift({
      label: "Explore the live portfolio",
      url: "/",
      link_type: "LIVE",
      display_order: 0,
      is_public: true,
    });
  for (const claim of claims)
    for (const span of claim.evidence) {
      for (const matched of span.quote.match(
        /https:\/\/github\.com\/[^\s<>"'`\)\]]+/g,
      ) || []) {
        const url = matched.replace(/[.,;]+$/, "");
        if (
          links.length < 12 &&
          safeProjectUrl(url) &&
          !links.some((link) => link.url === url)
        )
          links.push({
            label: "Referenced GitHub repository",
            url,
            link_type: "GITHUB",
            display_order: links.length,
            is_public: false,
          });
      }
    }
  // Copy accepted facts at their recorded scope; never promote team/exposure
  // claims to personal qualifications or add missing outcomes and metrics.
  return caseStudySchema.parse({
    project_id: project.id,
    baseline_version: null,
    project_version: project.updated_at,
    source_hash: caseEvidenceHash(record),
    selected:
      project.featured || Object.hasOwn(selectedProjectNames, project.id),
    is_public: false,
    content: {
      links: links.slice(0, 12),
      title: showcaseTitle(project),
      tagline: project.subtitle,
      summary: (
        actions[0] ||
        overview[0] ||
        technical[0] ||
        "No relevant evidence is currently stored."
      ).slice(0, 1200),
      overview: overview.join("\n\n").slice(0, 6000),
      highlights: actions.slice(0, 24),
      implementation: technical
        .map((value) => `- ${value}`)
        .join("\n")
        .slice(0, 18000),
      outcomes: values(["metric"]).slice(0, 24),
      limitations: [
        ...new Set(
          record.claims
            .filter(
              (c) =>
                c.availability === "CONFIRMED" &&
                ["UNCERTAIN", "NEGATED"].includes(c.attribution),
            )
            .map((c) => c.value),
        ),
      ].slice(0, 24),
    },
  });
}

export async function loadCaseStudies(
  db: SupabaseClient,
  accountId: string,
): Promise<CaseStudy[]> {
  const result = await db
    .from("project_case_studies")
    .select("project_id,content,source_hash,selected,is_public,updated_at")
    .eq("account_id", accountId);
  if (result.error) throw new Error("Cannot load project case studies.");
  return (result.data || []).map((row) =>
    caseStudySchema.parse({
      project_id: row.project_id,
      content: row.content,
      source_hash: row.source_hash,
      selected: row.selected,
      is_public: row.is_public,
      baseline_version: row.updated_at,
      project_version: "", // The current parent version is attached when editing.
    }),
  );
}
