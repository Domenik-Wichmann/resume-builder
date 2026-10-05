import { ground, normalize, type RichCandidate } from "./evidence";

// Chunk outputs can repeat one explicitly named skill. Do not merge distinct
// projects or use generic shared paragraphs as entity identity.
export function consolidateNamedSkills(rows: RichCandidate[], source: string) {
  const output: RichCandidate[] = [];
  const keyMap = new Map<string, string>();
  for (const row of rows) {
    const old =
      row.kind === "skill"
        ? output.find(
            (r) =>
              r.kind === "skill" && normalize(r.title) === normalize(row.title),
          )
        : undefined;
    if (!old) {
      output.push(structuredClone(row));
      continue;
    }
    keyMap.set(row.key, old.key);
    old.aliases = [...new Set([...old.aliases, ...row.aliases])].slice(0, 12);
    old.uncertainties = [
      ...new Set([...old.uncertainties, ...row.uncertainties]),
    ];
    for (const claim of row.claims) {
      const same = old.claims.find(
        (c) =>
          c.attribute === claim.attribute &&
          c.attribution === claim.attribution &&
          normalize(c.value) === normalize(claim.value),
      );
      if (!same) old.claims.push(claim);
      else
        same.evidence = [
          ...new Map(
            [...same.evidence, ...claim.evidence].map((s) => [s.quote, s]),
          ).values(),
        ].slice(0, 6);
    }
    if (old.claims.length > 24)
      old.uncertainties.push(
        "Merged skill exceeds the claim budget; split or select supported components during review.",
      );
  }
  return ground(
    output.map((r) => ({
      ...r,
      skill_keys: [...new Set(r.skill_keys.map((k) => keyMap.get(k) || k))],
    })),
    source,
  );
}
