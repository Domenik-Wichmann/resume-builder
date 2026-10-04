import { describe, it, expect } from "vitest";
import { safeProjectUrl, projectSchema } from "../src/lib/portfolio/model";
import { imageType } from "../src/lib/portfolio/images";
import { deriveExplorer } from "../src/lib/portfolio/explorer";
import { cardVisible } from "../src/lib/portfolio/answers";
import { fixture } from "../src/lib/career/fixture";
import {
  semanticEntities,
  needsEmbedding,
} from "../src/lib/embeddings/content";
import { compileResumeIR } from "../src/lib/resume-ir";
import { newWorkspace } from "../src/lib/workspaces/model";
import { accessConfig, requiresVerification } from "../src/lib/access/config";
import {
  outcomeAllowed,
  rawRates,
  suggestedMetadata,
  metadataSchema,
} from "../src/lib/applications/model";
import {
  experimentAnalytics,
  coverageSuggestions,
} from "../src/lib/applications/analytics";
import { dollarsToMicro } from "../src/lib/usage/service";
describe("public portfolio projections", () => {
  it("only accepts credential-free HTTPS and supported internal routes", () => {
    for (const url of [
      "https://github.com/example/project",
      "/projects/my-project",
      "/workspace",
      "/explore",
    ])
      expect(safeProjectUrl(url)).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://example.com",
      "//evil.test",
      "https://user:secret@example.com",
      "https://example.com\\@evil.test",
      "/api/admin/login",
      "/auth/callback",
      "/projects/../admin",
      "/projects/x?redirect=evil",
    ])
      expect(safeProjectUrl(url)).toBe(false);
    expect(projectSchema.safeParse({ title: "Anything" }).success).toBe(false);
  });
  it("detects permitted raster headers and rejects SVG/HTML content", () => {
    expect(
      imageType(
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          Buffer.alloc(24),
        ]),
      )?.mime,
    ).toBe("image/png");
    expect(imageType(Buffer.from("<svg onload='alert(1)'></svg>"))).toBeNull();
    expect(
      imageType(Buffer.from("<html><script>alert(1)</script></html>")),
    ).toBeNull();
  });
  it("derives skill evidence and co-occurrence without invented categories or edges", () => {
    const skill = fixture.skill_records.find((s) =>
      fixture.projects.some((p) => p.skills.includes(s.title)),
    )!;
    const data = deriveExplorer(
      fixture,
      [{ id: "category", title: "Approved category", summary: "Evidence" }],
      [{ id: skill.id, category_id: "category" }],
    );
    const selected = data.skills.find((s) => s.id === skill.id)!;
    expect(selected.projects.length).toBeGreaterThan(0);
    expect(selected.evidence_count).toBe(
      selected.projects.length +
        selected.experiences.length +
        selected.achievements.length,
    );
    expect(selected.related).not.toContain(skill.title);
    expect(data.categories).toHaveLength(1);
    expect(
      deriveExplorer(
        {
          ...fixture,
          skill_records: [],
          projects: [],
          experiences: [],
          achievements: [],
        },
        [],
        [],
      ),
    ).toEqual({ categories: [], skills: [] });
  });
  it("requires fresh cards and every supporting record to be published", () => {
    const card = {
      is_public: true,
      stale: false,
      expires_at: "2030-01-01T00:00:00Z",
      sources: [{ kind: "project" as const, id: "one" }],
    };
    const published = new Set(["project:one"]),
      now = Date.parse("2026-01-01");
    expect(cardVisible(card, published, now)).toBe(true);
    expect(cardVisible({ ...card, stale: true }, published, now)).toBe(false);
    expect(cardVisible({ ...card, is_public: false }, published, now)).toBe(
      false,
    );
    expect(cardVisible(card, new Set(), now)).toBe(false);
    expect(
      cardVisible({ ...card, expires_at: "2025-01-01" }, published, now),
    ).toBe(false);
    expect(cardVisible({ ...card, sources: [] }, published, now)).toBe(false);
  });
  it("changes only a project embedding when its description or outcomes change", () => {
    const before = semanticEntities(fixture);
    const career = {
      ...fixture,
      projects: fixture.projects.map((p, i) =>
        i
          ? p
          : {
              ...p,
              description: "Owner-approved detail",
              outcomes: ["Verified outcome"],
            },
      ),
    };
    const after = semanticEntities(career);
    const changed = after.filter((e) =>
      needsEmbedding(
        e,
        {
          content_hash: before.find((b) => b.record.id === e.record.id)!.hash,
          embedding_model: "embed-v4.0",
        },
        "embed-v4.0",
      ),
    );
    expect(changed).toHaveLength(1);
    expect(changed[0].type).toBe("project");
  });
  it("uses the same canonical bullet facts in each composition strategy", () => {
    const ws = {
      ...newWorkspace("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "US", true),
      evidence: [
        ...fixture.experiences,
        ...fixture.projects,
        ...fixture.achievements,
      ],
    };
    const contact = {
      market: "US" as const,
      location: "",
      contact_email: "",
      phone: "",
      work_authorization: "",
    };
    const a = compileResumeIR(fixture, ws, contact),
      b = compileResumeIR(fixture, ws, contact, "PROJECT_FORWARD"),
      c = compileResumeIR(fixture, ws, contact, "OUTCOME_FORWARD");
    expect(b.projects).toEqual(a.projects);
    expect(c.supporting_sections).toEqual(a.supporting_sections);
    expect(b.section_order?.[0]).toBe("Projects");
    expect(c.section_order?.[0]).toBe("Achievements");
    expect(a.summary).toBe(fixture.profile.introduction);
  });
});
describe("access, application and accounting decisions", () => {
  it("never bypasses verification merely because a caller claims a tracking code", () => {
    const now = Date.parse("2026-01-01");
    expect(requiresVerification(true, false, null, now)).toBe(true);
    expect(requiresVerification(true, true, null, now)).toBe(false);
    expect(requiresVerification(false, false, null, now)).toBe(false);
    expect(requiresVerification(true, false, "2027-01-01", now)).toBe(false);
    expect(requiresVerification(true, false, "2025-01-01", now)).toBe(true);
    expect(accessConfig({})).toMatchObject({
      spacing: 5,
      daily: 25,
      weekly: 50,
      configured: false,
    });
    expect(() => accessConfig({ TURNSTILE_SITE_KEY: "one" })).toThrow();
    expect(() => accessConfig({ AI_VISITOR_DAILY_LIMIT: "0" })).toThrow();
  });
  it("validates lightweight metadata and controlled outcome transitions", () => {
    expect(
      metadataSchema.parse(
        suggestedMetadata("Senior data analyst, remote", "BG"),
      ),
    ).toMatchObject({
      job_family: "DATA",
      seniority: "SENIOR",
      market: "BG",
      work_mode: "REMOTE",
    });
    expect(outcomeAllowed("DRAFT", "SENT")).toBe(true);
    expect(outcomeAllowed("DRAFT", "OFFER")).toBe(false);
    expect(outcomeAllowed("INTERVIEW", "REJECTED")).toBe(true);
    expect(outcomeAllowed("ACCEPTED", "SENT")).toBe(false);
  });
  it("reports raw rates with no winner or fabricated zero-denominator percentage", () => {
    expect(rawRates(0, 0, 0)).toMatchObject({
      interview_rate: null,
      offer_rate: null,
      signal: "Insufficient data",
    });
    expect(rawRates(4, 1, 1).interview_rate).toBe(0.25);
    expect(rawRates(10, 1, 0).signal).toBe("Early signal");
    const result = experimentAnalytics({
      applications: [
        { id: "a", sent_at: "2026-01-01" },
        { id: "draft", sent_at: null },
      ],
      snapshots: [
        { application_id: "a", variant_id: "v" },
        { application_id: "draft", variant_id: "v" },
      ],
      variants: [
        { id: "v", label: "A", experiment_id: "e", strategy: "TRADITIONAL" },
      ],
      links: [{ id: "l", application_id: "a" }],
      visits: [
        { link_id: "l", session_id: "s" },
        { link_id: "l", session_id: "s" },
      ],
      workspaces: [{ id: "w", tracking_link_id: "l" }],
      questions: [{ workspace_id: "w" }],
      events: [{ workspace_id: "w", event_type: "workspace_export" }],
      explorer: [{ workspace_id: "w" }],
      outcomes: [
        { application_id: "a", status: "INTERVIEW" },
        { application_id: "a", status: "OFFER" },
      ],
    });
    expect(result[0]).toMatchObject({
      assigned: 2,
      sent: 1,
      visits: 1,
      interviews: 1,
      offers: 1,
      questions: 1,
      exports: 1,
    });
  });
  it("suggests owner review based on observed interest and real evidence", () => {
    const result = coverageSuggestions(
      [
        { topic: "SQL", evidence_strength: "STRONG", question_id: "q" },
        { topic: "unknown", evidence_strength: "NONE", question_id: "r" },
      ],
      [],
      [{ id: "x", title: "Evidence", skills: ["SQL"] }],
      new Set(),
    );
    expect(result.find((s) => s.topic === "SQL")?.suggestion).toContain(
      "existing evidence",
    );
    expect(result.find((s) => s.topic === "unknown")?.suggestion).toContain(
      "possible evidence gap",
    );
    expect(dollarsToMicro(0.00001452)).toBe(15);
  });
});
