import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { timedResponse, measure } from "../src/lib/performance";
import { fixture } from "../src/lib/career/fixture";
import { semanticEntities } from "../src/lib/embeddings/content";

const mocks = vi.hoisted(() => ({ embed: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/lib/embeddings/cohere", () => ({ embed: mocks.embed }));
vi.mock("../src/lib/db", () => ({ database: () => ({ rpc: mocks.rpc }) }));
import { queryVectors } from "../src/lib/embeddings/query-cache";
import { retrieveCareerEvidence } from "../src/lib/embeddings/retrieval";

beforeEach(() => {
  vi.stubEnv("APP_MODE", "demo");
  mocks.embed.mockReset().mockResolvedValue([[1, 0]]);
  mocks.rpc.mockReset().mockResolvedValue({ data: [], error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("isolates query vectors by account and model and expires them", async () => {
  vi.useFakeTimers();
  await queryVectors(["Synthetic cache scoping"], { accountId: "a" });
  await queryVectors(["Synthetic cache scoping"], { accountId: "a" });
  expect(mocks.embed).toHaveBeenCalledTimes(1);
  await queryVectors(["Synthetic cache scoping"], { accountId: "b" });
  vi.stubEnv("COHERE_EMBED_MODEL", "synthetic-other-model");
  await queryVectors(["Synthetic cache scoping"], { accountId: "a" });
  expect(mocks.embed).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(300_001);
  await queryVectors(["Synthetic cache scoping"], { accountId: "a" });
  expect(mocks.embed).toHaveBeenCalledTimes(4);
});

it("does not cache failed or unaccounted provider calls", async () => {
  mocks.embed.mockRejectedValueOnce(new Error("Usage could not be recorded"));
  await expect(queryVectors(["Synthetic failed call"])).rejects.toThrow();
  await queryVectors(["Synthetic failed call"]);
  expect(mocks.embed).toHaveBeenCalledTimes(2);
});

it("bounds query cache memory by evicting old entries", async () => {
  await queryVectors(["Synthetic eviction first"]);
  for (let i = 0; i < 128; i++) await queryVectors([`Synthetic eviction ${i}`]);
  await queryVectors(["Synthetic eviction first"]);
  expect(mocks.embed).toHaveBeenCalledTimes(130);
});

it("rechecks vectors against fresh publication and hashes even on a query cache hit", async () => {
  const career = { ...fixture, demo: false };
  const entity = semanticEntities(career).find((e) => e.type === "project")!;
  mocks.rpc.mockResolvedValue({
    data: [
      {
        entity_type: entity.type,
        entity_id: entity.record.id,
        content_hash: entity.hash,
        similarity: 0.9,
      },
    ],
    error: null,
  });
  const query = ["zzzzsyntheticsemanticquery"];
  expect(await retrieveCareerEvidence(query, career)).toContainEqual(
    entity.record,
  );
  expect(
    await retrieveCareerEvidence(query, { ...career, projects: [] }),
  ).toEqual([]);
  const changed = {
    ...career,
    projects: career.projects.map((p) => ({
      ...p,
      summary: "Changed canonical evidence",
    })),
  };
  expect(await retrieveCareerEvidence(query, changed)).toEqual([]);
  expect(mocks.embed).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledTimes(3);
});

it("keeps concurrent request timings separate and includes awaited cleanup", async () => {
  const [one, two] = await Promise.all([
    timedResponse(async () => {
      await measure("career", async () => {});
      await measure("release", async () => {});
      return Response.json({ ok: true });
    }),
    timedResponse(async () => {
      await measure("vector_search", async () => {});
      return Response.json({ ok: true });
    }),
  ]);
  expect(one.headers.get("server-timing")).toMatch(
    /career;dur=.*release;dur=.*total;dur=/,
  );
  expect(one.headers.get("server-timing")).not.toContain("vector_search");
  expect(two.headers.get("server-timing")).not.toContain("career");
});
