import { readFile, writeFile } from "node:fs/promises";
import { annotated, annotationHash } from "./annotations";
import { evaluate } from "./metrics";
import {
  ground,
  reconcile,
  richDiff,
  type RichCandidate,
  type RichCanonical,
} from "./evidence";
import type { Change } from "../../../src/lib/ingestion/model";
type Run = {
  fixture: string;
  variant: string;
  repetition: number;
  rich?: RichCandidate[];
  changes?: Change[];
};
const root = "experiments/career-brain/v2/results";
const results: { runs: Run[] } = JSON.parse(
  await readFile(root + "/results.json", "utf8"),
);
const runs = results.runs.filter(
  (r) => r.variant === "R4" && ["B-messy", "B-reordered"].includes(r.fixture),
);
// These before objects came from the same fixed real approved database seed.
const current = [
  ...new Map(
    runs
      .flatMap((r) => r.changes || [])
      .flatMap((c) => (c.before ? [c.before as RichCanonical] : []))
      .map((c) => [c.id, c]),
  ).values(),
];
if (current.length !== 15)
  throw new Error("Incomplete persisted-state replay baseline");
const replay = runs.map((run) => {
  const source = annotated.find((f) => f.id === run.fixture)!.source;
  const records = (run.rich || []).map((r) => {
    const candidate = {
      ...r,
      uncertainties: r.uncertainties.filter(
        (u) => u !== "Team outcome must retain attribution in display text.",
      ),
    };
    const stillUnsafe = ground([candidate], source)[0].uncertainties.includes(
      "Team outcome must retain attribution in display text.",
    );
    return {
      ...r,
      uncertainties: stillUnsafe ? r.uncertainties : candidate.uncertainties,
    };
  });
  return {
    fixture: run.fixture,
    repetition: run.repetition,
    identity: reconcile(records, current).decisions,
    changes: richDiff(records, current, false),
  };
});
await writeFile(
  root + "/deterministic-replay.json",
  JSON.stringify(
    {
      annotationHash,
      scope:
        "Replay after name-precedence/team-context guards; original model outputs and audits unchanged, historical source references retained. No new provider calls. Fixed approved gold is not a previous rich-import factual baseline.",
      replay,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  root + "/rescored-2.1.json",
  JSON.stringify(
    {
      annotationHash,
      scope:
        "Source-corrected supplemental gold scores; original metrics are preserved",
      runs: results.runs.map((r) => ({
        fixture: r.fixture,
        variant: r.variant,
        repetition: r.repetition,
        metrics: evaluate(
          annotated.find((f) => f.id === r.fixture)!,
          r.rich || (r as Run & { rows: RichCandidate[] }).rows,
        ),
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    repeats: replay.length,
    matched: replay.map(
      (r) => r.identity.filter((d) => d.outcome === "MATCH_EXISTING").length,
    ),
  }),
);
