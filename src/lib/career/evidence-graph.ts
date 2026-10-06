import type { CareerRecord } from "./model";

export function evidenceEdges(records: CareerRecord[]) {
  return records.flatMap((record, index) =>
    records.slice(index + 1).flatMap((other) => {
      const direct =
        record.related_ids?.includes(other.id) ||
        other.related_ids?.includes(record.id);
      const skills = record.skills.filter((skill) =>
        other.skills.some(
          (candidate) =>
            candidate.trim().toLocaleLowerCase() ===
            skill.trim().toLocaleLowerCase(),
        ),
      );
      return direct || skills.length
        ? [
            {
              source: record.id,
              target: other.id,
              label: direct
                ? "Linked career records"
                : `Shared skills: ${skills.join(", ")}`,
            },
          ]
        : [];
    }),
  );
}
