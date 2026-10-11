// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const browser = vi.hoisted(() => ({
  browserListWorkspaces: vi.fn(),
  browserCreateWorkspace: vi.fn(),
  browserDeleteWorkspace: vi.fn(),
}));
vi.mock("../src/lib/workspaces/browser", () => browser);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { WorkspaceList } from "../src/components/workspace-list";

it("shows loading and retry states instead of claiming saved history is empty", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let reject!: (error: Error) => void;
  browser.browserListWorkspaces.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<WorkspaceList />));
    expect(host.textContent).toContain("Loading your saved chats");
    expect(host.textContent).not.toContain("No saved chats");
    await act(async () => reject(new Error("Offline")));
    expect(host.textContent).toContain("Offline");
    expect(host.textContent).not.toContain("No saved chats");
    browser.browserListWorkspaces.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Saved sample conversation",
        market: "US",
        updated_at: "2026-01-01",
      },
    ]);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(),
    );
    expect(host.textContent).toContain("Saved sample conversation");
    expect(host.textContent).not.toContain("Offline");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  }
});
