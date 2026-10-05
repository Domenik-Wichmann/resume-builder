import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  candidateSchema,
  type Candidate,
  type Canonical,
} from "../ingestion/model";

export const spanSchema = z
  .object({
    quote: z.string().min(1).max(2000),
    start: z.number().int().nonnegative().nullable(),
    end: z.number().int().nonnegative().nullable(),
  })
  .strict();
export const claimSchema = z
  .object({
    attribute: z.enum([
      "action",
      "tool",
      "metric",
      "ownership",
      "scope",
      "credential",
      "language",
      "depth",
      "context",
      "denial",
      "correction",
    ]),
    value: z.string().min(1).max(500),
    attribution: z.enum([
      "PERSONAL",
      "TEAM",
      "EXPOSURE",
      "NEGATED",
      "UNCERTAIN",
    ]),
    evidence: z.array(spanSchema).min(1).max(6),
  })
  .strict();
export const richSchema = candidateSchema.safeExtend({
  aliases: z.array(z.string().min(1).max(200)).max(12),
  claims: z.array(claimSchema).min(1).max(24),
});
const nativeKind = (kind: Candidate["kind"]) =>
  richSchema.safeExtend({
    kind: z.literal(kind),
    key: kind === "profile" ? z.literal("profile") : candidateSchema.shape.key,
    skill_keys: ["experience", "project", "achievement"].includes(kind)
      ? candidateSchema.shape.skill_keys
      : z.array(z.string()).max(0),
    achievement_keys: ["experience", "project"].includes(kind)
      ? candidateSchema.shape.achievement_keys
      : z.array(z.string()).max(0),
    category_key:
      kind === "skill" ? candidateSchema.shape.category_key : z.null(),
    organization: ["profile", "skill", "category"].includes(kind)
      ? z.null()
      : candidateSchema.shape.organization,
    start_date: ["profile", "skill", "category"].includes(kind)
      ? z.null()
      : candidateSchema.shape.start_date,
    end_date: ["profile", "skill", "category"].includes(kind)
      ? z.null()
      : candidateSchema.shape.end_date,
  });
export const richExtractionSchema = z
  .object({
    records: z
      .array(
        z.union([
          nativeKind("profile"),
          nativeKind("experience"),
          nativeKind("project"),
          nativeKind("achievement"),
          nativeKind("skill"),
          nativeKind("education"),
          nativeKind("certification"),
          nativeKind("language"),
          nativeKind("category"),
        ]),
      )
      .max(150),
  })
  .strict();
export type RichCandidate = z.infer<typeof richSchema>;
export type RichCanonical = Canonical &
  Pick<RichCandidate, "aliases" | "claims">;
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export function ground(
  records: RichCandidate[],
  source: string,
): RichCandidate[] {
  return records.map((r) => {
    const errors: string[] = [];
    const claims = r.claims.map((c) => ({
      ...c,
      evidence: c.evidence.map((s) => {
        const start = source.indexOf(s.quote);
        if (start < 0)
          errors.push("Exact evidence span is absent from source.");
        return {
          ...s,
          start: start < 0 ? null : start,
          end: start < 0 ? null : start + s.quote.length,
        };
      }),
    }));
    if (!source.includes(r.source_quote))
      errors.push("Primary exact quotation is absent from source.");
    if (r.kind === "skill" && claims.every((c) => c.attribution === "NEGATED"))
      errors.push("Denied technology cannot become a positive skill record.");
    if (claims.some((c) => c.attribution === "UNCERTAIN"))
      errors.push("Unresolved claim or correction requires review.");
    if (
      claims.some(
        (c) =>
          c.attribution === "TEAM" &&
          ((["action", "metric"].includes(c.attribute) &&
            !/\b(team|we|shared|collective)\b/i.test(r.summary)) ||
            (c.attribute === "ownership" &&
              !/\b(team|we|shared|collective|supervisors?|coworkers?|operators?)\b/i.test(
                r.summary,
              ))),
      )
    )
      errors.push("Team outcome must retain attribution in display text.");
    return {
      ...r,
      claims,
      uncertainties: [...new Set([...r.uncertainties, ...errors])],
    };
  });
}
const names = (r: RichCandidate) =>
  [r.title, ...r.aliases].map(normalize).filter(Boolean);
function sameOrganization(a: Candidate, b: Candidate) {
  return (
    !a.organization ||
    !b.organization ||
    normalize(a.organization) === normalize(b.organization)
  );
}
function quoteOverlap(a: RichCandidate, b: RichCandidate) {
  const an = normalize(a.title),
    bn = normalize(b.title);
  return a.claims.some((c) =>
    c.evidence.some((s) => {
      const text = normalize(s.quote);
      // A passage naming two distinct projects is context, not identity proof.
      if (
        a.kind === "project" &&
        an !== bn &&
        !an.includes(bn) &&
        !bn.includes(an) &&
        text.includes(an) &&
        text.includes(bn)
      )
        return false;
      return (
        s.quote.length >= 30 &&
        b.claims.some((d) => d.evidence.some((t) => t.quote === s.quote))
      );
    }),
  );
}
export function reconcile(incoming: RichCandidate[], current: RichCanonical[]) {
  const mapping = new Map<string, string>();
  const decisions: {
    hint: string;
    outcome: "MATCH_EXISTING" | "NEW_ENTITY" | "AMBIGUOUS";
    id: string | null;
    key: string;
  }[] = [];
  const records = incoming
    .map((r) => {
      const compatible = current.filter(
        (c) => c.kind === r.kind && sameOrganization(c, r),
      );
      // A shared paragraph can support several named skills. Exact names and
      // approved aliases take precedence over weaker quotation context.
      const named = compatible.filter(
        (c) =>
          r.kind === "profile" || names(r).some((n) => names(c).includes(n)),
      );
      const matches = named.length
        ? named
        : compatible.filter((c) => quoteOverlap(r, c));
      const ambiguous =
        matches.length > 1 ||
        (!named.length &&
          matches.length > 0 &&
          ["skill", "certification", "language"].includes(r.kind));
      const chosen =
        matches.length === 1 && !ambiguous ? matches[0] : undefined;
      // Application creates slugs; model's temporary key is never durable authority.
      const stem =
        normalize(r.title)
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || r.kind;
      const key =
        chosen?.key ||
        (r.kind === "profile"
          ? "profile"
          : `${stem}-${hash(`${r.kind}:${normalize(r.title)}:${normalize(r.organization || "")}`).slice(0, 10)}`);
      mapping.set(`${r.kind}:${r.key}`, key);
      decisions.push({
        hint: `${r.kind}:${r.key}`,
        outcome: ambiguous
          ? "AMBIGUOUS"
          : chosen
            ? "MATCH_EXISTING"
            : "NEW_ENTITY",
        id: chosen?.id || null,
        key,
      });
      return {
        ...r,
        key,
        aliases: [...new Set([...(chosen?.aliases || []), ...r.aliases])].slice(
          0,
          12,
        ),
        uncertainties: [
          ...r.uncertainties,
          ...(ambiguous
            ? [
                "Canonical identity is ambiguous; select the intended existing entity before accepting.",
              ]
            : []),
        ],
      };
    })
    .map((r) => ({
      ...r,
      skill_keys: r.skill_keys.map((k) => mapping.get(`skill:${k}`) || k),
      achievement_keys: r.achievement_keys.map(
        (k) => mapping.get(`achievement:${k}`) || k,
      ),
      category_key: r.category_key
        ? mapping.get(`category:${r.category_key}`) || r.category_key
        : null,
    }));
  for (const r of records)
    if (records.filter((x) => x.kind === r.kind && x.key === r.key).length > 1)
      r.uncertainties.push(
        "Several candidates resolve to one entity; merge or review their factual components.",
      );
  return { records, decisions };
}
export function factualHash(r: RichCandidate) {
  // Display prose and quotation selection do not define factual state. Claim values
  // remain material: a reused quotation never makes a changed assertion equivalent.
  const facts = r.claims.map((c) => ({
    attribute: c.attribute,
    attribution: c.attribution,
    value: normalize(c.value),
  }));
  const unique = [
    ...new Map(facts.map((f) => [JSON.stringify(f), f])).values(),
  ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return hash(
    JSON.stringify({
      kind: r.kind,
      organization: normalize(r.organization || ""),
      start: r.start_date,
      end: r.end_date,
      skills: [...new Set(r.skill_keys)].sort(),
      achievements: [...new Set(r.achievement_keys)].sort(),
      category: r.category_key,
      facts: unique,
    }),
  );
}
export function structuredState(r: RichCandidate) {
  return JSON.stringify({
    organization: normalize(r.organization || ""),
    start: r.start_date,
    end: r.end_date,
    skills: [...new Set(r.skill_keys)].sort(),
    achievements: [...new Set(r.achievement_keys)].sort(),
    category: r.category_key,
  });
}
