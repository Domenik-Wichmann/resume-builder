// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { fixture } from "../src/lib/career/fixture";
import { portfolioStory } from "../src/lib/portfolio/story";
import { finalStoryStep, storyScenes } from "../src/lib/portfolio/story-scenes";
const navigation = vi.hoisted(() => ({
  step: 0,
  chat: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../src/components/story-navigation", () => ({
  useStoryNavigation: () => ({ root: { current: null }, ...navigation }),
}));
import { PortfolioStoryHero } from "../src/components/portfolio-story";

it("introduces the project without region controls or an immediate chat bypass, and reserves drafting for the final scene", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const draft = vi.fn();
  window.addEventListener("portfolio-question", draft);
  const render = () =>
    root.render(
      <PortfolioStoryHero
        story={portfolioStory(fixture)}
        presentation={{
          market: "US",
          location: "Configured residence",
          phone: "",
          contact_email: "",
          work_authorization: "",
        }}
      />,
    );
  try {
    await act(async () => render());
    const active = () => host.querySelector(".story-scene:not([hidden])")!;
    expect(active().textContent).toContain(
      "This portfolio is one of my projects.",
    );
    expect(active().querySelector('[href="#ask"]')).toBeNull();
    expect(host.querySelector("select, .market-switch")).toBeNull();
    expect(host.textContent).not.toContain("Skip to chat");
    expect(host.querySelectorAll(".story-scene")).toHaveLength(
      storyScenes.length,
    );
    await act(async () =>
      active().querySelector<HTMLButtonElement>(".story-links button")!.click(),
    );
    expect(navigation.navigate).toHaveBeenCalledWith(1);
    expect(navigation.chat).not.toHaveBeenCalled();
    navigation.step = 3;
    await act(async () => render());
    expect(
      active().querySelector('[href="#ask"], .story-questions button'),
    ).toBeNull();
    expect(active().textContent).toContain(fixture.projects[0].summary);
    navigation.step = finalStoryStep;
    await act(async () => render());
    expect(active().querySelector('[href="#ask"]')?.textContent).toContain(
      "Explore my experience",
    );
    await act(async () =>
      active()
        .querySelector<HTMLButtonElement>(".story-questions button")!
        .click(),
    );
    expect(navigation.chat).toHaveBeenCalledOnce();
    expect(draft).toHaveBeenCalledOnce();
    expect((draft.mock.calls[0][0] as CustomEvent<string>).detail).toBe(
      portfolioStory(fixture).questions[0],
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.removeEventListener("portfolio-question", draft);
    navigation.step = 0;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  }
});
