import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  code: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../src/lib/tracking/codes", () => ({
  createTrackingCode: mocks.code,
}));
import { completeApplication } from "../src/lib/applications/completion";
import type { requireAccount } from "../src/lib/accounts";
import { designPreview } from "../src/lib/resume-design/preview";
import {
  applyFixedContent,
  clearSignalContent,
} from "../src/lib/resume-design/fixed-content";
import { wordDocument } from "../src/lib/resume-export";
import { resumeIRSchema } from "../src/lib/resume-ir";
const appId = "00000000-0000-4000-8000-000000000001";
const previewId = "00000000-0000-4000-8000-000000000002";
const account = {
  accountId: "verified-account",
  userId: "verified-owner",
  db: { rpc: mocks.rpc, from: mocks.from },
} as unknown as Awaited<ReturnType<typeof requireAccount>>;
const state = {
  id: undefined as string | undefined,
  preview_id: previewId,
  stage: 4,
  label: "Ready for review" as const,
  options: {},
  review: [],
};
const ir = applyFixedContent(
  { ...designPreview, portfolio_url: "https://domenik-wichmann.com" },
  clearSignalContent,
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.code.mockReturnValue("saved001");
  mocks.rpc.mockResolvedValue({ data: appId, error: null });
  mocks.single.mockResolvedValue({
    data: {
      tracking_code: "saved001",
      strategy: "PROJECT_FORWARD",
      resume_ir: ir,
    },
    error: null,
  });
  const chain = { eq: mocks.eq, maybeSingle: mocks.single };
  mocks.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue({ select: () => chain });
});
it("automatically persists a ready resume and uses the saved code in its exported portfolio links", async () => {
  const result = await completeApplication(account, state);
  expect(mocks.rpc).toHaveBeenCalledWith("finalize_application", {
    p_account: account.accountId,
    p_preview: previewId,
    p_code: "saved001",
  });
  expect(result).toMatchObject({
    id: appId,
    tracking_code: "saved001",
    strategy: "PROJECT_FORWARD",
  });
  expect(Object.keys(result.options)).toEqual(["PROJECT_FORWARD"]);
  const saved = resumeIRSchema.parse(result.options.PROJECT_FORWARD);
  expect(saved.portfolio_url).toBe("https://domenik-wichmann.com/r/saved001");
  expect(saved.projects[0].links?.find((link) => link.portfolio)?.url).toBe(
    saved.portfolio_url,
  );
  expect(wordDocument(saved)).toContain(saved.portfolio_url);
  expect(mocks.eq).toHaveBeenCalledWith("account_id", account.accountId);
  expect(mocks.eq).toHaveBeenCalledWith("application_id", appId);
});
it("does not allocate a code or read snapshots before all generation stages finish", async () => {
  expect(
    await completeApplication(account, { ...state, stage: 3 }),
  ).toMatchObject({ stage: 3 });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("reuses the original saved snapshot when resuming, without minting another code", async () => {
  await completeApplication(account, { ...state, id: appId });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.code).not.toHaveBeenCalled();
});
it("includes a tracking URL even when an older saved layout omitted the portfolio field", async () => {
  const { portfolio_url: omitted, ...legacy } = ir;
  void omitted;
  mocks.single.mockResolvedValueOnce({
    data: {
      tracking_code: "saved001",
      strategy: "TRADITIONAL",
      resume_ir: legacy,
    },
    error: null,
  });
  const result = await completeApplication(account, { ...state, id: appId });
  expect(result.options.TRADITIONAL.portfolio_url).toBe(
    "https://domenik-wichmann.com/r/saved001",
  );
});
it("retries a code collision and fails safely without exporting an unpersisted link", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
  await completeApplication(account, state);
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
  await expect(completeApplication(account, state)).rejects.toMatchObject({
    status: 503,
  });
});
it("keeps an interrupted saved snapshot recoverable and never substitutes a preview", async () => {
  mocks.single.mockResolvedValueOnce({ data: null, error: {} });
  await expect(completeApplication(account, state)).rejects.toMatchObject({
    status: 503,
  });
  vi.clearAllMocks();
  const result = await completeApplication(account, { ...state, id: appId });
  expect(result).toMatchObject({ id: appId, tracking_code: "saved001" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
