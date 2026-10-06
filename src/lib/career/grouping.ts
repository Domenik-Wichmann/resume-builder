export const groupingKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function isLanguageCategory(title: string) {
  return ["language", "languages"].includes(groupingKey(title));
}

export const languagesGroupId = "view:languages";

export function sharedLanguages<T extends { title: string }>(
  languages: T[],
  languageSkills: T[],
): T[] {
  const names = new Set(languages.map((record) => groupingKey(record.title)));
  // Prefer the language record's proficiency and uncertainty. A work-only
  // language stays available when no corresponding language record is stored.
  return [
    ...languages,
    ...languageSkills.filter((record) => {
      const key = groupingKey(record.title);
      if (names.has(key)) return false;
      names.add(key);
      return true;
    }),
  ];
}
