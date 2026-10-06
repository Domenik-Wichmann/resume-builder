import { z } from "zod";
import { careerSchema } from "./model";
import {
  groupingKey,
  isLanguageCategory,
  languagesGroupId,
  sharedLanguages,
} from "./grouping";

export const catalogSchema = z.object({
  career: careerSchema.omit({ profile: true, skills: true }),
  skill_categories: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      skill_ids: z.array(z.string()),
    }),
  ),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export const catalogCategories = [
  ["skill_records", "Skills", "Tools and capabilities connected to work"],
  ["experiences", "Experience", "Roles and professional background"],
  ["projects", "Projects", "Work built and delivered"],
  ["achievements", "Achievements", "Supported outcomes and contributions"],
  ["education", "Education", "Learning and academic background"],
  ["certifications", "Certifications", "Published credentials"],
  ["languages", "Languages", "Languages and proficiency"],
] as const;

export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogCategory = (typeof catalogCategories)[number][0];
export type CatalogGroup = { id: string; title: string; recordIds: string[] };

export function catalogRecords(data: Catalog, category: CatalogCategory) {
  if (category !== "skill_records" && category !== "languages")
    return data.career[category] || [];
  const languageIds = new Set(
    data.skill_categories
      .filter((group) => isLanguageCategory(group.title))
      .flatMap((group) => group.skill_ids),
  );
  const skills = data.career.skill_records;
  const names = new Set(
    (data.career.languages || []).map((record) => groupingKey(record.title)),
  );
  for (const skill of skills)
    if (names.has(groupingKey(skill.title))) languageIds.add(skill.id);
  const languages = sharedLanguages(
    data.career.languages || [],
    skills.filter((record) => languageIds.has(record.id)),
  );
  return category === "languages"
    ? languages
    : [...skills.filter((record) => !languageIds.has(record.id)), ...languages];
}

export function catalogGroups(
  data: Catalog,
  category: CatalogCategory,
): CatalogGroup[] {
  const records = catalogRecords(data, category);
  if (category === "skill_records") {
    const groups = data.skill_categories
      .filter((group) => !isLanguageCategory(group.title))
      .map((group) => ({
        id: group.id,
        title: group.title,
        recordIds: records
          .filter((record) => group.skill_ids.includes(record.id))
          .map((record) => record.id),
      }))
      .filter((group) => group.recordIds.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
    const languages = catalogRecords(data, "languages");
    if (languages.length)
      groups.push({
        id: languagesGroupId,
        title: "Languages",
        recordIds: languages.map((record) => record.id),
      });
    return groups.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (category === "languages") return [];
  // Other record types have no category relationship. Use only their stored
  // organization, never infer a taxonomy from titles or evidence prose.
  const groups = new Map<string, CatalogGroup>();
  for (const record of records) {
    const title = record.organization?.trim();
    if (!title) continue;
    const key = groupingKey(title);
    const group = groups.get(key) || {
      id: `organization:${key}`,
      title,
      recordIds: [],
    };
    group.recordIds.push(record.id);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
