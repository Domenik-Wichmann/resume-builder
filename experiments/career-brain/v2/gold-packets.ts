import { randomUUID } from "node:crypto";
import { revised } from "./benchmark";
import {
  factualHash,
  ground,
  type RichCandidate,
  type RichCanonical,
} from "./evidence";
import { candidate, type Fixture } from "../fixtures";

// Manually supplied packet claims for the clean retrieval corpus. This isolates
// retrieval/answering from extractor errors; generated-ingest results stay separate.
export function goldPackets(fixture: Fixture = revised[0]): RichCanonical[] {
  const find = (text: string) =>
    fixture.source.split("\n\n").find((p) => p.includes(text))!;
  const q = {
    role: find("I worked as Operations Analyst"),
    build: find("I wrote the Python parser"),
    metric: find("This was a team result"),
    training: find("trained 12"),
    requirements: find("I gathered Dispatch Loom"),
    degree: find("I earned a BSc"),
    certificate: find("I received the fictional"),
    languages: find("I speak English"),
  };
  const claim = (
    attribute: RichCandidate["claims"][number]["attribute"],
    value: string,
    quotes: string[],
    attribution: RichCandidate["claims"][number]["attribution"] = "PERSONAL",
  ) => ({
    attribute,
    value,
    attribution,
    evidence: quotes.map((quote) => ({ quote, start: null, end: null })),
  });
  const rows = fixture.gold.map((g) => {
    const r: RichCandidate = {
      ...candidate(g),
      aliases: g.aliases,
      claims: [claim("context", g.summary || g.title, [g.source_quote])],
    };
    if (g.kind === "experience")
      r.claims = [
        claim(
          "context",
          `Operations Analyst at Harbor Tools, ${g.start_date} to ${g.end_date}`,
          [q.role],
        ),
        claim(
          "action",
          "Designed Dispatch Loom and trained dispatch coworkers",
          [q.build, q.training],
        ),
      ];
    if (g.key === "dispatch-loom")
      r.claims = [
        claim(
          "action",
          "Personally designed Dispatch Loom; wrote Python parser and SQL checks",
          [q.build],
        ),
        claim("tool", "Python; SQL; PostgreSQL; Git", [
          q.build,
          q.requirements,
        ]),
        claim(
          "context",
          "Gathered warehouse supervisor requirements and explained validation failures",
          [q.requirements],
        ),
      ];
    if (g.key === "loom-time")
      r.claims = [
        claim(
          "metric",
          "Team reconciliation time fell from 5 to 2 hours per week over six weekly runs",
          [q.metric],
          "TEAM",
        ),
        claim("ownership", "Personal contribution was parser and checks", [
          q.metric,
          q.build,
        ]),
      ];
    if (g.key === "loom-training" || g.key === "coworker-training")
      r.claims = [
        claim(
          "action",
          "Personally trained 12 dispatch coworkers in two workshops and wrote a handbook",
          [q.training],
        ),
      ];
    if (g.kind === "skill" && g.key !== "coworker-training")
      r.claims = [claim("tool", g.title, [g.source_quote])];
    if (g.key === "loom-training" && fixture.id !== "A-clean-v1") {
      const quote =
        "For Dispatch Loom the handbook also included five worked examples.";
      if (fixture.source.includes(quote))
        r.claims.push(
          claim("context", "Handbook included five worked examples", [quote]),
        );
    }
    if (g.key === "sql" && fixture.id === "A-clean-v3") {
      const quote =
        "I used SQL extensively, while Docker remains a one-off exercise.";
      r.claims.push(claim("depth", "SQL extensive usage", [quote]));
    }
    if (g.kind === "education")
      r.claims = [
        claim(
          "credential",
          "BSc in Information Systems at Cedar College, 2017-09-01 to 2020-06-30",
          [q.degree],
        ),
      ];
    if (g.kind === "certification")
      r.claims = [
        claim(
          "credential",
          "Cedar SQL Foundations certificate awarded 2020-08-15; issuer unspecified",
          [q.certificate],
        ),
      ];
    if (g.kind === "certification") {
      const qualifier =
        "The certificate was a course completion, not a professional license.";
      if (fixture.source.includes(qualifier))
        r.claims.push(
          claim("context", "Course completion, not a professional license", [
            qualifier,
          ]),
          claim("denial", "Professional license", [qualifier], "NEGATED"),
        );
    }
    if (g.kind === "language")
      r.claims = [claim("language", "Fluent English", [q.languages])];
    return r;
  });
  return ground(rows, fixture.source).map((r) => ({
    ...r,
    id: randomUUID(),
    hash: factualHash(r),
    published: true,
    archived: false,
    updated_at: "2026-10-05T00:00:00Z",
  }));
}
