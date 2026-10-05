import { goldPackets } from "../gold-packets";
import { ground, type RichCandidate, type RichCanonical } from "../evidence";
import { fixture } from "./fixtures";

// Manually source-reviewed revisions of the SAME approved rich inventory. Native
// candidates are measured separately, never silently accepted or rewritten.
export function reviewedRevision(
  previous: RichCanonical[],
  revision: "V2" | "V3",
) {
  const source = fixture(
    revision === "V2" ? "A-clean-v2" : "A-clean-v3",
  ).source;
  const rows: RichCandidate[] = structuredClone(previous);
  const addClaim = (
    r: RichCandidate,
    value: string,
    quote: string,
    attribute: RichCandidate["claims"][number]["attribute"] = "context",
  ) =>
    r.claims.push({
      attribute,
      value,
      attribution: "PERSONAL",
      evidence: [{ quote, start: null, end: null }],
    });
  const experience = rows.find((r) => r.kind === "experience")!;
  if (revision === "V2") {
    experience.end_date = "2024-06-30";
    experience.summary = experience.summary.replaceAll(
      "2024-05-31",
      "2024-06-30",
    );
    experience.source_quote = experience.source_quote.replaceAll(
      "2024-05-31",
      "2024-06-30",
    );
    experience.claims = experience.claims.map((c) => ({
      ...c,
      value: c.value.replaceAll("2024-05-31", "2024-06-30"),
      evidence: c.evidence.map((s) => ({
        ...s,
        quote: s.quote.replaceAll("2024-05-31", "2024-06-30"),
      })),
    }));
    const training = rows.find(
      (r) => r.kind === "achievement" && /training/i.test(r.title),
    )!;
    addClaim(
      training,
      "Handbook included five worked examples",
      "For Dispatch Loom the handbook also included five worked examples.",
    );
    training.summary += " The handbook included five worked examples.";
    const roster = goldPackets(fixture("A-clean-v2")).find(
      (r) => r.key === "roster-note",
    )!;
    rows.push({
      ...roster,
      skill_keys: [
        rows.find((r) => r.kind === "skill" && r.title === "SQL")!.key,
      ],
      aliases: ["Roster Note"],
      claims: [
        {
          attribute: "action",
          value:
            "Personally built Roster Note, a separate SQL handover checklist",
          attribution: "PERSONAL",
          evidence: [
            {
              quote:
                "I personally built Roster Note at Harbor Tools, a separate SQL handover checklist.",
              start: null,
              end: null,
            },
          ],
        },
      ],
    });
    // Retain history in REVIEW, never pretend the current unnamed sentence proves
    // the named award/date. Existing RPC leaves the previously approved UUID intact.
    rows.find((r) => r.kind === "certification")!.uncertainties = [
      "Named award paragraph omitted; residual course completion prevents confident removal. Owner review required.",
    ];
  } else {
    const roster = rows.find(
      (r) => r.kind === "project" && /roster/i.test(r.title),
    )!;
    addClaim(
      roster,
      "Personally documented night-shift Roster Note handover; no measured impact",
      "I personally documented the Roster Note handover for the night shift; no measured impact is claimed.",
      "action",
    );
    roster.summary +=
      " Personally documented the handover for the night shift; no measured impact is claimed.";
    addClaim(
      rows.find((r) => r.kind === "skill" && r.title === "SQL")!,
      "SQL extensive usage",
      "I used SQL extensively, while Docker remains a one-off exercise.",
      "depth",
    );
    const sql = rows.find((r) => r.kind === "skill" && r.title === "SQL")!;
    rows.push({
      ...sql,
      key: "docker-exposure",
      title: "Docker",
      aliases: ["Docker"],
      category_key: null,
      summary: "Docker one-off exercise only",
      source_quote:
        "I used SQL extensively, while Docker remains a one-off exercise.",
      claims: [
        {
          attribute: "depth",
          value: "Docker one-off exercise only",
          attribution: "EXPOSURE",
          evidence: [
            {
              quote:
                "I used SQL extensively, while Docker remains a one-off exercise.",
              start: null,
              end: null,
            },
          ],
        },
      ],
    });
    for (const r of rows) {
      if (
        /\b12\b/.test(
          r.summary + " " + r.claims.map((c) => c.value).join(" "),
        ) &&
        /cowork|workshop|train/i.test(r.summary + r.title)
      )
        r.uncertainties = [
          "Attendance 12 versus 14 unresolved in V3; prior approved quantity must not be served as a current unqualified fact.",
        ];
    }
  }
  return ground(rows, source);
}
