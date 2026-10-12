import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/http";
import { primaryAccountId } from "../src/lib/account-id";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  parent: vi.fn(),
  insert: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: mocks.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: mocks.account }));
vi.mock("../src/lib/db", () => ({
  database: () => ({
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  }),
}));
vi.mock("../src/lib/env", () => ({
  validateEnv: () => ({ siteUrl: "https://portfolio.example", mode: "demo" }),
}));
import { POST } from "../src/app/api/admin/project-media/route";
const project = "11111111-1111-4111-8111-111111111111";
function request(
  bytes: Uint8Array = new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...Array(24).fill(0),
  ]),
) {
  return new Request(
    `https://portfolio.example/api/admin/project-media?project=${project}`,
    {
      method: "POST",
      headers: {
        origin: "https://portfolio.example",
        "content-type": "image/png",
        "x-screenshot-filename": encodeURIComponent(
          "C:\\fakepath\\Graph_review_approval.png",
        ),
      },
      body: new Blob([Uint8Array.from(bytes)]),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue({});
  mocks.parent.mockResolvedValue({ data: { id: project }, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.account.mockResolvedValue({
    accountId: primaryAccountId,
    db: {
      from: (table: string) =>
        table === "projects"
          ? {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              is() {
                return this;
              },
              maybeSingle: mocks.parent,
            }
          : { insert: mocks.insert },
    },
  });
});
it("saves descriptive filename metadata privately with a verified account and UUID storage path", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      account_id: primaryAccountId,
      project_id: project,
      alt: "Graph review approval",
      caption: "Graph review approval",
      source_filename: "Graph_review_approval.png",
      is_public: false,
    }),
  );
  expect(mocks.upload.mock.calls[0][0]).toMatch(
    new RegExp(`^${primaryAccountId}/${project}/[a-f0-9-]+\\.png$`),
  );
  expect(mocks.upload.mock.calls[0][0]).not.toContain("fakepath");
});
it("rejects unauthorized owners and foreign or archived parents before uploading bytes", async () => {
  mocks.owner.mockRejectedValueOnce(new HttpError(403, "Owner required"));
  expect((await POST(request())).status).toBe(403);
  expect(mocks.account).not.toHaveBeenCalled();
  mocks.parent.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(404);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("rejects executable formats and oversized uploads without saving metadata or storage objects", async () => {
  expect(
    (
      await POST(
        request(new TextEncoder().encode("<svg onload='alert(1)'></svg>")),
      )
    ).status,
  ).toBe(415);
  expect(
    (await POST(request(new Uint8Array(4 * 1024 * 1024 + 1)))).status,
  ).toBe(413);
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
