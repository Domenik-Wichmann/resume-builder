// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RichProjectEvidence } from "../src/components/rich-project-evidence";
import { CareerChatWelcome } from "../src/components/career-chat-welcome";
import { RichCareerAnswer } from "../src/components/rich-career-answer";
import { projectContextSchema } from "../src/lib/portfolio/project-context";

it("follows published skill connections and filters project cards with keyboard-accessible buttons", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const data = projectContextSchema.parse({
    projects: [
      {
        title: "Fictional catalog",
        url: "/projects/catalog",
        summary: "A fictional catalog.",
        skills: ["SQL", "Validation"],
        links: [],
        images: [],
      },
      {
        title: "Fictional learning",
        url: "/projects/learning",
        summary: "A fictional course.",
        skills: ["SQL", "Learning design"],
        links: [],
        images: [],
      },
    ],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<RichProjectEvidence projects={data.projects} />),
    );
    expect(host.querySelectorAll("article")).toHaveLength(2);
    const button = (text: string) =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === text)!;
    await act(async () => button("Connections").click());
    expect(host.querySelectorAll("svg path")).toHaveLength(4);
    await act(async () => button("Validation").click());
    expect(button("Validation").getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.querySelector("article")?.textContent).toContain(
      "Fictional catalog",
    );
    await act(async () => button("Show all").click());
    expect(host.querySelectorAll("article")).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("starter cards draft a question without sending requests and copy exports readable visual content", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const clipboard = {
    writeText: vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  vi.stubGlobal("navigator", { clipboard });
  const drafted = vi.fn();
  window.addEventListener("portfolio-question", drafted);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <>
          <CareerChatWelcome />
          <RichCareerAnswer
            text={
              'A fictional answer.\n\n```career-flow\n{"title":"Fictional flow","steps":[{"title":"Receive","detail":"Keep input."},{"title":"Review","detail":"Inspect changes."}]}\n```'
            }
          />
        </>,
      ),
    );
    await act(async () =>
      host.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(drafted).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    const copy = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Copy answer",
    )!;
    await act(async () => copy.click());
    expect(clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("1. Receive: Keep input."),
    );
    expect(clipboard.writeText.mock.calls[0][0]).not.toContain('"steps"');
    expect(host.textContent).toContain("Copied");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.removeEventListener("portfolio-question", drafted);
    vi.unstubAllGlobals();
  }
});
