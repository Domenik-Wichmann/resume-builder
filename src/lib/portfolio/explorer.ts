import type { Career, CareerRecord } from "../career/model";
import {
  groupingKey,
  isLanguageCategory,
  languagesGroupId,
  sharedLanguages,
} from "../career/grouping";
export type Category = { id: string; title: string; summary: string };
export type ExplorerSkill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category_id: string | null;
  experiences: CareerRecord[];
  projects: CareerRecord[];
  achievements: CareerRecord[];
  related: string[];
  evidence_count: number;
  kind: "skill" | "language";
};
export function deriveExplorer(
  career: Pick<
    Career,
    "skill_records" | "languages" | "experiences" | "projects" | "achievements"
  >,
  categories: Category[],
  assignments: { id: string; category_id: string | null }[],
) {
  const languageCategories = new Set(
    categories
      .filter((category) => isLanguageCategory(category.title))
      .map((category) => category.id),
  );
  const languageNames = new Set(
    (career.languages || []).map((record) => groupingKey(record.title)),
  );
  const languageSkills = career.skill_records.filter(
    (record) =>
      languageNames.has(groupingKey(record.title)) ||
      assignments.some(
        (assignment) =>
          assignment.id === record.id &&
          languageCategories.has(assignment.category_id || ""),
      ),
  );
  const languages = sharedLanguages(career.languages || [], languageSkills);
  const languageIds = new Set(languages.map((record) => record.id));
  const rows = [
    ...career.skill_records.filter(
      (record) => !languageSkills.includes(record),
    ),
    ...languages,
  ];
  const visibleCategories = [
    ...categories.filter((category) => !isLanguageCategory(category.title)),
    ...(languages.length
      ? [
          {
            id: languagesGroupId,
            title: "Languages",
            summary: "Language proficiency and learning status.",
          },
        ]
      : []),
  ];
  const skills: ExplorerSkill[] = rows.map((skill) => {
    const experiences = career.experiences.filter((r) =>
      r.skills.includes(skill.title),
    );
    const projects = career.projects.filter((r) =>
      r.skills.includes(skill.title),
    );
    const achievements = career.achievements.filter((r) =>
      r.skills.includes(skill.title),
    );
    const category = languageIds.has(skill.id)
      ? languagesGroupId
      : assignments.find((s) => s.id === skill.id)?.category_id;
    return {
      id: skill.id,
      slug: skill.slug,
      name: skill.title,
      description: skill.summary,
      category_id: visibleCategories.some((c) => c.id === category)
        ? category!
        : null,
      kind: (career.languages || []).some((record) => record.id === skill.id)
        ? "language"
        : "skill",
      experiences,
      projects,
      achievements,
      related: [
        ...new Set([...experiences, ...projects].flatMap((r) => r.skills)),
      ]
        .filter((s) => s !== skill.title)
        .sort(),
      evidence_count:
        experiences.length + projects.length + achievements.length,
    };
  });
  return {
    categories: visibleCategories.filter((c) =>
      skills.some((s) => s.category_id === c.id),
    ),
    skills,
  };
}
