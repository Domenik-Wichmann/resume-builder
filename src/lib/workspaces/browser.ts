"use client";
import { workspaceSchema, type Workspace } from "./model";
import { answerSchema, matchSchema } from "../ai/contracts";
import { applyQuestion, applyMatch, deriveTopics } from "./context";
import { fixture } from "../career/fixture";
import {
  compileResumeIR,
  resumeIRSchema,
  expansionQueries,
  type ResumeIR,
} from "../resume-ir";
import { retrieve } from "../career/retrieval";
import { deduplicate } from "../career/utils";
const storageKey = "resume-builder-demo-workspaces-v1";
function demoWorkspaces(): Workspace[] {
  try {
    return workspaceSchema
      .array()
      .max(2)
      .parse(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return [];
  }
}
function saveDemo(workspace: Workspace) {
  const others = demoWorkspaces().filter(
    (candidate) => candidate.id !== workspace.id,
  );
  if (others.length >= 2)
    throw new Error(
      "Both workspace slots are occupied. Delete an old workspace first.",
    );
  localStorage.setItem(storageKey, JSON.stringify([...others, workspace]));
}
async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}
export async function browserListWorkspaces() {
  const response = await json(
    await fetch("/api/workspaces", { cache: "no-store" }),
  );
  return response.mode === "demo"
    ? demoWorkspaces()
    : (response.workspaces as Pick<
        Workspace,
        "id" | "title" | "market" | "updated_at"
      >[]);
}
export async function browserCreateWorkspace() {
  const local = demoWorkspaces();
  const response = await json(
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
  const workspace = workspaceSchema.parse(response.workspace);
  if (workspace.demo) {
    if (local.length >= 2)
      throw new Error(
        "Both workspace slots are occupied. Delete an old workspace first.",
      );
    saveDemo(workspace);
  }
  return workspace;
}
export async function browserLoadWorkspace(id: string) {
  const local = demoWorkspaces().find((workspace) => workspace.id === id);
  if (local) return local;
  return workspaceSchema.parse(
    (await json(await fetch(`/api/workspaces/${id}`, { cache: "no-store" })))
      .workspace,
  );
}
export async function browserDeleteWorkspace(id: string) {
  if (demoWorkspaces().some((workspace) => workspace.id === id)) {
    localStorage.setItem(
      storageKey,
      JSON.stringify(
        demoWorkspaces().filter((workspace) => workspace.id !== id),
      ),
    );
    return;
  }
  await json(await fetch(`/api/workspaces/${id}`, { method: "DELETE" }));
}
export async function browserWorkspaceAction(
  workspace: Workspace,
  action: "ask" | "match" | "compile" | "export",
  input?: string,
): Promise<{ workspace: Workspace; ir?: ResumeIR }> {
  if (!workspace.demo) {
    const body = await json(
      await fetch(`/api/workspaces/${workspace.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(input ? { input } : {}) }),
        signal: AbortSignal.timeout(65000),
      }),
    );
    return {
      workspace: workspaceSchema.parse(body.workspace),
      ir: body.ir ? resumeIRSchema.parse(body.ir) : undefined,
    };
  }
  if (action === "export") return { workspace };
  if (action === "compile") {
    const expanded =
      workspace.evidence.length < 4
        ? expansionQueries(workspace).flatMap((query) =>
            retrieve(fixture, query),
          )
        : [];
    const updated = {
      ...workspace,
      evidence: deduplicate([...workspace.evidence, ...expanded], 60),
    };
    saveDemo(updated);
    return {
      workspace: updated,
      ir: compileResumeIR(fixture, updated, {
        market: workspace.market,
        location:
          workspace.market === "US"
            ? "United States · demo presentation"
            : "Bulgaria · demo presentation",
        contact_email: "",
        phone: "",
        work_authorization: "",
      }),
    };
  }
  const body = await json(
    await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(65000),
    }),
  );
  const evidence = workspaceSchema.shape.evidence.parse(body.evidence);
  const updated =
    action === "ask"
      ? applyQuestion(
          workspace,
          input!,
          answerSchema.parse(body.result),
          evidence,
          deriveTopics(input!, evidence, fixture.skills),
        )
      : applyMatch(workspace, input!, matchSchema.parse(body.result), evidence);
  saveDemo(updated);
  return { workspace: updated };
}
