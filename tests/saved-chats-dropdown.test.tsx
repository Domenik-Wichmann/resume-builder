// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../src/lib/workspaces/browser", () => ({
  browserListWorkspaces: mocks.list,
}));
import { SavedChatsDropdown } from "../src/components/saved-chats-dropdown";

it("opens saved chats inline, uses verified slots, and selects without navigating", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.list.mockResolvedValue([
    { id: "owned", title: "SQL conversation" },
    { id: "not-in-slots", title: "Unrelated title" },
  ]);
  const select = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <SavedChatsDropdown
          slots={["owned", null]}
          activeSlot={0}
          busy={false}
          ready
          onSelect={select}
        />,
      ),
    );
    expect(mocks.list).not.toHaveBeenCalled();
    await act(async () => host.querySelector("summary")!.click());
    expect(host.querySelector("details")?.open).toBe(true);
    expect(host.textContent).toContain("SQL conversation");
    expect(host.textContent).not.toContain("Unrelated title");
    expect(host.querySelector("a")).toBeNull();
    const newChat = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("New chat"),
    )!;
    await act(async () => newChat.click());
    expect(select).toHaveBeenCalledExactlyOnceWith(1);
    expect(host.querySelector("details")?.open).toBe(false);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});

it("offers a draft-only new chat when empty and blocks switching while busy", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.list.mockResolvedValue([]);
  const select = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <SavedChatsDropdown
          slots={[null, null]}
          activeSlot={0}
          busy
          ready
          onSelect={select}
        />,
      ),
    );
    await act(async () => host.querySelector("summary")!.click());
    expect(host.textContent).toContain("No saved chats yet.");
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async () => host.querySelector("button")!.click());
    expect(select).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});
