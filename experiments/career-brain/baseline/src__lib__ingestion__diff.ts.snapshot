import { createHash } from "node:crypto";
import type { Candidate, Canonical, Change } from "./model";
export function identity(record: Pick<Candidate, "kind" | "key">) {
  return `${record.kind}:${record.key}`;
}
export function semanticHash(record: Candidate) {
  const {
    kind,
    key,
    title,
    subtitle,
    summary,
    organization,
    start_date,
    end_date,
  } = record;
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind,
        key,
        title,
        subtitle,
        summary,
        organization,
        start_date,
        end_date,
        skill_keys: [...new Set(record.skill_keys)].sort(),
        achievement_keys: [...new Set(record.achievement_keys)].sort(),
        category_key: record.category_key,
      }),
    )
    .digest("hex");
}
export function diffCareer(
  incoming: Candidate[],
  current: Canonical[],
  fullDocument: boolean,
): Change[] {
  const seen = new Set<string>();
  const changes: Change[] = incoming.map((after) => {
    const id = identity(after);
    const before = current.find((row) => identity(row) === id) || null;
    const duplicate = incoming.filter((row) => identity(row) === id).length > 1;
    const uncertain = after.uncertainties.length > 0;
    // Similar titles with a new key need identity review; wording alone never chooses an existing UUID.
    const ambiguous =
      !before &&
      current.some(
        (row) =>
          row.kind === after.kind &&
          row.title.toLowerCase() === after.title.toLowerCase(),
      );
    seen.add(id);
    const status =
      duplicate || uncertain || ambiguous
        ? "REVIEW"
        : !before
          ? "ADDED"
          : semanticHash(after) === semanticHash(before) && !before.archived
            ? "UNCHANGED"
            : "UPDATED";
    return {
      identity: id,
      status,
      before,
      after,
      reason: duplicate
        ? "Duplicate proposed identity."
        : ambiguous
          ? "Similar existing title has another key. Confirm identity."
          : uncertain
            ? after.uncertainties.join(" ")
            : before?.archived
              ? "Restore archived record."
              : "",
    };
  });
  if (fullDocument)
    for (const before of current.filter(
      (row) => !row.archived && !seen.has(identity(row)),
    ))
      changes.push({
        identity: identity(before),
        status: "REMOVED",
        before,
        after: null,
        reason: "Missing from the full document. Archive only after review.",
      });
  return changes;
}
export function verifyProvenance(records: Candidate[], source: string) {
  return records.map((record) => ({
    ...record,
    uncertainties: [
      ...record.uncertainties,
      ...(!source.includes(record.source_quote)
        ? [
            "Source quotation could not be verified. Edit or reject this proposal.",
          ]
        : []),
    ],
  }));
}
