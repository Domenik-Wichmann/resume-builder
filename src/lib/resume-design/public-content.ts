import type { Career, CareerRecord } from "../career/model";
import type { Presentation } from "../markets";
import type { ResumeIR } from "../resume-ir";
import { generalResumeIR } from "./from-career";
import { applyFixedContent, type FixedContent } from "./fixed-content";

/** Editing display prose never promotes a disputed date, qualification or outcome. */
export function resumeProse(text: string, name: string) {
  const firstName = name.split(/\s+/)[0];
  return text
    .replace(/docs and and/gi, "documents and")
    .replace(/\bLearninh\b/g, "Learning")
    .replace(/\bquizes\b/gi, "quizzes")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(
      (sentence) =>
        !/\b(unconfirmed|unresolved|not documented|require confirmation|requires confirmation|not independently confirmed)\b/i.test(
          sentence,
        ) &&
        !/^(The CV dates|CV dates|Exact (?:dates|timing)|Institution and date|Business naming|The source describes|Degree completion|Support signatures|Based in .*as reported)/i.test(
          sentence,
        ),
    )
    .map((sentence) => {
      let value = sentence
        .replace(/^Background spanning/i, "My background spans")
        .replace(/^Interested in/i, "I am interested in")
        .replace(/; uses\b/g, "; I use")
        .replace(
          /^Reported co-founder and operational work in/i,
          "Co-founded and helped operate",
        )
        .replace(
          /^Reported English teaching and tutoring/i,
          "Taught English and tutored",
        )
        .replace(
          /^Reported customer support work/i,
          "Provided customer support",
        )
        .replace(/^Reported logistics coordination/i, "Coordinated logistics")
        .replace(/^Reported work /i, "Worked on ")
        .replace(/^Reports beginning studies/i, "Began studies")
        .replace(/^Validates and prepares/i, "Validate and prepare")
        .replace(/\band uses\b/g, "and use")
        .replace(/^Holds\b/, "Hold")
        .replace(
          /^Reports faster personal work, with sole-user scope and no verified measured savings; existing validation processors were not wholly replaced\.?$/i,
          "Use these tools in my own workflow alongside existing validation processors.",
        )
        .replace(/^Reported\s+/i, "")
        .replace(/\bhis\b/gi, "my")
        .replace(/\bhe\b/gi, "I")
        .replace(/\bhim\b/gi, "me")
        .trim();
      const graduation = `A direct statement says ${firstName} graduated high school`;
      if (value.startsWith(graduation))
        value = value.replace(graduation, "Graduated high school");
      return value;
    })
    .filter(Boolean)
    .join(" ");
}

const technicalRole = (record: CareerRecord) =>
  !/bartend|chef|cook|kitchen|renovat|house repair|small.farm/i.test(
    record.title,
  ) &&
  (/data|software|engineer|technical|developer|automation|teacher|teaching|tutor|content management|consultant|analyst/i.test(
    record.title,
  ) ||
    record.skills.some((skill) =>
      /SaaS troubleshooting|programming|data validation|ETL|SQL|VBA/i.test(
        skill,
      ),
    ));

const fixedProjectIds: Record<string, string> = {
  personal_portfolio: "2cf5bf4e-7fc1-4616-a8cd-8c014710392b",
  lms: "1ba79f8b-7379-41b1-94d2-7268a7e66b51",
  babycat: "937f2379-7dbc-4eae-a12f-5c3dacc13b0c",
};

/** The default is rebuilt on each request from current public facts and owner settings. */
export function publicDefaultResume(
  career: Career,
  contact: Presentation,
  fixed: FixedContent | null,
): ResumeIR {
  const clean = (text: string) => resumeProse(text, career.profile.name);
  const ir = generalResumeIR(career, contact);
  const prepared =
    fixed && !career.demo
      ? applyFixedContent(ir, {
          ...fixed,
          projects: fixed.projects
            .flatMap((project) => {
              const id = project.record_id || fixedProjectIds[project.id];
              return career.projects.some((record) => record.id === id)
                ? [
                    {
                      ...project,
                      record_id: id,
                      title: clean(project.title),
                      bullets: project.bullets.map(clean).filter(Boolean),
                    },
                  ]
                : [];
            })
            .filter((project) => project.bullets.length > 0),
        })
      : ir;
  const experiences = ir.experiences.filter((row) =>
    career.experiences.some(
      (record) => row.evidence_ids.includes(record.id) && technicalRole(record),
    ),
  );
  const usedSkills = new Set(
    [
      ...career.experiences.filter(technicalRole),
      ...career.projects.filter((project) =>
        prepared.projects.some((row) => row.evidence_ids.includes(project.id)),
      ),
    ].flatMap((record) => record.skills),
  );
  const skills = career.skills.filter(
    (skill) =>
      usedSkills.has(skill) &&
      !/^(German|English|Mandarin Chinese|Food Production|Kitchen Operations)$/i.test(
        skill,
      ),
  );
  const groups = [
    {
      label: "Data & automation",
      pattern:
        /data|sql|excel|sheets|script|vba|etl|feedonomics|regex|rule|workflow|analytics|tableau|inventory/i,
    },
    {
      label: "Engineering & AI",
      pattern:
        /AI|LLM|SaaS|OAuth|JSON|vector|security|CI\/CD|Azure|API|Firebase|Python|Domain-Specific/i,
    },
    { label: "Operations & teaching", pattern: /./ },
  ];
  const remaining = new Set(skills);
  const skill_groups = groups
    .map(({ label, pattern }) => {
      const selected = [...remaining].filter((skill) => pattern.test(skill));
      for (const skill of selected) remaining.delete(skill);
      return { label, skills: selected };
    })
    .filter((group) => group.skills.length);
  const languages = ["German", "English", "Mandarin"].flatMap((name) => {
    const record = career.languages?.find((row) =>
      name === "Mandarin"
        ? /^(Mandarin(?: Chinese)?|Chinese)$/i.test(row.title)
        : row.title.toLowerCase() === name.toLowerCase(),
    );
    if (!record) return [];
    const source = ir.languages?.find((row) =>
      row.evidence_ids.includes(record.id),
    );
    if (!source) return [];
    const description = record.summary
      .split(/[.;]\s*/)
      .filter((part) => !/\bHSK\b|the source|older drafts/i.test(part))
      .join(". ");
    return [
      { ...source, title: name, context: clean(description), bullets: [] },
    ];
  });
  const records = (rows: ResumeIR["experiences"]) =>
    rows.map((row) => ({
      ...row,
      title: clean(row.title),
      context: clean(row.context),
      bullets: row.bullets
        .flatMap((text) => clean(text).split(/(?<=[.!?])\s+(?=[A-Z])/))
        .filter(Boolean),
    }));
  return {
    ...prepared,
    headline: clean(prepared.headline),
    summary: clean(prepared.summary),
    experiences: records(experiences),
    projects: records(prepared.projects),
    supporting_sections: [],
    education: records(prepared.education),
    certifications: records(
      prepared.certifications.filter((row) => !/\bHSK\b/i.test(row.title)),
    ),
    skill_groups,
    languages,
    section_order: [
      "Projects",
      "Experience",
      "Education",
      "Certifications",
      "Achievements",
    ],
  };
}
