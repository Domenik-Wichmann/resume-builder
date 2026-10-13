// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProjectCaseEditor } from "../src/components/project-case-editor";
import { demoProject, demoCaseStudy } from "../src/lib/portfolio/demo";
import {
  caseStudySchema,
  type CaseStudy,
} from "../src/lib/portfolio/case-study";
import { newProjectLink } from "../src/lib/portfolio/edit-links";
import { ProjectDisplay } from "../src/components/project-display";
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
it("keeps custom project links when refilling page text and sends them to the case-study store", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const custom = {
    ...newProjectLink("LIVE", 0),
    url: "https://custom.example.com",
  };
  const generated = {
    ...newProjectLink("GITHUB", 0),
    url: "https://github.com/example/fictional",
  };
  let saved: CaseStudy | undefined;
  const fetch = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string) as {
      action: string;
      draft?: unknown;
    };
    if (body.action === "save") saved = caseStudySchema.parse(body.draft);
    return Response.json({
      draft: saved || {
        ...demoCaseStudy,
        content: {
          ...demoCaseStudy.content,
          links: [body.action === "fill" ? generated : custom],
        },
      },
    });
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
    const button = (text: string) =>
      [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
        item.textContent?.includes(text),
      )!;
    await act(async () => button("Fill from Career Brain").click());
    await act(async () =>
      root.render(
        <ProjectCaseEditor
          project={demoProject}
          media={[]}
          skills={[]}
          section="links"
        />,
      ),
    );
    expect(
      [
        ...host.querySelectorAll<HTMLInputElement>('input[inputmode="url"]'),
      ].map((input) => input.value),
    ).toEqual([custom.url, generated.url]);
    await act(async () => button("Save private draft").click());
    expect(saved?.content.links.map((link) => link.url)).toEqual([
      custom.url,
      generated.url,
    ]);
    expect(saved?.is_public).toBe(false);
    expect(saved?.content.links.map((link) => link.display_order)).toEqual([
      0, 1,
    ]);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
it("never turns an unsafe unsaved preview link into a clickable action", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ProjectDisplay
          project={demoProject}
          content={{
            ...demoCaseStudy.content,
            links: [
              { ...newProjectLink("LIVE", 0), url: "javascript:alert(1)" },
            ],
          }}
          media={[]}
          skills={[]}
          outcomes={[]}
        />,
      ),
    );
    expect(host.querySelector('a[href^="javascript:"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
