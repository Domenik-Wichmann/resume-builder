// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResumeRegenerateButton } from "../src/components/resume-regenerate-button";
import { designPreview } from "../src/lib/resume-design/preview";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
let root: Root;
let container: HTMLDivElement;
const ready = () =>
  Response.json({
    stage: 4,
    id: "new-version",
    tracking_code: "newcode1",
    options: { TRADITIONAL: designPreview },
  });
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(<ResumeRegenerateButton applicationId="old-version" />),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function click() {
  await act(async () => container.querySelector("button")!.click());
}
it("runs every generation stage and opens a distinct saved version", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ preview_id: "new-draft" }))
    .mockResolvedValueOnce(
      Response.json({ stage: 0, label: "Understanding the job" }),
    )
    .mockResolvedValueOnce(
      Response.json({ stage: 1, label: "Finding evidence" }),
    )
    .mockResolvedValueOnce(Response.json({ stage: 2, label: "Writing" }))
    .mockResolvedValueOnce(Response.json({ stage: 3, label: "Verifying" }))
    .mockResolvedValueOnce(ready());
  vi.stubGlobal("fetch", fetcher);
  await click();
  expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
    { action: "regenerate", id: "old-version" },
    { action: "status", preview_id: "new-draft" },
    ...[0, 1, 2, 3].map((stage) => ({
      action: "generate",
      preview_id: "new-draft",
      stage,
    })),
  ]);
  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/applications/new-version",
  );
  expect(navigation.refresh).toHaveBeenCalledOnce();
  expect(localStorage.getItem("resume-application-draft")).toBeNull();
});
it("retries the interrupted new draft instead of creating another version", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ preview_id: "retry-draft" }))
    .mockResolvedValueOnce(new Response("Gateway timeout", { status: 504 }))
    .mockResolvedValueOnce(Response.json({ stage: 3, label: "Verify facts" }))
    .mockResolvedValueOnce(ready());
  vi.stubGlobal("fetch", fetcher);
  await click();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "interrupted",
  );
  expect(container.querySelector("button")?.textContent).toBe(
    "Retry regeneration",
  );
  expect(localStorage.getItem("resume-application-draft")).toBe("retry-draft");
  await click();
  expect(
    fetcher.mock.calls.filter(
      (call) => JSON.parse(call[1].body).action === "regenerate",
    ),
  ).toHaveLength(1);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
    action: "status",
    preview_id: "retry-draft",
  });
  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/applications/new-version",
  );
});

it("starts fresh if the original viewer is revisited after successful regeneration", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ preview_id: "first-draft" }))
    .mockResolvedValueOnce(ready())
    .mockResolvedValueOnce(Response.json({ preview_id: "second-draft" }))
    .mockResolvedValueOnce(ready());
  vi.stubGlobal("fetch", fetcher);
  await click();
  await click();
  expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
    { action: "regenerate", id: "old-version" },
    { action: "status", preview_id: "first-draft" },
    { action: "regenerate", id: "old-version" },
    { action: "status", preview_id: "second-draft" },
  ]);
});
it("disables regeneration while a request is running and ignores repeated clicks", async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(pending)
    .mockResolvedValueOnce(ready());
  vi.stubGlobal("fetch", fetcher);
  await act(async () => {
    container.querySelector("button")!.click();
    container.querySelector("button")!.click();
  });
  expect(container.querySelector("button")!.disabled).toBe(true);
  expect(container.textContent).toContain("Regenerating…");
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => resolve(Response.json({ preview_id: "new-draft" })));
  expect(navigation.push).toHaveBeenCalledOnce();
});
it("keeps the retryable draft when a completed result has no saved tracking link", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ preview_id: "new-draft" }))
      .mockResolvedValueOnce(
        Response.json({ stage: 4, options: { TRADITIONAL: designPreview } }),
      ),
  );
  await click();
  expect(navigation.push).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "not saved yet",
  );
  expect(localStorage.getItem("resume-application-draft")).toBe("new-draft");
});
it("can finish when browser storage is disabled", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage disabled");
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ preview_id: "new-draft" }))
      .mockResolvedValueOnce(ready()),
  );
  await click();
  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/applications/new-version",
  );
});
