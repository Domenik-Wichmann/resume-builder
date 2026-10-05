import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { revised } from "./benchmark";

// Supplemental source corrections never overwrite frozen revision 2 or raw scores.
export const annotationNotes = [
  "H: inherited Dispatch Loom aliases are absent from the independently written Ledger source. Each Ledger NNN gets only its own explicit name.",
  "I: source establishes supervising eight direct reports at Harbor Tools, but no official Supervisor job title. Allow a professional activity frame; correct inherited project aliases.",
  "V3: Roster Note explicitly gains night-shift handover documentation. Retaining this inside the project or in a linked achievement is allowed. An explicit SQL depth claim may be UPDATED or UNCHANGED according to the previously approved facts.",
];
export const annotated = structuredClone(revised);
for (const f of annotated) {
  if (f.id === "H-boundary") for (const g of f.gold) g.aliases = [g.title];
  if (f.id === "I-correction") {
    f.gold[0].title = "People supervision activity";
    f.gold[0].aliases = [
      "supervis",
      "people management",
      "direct report",
      "management at harbor",
    ];
  }
  if (f.id === "A-clean-v3") {
    const roster = f.gold.find((g) => g.key === "roster-note")!;
    roster.achievement_keys = ["roster-handover"];
    f.expectedDiff = { ...f.expectedDiff, "project:roster-note": "UPDATED" };
  }
}
export const annotationHash = createHash("sha256")
  .update(JSON.stringify({ annotationNotes, annotated }))
  .digest("hex");
export async function freezeAnnotations() {
  const path = "experiments/career-brain/v2/results/annotations-2.1.json";
  const payload = {
    revision: "2.1",
    annotationHash,
    annotationNotes,
    fixtures: annotated,
  };
  try {
    const old = JSON.parse(await readFile(path, "utf8"));
    if (old.annotationHash !== annotationHash)
      throw new Error("Annotation supplement changed after freeze");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
    await writeFile(path, JSON.stringify(payload, null, 2) + "\n");
  }
}
