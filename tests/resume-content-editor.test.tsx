// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResumeContentEditor } from "../src/components/resume-content-editor";
import {
  clearSignalContent,
  type FixedContent,
} from "../src/lib/resume-design/fixed-content";
import babycat from "./fixtures/owner-approved-babycat.json";
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const draft: FixedContent = {
  ...clearSignalContent,
  version: 4,
  projects: [...clearSignalContent.projects, babycat],
};
let root: Root, container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ResumeContentEditor initial={draft} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function button(text: string) {
  const result = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function content(): FixedContent {
  return JSON.parse(
    container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Approved project text, links and invitations"]',
    )!.value,
  );
}
it("keeps the supplied text intact, requires an explicit unbinding choice and then saves successfully", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        {
          code: "INVALID_PROJECT",
          error: "Unavailable evidence link",
          invalid_bindings: [
            {
              id: babycat.id,
              title: babycat.title,
              record_id: babycat.record_id,
            },
          ],
          project_options: [],
        },
        { status: 422 },
      ),
    )
    .mockImplementationOnce(async (_url: string, options: RequestInit) =>
      Response.json({
        content: { ...JSON.parse(String(options.body)).content, version: 5 },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await act(async () => button("Save approved content").click());
  expect(content().projects[2]).toEqual(babycat);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(content().projects[2]).toEqual({ ...babycat, record_id: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => button("Save approved content").click());
  expect(JSON.parse(fetcher.mock.calls[1][1].body).content.projects[2]).toEqual(
    { ...babycat, record_id: null },
  );
  expect(content().version).toBe(5);
  expect(container.textContent).toContain("Saved for future applications");
});
it("can replace an unavailable binding with the owner's selected project", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          code: "INVALID_PROJECT",
          error: "Unavailable evidence link",
          invalid_bindings: [
            {
              id: babycat.id,
              title: babycat.title,
              record_id: babycat.record_id,
            },
          ],
          project_options: [
            { id, title: "Explicitly fictional project choice" },
          ],
        },
        { status: 422 },
      ),
    ),
  );
  await act(async () => button("Save approved content").click());
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(content().projects[2]).toEqual({ ...babycat, record_id: id });
});
it("preserves the draft during a stale conflict and requires review before replacing the saved revision", async () => {
  const latest = {
    ...clearSignalContent,
    version: 8,
    closing: "Explicitly fictional concurrent owner edit",
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { code: "STALE_CONTENT", error: "Review the latest saved content" },
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ fixed: latest }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => button("Save approved content").click());
  expect(content()).toEqual(draft);
  await act(async () => button("Review latest saved content").click());
  expect(content()).toEqual(draft);
  expect(
    container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Latest saved content"]',
    )!.value,
  ).toContain(latest.closing);
  await act(async () =>
    button("Keep my draft using this saved revision").click(),
  );
  expect(content()).toEqual({ ...draft, version: 8 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
