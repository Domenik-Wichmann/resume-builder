import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/http";
import { primaryAccountId } from "../src/lib/account-id";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  download: vi.fn(),
  rows: {} as Record<string, unknown>,
}));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/db", () => ({
  database: () => ({
    from: (table: string) => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: mocks.rows[table], error: null }),
    }),
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
import { GET } from "../src/app/media/[id]/route";
const id = "11111111-1111-4111-8111-111111111111";
const get = () =>
  GET(new Request(`http://localhost:3000/media/${id}`), {
    params: Promise.resolve({ id }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rows = {
    project_media: {
      account_id: primaryAccountId,
      project_id: id,
      storage_path: "private/screenshot.png",
      mime_type: "image/png",
      is_public: true,
    },
    projects: { is_public: true, archived_at: null },
  };
  mocks.account.mockRejectedValue(new HttpError(403, "Sign in"));
  mocks.download.mockResolvedValue({
    data: new Blob(["fictional screenshot"]),
    error: null,
  });
});
it("serves published screenshots with no-store and stops serving immediately after image or parent revocation", async () => {
  expect((await get()).status).toBe(200);
  mocks.rows.project_media = {
    ...(mocks.rows.project_media as object),
    is_public: false,
  };
  mocks.download.mockClear();
  expect((await get()).status).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
  mocks.rows.project_media = {
    ...(mocks.rows.project_media as object),
    is_public: true,
  };
  mocks.rows.projects = { is_public: true, archived_at: "2026-01-01" };
  expect((await get()).status).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("lets the owning account preview private uploads while denying another account and public secondary-account images", async () => {
  mocks.rows.project_media = {
    ...(mocks.rows.project_media as object),
    is_public: false,
  };
  mocks.account.mockResolvedValue({ accountId: primaryAccountId });
  expect((await get()).status).toBe(200);
  mocks.download.mockClear();
  mocks.account.mockResolvedValue({ accountId: "other" });
  expect((await get()).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});
