import { z } from "zod";
import { complete } from "../provider";
import { extractRich } from "../pipeline";
import { sourceCoverage } from "../repair";
import { reconcile, structuredState, type RichCandidate } from "../evidence";
import type { Change } from "../../../../src/lib/ingestion/model";
import type { Gate } from "../../variants";
import {
  actorValue,
  factualState,
  hydrateClaims,
  type ActorContext,
  type StateRecord,
} from "./claims";

const schema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            key: z.string(),
            verdict: z.enum(["EQUIVALENT", "ENRICHMENT", "CHANGED", "REVIEW"]),
            reason: z.string().max(400),
          })
          .strict(),
      )
      .max(150),
  })
  .strict();
export function stateDiff(
  incoming: RichCandidate[],
  current: StateRecord[],
  actor: ActorContext,
  full = true,
): Change[] {
  const records = reconcile(incoming, current).records;
  const changes: Change[] = records.map((after) => {
    const before =
      current.find((c) => c.kind === after.kind && c.key === after.key) || null;
    return {
      identity: `${after.kind}:${after.key}`,
      before,
      after,
      status: after.uncertainties.length
        ? "REVIEW"
        : !before
          ? "ADDED"
          : before.archived ||
              factualState(after, actor) !== factualState(before, actor)
            ? "UPDATED"
            : "UNCHANGED",
      reason: after.uncertainties.join(" "),
    };
  });
  if (full)
    for (const before of current.filter(
      (c) =>
        !c.archived &&
        !records.some((r) => r.kind === c.kind && r.key === c.key),
    ))
      changes.push({
        identity: `${before.kind}:${before.key}`,
        before,
        after: null,
        status: "REMOVED",
        reason: "Owner review required before archival.",
      });
  return changes;
}
export async function repairEquivalence(
  records: RichCandidate[],
  current: StateRecord[],
  actor: ActorContext,
  accountId: string,
  gate: Gate,
) {
  const available = records.map((r) => ({
    ...r,
    claims: r.claims.map((c) => ({
      ...c,
      availability:
        (c as StateRecord["claims"][number]).availability ||
        ("CONFIRMED" as const),
    })),
  }));
  const possible = available.flatMap((r) => {
    const old = current.find(
      (c) => c.kind === r.kind && c.key === r.key && !c.archived,
    );
    return old &&
      !r.uncertainties.length &&
      structuredState(r) === structuredState(old) &&
      factualState(r, actor) !== factualState(old, actor)
      ? [{ key: `${r.kind}:${r.key}`, before: old, after: r }]
      : [];
  });
  if (!possible.length) return { records: available, decisions: [] };
  const result = await gate(
    "bounded-actor-factual-equivalence",
    "OPENROUTER",
    () =>
      complete(
        "Compare factual state, not display text or claim decomposition. Known actor context is application supplied; normalized values resolve ONLY known name/first-person references, never ownership strength. EQUIVALENT when all material facts match, including redundant restatement and 3 hours as arithmetic difference from 5 to 2. ENRICHMENT only a newly represented source-supported fact not already entailed by old claims. CHANGED for changed date/quantity/ownership/depth/relationship or omitted factual capability. REVIEW for uncertainty. My contribution vs the known candidate's contribution is equivalent; I built vs we built vs contributed vs led vs assisted remains materially distinct. Unchanged exact source language restated in new components is representation-only when old factual state already entails it. Do not count aliases or generated summary prose as new facts. Preserve all actual supported rich facts; never force compact gold. DISPUTED/PENDING/SUPERSEDED availability cannot become confirmed through equivalence. Return exactly one decision per key.",
        JSON.stringify({
          actor,
          pairs: possible.map((p) => ({
            ...p,
            before: {
              ...p.before,
              summary: undefined,
              claims: p.before.claims.map((c) => ({
                ...c,
                value: actorValue(c.value, actor),
              })),
            },
            after: {
              ...p.after,
              summary: undefined,
              claims: p.after.claims.map((c) => ({
                ...c,
                value: actorValue(c.value, actor),
              })),
            },
          })),
        }),
        schema,
        {
          model: "openai/gpt-6-luna-pro",
          maxTokens: 7000,
          timeoutMs: 180000,
          usage: { accountId, operation: "claim_repair_equivalence" },
        },
      ),
  );
  if (
    result.decisions.length !== possible.length ||
    new Set(result.decisions.map((d) => d.key)).size !== possible.length ||
    result.decisions.some((d) => !possible.some((p) => p.key === d.key))
  )
    throw new Error("Incomplete factual compatibility audit");
  return {
    records: available.map((r) => {
      const decision = result.decisions.find(
        (d) => d.key === `${r.kind}:${r.key}`,
      );
      if (decision?.verdict === "EQUIVALENT") {
        const old = current.find((c) => c.kind === r.kind && c.key === r.key)!;
        return { ...r, claims: old.claims };
      }
      if (decision?.verdict === "REVIEW")
        return { ...r, uncertainties: [...r.uncertainties, decision.reason] };
      return r;
    }),
    decisions: result.decisions,
  };
}
export async function repairedExtract(
  source: string,
  current: StateRecord[],
  actor: ActorContext,
  accountId: string,
  gate: Gate,
) {
  const extracted = await extractRich(
    source,
    current,
    accountId,
    gate,
    false,
    true,
    true,
  );
  const covered = await sourceCoverage(
    extracted.records,
    current,
    source,
    accountId,
    gate,
  );
  // Existing unavailable facts must not be resurrected by a fresh extractor.
  const guarded = covered.records.map((r) => ({
    ...r,
    claims: r.claims.map((c) => {
      const old = current
        .find((x) => x.kind === r.kind && x.key === r.key)
        ?.claims.find(
          (f) =>
            f.attribute === c.attribute &&
            actorValue(f.value, actor) === actorValue(c.value, actor) &&
            f.attribution === c.attribution,
        );
      return {
        ...c,
        availability: old?.availability || ("CONFIRMED" as const),
        conflict: old?.conflict,
      };
    }),
  }));
  const equivalent = await repairEquivalence(
    guarded,
    current,
    actor,
    accountId,
    gate,
  );
  return {
    records: equivalent.records,
    decisions: {
      identity: extracted.decisions,
      audit: extracted.audit,
      coverage: covered.decisions,
      equivalence: equivalent.decisions,
    },
  };
}
export function reviewedState(records: RichCandidate[]) {
  return records.map((r) =>
    hydrateClaims(
      {
        ...r,
        id: "",
        hash: "",
        updated_at: "",
        published: false,
        archived: false,
      },
      "CONFIRMED",
    ),
  );
}
