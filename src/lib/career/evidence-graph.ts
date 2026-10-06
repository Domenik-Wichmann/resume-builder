import type { CareerRecord } from "./model";

export function evidenceEdges(
  records: CareerRecord[],
  skillIds: ReadonlySet<string> = new Set(),
) {
  return records.flatMap((record, index) =>
    records.slice(index + 1).flatMap((other) => {
      const direct =
        record.related_ids?.includes(other.id) ||
        other.related_ids?.includes(record.id);
      const normalize = (value: string) => value.trim().toLocaleLowerCase();
      const skillLink =
        (skillIds.has(other.id) &&
          record.skills.some(
            (skill) => normalize(skill) === normalize(other.title),
          )) ||
        (skillIds.has(record.id) &&
          other.skills.some(
            (skill) => normalize(skill) === normalize(record.title),
          ));
      const skills = record.skills.filter((skill) =>
        other.skills.some(
          (candidate) =>
            candidate.trim().toLocaleLowerCase() ===
            skill.trim().toLocaleLowerCase(),
        ),
      );
      return direct || skillLink || skills.length
        ? [
            {
              source: record.id,
              target: other.id,
              label: direct
                ? "Linked career records"
                : skillLink
                  ? `Stored skill: ${skillIds.has(other.id) ? other.title : record.title}`
                  : `Shared skills: ${skills.join(", ")}`,
            },
          ]
        : [];
    }),
  );
}
