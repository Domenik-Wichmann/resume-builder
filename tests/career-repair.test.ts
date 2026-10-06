import { describe, it, expect, vi } from "vitest";
import { sourceCoverage } from "../experiments/career-brain/v2/repair";
import { complete } from "../experiments/career-brain/v2/provider";
import { consolidateNamedSkills } from "../experiments/career-brain/v2/consolidate";
import { matchGold } from "../experiments/career-brain/v2/metrics";
import { annotated } from "../experiments/career-brain/v2/annotations";
import { directNamed } from "../experiments/career-brain/v2/semantic-adjudication";
import { goldPackets } from "../experiments/career-brain/v2/gold-packets";
vi.mock("../experiments/career-brain/v2/provider", () => ({
  complete: vi.fn(),
}));
import {
  factualHash,
  ground,
  reconcile,
  richDiff,
  type RichCandidate,
  type RichCanonical,
} from "../experiments/career-brain/v2/evidence";
import {
  adjudicate,
  packets,
  resumeAdmission,
} from "../experiments/career-brain/v2/packets";
import { packets as publicPackets } from "../src/lib/career-brain/packets";
const quote = "I wrote the Python parser and SQL checks myself.";
const team =
  "The team reduced checking from 5 hours to 2 hours; my contribution was the parser.";
const record: RichCandidate = {
  kind: "project",
  key: "model-hint",
  title: "Dispatch Loom",
  subtitle: "",
  summary: "Built a Python parser and SQL checks.",
  organization: "Harbor Tools",
  start_date: null,
  end_date: null,
  skill_keys: [],
  achievement_keys: [],
  category_key: null,
  source_quote: quote,
  uncertainties: [],
  aliases: ["Loom"],
  claims: [
    {
      attribute: "action",
      value: "Python parser and SQL checks",
      attribution: "PERSONAL",
      evidence: [{ quote, start: null, end: null }],
    },
    {
      attribute: "tool",
      value: "Python; SQL",
      attribution: "PERSONAL",
      evidence: [{ quote, start: null, end: null }],
    },
  ],
};
const stored = (patch: Partial<RichCanonical> = {}): RichCanonical => ({
  ...record,
  key: "application-key",
  id: "11111111-1111-4111-8111-111111111111",
  hash: factualHash(record),
  published: true,
  archived: false,
  updated_at: "2026-10-05T00:00:00Z",
  ...patch,
});
describe("experimental Career Brain repair boundaries", () => {
  it("retains the credential's explicit course-completion and license qualifiers in packets", () => {
    const gold = goldPackets(annotated[0]);
    const certificate = gold.find((r) => r.kind === "certification")!;
    const packet = packets(gold, [certificate.id])[0];
    expect(
      packet.claims.some(
        (c) => c.value === "Course completion, not a professional license",
      ),
    ).toBe(true);
    expect(
      packet.claims.some(
        (c) =>
          c.value === "Professional license" && c.attribution === "NEGATED",
      ),
    ).toBe(true);
  });
  it("scores PostgreSQL separately from SQL and freezes source-supported boundary labels", () => {
    expect(
      matchGold(
        {
          ...record,
          kind: "skill",
          title: "PostgreSQL",
          key: "postgresql-new",
        },
        annotated[0].gold,
      )?.key,
    ).toBe("postgresql");
    const boundary = annotated.find((f) => f.id === "H-boundary")!;
    expect(
      boundary.gold.every(
        (g) =>
          g.aliases[0] === g.title && boundary.source.includes(g.source_quote),
      ),
    ).toBe(true);
  });
  it("consolidates exact named skills across chunks and recomputes global offsets", () => {
    const sql = {
      ...record,
      kind: "skill" as const,
      title: "SQL",
      organization: null,
      key: "sql-first",
    };
    const merged = consolidateNamedSkills(
      [
        sql,
        { ...sql, key: "sql-second" },
        { ...record, skill_keys: ["sql-second"] },
      ],
      "Prefix\n" + quote,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].claims[0].evidence[0].start).toBe(7);
    expect(merged[1].skill_keys).toEqual(["sql-first"]);
  });
  it("prefers a unique named skill over shared evidence and emits valid keys for Unicode titles", () => {
    const python = stored({
      kind: "skill",
      title: "Python",
      aliases: [],
      key: "python",
    });
    const sql = stored({
      kind: "skill",
      title: "SQL",
      aliases: [],
      key: "sql",
      id: "22222222-2222-4222-8222-222222222222",
    });
    expect(
      reconcile([{ ...python, key: "new-hint" }], [python, sql]).decisions[0],
    ).toMatchObject({ outcome: "MATCH_EXISTING", id: python.id });
    expect(
      reconcile([{ ...sql, key: "new-hint" }], [python]).decisions[0].outcome,
    ).toBe("AMBIGUOUS");
    expect(
      reconcile([{ ...record, title: "Résumé 分析" }], []).records[0].key,
    ).toMatch(/^[a-z0-9-]+$/);
  });
  it("does not demand a team-result qualifier for neutral team usage context", () => {
    const context = {
      ...record,
      claims: [
        {
          ...record.claims[0],
          attribute: "scope" as const,
          attribution: "TEAM" as const,
          value: "Warehouse operators used the checker",
        },
      ],
    };
    expect(ground([context], quote)[0].uncertainties).toEqual([]);
  });
  it("keeps a corrected but omitted existing entity in review instead of archiving it", async () => {
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: [
        {
          id: stored().id,
          status: "FACT_CHANGED",
          reason: "Headcount changed; same entity remains",
          quotes: [],
        },
      ],
    });
    const result = await sourceCoverage(
      [],
      [stored()],
      quote,
      "synthetic-account",
      async (_label, _provider, call) => call(),
    );
    expect(richDiff(result.records, [stored()], true)[0].status).toBe("REVIEW");
  });
  it("does not turn team-only AWS evidence into the candidate's skill", () => {
    const aws = stored({
      kind: "skill",
      title: "AWS",
      aliases: [],
      claims: [{ ...record.claims[1], value: "AWS", attribution: "TEAM" }],
    });
    expect(
      adjudicate("AWS engineer", packets([aws], [aws.id]))[0].support,
    ).toBe("RELATED_ONLY");
    expect(resumeAdmission("AWS engineer", packets([aws], [aws.id]))).toEqual(
      [],
    );
  });
  it("requires credential facts for credentials and personal implementation for professional named skills", () => {
    const p = packets([stored()], [stored().id])[0];
    expect(directNamed("SQL", "SKILL", p, "SQL certificate?")).toBe(false);
    const exposure = {
      ...p,
      kind: "skill" as const,
      title: "Docker",
      aliases: ["Docker"],
      claims: [
        {
          ...record.claims[1],
          value: "Docker one-off exercise",
          attribution: "EXPOSURE" as const,
        },
      ],
    };
    expect(
      directNamed("Docker", "SKILL", exposure, "Docker production engineer?"),
    ).toBe(false);
    expect(directNamed("Docker", "SKILL", exposure, "Docker exposure?")).toBe(
      true,
    );
    expect(
      directNamed(
        "Docker",
        "SKILL",
        {
          ...exposure,
          claims: [{ ...exposure.claims[0], attribution: "PERSONAL" }],
        },
        "Docker production engineer?",
      ),
    ).toBe(false);
    const german = {
      ...p,
      kind: "language" as const,
      title: "German",
      aliases: ["German"],
      claims: [
        {
          ...record.claims[0],
          attribute: "language" as const,
          value: "Basic German",
        },
      ],
    };
    expect(directNamed("German", "LANGUAGE", german, "German fluency?")).toBe(
      false,
    );
  });
  it("bounds packet quotations without cutting away a retained claim's qualifiers", () => {
    const ownership = {
      ...record.claims[0],
      attribute: "ownership" as const,
      value: "Personal parser contribution only",
      evidence: [
        { quote: "x".repeat(2000), start: 0, end: 2000 },
        { quote: "y".repeat(2000), start: 2001, end: 4001 },
      ],
    };
    const context = {
      ...record.claims[0],
      attribute: "context" as const,
      evidence: [{ quote: "z".repeat(2000), start: 0, end: 2000 }],
    };
    const bounded = packets(
      [
        stored({
          claims: [...Array.from({ length: 20 }, () => context), ownership],
        }),
      ],
      [stored().id],
    )[0];
    expect(bounded.claims[0]).toEqual(ownership);
    expect(
      bounded.claims
        .flatMap((c) => c.evidence)
        .reduce((n, e) => n + e.quote.length, 0),
    ).toBeLessThanOrEqual(10000);
    expect(
      bounded.claims.every((c) =>
        c.evidence.every((e) => e.quote.length === 2000),
      ),
    ).toBe(true);
  });
  it("bounds expanded public Q&A packets without changing legacy admission or including private records", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      stored({ id: `fictional-${i}` }),
    );
    const privateRecord = stored({ id: "fictional-private", published: false });
    const archivedRecord = stored({ id: "fictional-archived", archived: true });
    const all = [privateRecord, archivedRecord, ...records];
    const ids = all.map((record) => record.id);
    expect(
      publicPackets(
        records,
        records.map((record) => record.id),
      ),
    ).toHaveLength(8);
    const selected = publicPackets(all, ids, 12);
    expect(selected).toHaveLength(10);
    expect(
      selected.every(
        (packet) => ![privateRecord.id, archivedRecord.id].includes(packet.id),
      ),
    ).toBe(true);
    expect(
      publicPackets(
        records,
        records.map((record) => record.id),
        100,
      ),
    ).toHaveLength(12);
    expect(publicPackets(records, ids, -1)).toEqual([]);
  });
  it("ignores generated keys and preserves canonical UUID through aliases and exact evidence context", () => {
    const r = reconcile(
      [{ ...record, key: "another-hint", title: "Loom" }],
      [stored()],
    );
    expect(r.decisions[0]).toMatchObject({
      outcome: "MATCH_EXISTING",
      id: stored().id,
      key: "application-key",
    });
    expect(r.records[0].key).not.toBe("another-hint");
    expect(reconcile([record], []).records[0].key).not.toBe(record.key);
  });
  it("routes ambiguous identity to review without creating an accepted guess", () => {
    const r = richDiff(
      [record],
      [
        stored(),
        stored({ key: "other", id: "22222222-2222-4222-8222-222222222222" }),
      ],
      false,
    );
    expect(r[0].status).toBe("REVIEW");
  });
  it("does not merge distinct named projects just because they share a source paragraph", () => {
    const shared =
      "I implemented Alpha and Beta as two distinct reconciliation tools.";
    const alpha = stored({
      title: "Alpha",
      aliases: [],
      claims: [
        {
          ...record.claims[0],
          evidence: [{ quote: shared, start: 0, end: shared.length }],
        },
      ],
    });
    const beta = {
      ...record,
      title: "Beta",
      aliases: [],
      claims: alpha.claims,
    };
    expect(reconcile([beta], [alpha]).decisions[0].outcome).toBe("NEW_ENTITY");
  });
  it("ignores display wording but changes facts, dates, attribution and relations materially", () => {
    expect(
      richDiff(
        [
          {
            ...record,
            summary: "Personally implemented the parser and checking logic.",
          },
        ],
        [stored()],
        false,
      )[0].status,
    ).toBe("UNCHANGED");
    expect(
      factualHash({
        ...record,
        claims: [{ ...record.claims[0], value: "AWS implementation" }],
      }),
    ).not.toBe(factualHash(record));
    expect(factualHash({ ...record, end_date: "2024-06-30" })).not.toBe(
      factualHash(record),
    );
    expect(factualHash({ ...record, skill_keys: ["aws"] })).not.toBe(
      factualHash(record),
    );
  });
  it("retains multiple exact evidence spans and computes offsets instead of trusting the model", () => {
    const r = {
      ...record,
      summary: "Team checking fell from 5 to 2 hours; personally wrote parser.",
      claims: [
        {
          ...record.claims[0],
          attribute: "metric" as const,
          value: "5 to 2 hours",
          attribution: "TEAM" as const,
          evidence: [
            { quote: team, start: 99, end: 100 },
            { quote, start: null, end: null },
          ],
        },
      ],
    };
    const checked = ground([r], quote + "\n" + team)[0];
    expect(checked.claims[0].evidence).toHaveLength(2);
    expect(checked.claims[0].evidence[0].start).toBe(quote.length + 1);
    expect(checked.uncertainties).toEqual([]);
    expect(ground([r], "unrelated")[0].uncertainties).toContain(
      "Exact evidence span is absent from source.",
    );
  });
  it("prevents team-result inflation and denied skill records", () => {
    expect(
      ground(
        [{ ...record, claims: [{ ...record.claims[0], attribution: "TEAM" }] }],
        quote,
      )[0].uncertainties.length,
    ).toBeGreaterThan(0);
    expect(
      ground(
        [
          {
            ...record,
            kind: "skill",
            claims: [{ ...record.claims[0], attribution: "NEGATED" }],
          },
        ],
        quote,
      )[0].uncertainties,
    ).toContain("Denied technology cannot become a positive skill record.");
  });
  it("keeps broad retrieval as context while rejecting absent named skills and managerial counts", () => {
    const p = packets([stored()], [stored().id]);
    expect(adjudicate("Does this person know AWS?", p)[0].support).toBe(
      "RELATED_ONLY",
    );
    expect(adjudicate("Managed 100 employees?", p)[0].support).toBe(
      "RELATED_ONLY",
    );
    expect(resumeAdmission("AWS engineer", p)).toEqual([]);
    expect(
      resumeAdmission(
        "Used Python and SQL?",
        p.map((packet) => ({ ...packet, support: "RELATED_ONLY" as const })),
      ),
    ).toEqual([]);
    expect(adjudicate("Used Python and SQL?", p)[0].support).toBe("SUPPORTS");
    expect(adjudicate("SQL certificate?", p)[0].support).toBe("RELATED_ONLY");
    expect(
      adjudicate("Has this person built a neural network?", p)[0].support,
    ).toBe("RELATED_ONLY");
  });
  it("retains correction history but hashes the active corrected factual value", () => {
    const evidence = [
      { quote: "I managed five people.", start: 0, end: 22 },
      {
        quote: "Correction: eight direct reports, not five.",
        start: 23,
        end: 65,
      },
    ];
    const eight = {
      ...record,
      claims: [
        {
          attribute: "scope" as const,
          value: "8 direct reports",
          attribution: "PERSONAL" as const,
          evidence,
        },
      ],
    };
    const five = {
      ...eight,
      claims: [{ ...eight.claims[0], value: "5 direct reports" }],
    };
    expect(factualHash(eight)).not.toBe(factualHash(five));
  });
  it("excludes unpublished/archived relationship evidence and limits exposure claims", () => {
    expect(packets([stored({ published: false })], [stored().id])).toEqual([]);
    const docker = stored({
      kind: "skill",
      title: "Docker",
      summary: "Tried once locally.",
      claims: [
        {
          attribute: "depth",
          value: "Docker once in local guided exercise",
          attribution: "EXPOSURE",
          evidence: [{ quote: "I tried Docker once.", start: 0, end: 20 }],
        },
      ],
    });
    expect(
      adjudicate(
        "Docker production engineer",
        packets([docker], [docker.id]),
      )[0].support,
    ).toBe("RELATED_ONLY");
  });
});
