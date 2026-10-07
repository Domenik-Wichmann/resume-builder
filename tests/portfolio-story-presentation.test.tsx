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
it("introduces the owner first and expands public answers without navigation, drafting or provider calls", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const draft = vi.fn();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  window.addEventListener("portfolio-question", draft);
  const story = portfolioStory(fixture);
  const render = () =>
    root.render(
      <PortfolioStoryHero
        story={story}
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
    expect(active().textContent).toContain(story.profile.name);
    expect(active().textContent).not.toContain("recursive portfolio");
    expect(active().querySelector('[href="#ask"]')).toBeNull();
    expect(host.querySelector("select, .market-switch")).toBeNull();
    expect(host.querySelectorAll(".story-scene")).toHaveLength(9);
    expect(storyScenes.map((scene) => scene.chapter)).toEqual([
      "Intro",
      "The Project",
      "Import",
      "Structure",
      "Diff",
      "Use",
      "Feedback",
      "Stack",
      "Ask Me Anything",
    ]);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(".story-intro-handoff > button")!
        .click(),
    );
    expect(navigation.navigate).toHaveBeenCalledWith(1);
    expect(navigation.chat).not.toHaveBeenCalled();
    navigation.step = 1;
    await act(async () => render());
    expect(active().textContent).toContain("the project runs the portfolio");
    navigation.step = finalStoryStep;
    await act(async () => render());
    const button = active().querySelector<HTMLButtonElement>(
      ".question-example > button",
    )!;
    const initialHash = location.hash;
    const initialY = window.scrollY;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const answer = document.getElementById(
      button.getAttribute("aria-controls")!,
    )!;
    expect(answer.hidden).toBe(false);
    expect(answer.textContent).toContain(
      story.questionExamples[0].items[0].details[0],
    );
    expect(location.hash).toBe(initialHash);
    expect(window.scrollY).toBe(initialY);
    expect(navigation.chat).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => button.click());
    expect(answer.hidden).toBe(true);
    const handoff =
      host.querySelector<HTMLAnchorElement>(".story-handoff > a")!;
    expect(handoff.textContent).toContain("Explore my experience");
    await act(async () => handoff.click());
    expect(navigation.chat).toHaveBeenCalledOnce();
    expect(draft).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.removeEventListener("portfolio-question", draft);
    navigation.step = 0;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  }
});
