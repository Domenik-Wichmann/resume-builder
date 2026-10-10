import { afterEach, expect, it, vi } from "vitest";
import { ProviderError } from "../src/lib/ai/openrouter";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  advance: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/applications/generation", () => ({
  advanceGeneration: mocks.advance,
  startGeneration: vi.fn(),
  generationStatus: vi.fn(),
}));
import { POST } from "../src/app/api/admin/applications/route";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("returns a safe actionable provider failure while preserving owner authentication and the saved stage", async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://portfolio.test");
  mocks.account.mockResolvedValue({
    accountId: "verified-account",
    userId: "verified-owner",
    db: {},
  });
  const message =
    "The AI response reached its output limit before completing. Retry the saved generation; no partial draft was accepted.";
  mocks.advance.mockRejectedValue(new ProviderError(message, "TRUNCATED"));
  const response = await POST(
    new Request("https://portfolio.test/api/admin/applications", {
      method: "POST",
      headers: {
        origin: "https://portfolio.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "generate",
        preview_id: "00000000-0000-4000-8000-000000000001",
        stage: 2,
      }),
    }),
  );
  expect(mocks.owner).toHaveBeenCalledOnce();
  expect(mocks.advance).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: "verified-account" }),
    "00000000-0000-4000-8000-000000000001",
    2,
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: message });
});
