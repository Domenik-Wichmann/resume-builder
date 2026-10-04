import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { newWorkspace } from "../src/lib/workspaces/model";
import {
  applyQuestion,
  applyMatch,
  deriveTopics,
} from "../src/lib/workspaces/context";
import { fixture } from "../src/lib/career/fixture";
import {
  compileResumeIR,
  expansionQueries,
  resumeIRSchema,
} from "../src/lib/resume-ir";
import { exportWorkspaceText } from "../src/lib/workspaces/export";
import { createVisitor, readVisitor } from "../src/lib/workspaces/identity";
import { resolveMarket } from "../src/lib/markets";
import {
  browserCreateWorkspace,
  browserListWorkspaces,
  browserDeleteWorkspace,
  browserLoadWorkspace,
  browserWorkspaceAction,
} from "../src/lib/workspaces/browser";
const presentation = {
  market: "BG" as const,
  location: "Demo Bulgaria",
  contact_email: "",
  phone: "",
  work_authorization: "",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("workspace compilation and privacy", () => {
  it("suppresses topic duplicates across canonical capitalization and hints", () => {
    expect(deriveTopics("automation", [], ["Automation"])).toEqual([
      { topic: "Automation", strength: "NONE" },
    ]);
  });
  it("uses tracking market before preference or coarse location, with no precise geolocation", () => {
    expect(resolveMarket("US", "BG", "BG")).toBe("US");
    expect(resolveMarket(null, "US", "BG")).toBe("US");
    expect(resolveMarket(null, null, "BG")).toBe("BG");
    expect(resolveMarket(null, null, null)).toBe("US");
  });
  it("rejects forged and expired visitor identifiers", () => {
    vi.stubEnv("APP_MODE", "demo");
    const visitor = createVisitor();
    expect(readVisitor(visitor.cookie)).toBe(visitor.id);
    expect(readVisitor(visitor.cookie + "x")).toBeNull();
    expect(readVisitor(undefined)).toBeNull();
    expect(
      readVisitor(visitor.cookie.replace(visitor.id, randomUUID())),
    ).toBeNull();
  });
  it("accumulates deduplicated evidence, topics, and role requirements", () => {
    let workspace = newWorkspace(randomUUID(), "BG", true);
    workspace = applyQuestion(
      workspace,
      "SQL?",
      { answer: "Stored SQL evidence", evidence_ids: ["project-quality"] },
      [fixture.projects[1]],
      deriveTopics("SQL?", [fixture.projects[1]], fixture.skills),
    );
    workspace = applyQuestion(
      workspace,
      "AWS?",
      { answer: "No relevant evidence is currently stored.", evidence_ids: [] },
      [],
      deriveTopics("AWS?", [], fixture.skills),
    );
    expect(workspace.questions[0].topics[0]).toEqual({
      topic: "SQL",
      strength: "STRONG",
    });
    expect(workspace.questions[1].topics[0]).toEqual({
      topic: "AWS",
      strength: "NONE",
    });
    workspace = applyMatch(
      workspace,
      "SQL reporting and React\nSQL reporting and React",
      {
        overall_summary: "Evidence supports SQL",
        strong_matches: [],
        supporting_experience: ["project-quality"],
        skills: ["SQL"],
        gaps: [],
        suggested_resume_emphasis: [],
      },
      [fixture.projects[1]],
    );
    expect(workspace.evidence).toHaveLength(1);
    expect(workspace.requirements).toHaveLength(1);
    expect(expansionQueries(workspace).length).toBeLessThanOrEqual(3);
  });
  it("compiles only current canonical facts, reorders for explored evidence, and excludes Q&A text", () => {
    const workspace = newWorkspace(randomUUID(), "BG", true);
    workspace.evidence = [
      ...fixture.projects.map((record) => ({
        ...record,
        summary: "FORGED BROWSER ACCOMPLISHMENT",
      })),
      { ...fixture.experiences[0], id: "invented" },
    ];
    workspace.questions = [
      {
        question: "SQL?",
        answer: "UNSUPPORTED Q&A BULLET",
        evidence_ids: ["project-quality"],
        topics: [{ topic: "SQL", strength: "STRONG" }],
        created_at: new Date().toISOString(),
      },
    ];
    const ir = compileResumeIR(fixture, workspace, presentation);
    expect(resumeIRSchema.safeParse(ir).success).toBe(true);
    expect(ir.projects[0].title).toBe("Data quality checks");
    expect(ir.experiences).toEqual([]);
    expect(JSON.stringify(ir)).not.toContain("FORGED");
    expect(JSON.stringify(ir)).not.toContain("UNSUPPORTED Q&A BULLET");
    expect(ir.profile.contact.market).toBe("BG");
  });
  it("exports useful readable content while excluding source and workspace identifiers", () => {
    const workspace = newWorkspace(randomUUID(), "BG", true);
    workspace.evidence = [fixture.projects[0]];
    workspace.questions = [
      {
        question: "What SQL work?",
        answer: "The project is relevant.",
        evidence_ids: ["project-demo"],
        topics: [],
        created_at: new Date().toISOString(),
      },
    ];
    const text = exportWorkspaceText(workspace);
    expect(text).toContain("Operations workbench");
    expect(text).toContain("What SQL work?");
    expect(text).not.toContain(workspace.id);
    expect(text).not.toContain("project-demo");
    expect(text).not.toContain("embedding");
  });
});
describe("offline browser workspace persistence", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url === "/api/workspaces" && options?.method === "POST")
          return Response.json({
            workspace: newWorkspace(randomUUID(), "BG", true),
          });
        if (url === "/api/workspaces")
          return Response.json({ mode: "demo", workspaces: [] });
        if (url === "/api/ask")
          return Response.json({
            result: {
              answer: fixture.projects[1].summary,
              evidence_ids: ["project-quality"],
            },
            evidence: [fixture.projects[1]],
            mode: "demo",
          });
        return Response.json({ error: "Not found" }, { status: 404 });
      }),
    );
  });
  it("enforces two slots, resumes across reads, and frees a deleted slot", async () => {
    const first = await browserCreateWorkspace();
    await browserCreateWorkspace();
    await expect(browserCreateWorkspace()).rejects.toThrow("slots");
    expect(await browserLoadWorkspace(first.id)).toEqual(first);
    expect(await browserListWorkspaces()).toHaveLength(2);
    await browserDeleteWorkspace(first.id);
    await browserCreateWorkspace();
    expect(await browserListWorkspaces()).toHaveLength(2);
  });
  it("persists questions and compiles a current résumé through the offline vertical slice", async () => {
    const workspace = await browserCreateWorkspace();
    const answered = await browserWorkspaceAction(
      workspace,
      "ask",
      "What SQL experience?",
    );
    expect((await browserLoadWorkspace(workspace.id)).questions).toHaveLength(
      1,
    );
    const preview = await browserWorkspaceAction(answered.workspace, "compile");
    expect(preview.ir?.projects.length).toBeGreaterThan(0);
    expect(preview.ir?.profile.contact.market).toBe("BG");
  });
});
