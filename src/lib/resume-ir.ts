import { z } from "zod";
import type { Career, CareerRecord } from "./career/model";
import type { Workspace } from "./workspaces/model";
import { presentationSchema, type Presentation } from "./markets";
const sectionRecord = z.object({
  title: z.string(),
  context: z.string(),
  organization: z.string().nullable(),
  role: z.string(),
  dates: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
  bullets: z.array(z.string()),
  evidence_ids: z.array(z.string()),
  priority: z.number(),
});
export const resumeIRSchema = z.object({
  profile: z.object({ name: z.string(), contact: presentationSchema }),
  headline: z.string(),
  summary: z.string(),
  skill_groups: z.array(
    z.object({ label: z.string(), skills: z.array(z.string()) }),
  ),
  experiences: z.array(sectionRecord),
  projects: z.array(sectionRecord),
  education: z.array(sectionRecord),
  certifications: z.array(sectionRecord),
  supporting_sections: z.array(sectionRecord),
  demo: z.boolean(),
});
export type ResumeIR = z.infer<typeof resumeIRSchema>;
/** Questions change selection priority; factual text remains canonical, never copied from Q&A. */
export function compileResumeIR(
  career: Career,
  workspace: Workspace,
  presentation: Presentation,
): ResumeIR {
  const allowed = new Set(workspace.evidence.map((record) => record.id));
  const signals = [
    ...workspace.requirements,
    ...workspace.questions.flatMap((question) =>
      question.topics.map((topic) => topic.topic),
    ),
  ]
    .join(" ")
    .toLowerCase();
  const explored = new Set(
    workspace.questions.flatMap((question) => question.evidence_ids),
  );
  function section(records: CareerRecord[]) {
    return records
      .filter((record) => allowed.has(record.id))
      .map((record) => ({
        title: record.title,
        context: record.subtitle,
        organization: record.organization || null,
        role: record.title,
        dates: {
          start: record.start_date || null,
          end: record.end_date || null,
        },
        bullets: record.summary ? [record.summary] : [],
        evidence_ids: [record.id],
        priority:
          (explored.has(record.id) ? 10 : 0) +
          record.skills.filter((skill) => signals.includes(skill.toLowerCase()))
            .length,
      }))
      .sort((a, b) => b.priority - a.priority);
  }
  const canonical = [
    ...career.experiences,
    ...career.projects,
    ...career.achievements,
    ...career.skill_records,
    ...career.education,
    ...career.certifications,
  ].filter((record) => allowed.has(record.id));
  const skills = [...new Set(canonical.flatMap((record) => record.skills))];
  return resumeIRSchema.parse({
    profile: { name: career.profile.name, contact: presentation },
    headline: career.profile.title,
    summary: career.profile.introduction,
    skill_groups: skills.length
      ? [{ label: "Supported capabilities", skills }]
      : [],
    experiences: section(career.experiences),
    projects: section(career.projects),
    education: section(career.education),
    certifications: section(career.certifications),
    supporting_sections: section(career.achievements),
    demo: career.demo,
  });
}
export function expansionQueries(workspace: Workspace) {
  const topics = [
    ...new Set(
      workspace.questions.flatMap((question) =>
        question.topics.map((topic) => topic.topic),
      ),
    ),
  ];
  const related: Record<string, string> = {
    sql: "data analysis and data validation",
    automation: "workflow design and business operations",
    management: "leadership and team coordination",
  };
  return [
    ...new Set(
      [
        workspace.job_description?.slice(0, 1000),
        ...topics.map((topic) => related[topic.toLowerCase()] || topic),
        "software engineering, data, workflow design and projects",
      ].filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, 3);
}
