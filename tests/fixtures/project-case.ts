import type { Project } from "../../src/lib/portfolio/model";
import type { BrainRecord } from "../../src/lib/career-brain/repository";
import type { StateClaim } from "../../src/lib/career-brain/state";
export const fictionalProjectId = "11111111-1111-4111-8111-111111111111";
export function projectFixture(patch: Partial<Project> = {}): Project {
  return {
    id: fictionalProjectId,
    title: "Fictional knowledge workspace",
    slug: "fictional-workspace",
    subtitle: "Fictional sample",
    summary: "Fictional summary",
    description: "",
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
    ...patch,
  };
}
export function claimFixture(
  value: string,
  patch: Partial<StateClaim> = {},
): StateClaim {
  return {
    attribute: "action",
    value,
    attribution: "PERSONAL",
    availability: "CONFIRMED",
    evidence: [{ quote: value, start: 0, end: value.length }],
    ...patch,
  };
}
export function brainFixture(patch: Partial<BrainRecord> = {}): BrainRecord {
  return {
    id: fictionalProjectId,
    kind: "project",
    key: "fictional-workspace",
    title: "Fictional knowledge workspace",
    subtitle: "Fictional sample",
    summary: "Fictional summary",
    organization: null,
    start_date: null,
    end_date: null,
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: "Fictional source",
    uncertainties: [],
    hash: "a".repeat(64),
    published: true,
    archived: false,
    updated_at: "2026-01-01T00:00:00Z",
    aliases: [],
    evidence_version: "2026-01-01T00:00:00Z",
    claims: [claimFixture("Built a fictional graph-review interface.")],
    ...patch,
  };
}
