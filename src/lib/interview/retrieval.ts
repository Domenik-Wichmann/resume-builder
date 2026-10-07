import "server-only";
import type { BrainRecord } from "../career-brain/repository";
import { usable } from "../career-brain/state";

const words = (text: string) =>
  [...new Set(text.toLowerCase().match(/[\p{L}\d][\p{L}\d+#.-]{1,}/gu) || [])]
    .filter(
      (w) =>
        ![
          "the",
          "and",
          "with",
          "this",
          "that",
          "have",
          "for",
          "from",
          "what",
          "your",
        ].includes(w),
    )
    .slice(0, 60);

export function getCareerRecord(records: BrainRecord[], id: string) {
  const record = records.find((r) => r.id === id && !r.archived);
  if (!record) return null;
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    organization: record.organization,
    // Summaries help find records, but only verified claims license career assertions.
    description: record.summary.slice(0, 1000),
    claims: record.claims
      .filter(usable)
      .slice(0, 12)
      .map((c) => ({
        value: c.value,
        attribution: c.attribution,
        evidence: c.evidence
          .slice(0, 1)
          .map((e) => ({ quote: e.quote.slice(0, 500) })),
      })),
    uncertainties: record.claims
      .filter(
        (c) =>
          !usable(c) && !["REMOVED", "SUPERSEDED"].includes(c.availability),
      )
      .slice(0, 8)
      .map((c) => ({
        value: c.value,
        availability: c.availability,
        attribution: c.attribution,
        conflict: c.conflict || "",
      })),
    relationships: {
      skills: record.skill_keys,
      achievements: record.achievement_keys,
    },
  };
}
export type RetrievedRecord = NonNullable<ReturnType<typeof getCareerRecord>>;
export function searchCareer(
  records: BrainRecord[],
  query: string,
  targetId: string | null = null,
): RetrievedRecord[] {
  const terms = words(query);
  const target = records.find((r) => r.id === targetId && !r.archived);
  return records
    .filter((r) => !r.archived)
    .map((r) => {
      const text =
        `${r.title} ${r.aliases.join(" ")} ${r.summary} ${r.claims.map((c) => c.value).join(" ")}`.toLowerCase();
      const overlap = terms.filter((t) => text.includes(t)).length;
      const unresolved = r.claims.some((c) =>
        ["DISPUTED", "PENDING_REVIEW"].includes(c.availability),
      );
      const associated =
        target &&
        ((r.kind === "skill" && target.skill_keys.includes(r.key)) ||
          (r.kind === "achievement" &&
            target.achievement_keys.includes(r.key)) ||
          r.achievement_keys.includes(target.key));
      return {
        r,
        score:
          (r.id === targetId ? 1000 : 0) +
          (associated ? 50 : 0) +
          overlap * 10 +
          (unresolved ? 3 : 0) +
          (["project", "experience", "achievement"].includes(r.kind) ? 2 : 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id))
    .slice(0, 6)
    .flatMap(({ r }) => {
      const item = getCareerRecord(records, r.id);
      return item ? [item] : [];
    });
}

// Search claim-level evidence across the private snapshot, including records
// outside the six rich hits. Lexical candidates are signals, not semantic proof.
export function inspectRequirement(
  records: BrainRecord[],
  requirement: string,
) {
  const terms = words(requirement);
  const hits = records
    .filter((r) => !r.archived)
    .flatMap((r) =>
      r.claims.filter(usable).map((c) => ({
        record_id: r.id,
        title: r.title,
        value: c.value,
        attribution: c.attribution,
        quote: c.evidence[0]?.quote.slice(0, 500) || "",
        overlap: terms.filter((t) => c.value.toLowerCase().includes(t)).length,
      })),
    )
    .filter((c) => c.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);
  return {
    requirement,
    candidates: hits.map((hit) => ({
      record_id: hit.record_id,
      title: hit.title,
      value: hit.value,
      attribution: hit.attribution,
      quote: hit.quote,
    })),
    note: "Lexical candidates only. Judge direct/partial/related support from verified claims; a search miss is not proof of no skill.",
  };
}
