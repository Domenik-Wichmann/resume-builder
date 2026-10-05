import { readFile, writeFile } from "node:fs/promises";
import { fixtures, candidate } from "./fixtures";
import { canonical, diffScore } from "./metrics";
import { diffCareer } from "../../src/lib/ingestion/diff";
import type { Candidate } from "../../src/lib/ingestion/model";
const results = JSON.parse(
  await readFile("experiments/career-brain/results/results.json", "utf8"),
) as {
  runs: {
    fixture: string;
    variant: string;
    rows: Candidate[];
    error?: string;
  }[];
};
const [v1, v2, v3] = [fixtures[0], fixtures[7], fixtures[8]];
const current1 = canonical(v1.gold.map(candidate));
const current2 = canonical(
  [
    ...v2.gold.map(candidate),
    candidate(v1.gold.find((r) => r.kind === "certification")!),
  ],
  ["certification:cedar-sql"],
);
const extracted = results.runs
  .filter((r) => r.variant === "A" && [v2.id, v3.id].includes(r.fixture))
  .map((run) => ({
    fixture: run.fixture,
    ...diffScore(
      run.fixture === v2.id ? v2 : v3,
      run.rows,
      run.fixture === v2.id ? current1 : current2,
    ),
  }));
const project = candidate(v1.gold.find((r) => r.kind === "project")!);
const rewritten = {
  ...project,
  summary:
    "Built dispatch reconciliation with a Python parser and SQL checks; collected warehouse supervisor requirements.",
};
const result = {
  method:
    "Compare A revision outputs to the manually approved gold canonical state whose keys were actually supplied to extraction. This avoids comparing against fresh V1 model keys that were not supplied. Experimental E cannot establish a sequential revision baseline because V1 and V3 timed out; failed outputs must never imply removals.",
  goldCanonical: {
    v2: diffScore(v2, v2.gold.map(candidate), current1).accuracy,
    v3: diffScore(v3, v3.gold.map(candidate), current2).accuracy,
  },
  extracted,
  semanticEquivalence: {
    expected: "UNCHANGED",
    actual: diffCareer([rewritten], canonical([project]), false)[0].status,
  },
};
await writeFile(
  "experiments/career-brain/results/revision-audit.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    gold: result.goldCanonical,
    extracted: extracted.map((r) => ({
      fixture: r.fixture,
      accuracy: r.accuracy,
    })),
    semanticEquivalence: result.semanticEquivalence,
  }),
);
