import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  understandJob,
  findRequirementEvidence,
  writeApplication,
  auditWriting,
  assembleWriting,
  selectInventory,
  packetInventory,
  admittedInputs,
  writingInputs,
  compactApplicationEvidence,
  applicationAuditBatchSize,
  applicationRelevance,
  type Writing,
} from "../src/lib/applications/generation";
import { compileResumeIR } from "../src/lib/resume-ir";
import { newWorkspace } from "../src/lib/workspaces/model";
import {
  clearSignalContent,
  applyFixedContent,
  withTrackingUrl,
  fixedContentSchema,
} from "../src/lib/resume-design/fixed-content";
import { clearSignalDesign } from "../src/lib/resume-design/model";
import { ResumeRenderer } from "../src/components/resume-renderer";
import type { BrainRecord } from "../src/lib/career-brain/repository";
import type { StatePacket } from "../src/lib/career-brain/state";
import type { Career } from "../src/lib/career/model";
import {
  reportedTimeline,
  timelineSortKey,
} from "../src/lib/applications/timeline";
vi.mock("../src/lib/ai/openrouter", () => ({ complete: vi.fn() }));
vi.mock("../src/lib/embeddings/retrieval", () => ({
  retrieveCareerEvidence: vi.fn(),
}));
vi.mock("../src/lib/http", () => ({
  reserveAIQuota: vi.fn(),
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
import { complete } from "../src/lib/ai/openrouter";
import { reserveAIQuota } from "../src/lib/http";
import { retrieveCareerEvidence } from "../src/lib/embeddings/retrieval";

// Deliberately fictional career; no package sample employment becomes canonical.
function record(
  id: string,
  title: string,
  text: string,
  kind: BrainRecord["kind"] = "experience",
): BrainRecord {
  return {
    id,
    key: id,
    kind,
    title,
    subtitle: "Fictional example",
    organization: "Example employer",
    start_date: "2022-01-01",
    end_date: "2023-01-01",
    summary: "Not evidence",
    skill_keys: [],
    achievement_keys: [],
    category_key: null,
    source_quote: text,
    uncertainties: [],
    aliases: [],
    published: true,
    archived: false,
    hash: "test-hash",
    updated_at: "test-revision",
    evidence_version: "proof-v1",
    claims: [
      {
        attribute: "action",
        value: text,
        attribution: "PERSONAL",
        availability: "CONFIRMED",
        evidence: [{ quote: text, start: 0, end: text.length }],
      },
    ],
  };
}
const rows = [
  record(
    "ai",
    "AI implementation coordinator",
    "Directed AI-assisted RAG retrieval implementation and evaluated answers against source passages.",
  ),
  record(
    "data",
    "Data operations analyst",
    "Built spreadsheet validation workflows and automated product-data transformations.",
  ),
  record(
    "customer",
    "Customer operations associate",
    "Resolved German and English customer-support cases and coordinated multilingual onboarding.",
  ),
];
const career: Career = {
  profile: { name: "Fictional Candidate", title: "", introduction: "" },
  experiences: rows.map((r) => ({
    id: r.id,
    slug: r.key,
    title: r.title,
    subtitle: r.subtitle,
    summary: r.summary,
    organization: r.organization,
    start_date: r.start_date,
    end_date: r.end_date,
    skills: [],
  })),
  projects: [],
  achievements: [],
  skill_records: [],
  skills: [],
  education: [],
  certifications: [],
  languages: [],
  demo: false,
};
const presentation = {
  market: "US" as const,
  location: "Example City",
  contact_email: "fictional@example.invalid",
  phone: "",
  work_authorization: "",
};
const base = () =>
  compileResumeIR(
    career,
    { ...newWorkspace("example", "US", false), evidence: career.experiences },
    presentation,
  );
const statement = (text: string, id: string) => ({ text, refs: [`${id}:0`] });
function writing(id: string, headline: string, skill: string): Writing {
  const selected = rows.find((r) => r.id === id)!;
  return {
    headline: statement(headline, id),
    summary: [statement(selected.claims[0].value, id)],
    skills: [{ label: "Relevant capabilities", items: [statement(skill, id)] }],
    entries: [
      { record_id: id, bullets: [statement(selected.claims[0].value, id)] },
    ],
    coverage: [
      {
        requirement: "Required exact technology",
        support: "TRANSFERABLE",
        refs: [`${id}:0`],
        note: "Related workflow evidence; exact product use is not stored.",
      },
    ],
    review: [],
  };
}
beforeEach(() => vi.clearAllMocks());
it("does not call Cohere with an empty follow-up batch for preferred-only vacancies", async () => {
  vi.mocked(retrieveCareerEvidence).mockResolvedValue(career.experiences);
  const evidence = await findRequirementEvidence(
    {
      focus: "Fictional preferred-only job",
      requirements: [
        {
          requirement: "Preferred spreadsheet familiarity",
          importance: "PREFERRED",
          query: "spreadsheet validation",
          transferable_query: "data operations",
        },
      ],
    },
    career,
    "verified-account",
  );
  expect(evidence).toEqual(career.experiences);
  expect(retrieveCareerEvidence).toHaveBeenCalledTimes(1);
  expect(retrieveCareerEvidence).toHaveBeenCalledWith(
    ["spreadsheet validation"],
    career,
    { accountId: "verified-account", operation: "application_search" },
  );
  expect(reserveAIQuota).toHaveBeenCalledTimes(1);
});
it("uses bounded planning, writing and complete-assertion verification for three materially different jobs", async () => {
  const evidence = packetInventory(rows);
  const outputs = [];
  for (const [id, headline, skill] of [
    ["ai", "AI Retrieval & Implementation", "RAG evaluation"],
    ["data", "Data Operations & Automation", "Spreadsheet validation"],
    ["customer", "Multilingual Customer Operations", "German customer support"],
  ]) {
    const plan = {
      focus: headline,
      requirements: [
        {
          requirement: headline,
          importance: "ESSENTIAL",
          query: skill,
          transferable_query: "workflow coordination",
        },
      ],
    };
    const draft = writing(id, headline, skill);
    vi.mocked(complete)
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(draft);
    const job = await understandJob(
      `${headline}: fictional vacancy`,
      "account",
    );
    const result = await writeApplication(job, evidence, "account");
    const writeCall = vi.mocked(complete).mock.calls.at(-1)!;
    expect(writeCall[3]).toMatchObject({
      maxTokens: 16000,
      reasoningEffort: "low",
      timeoutMs: 120000,
    });
    const payload = JSON.parse(writeCall[1] as string);
    expect(payload.plan).toEqual(plan);
    expect(payload.evidence.inputs[0].requirement).toBe("");
    expect(
      payload.evidence.inputs[0].claims[0].source_refs.map(
        (index: number) => payload.evidence.source_passages[index],
      ),
    ).toEqual(
      admittedInputs(evidence, "")[0].claims[0].evidence.map(
        (span) => span.quote,
      ),
    );
    const inputs = writingInputs(result, evidence);
    vi.mocked(complete).mockResolvedValueOnce({
      decisions: inputs.map((i) => ({
        id: i.id,
        verdict: "PASS",
        assertions: [
          {
            text: i.bullet,
            verdict: "SUPPORTED",
            claimRefs: i.claims.map((c) => c.ref),
            reason: "Exact fictional support",
          },
        ],
        reason: "Supported",
      })),
    });
    const audit = await auditWriting(result, evidence, "account");
    expect(vi.mocked(complete).mock.calls.at(-1)![3]).toMatchObject({
      maxTokens: 10000,
      reasoningEffort: "medium",
      timeoutMs: 120000,
    });
    const ir = withTrackingUrl(
      {
        ...applyFixedContent(
          assembleWriting(base(), result, evidence, audit),
          clearSignalContent,
        ),
        design: clearSignalDesign,
      },
      "abc_DEF1",
    );
    outputs.push(ir);
    expect(ir.headline).toBe(headline);
    expect(ir.skill_groups[0].skills).toEqual([skill]);
    expect(ir.experiences[0].evidence_ids).toEqual([id]);
    expect(ir.projects.map((p) => p.bullets)).toEqual(
      clearSignalContent.projects.map((p) => p.bullets),
    );
    expect(ir.projects.map((p) => p.title)).toEqual(
      clearSignalContent.projects.map((p) => p.title),
    );
    const html = renderToStaticMarkup(createElement(ResumeRenderer, { ir }));
    expect(
      html.match(/href="https:\/\/domenik-wichmann.com\/r\/abc_DEF1"/g),
    ).toHaveLength(3);
    expect(html).not.toContain("Learning demo:");
    expect(html).not.toContain("test-hash");
    expect(html).not.toContain("proof-v1");
  }
  expect(new Set(outputs.map((o) => o.summary)).size).toBe(3);
  expect(reserveAIQuota).toHaveBeenCalledTimes(9);
});
it("deduplicates exact source passages while retaining claim refs, constraints and attribution", () => {
  const packet = packetInventory(rows)[0];
  packet.claims.push({
    ...packet.claims[0],
    availability: "DISPUTED",
    attribution: "NEGATED",
  });
  const inputs = admittedInputs([packet], "Synthetic requirement");
  const original = JSON.stringify(inputs);
  const compact = compactApplicationEvidence([...inputs, ...inputs]);
  expect(compact.source_passages).toEqual([packet.claims[0].evidence[0].quote]);
  expect(compact.inputs[0].claims[0].source_refs).toEqual([0]);
  expect(compact.inputs[1].constraints[0]).toMatchObject({
    availability: "DISPUTED",
    attribution: "NEGATED",
    source_refs: [0],
  });
  expect(compact.inputs[0].claims[0].ref).toBe(inputs[0].claims[0].ref);
  expect(JSON.stringify(inputs)).toBe(original);
});
it("rejects incomplete and unexpected verifier IDs instead of accepting a partial audit", async () => {
  const evidence = packetInventory(rows);
  const draft = writing("data", "Data Operations", "Validation");
  vi.mocked(complete).mockResolvedValue({ decisions: [] });
  await expect(auditWriting(draft, evidence, "account")).rejects.toThrow(
    "did not check every",
  );
  const inputs = writingInputs(draft, evidence);
  vi.mocked(complete).mockResolvedValue({
    decisions: inputs.map((i, index) => ({
      id: index ? i.id : "unexpected",
      verdict: "PASS",
      assertions: [],
      reason: "Synthetic response",
    })),
  });
  await expect(auditWriting(draft, evidence, "account")).rejects.toThrow(
    "unexpected statement ID",
  );
});
it("reviews bounded batches in parallel while preserving global statement IDs and source refs", async () => {
  const evidence = packetInventory(rows);
  const draft = writing("data", "Data Operations", "Validation");
  draft.skills = [
    {
      label: "Relevant capabilities",
      items: Array.from({ length: 6 }, () => ({
        text: rows[1].claims[0].value,
        refs: ["data:0"],
      })),
    },
    {
      label: "Practical tools",
      items: Array.from({ length: 6 }, () => ({
        text: rows[1].claims[0].value,
        refs: ["data:0"],
      })),
    },
  ];
  draft.entries = rows.map((row) => ({
    record_id: row.id,
    bullets: Array.from({ length: 4 }, () => ({
      text: row.claims[0].value,
      refs: [`${row.id}:0`],
    })),
  }));
  const expected = writingInputs(draft, evidence);
  vi.mocked(complete).mockImplementation(async (_system, input) => {
    const payload = JSON.parse(input as string) as {
      inputs: { id: string; bullet: string; claims: { ref: string }[] }[];
    };
    expect(payload.inputs.length).toBeLessThanOrEqual(
      applicationAuditBatchSize,
    );
    return {
      decisions: payload.inputs
        .map((i) => ({
          id: i.id,
          verdict: "PASS",
          assertions: [
            {
              text: i.bullet,
              verdict: "SUPPORTED",
              claimRefs: i.claims.map((c) => c.ref),
              reason: "Synthetic test evidence",
            },
          ],
          reason: "Synthetic test evidence",
        }))
        .reverse(),
    };
  });
  const audit = await auditWriting(draft, evidence, "account");
  expect(audit).toHaveLength(expected.length);
  expect(audit.map((a) => a.text)).toEqual(expected.map((i) => i.bullet));
  expect(audit.every((a) => a.pass)).toBe(true);
  expect(complete).toHaveBeenCalledTimes(
    Math.ceil(expected.length / applicationAuditBatchSize),
  );
  expect(reserveAIQuota).toHaveBeenCalledTimes(
    Math.ceil(expected.length / applicationAuditBatchSize),
  );
});

it("prioritizes essential AI and RAG claims beyond the old packet limit and keeps source constraints", () => {
  const plan = {
    focus: "AI automation and knowledge bases",
    requirements: [
      {
        requirement: "AI RAG knowledge bases",
        importance: "ESSENTIAL" as const,
        query: "AI automation RAG",
        transferable_query: "retrieval",
      },
      {
        requirement: "translation",
        importance: "CONTEXT" as const,
        query: "translation",
        transferable_query: "",
      },
    ],
  };
  expect(applicationRelevance("AI RAG automation", plan)).toBeGreaterThan(
    applicationRelevance("translation", plan),
  );
  const project = record(
    "kb",
    "Fictional knowledge base",
    "Built an AI RAG knowledge base.",
    "project",
  );
  const relevant = project.claims[0];
  project.claims = [
    ...Array.from({ length: 27 }, (_, i) => ({
      ...relevant,
      value: `Translation task ${i}`,
    })),
    relevant,
    {
      ...relevant,
      attribute: "denial",
      value: "No production deployment",
      attribution: "NEGATED",
      availability: "DISPUTED",
    },
  ];
  const original = JSON.stringify(project);
  const packet = packetInventory([project], plan)[0];
  expect(packet.claims).toContain(relevant);
  expect(packet.claims[0].value).toBe("No production deployment");
  expect(packet.claims[1].value).toBe(relevant.value);
  expect(packet.claims[1].evidence).toEqual(relevant.evidence);
  expect(JSON.stringify(project)).toBe(original);
});

it("shows only unambiguous reported start months without inventing an end or current employment", () => {
  const claim = {
    ...rows[0].claims[0],
    value:
      "CV reports a September 2022 start month; current/end date unresolved",
  };
  expect(reportedTimeline([claim])).toBe(
    "Reported start: Sep 2022 · end date unconfirmed",
  );
  expect(
    reportedTimeline([{ ...claim, availability: "PENDING_REVIEW" }]),
  ).toBeUndefined();
  expect(
    reportedTimeline([{ ...claim, attribution: "NEGATED" }]),
  ).toBeUndefined();
  expect(
    reportedTimeline([
      claim,
      { ...claim, value: "Reported start month January 2023" },
    ]),
  ).toBeUndefined();
  expect(
    reportedTimeline([{ ...claim, value: "Worked on AI systems" }]),
  ).toBeUndefined();
  expect(
    timelineSortKey({
      dates: { start: null, end: null },
      timeline_note: reportedTimeline([claim]),
    }),
  ).toBe("2022-09");
  expect(timelineSortKey({ dates: { start: null, end: null } })).toBe("");
});

it("renders honest experience timelines and a compact invitation with a bold portfolio label", () => {
  const ir = base();
  ir.experiences = [
    {
      ...ir.experiences[0],
      dates: { start: null, end: null },
      timeline_note: "Reported start: Sep 2022 · end date unconfirmed",
    },
    { ...ir.experiences[1], dates: { start: "2022-01-01", end: null } },
    { ...ir.experiences[2], dates: { start: null, end: null } },
  ];
  ir.portfolio_url = "https://example.invalid";
  ir.invitation = "Explore my projects and ask about my experience online.";
  const html = renderToStaticMarkup(createElement(ResumeRenderer, { ir }));
  expect(html).toContain("Reported start: Sep 2022 · end date unconfirmed");
  expect(html).toContain("2022-01-01 – End date not recorded");
  expect(html).toContain("Dates not recorded");
  expect(html).not.toContain("Present");
  expect(html).toContain("<strong>Portfolio &amp; AI demo:</strong>");
  expect(html).toContain('<p class="resume-invitation">Explore my projects');
});

it("recovers a rejected headline using only complete audited capability phrases", () => {
  const evidence = packetInventory(rows);
  const draft = writing("ai", "Unsupported senior architect", "RAG retrieval");
  const audit = writingInputs(draft, evidence).map((i) => ({
    text: i.bullet,
    refs: i.claims.map((c) => c.ref),
    pass: i.bullet !== draft.headline.text,
    reason: "Synthetic audit",
  }));
  expect(assembleWriting(base(), draft, evidence, audit).headline).toBe(
    "RAG retrieval",
  );
  expect(
    assembleWriting(
      base(),
      draft,
      evidence,
      audit.map((a) => ({ ...a, pass: false })),
    ).headline,
  ).toBe("");
});

it("rejects factual but job-irrelevant skills while accepting them for a matching job", async () => {
  const translation = record(
    "translation",
    "Translation",
    "Translated German onboarding materials.",
    "skill",
  );
  const evidence = packetInventory([translation]);
  const draft = writing("data", "Data operations", "German translation");
  draft.headline.refs =
    draft.summary[0].refs =
    draft.skills[0].items[0].refs =
      ["translation:0"];
  draft.entries = [];
  let jobFit = "IRRELEVANT";
  vi.mocked(complete).mockImplementation(async (_system, payload) => {
    const data = JSON.parse(payload as string) as {
      inputs: { id: string; bullet: string; claims: { ref: string }[] }[];
    };
    return {
      decisions: data.inputs.map((input) => ({
        id: input.id,
        verdict: "PASS",
        job_fit: jobFit,
        assertions: [
          {
            text: input.bullet,
            verdict: "SUPPORTED",
            claimRefs: input.claims.map((claim) => claim.ref),
            reason: "Fictional evidence",
          },
        ],
        reason: "Fictional evidence",
      })),
    };
  });
  const plan = {
    focus: "Data analyst",
    requirements: [
      {
        requirement: "data validation",
        query: "data validation",
        transferable_query: "rules",
        importance: "ESSENTIAL" as const,
      },
    ],
  };
  const audit = await auditWriting(draft, evidence, "account", plan);
  expect(audit.every((result) => !result.pass)).toBe(true);
  expect(audit[2].reason).toContain("Not relevant");
  jobFit = "DIRECT";
  expect(
    (
      await auditWriting(draft, evidence, "account", {
        ...plan,
        focus: "Translator",
      })
    ).every((result) => result.pass),
  ).toBe(true);
});

it("keeps explicitly requested confirmed tool records even when broad records dominate relevance scores", () => {
  const broad = Array.from({ length: 30 }, (_, index) =>
    record(
      `broad${index}`,
      "AI RAG operations data workflows",
      "AI RAG operations data workflow integration API automation.",
    ),
  );
  const n8n = record(
    "n8n",
    "n8n",
    "Used n8n for integration workflows.",
    "skill",
  );
  const zapier = record(
    "zapier",
    "Zapier",
    "Used Zapier for integration workflows.",
    "skill",
  );
  const translation = record(
    "translation",
    "Translation",
    "Translated onboarding content.",
    "skill",
  );
  const plan = {
    focus: "Automation",
    requirements: [
      {
        requirement: "AI RAG operations data automation using n8n or Zapier",
        query: "workflow API integration",
        transferable_query: "process automation",
        importance: "ESSENTIAL" as const,
      },
    ],
  };
  const selected = selectInventory(
    [...broad, n8n, zapier, translation],
    plan,
    broad.map((record) => record.id),
  );
  expect(selected.map((record) => record.id)).toContain("n8n");
  expect(selected.map((record) => record.id)).toContain("zapier");
  expect(selected.map((record) => record.id)).not.toContain("translation");
  expect(selected.length).toBeLessThanOrEqual(28);
});

it("appends only one verified bullet while preserving each approved project block exactly", () => {
  const draft = writing("ai", "AI work", "RAG retrieval");
  const evidence = packetInventory(rows);
  const original = base();
  original.projects = [original.experiences[0]];
  original.experiences = [];
  const audit = writingInputs(draft, evidence).map((input) => ({
    text: input.bullet,
    refs: input.claims.map((claim) => claim.ref),
    pass: true,
    reason: "Fictional audit",
  }));
  const fixed = {
    ...clearSignalContent,
    projects: [
      { ...clearSignalContent.projects[0], record_id: "ai" },
      clearSignalContent.projects[1],
    ] as typeof clearSignalContent.projects,
  };
  const ir = applyFixedContent(
    assembleWriting(original, draft, evidence, audit, ["ai"]),
    fixed,
  );
  expect(ir.projects[0].bullets).toEqual([
    ...fixed.projects[0].bullets,
    rows[0].claims[0].value,
  ]);
  expect(ir.projects[1].bullets).toEqual(fixed.projects[1].bullets);
  expect(ir.projects[0].title).toBe(fixed.projects[0].title);
  expect(applyFixedContent(ir, fixed)).toEqual(ir);
});

it("includes verified additional project work while excluding locked projects and preserving timeline uncertainty", () => {
  const draft = writing("ai", "AI implementation", "RAG");
  const evidence = packetInventory(rows);
  evidence[0].timeline_note = "Reported start: Sep 2022 · end date unconfirmed";
  const original = base();
  const project = {
    ...original.experiences[0],
    dates: { start: null, end: null },
  };
  original.projects = [project];
  original.experiences = [];
  const audit = writingInputs(draft, evidence).map((i) => ({
    text: i.bullet,
    refs: i.claims.map((c) => c.ref),
    pass: true,
    reason: "Synthetic verified fixture",
  }));
  const result = assembleWriting(original, draft, evidence, audit);
  expect(result.supporting_sections[0].bullets).toEqual([
    rows[0].claims[0].value,
  ]);
  expect(result.supporting_sections[0].timeline_note).toContain(
    "end date unconfirmed",
  );
  expect(result.supporting_sections[0].dates).toEqual({
    start: null,
    end: null,
  });
  expect(
    assembleWriting(original, draft, evidence, audit, ["ai"])
      .supporting_sections,
  ).toEqual([]);
});
it("finds an accomplishment outside the original hits, expands the actual parent and excludes unpublished/archive evidence", () => {
  const achievement = record(
    "rare",
    "Validation exception recovery",
    "Recovered supplier data with reusable validation rules.",
    "achievement",
  );
  const parent = { ...rows[1], achievement_keys: ["rare"] };
  const unrelated = Array.from({ length: 12 }, (_, i) =>
    record(
      `unrelated${i}`,
      "Administrative support",
      "Handled routine correspondence.",
    ),
  );
  const plan = {
    focus: "data",
    requirements: [
      {
        requirement: "supplier data",
        importance: "ESSENTIAL" as const,
        query: "validation exception recovery",
        transferable_query: "reusable validation rules",
      },
    ],
  };
  const result = selectInventory(
    [
      ...unrelated,
      achievement,
      parent,
      { ...achievement, id: "private", published: false },
      { ...achievement, id: "archived", archived: true },
    ],
    plan,
    unrelated.slice(0, 8).map((r) => r.id),
  );
  expect(result.map((r) => r.id)).toContain("rare");
  expect(result.map((r) => r.id)).toContain("data");
  expect(result.map((r) => r.id)).not.toContain("private");
  expect(result.map((r) => r.id)).not.toContain("archived");
});
it("omits an unsafe exact tool without losing the truthful transferable bullet and its private gap", async () => {
  const evidence = packetInventory(rows);
  const draft = writing("data", "Data Operations", "Neo4j expert");
  const inputs = writingInputs(draft, evidence);
  vi.mocked(complete).mockResolvedValue({
    decisions: inputs.map((i) => ({
      id: i.id,
      verdict: i.bullet === "Neo4j expert" ? "FAIL" : "PASS",
      assertions: [
        {
          text: i.bullet,
          verdict: i.bullet === "Neo4j expert" ? "UNSUPPORTED" : "SUPPORTED",
          claimRefs: i.claims.map((c) => c.ref),
          reason: "Test source boundary",
        },
      ],
      reason: "Exact technology missing",
    })),
  });
  const ir = assembleWriting(
    base(),
    draft,
    evidence,
    await auditWriting(draft, evidence, "account"),
  );
  expect(ir.skill_groups).toEqual([]);
  expect(ir.experiences[0].bullets).toEqual([rows[1].claims[0].value]);
  expect(draft.coverage[0].support).toBe("TRANSFERABLE");
});
it("rejects forged refs, pending/planned proof, incomplete audits and cross-employer attribution", () => {
  const evidence = packetInventory(rows);
  const draft = writing("data", "Data Operations", "Validation");
  draft.headline.refs.push("forged-ref");
  expect(writingInputs(draft, evidence)[0].claims).toEqual([]);
  const blocked: StatePacket = {
    ...evidence[0],
    claims: [
      { ...evidence[0].claims[0], availability: "DISPUTED" },
      { ...evidence[0].claims[0], attribution: "UNCERTAIN" },
    ],
  };
  expect(admittedInputs([blocked], "test")[0].claims).toHaveLength(0);
  draft.entries[0].record_id = "customer";
  const audit = writingInputs(draft, evidence).map((i) => ({
    text: i.bullet,
    refs: i.claims.map((c) => c.ref),
    pass: true,
    reason: "Fictional test",
  }));
  expect(assembleWriting(base(), draft, evidence, audit).experiences).toEqual(
    [],
  );
});
it("omits conflicting dates and titles, and keeps distinct LMS destinations and immutable captured design", () => {
  const evidence = packetInventory(rows);
  evidence[1].uncertainties = ["Conflicting dates"];
  const draft = writing("data", "Data Operations", "Validation");
  const audit = writingInputs(draft, evidence).map((i) => ({
    text: i.bullet,
    refs: i.claims.map((c) => c.ref),
    pass: true,
    reason: "Fictional test",
  }));
  const mutable = assembleWriting(base(), draft, evidence, audit);
  expect(mutable.experiences[0].dates).toEqual({ start: null, end: null });
  evidence[1].uncertainties = ["Official title disputed"];
  expect(assembleWriting(base(), draft, evidence, audit).experiences).toEqual(
    [],
  );
  const ir = withTrackingUrl(
    applyFixedContent(
      { ...mutable, design: clearSignalDesign },
      clearSignalContent,
      "https://example.invalid/learner",
    ),
    "abc_DEF1",
  );
  expect(ir.projects[1].links?.map((l) => l.url)).toEqual([
    "https://systemwright-lms.web.app/",
    "https://example.invalid/learner",
  ]);
  expect(withTrackingUrl(ir, "abc_DEF1")).toEqual(ir);
  expect(() => withTrackingUrl(ir, "random")).toThrow();
  expect(
    fixedContentSchema.safeParse({
      ...clearSignalContent,
      learning_demo: "javascript:alert(1)",
    }).success,
  ).toBe(false);
  expect(
    fixedContentSchema.safeParse({
      ...clearSignalContent,
      learning_demo: "https://systemwright-lms.web.app/",
    }).success,
  ).toBe(false);
  const html = renderToStaticMarkup(createElement(ResumeRenderer, { ir }));
  expect(html).toContain("#F9F7F2");
  expect(html).toContain("#21656B");
});
