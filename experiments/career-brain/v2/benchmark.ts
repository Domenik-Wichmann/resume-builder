import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fixtures, type GoldRecord, type Fixture } from "../fixtures";

export const corrections = [
  "D: remove absent Git/PostgreSQL/training/outcome/category links and requirements-gathering assertion; include explicit Python and SQL skills. The shortened source does not establish the removed facts.",
  "E: accept an optional Harbor Tools SQL activity frame without inventing a job title.",
  "All certificates: issuer is null; the award name does not establish issuer Cedar or Cedar College. Award date is not expiry date.",
  "Requirements gathering and supervisor communication are optional supported skills, not false positives merely because closed-set gold omits them.",
  "V3: night-shift handover may be retained as a claim in Roster Note or a separate achievement; SQL extensive usage is already entailed by the prior source and need not produce a factual update.",
  "Unknown optional dates are not contradictions. Unresolved attendance 12 versus 14 remains REVIEW.",
];
const copy = (r: GoldRecord): GoldRecord => structuredClone(r);
export const revised: Fixture[] = fixtures.map((f) => {
  const gold = f.gold
    .map(copy)
    .map((r) =>
      r.kind === "certification" ? { ...r, organization: null } : r,
    );
  if (f.id === "D-ownership") {
    for (const r of gold) {
      r.skill_keys =
        ["experience", "project"].includes(r.kind) && r.key !== "beacon"
          ? ["python", "sql"]
          : [];
      r.achievement_keys = [];
      if (r.kind === "experience")
        r.summary = "Operations Analyst at Harbor Tools; built Dispatch Loom.";
      if (r.kind === "project" && r.key === "dispatch-loom") {
        r.summary =
          "Personally built Dispatch Loom's Python parser and SQL checks.";
        r.essential = ["parser", "SQL", "reconciliation"];
      }
    }
    for (const name of ["Python", "SQL"]) {
      const original = fixtures[0].gold.find((r) => r.title === name)!;
      gold.push({ ...copy(original), category_key: null });
    }
  }
  return {
    ...f,
    gold,
    ...(f.id === "A-clean-v3"
      ? {
          expectedDiff: {
            ...f.expectedDiff,
            "skill:sql": "UNCHANGED" as const,
          },
        }
      : {}),
  };
});
// Independent boundary/correction inputs. No model output informs these labels.
const template = revised[0].gold.find((r) => r.kind === "project")!;
const boundaryProjects = Array.from({ length: 145 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  const quote = `I personally implemented Ledger ${n}, a distinct SQL reconciliation checker for division ${n}. No users or measured improvement are claimed.`;
  return {
    ...copy(template),
    key: `ledger-${n}`,
    title: `Ledger ${n}`,
    summary: `Implemented a SQL reconciliation checker for division ${n}.`,
    organization: null,
    skill_keys: [],
    achievement_keys: [],
    essential: [`Ledger ${n}`, `division ${n}`],
    source_quote: quote,
  };
});
revised.push({
  id: "H-boundary",
  purpose: "145 distinct units plus relationships; early/middle/late labels",
  source:
    "SYNTHETIC boundary narrative\n\n" +
    boundaryProjects.map((r) => r.source_quote).join("\n\n"),
  gold: boundaryProjects,
  forbidden: [],
});
revised.push({
  id: "I-correction",
  purpose: "Explicit replacement of five by eight direct reports",
  source:
    "SYNTHETIC account. I managed five people at Harbor Tools. Correction: it was eight direct reports, not five. I supervised the eight people directly; this is different from training coworkers.",
  gold: [
    {
      ...copy(template),
      kind: "experience",
      key: "supervisor",
      title: "Supervisor",
      organization: "Harbor Tools",
      skill_keys: [],
      achievement_keys: [],
      summary:
        "Supervised eight direct reports; corrected earlier five-person estimate.",
      source_quote: "Correction: it was eight direct reports, not five.",
      essential: ["eight|8", "direct"],
    },
  ],
  forbidden: ["five direct reports"],
});
export async function freezeBenchmark() {
  const root = "experiments/career-brain/v2";
  const payload =
    JSON.stringify(
      {
        revision: 2,
        baselineCommit: "a41613980d43e80721a676b7110fbad67e524eaa",
        corrections,
        fixtures: revised,
      },
      null,
      2,
    ) + "\n";
  const hash = createHash("sha256").update(payload).digest("hex");
  await mkdir(root + "/results", { recursive: true });
  try {
    const existing = JSON.parse(
      await readFile(root + "/benchmark.json", "utf8"),
    );
    if (existing.hash !== hash)
      throw new Error(
        "Revised benchmark is frozen; create a new revision for label changes.",
      );
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
    await writeFile(
      root + "/benchmark.json",
      JSON.stringify({ hash, payload: JSON.parse(payload) }, null, 2) + "\n",
    );
  }
  return hash;
}
