import { readFile } from "node:fs/promises";
import { stableId, fixture, reviewedSeed } from "../continuation/fixtures";
import type { RichCandidate } from "../evidence";
import type { AdmissionInput, StateClaim } from "./claims";
export const root = "experiments/career-brain/v2/claim-repair/results";
export const actor = {
  name: "Ada Rowan",
  aliases: ["Ada"],
  firstPersonOwner: true,
};
export type AdmissionCase = AdmissionInput & {
  source: string;
  expectedDirect: number[];
  badBullet?: string;
  goodBullet: string;
};
export const sourceClaim = (
  value: string,
  quote: string,
  source: string,
  attribute: StateClaim["attribute"] = "action",
  attribution: StateClaim["attribution"] = "PERSONAL",
  state: StateClaim["availability"] = "CONFIRMED",
): StateClaim => ({
  attribute,
  value,
  attribution,
  availability: state,
  evidence: [
    {
      quote,
      start: source.indexOf(quote),
      end: source.indexOf(quote) + quote.length,
    },
  ],
});
function sample(
  id: string,
  source: string,
  claims: StateClaim[],
  requirement: string,
  expectedDirect: number[],
  goodBullet: string,
  badBullet?: string,
): AdmissionCase {
  return {
    id,
    source,
    requirement,
    expectedDirect,
    goodBullet,
    badBullet,
    packet: {
      id: stableId(id),
      kind: "project",
      title: "Dispatch reconciliation",
      organization: null,
      dates: { start: null, end: null },
      summary: badBullet || goodBullet,
      aliases: [],
      skills: [],
      outcomes: [],
      claims,
      uncertainties: [],
      relatedIds: [],
      support: "SUPPORTS",
    },
  };
}
export async function frozenInputs() {
  const sql =
    "I personally wrote SQL validation checks for dispatch reconciliation.";
  const good = "Wrote SQL validation checks for dispatch reconciliation";
  const definitions: [
    string,
    string,
    string,
    StateClaim["attribution"]?,
    StateClaim["availability"]?,
  ][] = [
    [
      "preferred-warning",
      "Operators preferred a visible warning for late files.",
      "implemented a visible warning for late files",
      "TEAM",
    ],
    [
      "wanted-feature",
      "Supervisors wanted automatic exception emails.",
      "implemented automatic exception emails",
      "TEAM",
    ],
    [
      "planned-completed",
      "I planned the Route Note rollout, but did not complete it.",
      "completed the Route Note rollout",
    ],
    [
      "discussed-performed",
      "We discussed a database migration; it was never performed.",
      "performed the database migration",
      "TEAM",
    ],
    [
      "recommended-delivered",
      "I recommended an analytics dashboard; it was not delivered.",
      "delivered an analytics dashboard",
    ],
    [
      "team-personal",
      "The team reduced weekly reconciliation time from five hours to two; my contribution was the SQL checks.",
      "personally achieved the entire three-hour weekly saving",
    ],
    [
      "exposure-proficiency",
      "I completed one Docker exercise; I have no production Docker experience.",
      "became proficient in production Docker engineering",
      "EXPOSURE",
    ],
    [
      "contributed-owned",
      "I contributed SQL checks; Mira owned the project.",
      "owned the entire project",
    ],
    [
      "trained-managed",
      "I trained dispatch coworkers through workshops; I did not manage employees.",
      "managed dispatch employees",
    ],
    [
      "related-named-tech",
      "I used PostgreSQL locally; I have never used AWS professionally.",
      "implemented AWS infrastructure",
    ],
    [
      "superseded-count",
      "I previously said five direct reports; correction: I supervised eight, not five.",
      "supervised five direct reports",
      "PERSONAL",
      "SUPERSEDED",
    ],
    [
      "disputed-count",
      "I remember twelve coworkers, but the roster says fourteen; I cannot resolve attendance.",
      "trained twelve coworkers",
      "PERSONAL",
      "DISPUTED",
    ],
  ];
  const cases = definitions.map(([id, extra, bad, attr, state]) => {
    const source = `${sql}\n${extra}`;
    return sample(
      id,
      source,
      [
        sourceClaim(good, sql, source),
        sourceClaim(
          bad,
          extra,
          source,
          "action",
          attr || "PERSONAL",
          state || "CONFIRMED",
        ),
      ],
      "What SQL validation work did the candidate personally perform?",
      [0],
      `${good}.`,
      `${good} and ${bad}.`,
    );
  });
  const controls: [
    string,
    string,
    string,
    StateClaim["attribute"],
    StateClaim["attribution"],
  ][] = [
    [
      "training-safe",
      "I trained dispatch coworkers through workshops and wrote a handbook.",
      "Training and documentation",
      "action",
      "PERSONAL",
    ],
    [
      "team-safe",
      "The team reduced weekly reconciliation time from five hours to two over six runs; my contribution was the checks.",
      "Measured team reconciliation result",
      "metric",
      "TEAM",
    ],
    [
      "exposure-safe",
      "I completed one Docker exercise; no production use is claimed.",
      "Limited Docker exposure only",
      "depth",
      "EXPOSURE",
    ],
    [
      "reports-corrected",
      "I supervised eight direct reports, not five.",
      "Supervision of eight direct reports",
      "scope",
      "PERSONAL",
    ],
  ];
  for (const [id, quote, requirement, attribute, attr] of controls) {
    const value =
      id === "team-safe"
        ? "Team reconciliation time fell from five to two hours per week over six runs; personal contribution was the checks"
        : id === "exposure-safe"
          ? "Completed one Docker exercise only"
          : id === "reports-corrected"
            ? "Supervised eight direct reports"
            : "Trained dispatch coworkers through workshops and wrote a handbook";
    cases.push(
      sample(
        id,
        quote,
        [sourceClaim(value, quote, quote, attribute, attr)],
        requirement,
        [0],
        `${value}.`,
      ),
    );
  }
  const prior = JSON.parse(
    await readFile("experiments/career-brain/v2/results/results.json", "utf8"),
  );
  const historical: RichCandidate = prior.runs
    .find(
      (r: { fixture: string; variant: string }) =>
        r.fixture === "G-pathological" && r.variant === "R4",
    )
    .rich.find(
      (r: RichCandidate) => r.kind === "project" && r.title === "Dispatch Loom",
    );
  const hSource = fixture("G-pathological").source;
  cases.push(
    sample(
      "historical-warning",
      hSource,
      historical.claims.map((c) => ({ ...c, availability: "CONFIRMED" })),
      "What SQL checks did the candidate personally write?",
      [2, 3],
      "Wrote the Python parser and SQL checks.",
      historical.summary,
    ),
  );
  return {
    cases,
    actor,
    richB: await reviewedSeed("B-messy"),
    richV1: await reviewedSeed("A-clean-v1"),
    oracle: {
      version: "claim-repair-1",
      basis:
        "Frozen source-based factual compatibility; previous strict and corrected gold retained. Existing direct facts may enrich/decompose without forcing compact gold.",
      requiredV2: [
        "end-date-june",
        "handbook-five-examples",
        "roster-added",
        "certificate-review",
        "team-metric-stable",
        "profile-stable",
      ],
      requiredV3: [
        "end-date-stable",
        "roster-handover",
        "attendance-disputed-all-parents",
        "sql-depth",
        "docker-exposure",
        "certificate-continuity",
        "team-metric-stable",
        "profile-stable",
      ],
    },
  };
}
