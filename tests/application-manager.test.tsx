// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApplicationManager } from "../src/components/application-manager";
import type { applicationDashboard } from "../src/lib/applications/repository";
import { designPreview } from "../src/lib/resume-design/preview";
import { withTrackingUrl } from "../src/lib/resume-design/fixed-content";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
type Dashboard = Awaited<ReturnType<typeof applicationDashboard>>;
const data: Dashboard = {
  applications: [
    {
      id: "saved",
      organization: "Fictional employer",
      role: "Demonstration role",
      status: "DRAFT",
      market: "BG",
      generated_at: "2026-10-10T00:00:00Z",
      code: "testcode",
      strategy: "TRADITIONAL",
      activity: {
        visits: 3,
        questions: 2,
        exports: 1,
        previews: 0,
        workspaces: 1,
        engagement: 0,
      },
    },
  ],
  experiments: [],
  analytics: [],
  suggestions: [],
  truncated: false,
};
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ApplicationManager data={data} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows the saved tracked resume immediately with export and analytics controls, without a second save action", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ preview_id: "draft" }))
      .mockResolvedValueOnce(
        Response.json({
          stage: 4,
          id: "00000000-0000-4000-8000-000000000001",
          tracking_code: "saved001",
          strategy: "TRADITIONAL",
          options: {
            TRADITIONAL: withTrackingUrl(
              { ...designPreview, portfolio_url: "https://portfolio.test" },
              "saved001",
            ),
          },
          review: ["Fictional review note"],
        }),
      ),
  );
  await act(async () =>
    container
      .querySelector("#create-resume form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  const sheet = container.querySelector(".resume-design")!;
  const composition = Array.from(container.querySelectorAll("h3")).find(
    (label) => label.textContent?.includes("Saved resume & tracking"),
  )!;
  expect(sheet).not.toBeNull();
  expect(composition).toBeDefined();
  expect(
    sheet.compareDocumentPosition(composition) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const review = Array.from(container.querySelectorAll("details")).find(
    (detail) => detail.textContent?.includes("Fictional review note"),
  );
  expect(review?.open).toBe(false);
  expect(container.textContent).toContain("Print preview");
  expect(
    container.querySelector(".resume-regenerate-controls button")?.textContent,
  ).toBe("Regenerate résumé");
  expect(
    container.querySelector(".resume-export-controls select")?.textContent,
  ).toContain("DOC (Word-compatible)");
  expect(container.textContent).toContain("Download PDF");
  expect(container.textContent).toContain("saved001");
  expect(container.textContent).not.toContain("Tracking link pending");
  expect(container.textContent).not.toContain("Draft download");
  expect(
    container.querySelector('a[href="https://portfolio.test/r/saved001"]'),
  ).not.toBeNull();
  expect(
    container.querySelector(
      'a[href="/admin/applications/00000000-0000-4000-8000-000000000001"]',
    ),
  ).not.toBeNull();
  expect(navigation.refresh).toHaveBeenCalled();
  expect(navigation.push).not.toHaveBeenCalled();
  expect(localStorage.getItem("resume-application-draft")).toBeNull();
});

it("retains the draft and withholds downloads when tracking finalization is incomplete", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ preview_id: "draft" }))
      .mockResolvedValueOnce(
        Response.json({ stage: 4, options: { TRADITIONAL: designPreview } }),
      ),
  );
  await act(async () =>
    container
      .querySelector("#create-resume form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(container.querySelector(".resume-export-controls")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "tracking link is not saved",
  );
  expect(localStorage.getItem("resume-application-draft")).toBe("draft");
});

it("places saved résumés before creation and exposes a link to their analytics", () => {
  expect(container.querySelector("section")?.textContent).toContain(
    "Saved résumés",
  );
  expect(
    container.querySelector(".resume-card-link")?.getAttribute("href"),
  ).toBe("/admin/applications/saved");
  expect(container.querySelector(".resume-card-stats")?.textContent).toContain(
    "3 visits",
  );
  expect(
    container.querySelector(".resume-advanced")?.hasAttribute("open"),
  ).toBe(false);
});

it("sends the explicitly selected résumé region and preserves a retryable draft on interrupted responses", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ preview_id: "draft" }))
    .mockResolvedValueOnce(new Response("Gateway timeout", { status: 504 }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () =>
    container
      .querySelector<HTMLInputElement>(
        'input[name="resume-region"][value="BG"]',
      )!
      .click(),
  );
  await act(async () =>
    container
      .querySelector("#create-resume form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(
    JSON.parse(fetcher.mock.calls[0][1].body).application.metadata.market,
  ).toBe("BG");
  expect(localStorage.getItem("resume-application-draft")).toBe("draft");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "server response was interrupted",
  );
  expect(container.textContent).toContain("Retry saved generation");
});
