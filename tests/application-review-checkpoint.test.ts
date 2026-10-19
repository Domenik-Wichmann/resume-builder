import { beforeEach, expect, it, vi } from "vitest";
import { brainFixture, claimFixture } from "./fixtures/project-case";
import { fixture } from "../src/lib/career/fixture";
import { clearSignalDesign } from "../src/lib/resume-design/model";
import { suggestedMetadata } from "../src/lib/applications/model";
import type { requireAccount } from "../src/lib/accounts";
import {
  checkpointAudit,
  reviewCheckpointKey,
} from "../src/lib/applications/review-checkpoint";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  brain: vi.fn(),
  career: vi.fn(),
}));
vi.mock("../src/lib/ai/openrouter", async (original) => ({
  ...(await original<typeof import("../src/lib/ai/openrouter")>()),
  complete: mocks.complete,
}));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: mocks.brain,
}));
vi.mock("../src/lib/career/repository", () => ({ getCareer: mocks.career }));
vi.mock("../src/lib/market-server", () => ({
  getPresentation: async () => ({
    market: "US",
    location: "Fictional City",
    contact_email: "example@example.invalid",
    phone: "",
    work_authorization: "",
  }),
}));
vi.mock("../src/lib/career-brain/provider", () => ({
  productionGate: (
    _label: string,
    _provider: string,
    run: () => Promise<unknown>,
  ) => run(),
}));
import {
  advanceGeneration,
  fullWritingInventory,
  type GenerationContext,
  type Writing,
} from "../src/lib/applications/generation";
import { ProviderError } from "../src/lib/ai/openrouter";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.career.mockResolvedValue({ ...fixture, demo: false });
});

function setup() {
  const record = brainFixture({
    claims: [
      claimFixture(
        "Built a fictional catalog importer to normalize supplier records.",
      ),
      claimFixture(
        "Built fictional spreadsheet validation to flag duplicate products.",
      ),
      claimFixture(
        "Built a fictional catalog report to review product classifications.",
      ),
      claimFixture(
        "Built a fictional catalog export to prepare marketplace listings.",
      ),
    ],
  });
  mocks.brain.mockResolvedValue([record]);
  const plan = {
    focus: "Fictional catalog operations",
    requirements: [
      {
        requirement: "Maintain catalog quality",
        importance: "ESSENTIAL" as const,
        query: "catalog",
        transferable_query: "spreadsheet",
      },
    ],
  };
  const evidence = fullWritingInventory([record], plan);
  const statement = (index: number) => ({
    text: evidence[0].claims[index].value,
    refs: [`${record.id}:${index}`],
  });
  const writing: Writing = {
    headline: { text: "Catalog operations", refs: [`${record.id}:0`] },
    summary: [statement(0)],
    skills: [
      { label: "Catalog workflows", items: [0, 1, 2, 3].map(statement) },
    ],
    entries: [],
    coverage: [
      {
        requirement: plan.requirements[0].requirement,
        support: "DIRECT",
        refs: [`${record.id}:0`],
        note: "Fictional supported operations",
      },
    ],
    review: [],
  };
  const row = {
    id: "11111111-1111-4111-8111-111111111112",
    account_id: "account",
    organization: "Fictional Employer",
    role: "Catalog operations",
    job_description: "Fictional catalog operations job",
    metadata: suggestedMetadata("catalog", "US"),
    learning_demo: null,
    generation_context: {
      fixed: null,
      design: clearSignalDesign,
      design_version: 1,
    } as GenerationContext,
    generation_plan: plan,
    generation_writing: writing,
    generation_evidence: [
      {
        id: record.id,
        hash: record.hash,
        revision: record.evidence_version,
        packet_version: 3,
      },
    ],
    generation_stage: 3,
    generation_lease: null as string | null,
    generation_review: [],
    resume_options: {},
    saved_application_id: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  const writes: { patch: object; filters: [string, unknown][] }[] = [];
  let lease = 0;
  const db = {
    rpc: async () => {
      row.generation_lease = `lease-${++lease}`;
      return { data: row.generation_lease, error: null };
    },
    from: (table: string) => {
      expect(table).toBe("application_previews");
      let patch: object | undefined;
      const filters: [string, unknown][] = [];
      const result = () => {
        if (patch) {
          expect(filters).toContainEqual(["account_id", "account"]);
          expect(filters).toContainEqual(["id", row.id]);
          expect(filters).toContainEqual([
            "generation_lease",
            row.generation_lease,
          ]);
          writes.push({ patch, filters });
          Object.assign(row, patch);
        }
        return { data: structuredClone(row), error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        update: (value: object) => {
          patch = value;
          return query;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  const account = {
    accountId: "account",
    userId: "owner",
    db: db as unknown as Awaited<ReturnType<typeof requireAccount>>["db"],
  };
  mocks.complete.mockImplementation(async (_system: string, input: string) => {
    const payload = JSON.parse(input) as {
      inputs: { id: string; bullet: string; claims: { ref: string }[] }[];
    };
    return {
      decisions: payload.inputs.map((item) => ({
        id: item.id,
        verdict: "PASS",
        skill_quality: "PASS",
        job_fit: "DIRECT",
        skill_context: {
          subject: item.bullet,
          purpose: item.bullet,
          requirement_index: 0,
          priority: "CORE",
        },
        assertions: [
          {
            text: item.bullet,
            verdict: "SUPPORTED",
            claimRefs: item.claims.map((c) => c.ref),
            reason: "Fictional exact support",
          },
        ],
        reason: "Fictional support",
      })),
    };
  });
  return { row, account, record, writes };
}

it("persists review in its own leased request, then resumes without repeating provider calls", async () => {
  const { row, account, writes } = setup();
  const first = await advanceGeneration(account, row.id, 3);
  expect(first.stage).toBe(3);
  expect(row.generation_lease).toBeNull();
  expect(row.generation_context.review_checkpoint?.audit).toHaveLength(6);
  expect(row.resume_options).toEqual({});
  expect(mocks.complete).toHaveBeenCalledTimes(1);
  const second = await advanceGeneration(account, row.id, 3);
  expect(second.stage).toBe(4);
  expect(mocks.complete).toHaveBeenCalledTimes(1);
  expect(writes).toHaveLength(2);
});

it("keeps the successful review when a later repair times out and rejects changed sources before reuse", async () => {
  const { row, account, record } = setup();
  row.generation_writing.skills[0].items.pop(); // Thin draft needs repair.
  await advanceGeneration(account, row.id, 3);
  const checkpoint = structuredClone(row.generation_context.review_checkpoint);
  mocks.complete.mockRejectedValue(
    new ProviderError("Synthetic repair timeout", "TIMEOUT"),
  );
  await expect(advanceGeneration(account, row.id, 3)).rejects.toThrow(
    "Synthetic repair timeout",
  );
  expect(row.generation_stage).toBe(3);
  expect(row.generation_lease).toBeNull();
  expect(row.generation_context.review_checkpoint).toEqual(checkpoint);
  await expect(advanceGeneration(account, row.id, 3)).rejects.toThrow(
    "Synthetic repair timeout",
  );
  expect(mocks.complete).toHaveBeenCalledTimes(3); // One review, two repair attempts.
  mocks.brain.mockResolvedValue([{ ...record, hash: "changed-source" }]);
  await expect(advanceGeneration(account, row.id, 3)).rejects.toThrow(
    "Source evidence changed",
  );
  expect(mocks.complete).toHaveBeenCalledTimes(3);
});

it("invalidates a checkpoint when the draft, job, source passages or locked content changes", () => {
  const input = {
    writing: "Private draft",
    evidence: "Private source",
    plan: "Private job",
    lockedBlocks: "Private blocks",
  };
  const key = reviewCheckpointKey(input);
  const checkpoint = { key, audit: [] };
  expect(key).not.toContain("Private");
  expect(checkpointAudit(checkpoint, key)).toEqual([]);
  for (const field of Object.keys(input)) {
    expect(
      checkpointAudit(
        checkpoint,
        reviewCheckpointKey({ ...input, [field]: "changed" }),
      ),
    ).toBeUndefined();
  }
  expect(
    checkpointAudit({ ...checkpoint, audit: [{ pass: true }] }, key),
  ).toBeUndefined();
});
