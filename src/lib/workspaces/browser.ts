"use client";
import { z } from "zod";
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
import {
  assignWorkspaceSlots,
  type WorkspaceSlot,
  type WorkspaceSlots,
} from "./slots";
const storageKey = "resume-builder-demo-workspaces-v1";
const slotsKey = "resume-builder-workspace-slots-v1";
function storedSlots(): WorkspaceSlots {
  try {
    const parsed = workspaceSchema.shape.id
      .nullable()
      .array()
      .length(2)
      .parse(JSON.parse(localStorage.getItem(slotsKey) || "[]"));
    return [parsed[0], parsed[1]];
  } catch {
    return [null, null];
  }
}
export async function browserWorkspaceSlots(): Promise<WorkspaceSlots> {
  const workspaces = await browserListWorkspaces();
  const slots = assignWorkspaceSlots(
    workspaces.map((value) => value.id),
    storedSlots(),
  );
  localStorage.setItem(slotsKey, JSON.stringify(slots));
  return slots;
}
export function browserRememberWorkspaceSlot(id: string, slot: WorkspaceSlot) {
  const previous = storedSlots();
  const slots: WorkspaceSlots = [
    previous[0] === id ? null : previous[0],
    previous[1] === id ? null : previous[1],
  ];
  slots[slot] = id;
  localStorage.setItem(slotsKey, JSON.stringify(slots));
}
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
async function requestJson(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
    });
    const body = z
      .object({ error: z.string().optional() })
      .passthrough()
      .parse(await response.json());
    if (!response.ok) throw new Error(body.error || "Request failed.");
    return body;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function browserListWorkspaces() {
  const response = await requestJson("/api/workspaces", { cache: "no-store" });
  return response.mode === "demo"
    ? demoWorkspaces()
    : (response.workspaces as Pick<
        Workspace,
        "id" | "title" | "market" | "updated_at"
      >[]);
}
export async function browserCreateWorkspace() {
  const local = demoWorkspaces();
  const response = await requestJson("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
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
    (await requestJson(`/api/workspaces/${id}`, { cache: "no-store" }))
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
  await requestJson(`/api/workspaces/${id}`, { method: "DELETE" });
}
export async function browserWorkspaceAction(
  workspace: Workspace,
  action: "ask" | "match" | "compile" | "export",
  input?: string,
): Promise<{ workspace: Workspace; ir?: ResumeIR }> {
  if (!workspace.demo) {
    const body = await requestJson(
      `/api/workspaces/${workspace.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(input ? { input } : {}) }),
      },
      // Allow the server's 300-second action limit to finish before aborting.
      305000,
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
  const body = await requestJson(
    `/api/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    },
    305000,
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
