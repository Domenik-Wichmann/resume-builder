import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  initialInputKind,
  submitComposerOnEnter,
} from "../src/lib/workspaces/input";
import type { KeyboardEvent } from "react";
import { presentationSettingsSchema, resolveMarket } from "../src/lib/markets";
import { SafeMarkdown } from "../src/components/safe-markdown";
const request = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  country: null as string | null,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      request.cookies[name] ? { value: request.cookies[name] } : undefined,
  }),
  headers: async () => ({ get: () => request.country }),
}));
import { currentMarket } from "../src/lib/market-server";
import { createSession } from "../src/lib/tracking/service";
import { POST as changeMarket } from "../src/app/api/market/route";
beforeEach(() => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("VERCEL", "1");
  request.cookies = {};
  request.country = null;
});
afterEach(() => vi.unstubAllEnvs());
it("sends on Enter, keeps Shift+Enter and composition as text input, and prevents repeated or disabled submissions", () => {
  const submit = vi.fn(),
    preventDefault = vi.fn();
  const event = (overrides: Record<string, unknown> = {}) =>
    ({
      key: "Enter",
      shiftKey: false,
      keyCode: 13,
      repeat: false,
      nativeEvent: { isComposing: false },
      preventDefault,
      currentTarget: { form: { requestSubmit: submit } },
      ...overrides,
    }) as unknown as KeyboardEvent<HTMLTextAreaElement>;
  submitComposerOnEnter(event(), true);
  expect(submit).toHaveBeenCalledOnce();
  expect(preventDefault).toHaveBeenCalledOnce();
  vi.clearAllMocks();
  for (const overrides of [
    { shiftKey: true },
    { nativeEvent: { isComposing: true } },
    { keyCode: 229 },
    { key: "a" },
  ])
    submitComposerOnEnter(event(overrides), true);
  expect(submit).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
  submitComposerOnEnter(event({ repeat: true }), true);
  submitComposerOnEnter(event(), false);
  expect(submit).not.toHaveBeenCalled();
  expect(preventDefault).toHaveBeenCalledTimes(2);
});

it("distinguishes a role brief conservatively without sending text to a provider", () => {
  expect(
    initialInputKind(
      "We are hiring. Responsibilities: build services. Required skills: SQL.",
    ),
  ).toBe("match");
  expect(
    initialInputKind(
      "What qualifications match the requirements for this role?",
    ),
  ).toBe("ask");
  expect(initialInputKind("Tell me about the projects.")).toBe("ask");
  expect(initialInputKind("SQL React")).toBe("ask");
});
it("renders useful Markdown without interpreting executable HTML or links", () => {
  const html = renderToStaticMarkup(
    <SafeMarkdown
      text={
        "## Experience\n- **SQL** workflows\n- `automation`\n\n1. First\n2. Second\n\n<img src=x onerror=alert(1)>\n[link](javascript:alert(1))"
      }
    />,
  );
  expect(html).toContain("<h3>Experience</h3>");
  expect(html).toContain("<strong>SQL</strong>");
  expect(html).toContain("<ol>");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<a ");
});
it("resolves presentation automatically and ignores manual or unsigned tracking cookies", async () => {
  request.cookies = {
    rb_market: "BG",
    rb_link_market: "BG",
    rb_ai_access: "forged",
  };
  expect(await currentMarket()).toBe("US");
  request.country = "BG";
  request.cookies.rb_market = "US";
  expect(await currentMarket()).toBe("BG");
  request.cookies.rb_ai_access = createSession("demoLink").cookie;
  expect(await currentMarket()).toBe("US");
  request.country = "US";
  request.cookies.rb_ai_access = createSession("demoBGbg").cookie;
  expect(await currentMarket()).toBe("BG");
  expect(resolveMarket(null, "BG", "DE")).toBe("US");
});
it("does not permit public presentation overrides or issue preference cookies", async () => {
  const response = await changeMarket();
  expect(response.status).toBe(405);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("uses only signed sessions for active links and falls back after expiry", async () => {
  request.cookies.rb_ai_access = createSession("demoBGbg").cookie;
  expect(await currentMarket()).toBe("BG");
  request.cookies.rb_ai_access = createSession("inactive").cookie;
  expect(await currentMarket()).toBe("US");
  request.cookies.rb_ai_access = createSession("demoBGbg").cookie;
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 86400001);
  try {
    expect(await currentMarket()).toBe("US");
  } finally {
    vi.restoreAllMocks();
  }
});
it("rejects unsafe portraits, oversized contact values, and browser account authority", () => {
  const settings = {
    market: "US",
    location: "",
    address: "",
    contact_email: "",
    phone: "",
    work_authorization: "",
    photo_url: "",
    version: 0,
    is_public: false,
  };
  expect(presentationSettingsSchema.safeParse(settings).success).toBe(true);
  for (const photo_url of [
    "javascript:alert(1)",
    "data:image/svg+xml,bad",
    "http://insecure.example/photo",
    "https://user:password@example.com/photo",
  ])
    expect(
      presentationSettingsSchema.safeParse({ ...settings, photo_url }).success,
    ).toBe(false);
  expect(
    presentationSettingsSchema.safeParse({ ...settings, account_id: "forged" })
      .success,
  ).toBe(false);
  expect(
    presentationSettingsSchema.safeParse({
      ...settings,
      address: "x".repeat(501),
    }).success,
  ).toBe(false);
});
