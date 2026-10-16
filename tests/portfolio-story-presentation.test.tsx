// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { fixture } from "../src/lib/career/fixture";
import { portfolioStory } from "../src/lib/portfolio/story";
import { finalStoryStep } from "../src/lib/portfolio/story-scenes";
const navigation = vi.hoisted(() => ({
  step: 1,
  mobile: false,
  chat: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../src/components/story-navigation", () => ({
  useStoryNavigation: () => ({ root: { current: null }, ...navigation }),
}));
import { PortfolioStoryHero } from "../src/components/portfolio-story";
import { PortfolioIntro } from "../src/components/portfolio-intro";
const presentation = {
  market: "US" as const,
  location: "Configured residence",
  phone: "",
  contact_email: "",
  work_authorization: "",
};

it("introduces the person on the homepage with direct experience and project actions", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <PortfolioIntro
          story={portfolioStory(fixture)}
          presentation={presentation}
        />,
      ),
    );
    expect(host.querySelector("h1")?.textContent).toContain("Domenik Wichmann");
    expect(
      host.querySelector('.personal-hero-actions a[href="#ask"]')?.textContent,
    ).toContain("Explore my experience");
    expect(
      host.querySelector('.personal-hero-actions a[href="/projects"]')
        ?.textContent,
    ).toContain("Explore my projects");
    expect(host.textContent).toContain("Configured residence");
    expect(
      host.querySelector(".story-runway, .story-scene, select, .market-switch"),
    ).toBeNull();
    expect(host.textContent).not.toContain("project walkthrough");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("starts the project walkthrough at Resume Builder and expands saved examples without drafting or provider calls", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    draft = vi.fn(),
    fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  window.addEventListener("portfolio-question", draft);
  const story = portfolioStory(fixture);
  const render = () => root.render(<PortfolioStoryHero story={story} />);
  try {
    await act(async () => render());
    const active = () => host.querySelector(".story-scene:not([hidden])")!;
    expect(active().querySelector("h1")?.textContent).toContain(
      "Resume Builder",
    );
    expect(host.querySelector(".story-scene-0, .portrait-layout")).toBeNull();
    expect(host.querySelectorAll(".story-scene")).toHaveLength(8);
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Previous chapter"]')
        ?.disabled,
    ).toBe(true);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Next chapter"]')!
        .click(),
    );
    expect(navigation.navigate).toHaveBeenCalledWith(2);
    navigation.step = finalStoryStep;
    await act(async () => render());
    const example = active().querySelector<HTMLButtonElement>(
      ".question-example > button",
    )!;
    const initialHash = location.hash;
    await act(async () => example.click());
    expect(example.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.getElementById(example.getAttribute("aria-controls")!)
        ?.textContent,
    ).toContain(story.questionExamples[0].items[0].details[0]);
    expect(location.hash).toBe(initialHash);
    expect(draft).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(navigation.chat).not.toHaveBeenCalled();
    expect(host.querySelector('a[href="/#ask"]')?.textContent).toContain(
      "Explore my experience",
    );
    await act(async () =>
      host
        .querySelector<HTMLAnchorElement>('a[href="#project-details"]')!
        .click(),
    );
    expect(navigation.chat).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.removeEventListener("portfolio-question", draft);
    navigation.step = 1;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  }
});

it("keeps all project chapters in the native mobile document flow", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  navigation.mobile = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<PortfolioStoryHero story={portfolioStory(fixture)} />),
    );
    expect(host.querySelectorAll(".story-scene[hidden]")).toHaveLength(0);
    expect(host.querySelectorAll(".story-scene")).toHaveLength(8);
    expect(host.querySelector(".story-mobile-actions")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    navigation.mobile = false;
    vi.unstubAllGlobals();
  }
});
