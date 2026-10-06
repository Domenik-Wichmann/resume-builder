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
vi.mock("../src/lib/ai/openrouter", () => ({ complete: vi.fn() }));
vi.mock("../src/lib/embeddings/retrieval", () => ({
  retrieveCareerEvidence: vi.fn(),
}));
vi.mock("../src/lib/http", () => ({
  reserveAIQuota: vi.fn(),
  HttpError: class extends Error {},
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
