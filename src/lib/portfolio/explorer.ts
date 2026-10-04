import type { Career, CareerRecord } from "../career/model";
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
};
export function deriveExplorer(
  career: Career,
  categories: Category[],
  assignments: { id: string; category_id: string | null }[],
) {
  const skills: ExplorerSkill[] = career.skill_records.map((skill) => {
    const experiences = career.experiences.filter((r) =>
      r.skills.includes(skill.title),
    );
    const projects = career.projects.filter((r) =>
      r.skills.includes(skill.title),
    );
    const achievements = career.achievements.filter((r) =>
      r.skills.includes(skill.title),
    );
    const category = assignments.find((s) => s.id === skill.id)?.category_id;
    return {
      id: skill.id,
      slug: skill.slug,
      name: skill.title,
      description: skill.summary,
      category_id: categories.some((c) => c.id === category) ? category! : null,
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
    categories: categories.filter((c) =>
      skills.some((s) => s.category_id === c.id),
    ),
    skills,
  };
}
