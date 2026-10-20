// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ResumeReuseForm } from "../src/components/resume-reuse-form";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
let root: Root, container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ResumeReuseForm
        applicationId="00000000-0000-4000-8000-000000000001"
        organization="Fictional company"
        role="Fictional role"
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
it("saves one copy with entered details then opens the new viewer", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: "new-copy", tracking_code: "newcode1" }),
    );
  vi.stubGlobal("fetch", fetcher);
  container.querySelector<HTMLInputElement>('[name="organization"]')!.value =
    "New fictional company";
  container.querySelector<HTMLInputElement>('[name="learning_demo"]')!.value =
    "https://example.invalid/learner";
  await submit();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    action: "reuse",
    organization: "New fictional company",
    role: "Fictional role",
    job_description: "",
    learning_demo: "https://example.invalid/learner",
  });
  expect(navigation.push).toHaveBeenCalledWith("/admin/applications/new-copy");
});
it("retries an interrupted response with the same key and removes the old LMS demo by default", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("interrupted", { status: 504 }))
    .mockResolvedValueOnce(
      Response.json({ id: "new-copy", tracking_code: "newcode1" }),
    );
  vi.stubGlobal("fetch", fetcher);
  await submit();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Retry with the same details",
  );
  await submit();
  const calls = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0].learning_demo).toBeNull();
});
