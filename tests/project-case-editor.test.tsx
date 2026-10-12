// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProjectCaseEditor } from "../src/components/project-case-editor";
import { demoProject, demoCaseStudy } from "../src/lib/portfolio/demo";
it("fills the owner editor automatically and saves a private draft unless publication is explicitly selected", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return Response.json({ draft: demoCaseStudy });
  });
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ProjectCaseEditor project={demoProject} media={[]} skills={[]} />,
      ),
    );
    expect(
      host.querySelector<HTMLInputElement>('input[maxlength="200"]')?.value,
    ).toBe(demoProject.title);
    expect(host.textContent).toContain("Fill from Career Brain");
    const save = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Save private draft",
    )!;
    await act(async () => save.click());
    const body = JSON.parse(fetch.mock.calls[1][1]!.body as string) as {
      action: string;
      draft: { is_public: boolean };
    };
    expect(body.action).toBe("save");
    expect(body.draft.is_public).toBe(false);
    expect(host.textContent).toContain("Private case-study draft saved");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
