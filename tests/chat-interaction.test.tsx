// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CareerChat } from "../src/components/career-chat";
import { newWorkspace, type Workspace } from "../src/lib/workspaces/model";

const browser = vi.hoisted(() => ({
  browserWorkspaceSlots: vi.fn(),
  browserLoadWorkspace: vi.fn(),
  browserCreateWorkspace: vi.fn(),
  browserWorkspaceAction: vi.fn(),
  browserRememberWorkspaceSlot: vi.fn(),
}));
vi.mock("../src/lib/workspaces/browser", () => browser);
vi.mock("../src/components/human-verification", () => ({
  HumanVerification: () => null,
}));
vi.mock("../src/components/evidence-map", () => ({ EvidenceMap: () => null }));
vi.mock("../src/components/recruiter-explorer", () => ({
  RecruiterExplorer: () => null,
}));

let root: Root;
let container: HTMLDivElement;
const workspace = newWorkspace(
  "00000000-0000-4000-8000-000000000001",
  "US",
  true,
);
const question = "What SQL experience?\n  Keep my wording.";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function mount(initialWorkspace: Workspace | null = workspace) {
  await act(async () => {
    root.render(
      <CareerChat
        initialWorkspace={initialWorkspace}
        initialInput={question}
      />,
    );
  });
}
async function send() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
function field() {
  return container.querySelector("textarea")!;
}
function sendButton() {
  return container.querySelector<HTMLButtonElement>(".composer-send")!;
}
function answered() {
  return {
    ...workspace,
    questions: [
      {
        question,
        answer: "Published SQL evidence.",
        evidence_ids: [],
        topics: [],
        created_at: workspace.created_at,
      },
    ],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  browser.browserWorkspaceSlots.mockResolvedValue([workspace.id, null]);
  browser.browserLoadWorkspace.mockResolvedValue(workspace);
  browser.browserCreateWorkspace.mockResolvedValue(workspace);
  vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows the exact message and clears the composer before workspace creation finishes", async () => {
  browser.browserWorkspaceSlots.mockResolvedValue([null, null]);
  const creation = deferred<Workspace>();
  const answer = deferred<{ workspace: Workspace }>();
  browser.browserCreateWorkspace.mockReturnValue(creation.promise);
  browser.browserWorkspaceAction.mockReturnValue(answer.promise);
  await mount(null);
  await send();
  expect(field().value).toBe("");
  expect(document.activeElement).toBe(field());
  expect(container.querySelector(".question-bubble")?.textContent).toBe(
    `You: ${question}`,
  );
  expect(container.querySelector(".answer-waiting")).not.toBeNull();
  const bubble = container.querySelector(".question-bubble");
  expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledOnce();
  expect(sendButton().getAttribute("aria-busy")).toBe("true");
  expect(browser.browserWorkspaceAction).not.toHaveBeenCalled();
  await send();
  expect(browser.browserCreateWorkspace).toHaveBeenCalledOnce();
  await act(async () => creation.resolve(workspace));
  expect(browser.browserWorkspaceAction).toHaveBeenCalledWith(
    workspace,
    "ask",
    question,
  );
  await act(async () => answer.resolve({ workspace: answered() }));
  expect(container.querySelectorAll(".question-bubble")).toHaveLength(1);
  expect(container.querySelector(".question-bubble")).toBe(bubble);
  expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledOnce();
  expect(container.querySelector(".answer-waiting")).toBeNull();
  expect(container.textContent).toContain("Published SQL evidence.");
  expect(sendButton().getAttribute("aria-busy")).toBe("false");
  expect(field().readOnly).toBe(false);
});

it("restores unsent text and releases the send lock after a request failure", async () => {
  const answer = deferred<{ workspace: Workspace }>();
  browser.browserWorkspaceAction.mockReturnValue(answer.promise);
  await mount();
  await send();
  await act(async () => answer.reject(new Error("The request timed out.")));
  expect(field().value).toBe(question);
  expect(sendButton().disabled).toBe(false);
  expect(field().readOnly).toBe(false);
  expect(container.querySelector(".pending-answer")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "The request timed out.",
  );
  browser.browserWorkspaceAction.mockResolvedValue({ workspace: answered() });
  await send();
  expect(browser.browserWorkspaceAction).toHaveBeenCalledTimes(2);
  expect(field().value).toBe("");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("can retry failed initialization rather than keeping Send permanently disabled", async () => {
  browser.browserWorkspaceSlots.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(sendButton().disabled).toBe(true);
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(".workspace-load-retry")!
      .click();
  });
  expect(browser.browserWorkspaceSlots).toHaveBeenCalledTimes(2);
  expect(sendButton().disabled).toBe(false);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("resumes the last saved chat across sessions and ignores selection hints outside the owned slots", async () => {
  const second = { ...answered(), id: "00000000-0000-4000-8000-000000000002" };
  localStorage.setItem("rb_selected_workspace", second.id);
  browser.browserWorkspaceSlots.mockResolvedValue([workspace.id, second.id]);
  browser.browserLoadWorkspace.mockResolvedValue(second);
  await mount(null);
  expect(browser.browserLoadWorkspace).toHaveBeenCalledWith(second.id);
  expect(
    container
      .querySelector('select[aria-label="Saved conversation"]')
      ?.getAttribute("aria-label"),
  ).toBe("Saved conversation");
  expect(container.textContent).toContain("Published SQL evidence.");
  await act(async () => root.unmount());
  root = createRoot(container);
  sessionStorage.clear();
  localStorage.setItem("rb_selected_workspace", "forged-private-id");
  browser.browserLoadWorkspace.mockClear().mockResolvedValue(workspace);
  await mount(null);
  expect(browser.browserLoadWorkspace).toHaveBeenCalledWith(workspace.id);
  expect(browser.browserLoadWorkspace).not.toHaveBeenCalledWith(
    "forged-private-id",
  );
});

it("keeps a committed role match when its automatic resume preview fails", async () => {
  const matched: Workspace = {
    ...workspace,
    job_description: question,
    match: {
      overall_summary: "Stored role fit.",
      strong_matches: [],
      supporting_experience: [],
      skills: [],
      gaps: [],
      suggested_resume_emphasis: [],
    },
  };
  browser.browserWorkspaceAction
    .mockResolvedValueOnce({ workspace: matched })
    .mockRejectedValueOnce(new Error("Preview unavailable"));
  await mount();
  await act(async () => {
    const mode = container.querySelector<HTMLSelectElement>(
      '.composer-tools select:not([aria-label="Workspace"])',
    )!;
    mode.value = "match";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await send();
  expect(browser.browserWorkspaceAction).toHaveBeenNthCalledWith(
    1,
    workspace,
    "match",
    question,
  );
  expect(browser.browserWorkspaceAction).toHaveBeenNthCalledWith(
    2,
    matched,
    "compile",
  );
  expect(field().value).toBe("");
  expect(container.textContent).toContain("Stored role fit.");
  expect(container.querySelectorAll(".question-bubble")).toHaveLength(1);
  expect(sendButton().getAttribute("aria-busy")).toBe("false");
});

it("drafts hero suggestions in the existing composer without sending or creating a workspace", async () => {
  await mount();
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("portfolio-question", {
        detail: "How have you used SQL?",
      }),
    );
  });
  expect(field().value).toBe("How have you used SQL?");
  expect(document.activeElement).toBe(field());
  expect(browser.browserCreateWorkspace).not.toHaveBeenCalled();
  expect(browser.browserWorkspaceAction).not.toHaveBeenCalled();
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("portfolio-question", { detail: { text: "invalid" } }),
    );
  });
  expect(field().value).toBe("How have you used SQL?");
});

it("waits for owned slots before submitting a hero question exactly once and preserves failed input", async () => {
  const slots = deferred<[string | null, string | null]>();
  const answer = deferred<{ workspace: Workspace }>();
  browser.browserWorkspaceSlots.mockReturnValue(slots.promise);
  browser.browserWorkspaceAction.mockReturnValue(answer.promise);
  const request = { id: 1, input: question, kind: "ask" as const };
  const render = () => root.render(<CareerChat heroSubmission={request} />);
  await act(async () => render());
  expect(browser.browserWorkspaceAction).not.toHaveBeenCalled();
  expect(field().value).toBe(question);
  await act(async () => slots.resolve([workspace.id, null]));
  expect(browser.browserWorkspaceAction).toHaveBeenCalledExactlyOnceWith(
    workspace,
    "ask",
    question,
  );
  await act(async () => render());
  expect(browser.browserWorkspaceAction).toHaveBeenCalledTimes(1);
  await act(async () =>
    answer.reject(new Error("Please complete human verification.")),
  );
  expect(field().value).toBe(question);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "human verification",
  );
  expect(browser.browserWorkspaceAction).toHaveBeenCalledTimes(1);
});

it("submits a hero job description as a match even when returning to an existing conversation", async () => {
  const description =
    "Responsibilities: build systems. Required skills: SQL and automation.";
  const existing = answered();
  const matched = { ...existing, job_description: description };
  browser.browserLoadWorkspace.mockResolvedValue(existing);
  browser.browserWorkspaceAction.mockResolvedValue({ workspace: matched });
  await act(async () =>
    root.render(
      <CareerChat
        heroSubmission={{ id: 1, input: description, kind: "match" }}
      />,
    ),
  );
  expect(browser.browserWorkspaceAction).toHaveBeenNthCalledWith(
    1,
    existing,
    "match",
    description,
  );
  expect(browser.browserWorkspaceAction).toHaveBeenNthCalledWith(
    2,
    matched,
    "compile",
  );
  expect(browser.browserWorkspaceAction).toHaveBeenCalledTimes(2);
});
