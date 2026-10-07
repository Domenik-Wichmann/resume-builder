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
  browserWorkspaceSlots,
  browserRememberWorkspaceSlot,
} from "../src/lib/workspaces/browser";
import { assignWorkspaceSlots } from "../src/lib/workspaces/slots";
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
  it("uses tracking context before coarse location and ignores legacy manual preferences, with no precise geolocation", () => {
    expect(resolveMarket("US", "BG", "BG")).toBe("US");
    expect(resolveMarket(null, "US", "BG")).toBe("BG");
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
  it("retains slot labels when activity reorders the list and discards unverified stored IDs", () => {
    expect(
      assignWorkspaceSlots(["second", "first"], ["first", "second"]),
    ).toEqual(["first", "second"]);
    expect(
      assignWorkspaceSlots(["second", "replacement"], ["deleted", "second"]),
    ).toEqual(["replacement", "second"]);
    expect(assignWorkspaceSlots(["allowed"], ["forged", "allowed"])).toEqual([
      null,
      "allowed",
    ]);
  });
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
  it("supports starting Workspace 2 first and keeps both conversations in stable slots", async () => {
    const second = await browserCreateWorkspace();
    browserRememberWorkspaceSlot(second.id, 1);
    expect(await browserWorkspaceSlots()).toEqual([null, second.id]);
    const first = await browserCreateWorkspace();
    browserRememberWorkspaceSlot(first.id, 0);
    await browserWorkspaceAction(second, "ask", "What SQL experience?");
    expect(await browserWorkspaceSlots()).toEqual([first.id, second.id]);
    await expect(browserCreateWorkspace()).rejects.toThrow("slots");
    await browserDeleteWorkspace(first.id);
    expect(await browserWorkspaceSlots()).toEqual([null, second.id]);
    expect((await browserLoadWorkspace(second.id)).questions).toHaveLength(1);
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
  it.each([
    ["list", () => browserListWorkspaces()],
    ["create", () => browserCreateWorkspace()],
    [
      "load",
      () => browserLoadWorkspace("00000000-0000-4000-8000-000000000001"),
    ],
    [
      "delete",
      () => browserDeleteWorkspace("00000000-0000-4000-8000-000000000001"),
    ],
  ] as const)(
    "bounds stalled %s requests and clears their timeout",
    async (_name, call) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: string, options: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              options.signal!.addEventListener("abort", () =>
                reject(options.signal!.reason),
              );
            }),
        ),
      );
      try {
        const failed = expect(call()).rejects.toThrow(
          "The request timed out. Please try again.",
        );
        await vi.advanceTimersByTimeAsync(30000);
        await failed;
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("also bounds a stalled JSON body after the response headers arrive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, options: RequestInit) =>
          new Response(
            new ReadableStream({
              start(controller) {
                options.signal!.addEventListener("abort", () =>
                  controller.error(options.signal!.reason),
                );
              },
            }),
          ),
      ),
    );
    try {
      const failed = expect(browserListWorkspaces()).rejects.toThrow(
        "The request timed out.",
      );
      await vi.advanceTimersByTimeAsync(30000);
      await failed;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("allows verified actions to run past the old client cutoff while still bounding them", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal;
        return new Promise<Response>((_resolve, reject) => {
          options.signal!.addEventListener("abort", () =>
            reject(options.signal!.reason),
          );
        });
      }),
    );
    try {
      const failed = expect(
        browserWorkspaceAction(
          newWorkspace(randomUUID(), "US", false),
          "ask",
          "What SQL experience?",
        ),
      ).rejects.toThrow("The request timed out.");
      await vi.advanceTimersByTimeAsync(65000);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(240000);
      await failed;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
