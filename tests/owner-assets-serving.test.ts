import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  download: vi.fn(),
  rows: {} as Record<string, unknown>,
}));
vi.mock("@/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("@/lib/db", () => ({
  database: () => ({
    from: (table: string) => {
      const q = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: async () => ({ data: mocks.rows[table], error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: mocks.rows[table], error: null }).then(
            resolve,
          ),
      };
      return q;
    },
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
import { GET } from "../src/app/assets/[id]/route";
import { HttpError } from "../src/lib/http";
import { primaryAccountId } from "../src/lib/account-id";
const id = "77777777-7777-4777-8777-777777777777";
function get() {
  return GET(new Request(`http://localhost:3000/assets/${id}`), {
    params: Promise.resolve({ id }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows = {
    owner_assets: {
      account_id: primaryAccountId,
      kind: "PORTRAIT",
      storage_path: "private/portrait.png",
      mime_type: "image/png",
    },
    profile_presentations: [{ profile_id: id }],
    profile: [{ id }],
  };
  mocks.account.mockRejectedValue(new HttpError(403, "Account required."));
  mocks.download.mockResolvedValue({
    data: new Blob(["synthetic-image"]),
    error: null,
  });
});
it("never exposes reference documents as public portraits", async () => {
  mocks.rows.owner_assets = {
    ...(mocks.rows.owner_assets as object),
    kind: "REFERENCE",
  };
  expect((await get()).status).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("serves the selected primary portrait with no-store/nosniff only while its canonical profile is public", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(mocks.account).not.toHaveBeenCalled();
  mocks.rows.profile = [];
  expect((await get()).status).toBe(403);
});
it("lets the verified account preview its private photos but denies another account", async () => {
  mocks.rows.profile_presentations = [];
  mocks.account.mockResolvedValue({ accountId: primaryAccountId });
  expect((await get()).status).toBe(200);
  mocks.download.mockClear();
  mocks.account.mockResolvedValue({ accountId: "other-account" });
  expect((await get()).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});
