import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  load: vi.fn(),
  manage: vi.fn(),
  index: vi.fn(),
  data: vi.fn(),
}));
vi.mock("@/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("@/lib/career-brain/repository", () => ({ loadBrain: mocks.load }));
vi.mock("@/lib/embeddings/indexer", () => ({ reindexCareer: mocks.index }));
vi.mock("@/lib/career-brain/record-management", async (original) => ({
  ...(await original<object>()),
  manageRecords: mocks.manage,
  explorerData: mocks.data,
}));
import { GET, POST } from "../src/app/api/admin/records/route";
import { HttpError } from "../src/lib/http";
const selection = {
  id: "77777777-7777-4777-8777-777777777777",
  kind: "skill",
  hash: "a".repeat(64),
  updated_at: "2026-10-06T00:00:00Z",
  evidence_version: null,
};
function request(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/admin/records", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.resetAllMocks();
  mocks.account.mockResolvedValue({ db: {}, accountId: "verified-account" });
  mocks.load.mockResolvedValue([]);
  mocks.manage.mockResolvedValue(1);
  mocks.data.mockResolvedValue({ records: [], sources: [] });
  mocks.index.mockResolvedValue({ indexed: 1 });
});
afterEach(() => vi.unstubAllEnvs());
it("denies anonymous reads and mutations before any canonical access", async () => {
  mocks.account.mockRejectedValue(new HttpError(403, "Sign in."));
  expect((await GET()).status).toBe(403);
  expect(
    (await POST(request({ action: "archive", records: [selection] }))).status,
  ).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.data).not.toHaveBeenCalled();
  expect(mocks.manage).not.toHaveBeenCalled();
});
it("rejects cross-site, oversized and browser-supplied account authority", async () => {
  expect(
    (
      await POST(
        request(
          { action: "archive", records: [selection] },
          "https://elsewhere.example",
        ),
      )
    ).status,
  ).toBe(403);
  expect((await POST(request({ padding: "x".repeat(100001) }))).status).toBe(
    413,
  );
  expect(
    (
      await POST(
        request({
          action: "archive",
          records: [selection],
          accountId: "attacker",
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.manage).not.toHaveBeenCalled();
  expect(mocks.index).not.toHaveBeenCalled();
});
it("uses verified account authority and reports committed changes when reindex needs retry", async () => {
  mocks.index.mockRejectedValue(new Error("provider unavailable"));
  const response = await POST(
    request({ action: "archive", records: [selection] }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.manage).toHaveBeenCalledWith(
    {},
    "verified-account",
    { action: "archive", records: [selection] },
    [],
  );
  expect(mocks.index).toHaveBeenCalledWith("verified-account");
  expect(await response.json()).toMatchObject({
    changed: 1,
    indexing: { pending: true },
  });
});
it("does not index or claim success when the atomic mutation is stale", async () => {
  mocks.manage.mockRejectedValue(new HttpError(409, "Stale record."));
  expect(
    (await POST(request({ action: "archive", records: [selection] }))).status,
  ).toBe(409);
  expect(mocks.index).not.toHaveBeenCalled();
  expect(mocks.data).not.toHaveBeenCalled();
});
