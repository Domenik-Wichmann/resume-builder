import type { Career, CareerRecord } from "../career/model";
import type { Presentation } from "../markets";
import { resumeIRSchema, type ResumeIR } from "../resume-ir";
import { applyFixedContent, type FixedContent } from "./fixed-content";
/** Render already-public canonical facts; a template never adds or rewrites content. */
export function generalResumeIR(
  career: Career,
  contact: Presentation,
  fixed?: FixedContent | null,
): ResumeIR {
  const section = (records: CareerRecord[]) =>
    records.map((r) => ({
      title: r.title,
      context: r.subtitle,
      organization: r.organization || null,
      role: r.title,
      dates: { start: r.start_date || null, end: r.end_date || null },
      bullets: r.summary ? [r.summary] : [],
      evidence_ids: [r.id],
      priority: 0,
    }));
  const ir = resumeIRSchema.parse({
    profile: {
      name: career.profile.name || "Career profile pending publication",
      contact,
    },
    headline: career.profile.title,
    summary: career.profile.introduction,
    skill_groups: career.skills.length
      ? [{ label: "Skills", skills: career.skills }]
      : [],
    experiences: section(career.experiences),
    projects: section(career.projects),
    supporting_sections: section(career.achievements),
    education: section(career.education),
    certifications: section(career.certifications),
    languages: section(career.languages || []),
    demo: career.demo,
  });
  if (!fixed || career.demo) return ir;
  const configured = applyFixedContent(ir, fixed);
  // Private template settings cannot restore an unpublished canonical project.
  return {
    ...configured,
    projects: configured.projects.filter((project) =>
      project.evidence_ids.some((id) =>
        career.projects.some((record) => record.id === id),
      ),
    ),
  };
}
