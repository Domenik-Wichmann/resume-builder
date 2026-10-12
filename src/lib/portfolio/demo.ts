import type { Project } from "./model";
import type { CaseContent, CaseStudy } from "./case-study";

export const demoProject: Project = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Resume Builder · fictional sample",
  slug: "fictional-resume-builder",
  subtitle: "Fictional portfolio demonstration",
  summary: "Fictional sample demonstrating a structured career portfolio.",
  description: "Fictional layout sample, not owner career evidence.",
  organization: null,
  start_date: null,
  end_date: null,
  status: "OTHER",
  featured: true,
  is_public: true,
  archived: false,
  display_order: 0,
  skill_ids: [],
  achievement_ids: [],
  links: [],
  updated_at: "2026-01-01T00:00:00Z",
};
export const demoCaseContent: CaseContent = {
  links: [],
  title: demoProject.title,
  tagline: "Fictional layout preview · Domenik Wichmann",
  summary:
    "Explore how a fictional career portfolio connects structured records, project pages and conversational discovery.",
  overview:
    "This is an explicitly fictional example for checking the case-study layout. These sample facts are not owner evidence.",
  highlights: [
    "Fictional sample: a searchable career record browser.",
    "Fictional sample: project pages with a shared visual template.",
  ],
  implementation:
    "- Fictional sample: structured relational records.\n- Fictional sample: reviewed content and screenshot captions.",
  outcomes: [],
  limitations: ["This is a demonstration, not a published career claim."],
};
export const demoCaseStudy: CaseStudy = {
  project_id: demoProject.id,
  project_version: demoProject.updated_at,
  baseline_version: null,
  source_hash: "a".repeat(64),
  selected: true,
  is_public: false,
  content: demoCaseContent,
};
