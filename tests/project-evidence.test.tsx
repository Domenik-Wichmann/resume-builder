// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ProjectEvidence } from "../src/components/project-evidence";
it("renders published project links and screenshots beside an answer without changing the answer or calling AI", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn(async () =>
    Response.json({
      projects: [
        {
          title: "Fictional project",
          url: "/projects/fictional-project",
          images: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              alt: "Fictional graph review",
              caption: "Fictional approval controls",
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ProjectEvidence
          ids={["11111111-1111-4111-8111-111111111111"]}
          query="graph review"
        />,
      ),
    );
    expect(host.querySelector("img")?.getAttribute("alt")).toBe(
      "Fictional graph review",
    );
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      "/projects/fictional-project",
    );
    expect(host.querySelector("figcaption")?.textContent).toBe(
      "Fictional approval controls",
    );
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/project-context",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("graph review"),
      }),
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
