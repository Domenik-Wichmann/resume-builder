import { readFile, writeFile } from "node:fs/promises";
import { identity } from "../../src/lib/ingestion/diff";
import type { Candidate } from "../../src/lib/ingestion/model";
type Run = {
  fixture: string;
  variant: string;
  repetition: number;
  rows: Candidate[];
};
const results = JSON.parse(
  await readFile("experiments/career-brain/results/results.json", "utf8"),
) as { runs: Run[] };
// Human audit annotations are deliberately separate from pre-run gold. They do not
// rewrite frozen recall labels to make an architecture look better.
const reviewed = new Set(["A", "B", "C", "D", "E"]);
const audit = results.runs
  .filter((r) => reviewed.has(r.variant))
  .map((run) => {
    const claims = run.rows.flatMap((row) => {
      const values = [
        { field: "identity", text: `${row.kind}: ${row.title}` },
        ...(row.subtitle ? [{ field: "subtitle", text: row.subtitle }] : []),
        ...row.summary
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .map((text) => ({ field: "summary", text })),
        ...(row.organization
          ? [{ field: "organization", text: row.organization }]
          : []),
        ...(row.start_date
          ? [{ field: "start_date", text: row.start_date }]
          : []),
        ...(row.end_date ? [{ field: "end_date", text: row.end_date }] : []),
        ...row.skill_keys.map((text) => ({ field: "skill_link", text })),
        ...row.achievement_keys.map((text) => ({
          field: "achievement_link",
          text,
        })),
        ...(row.category_key
          ? [{ field: "category_link", text: row.category_key }]
          : []),
      ];
      return values.map((claim) => {
        let supported = true,
          reason =
            "Supported by original synthetic source; summary clauses reviewed together as one statement group.";
        if (claim.field === "end_date" && row.kind === "certification") {
          supported = false;
          reason =
            "Award date is given; a certificate end date is not stated. Do not turn it into a one-day validity interval.";
        }
        if (
          claim.field === "organization" &&
          row.kind === "certification" &&
          ["Cedar College", "Cedar"].includes(claim.text)
        ) {
          supported = false;
          reason =
            "College is the degree institution. The certificate name does not explicitly identify College as its issuer.";
        }
        if (
          claim.field === "identity" &&
          row.kind === "skill" &&
          /never used|did not use|did not write|training slide/i.test(
            row.summary,
          )
        ) {
          supported = false;
          reason =
            "The description denies use; a positive canonical skill identity would assert an unsupported capability in skill lists.";
        }
        if (
          claim.field === "summary" &&
          /(?:provided|displayed|including|with).*warnings?|warnings?.*late|displayed a warning/i.test(
            claim.text,
          )
        ) {
          supported = false;
          reason =
            "Source says operators preferred a warning, not that the tool implemented a late-file warning.";
        }
        if (
          claim.field === "summary" &&
          row.kind === "achievement" &&
          /Reduced reconciliation time from/.test(claim.text) &&
          !/team/i.test(claim.text)
        ) {
          supported = false;
          reason =
            "Team attribution appears only in uncertainties. Standalone canonical summary omits that required qualifier.";
        }
        return { identity: identity(row), ...claim, supported, reason };
      });
    });
    const supported = claims.filter((c) => c.supported).length;
    return {
      fixture: run.fixture,
      variant: run.variant,
      repetition: run.repetition,
      supportedClaims: supported,
      totalClaims: claims.length,
      precision: claims.length ? supported / claims.length : null,
      claims,
    };
  });
await writeFile(
  "experiments/career-brain/results/claim-audit.json",
  JSON.stringify(
    {
      method:
        "Human source comparison with explicit exceptions. A claim unit is a populated identity/subtitle/organization/date, one summary sentence (possibly several clauses), or one relationship edge. This is statement-group precision, not fully atomized fact precision. Uncertainties and quotations are audited separately. Gold label defects in D/E are not treated as hallucinations.",
      reviewedVariants: [...reviewed],
      audits: audit,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    audit.map(({ claims, ...r }) => {
      void claims;
      return r;
    }),
  ),
);
