import { afterEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "../src/lib/env";
import {
  createTrackingCode,
  validTrackingCode,
} from "../src/lib/tracking/codes";
import { fixture } from "../src/lib/career/fixture";
import { retrieve } from "../src/lib/career/retrieval";
import {
  semanticText,
  contentHash,
  semanticEntities,
  needsEmbedding,
  deduplicate,
  expandMatches,
  jobQueries,
} from "../src/lib/embeddings/content";
import {
  answerSchema,
  matchSchema,
  validateEvidence,
} from "../src/lib/ai/contracts";
import { embed } from "../src/lib/embeddings/cohere";
import { retrieveCareerEvidence } from "../src/lib/embeddings/retrieval";
import { analyze } from "../src/lib/ai/service";
import { handleAI } from "../src/lib/api";
import {
  createSession,
  readSession,
  trackingDisabled,
} from "../src/lib/tracking/service";
import { complete } from "../src/lib/ai/openrouter";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function demo() {
  vi.stubEnv("APP_MODE", "demo");
}
describe("configuration and secrets", () => {
  it("allows local offline development and requires explicit production mode", () => {
    expect(validateEnv({ NODE_ENV: "development" }).mode).toBe("demo");
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow("APP_MODE");
    expect(validateEnv({ NODE_ENV: "production", APP_MODE: "demo" }).mode).toBe(
      "demo",
    );
  });
  it("requires live credentials and matching vector dimensions", () => {
    expect(() => validateEnv({ APP_MODE: "live" })).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(() =>
      validateEnv({ APP_MODE: "demo", COHERE_EMBED_DIMENSION: "512" }),
    ).toThrow("vector(1024)");
    expect(() =>
      validateEnv({ APP_MODE: "demo", NEXT_PUBLIC_SITE_URL: "javascript:bad" }),
    ).toThrow();
  });
});
describe("tracking privacy", () => {
  it("generates 48-bit URL-safe codes, rejecting enumerated and malformed values", () => {
    const codes = Array.from({ length: 1000 }, createTrackingCode);
    expect(new Set(codes).size).toBe(1000);
    expect(codes.every(validTrackingCode)).toBe(true);
    for (const value of [
      "123",
      "../hello",
      "abcdefghij",
      "bad code",
      "<script>",
    ])
      expect(validTrackingCode(value)).toBe(false);
  });
  it("signs session cookies and rejects tampering/expiration", () => {
    demo();
    const session = createSession("demoLink");
    expect(readSession(session.cookie)).toEqual({
      code: "demoLink",
      sessionId: session.sessionId,
    });
    expect(
      readSession(session.cookie.replace("demoLink", "otherOne")),
    ).toBeNull();
    expect(readSession(session.cookie + "x")).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 90000000);
    expect(readSession(session.cookie)).toBeNull();
    vi.restoreAllMocks();
  });
  it("honors browser privacy signals", () => {
    expect(trackingDisabled(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(trackingDisabled(new Headers({ dnt: "1" }))).toBe(true);
    expect(trackingDisabled(new Headers())).toBe(false);
  });
});
describe("semantic evidence", () => {
  it("constructs readable evidence, with deterministic sorted skills and hashes", () => {
    const record = fixture.projects[0];
    const text = semanticText("project", record);
    expect(text).toContain(record.summary);
    expect(text).not.toContain(record.id);
    expect(
      semanticText("project", {
        ...record,
        skills: [...record.skills].reverse(),
      }),
    ).toBe(text);
    expect(contentHash(text)).toHaveLength(64);
    expect(contentHash(text)).toBe(contentHash(text));
    expect(contentHash(text + " changed")).not.toBe(contentHash(text));
  });
  it("only re-embeds changed content or a changed model", () => {
    const entity = semanticEntities(fixture)[0];
    const stored = { content_hash: entity.hash, embedding_model: "embed-v4.0" };
    expect(needsEmbedding(entity, stored, "embed-v4.0")).toBe(false);
    expect(needsEmbedding(entity, stored, "next-model")).toBe(true);
    expect(needsEmbedding(entity, undefined, "embed-v4.0")).toBe(true);
  });
  it("expands only canonical current matches and suppresses duplicates", () => {
    const entities = semanticEntities(fixture);
    const entity = entities[0];
    const match = {
      entity_type: entity.type,
      entity_id: entity.record.id,
      content_hash: entity.hash,
    };
    expect(expandMatches([match, match], entities)).toEqual([entity.record]);
    expect(
      expandMatches([{ ...match, content_hash: "stale" }], entities),
    ).toEqual([]);
    expect(expandMatches([match], [])).toEqual([]);
    expect(deduplicate([entity.record, entity.record])).toHaveLength(1);
  });
  it("bounds job queries and runs fixture retrieval without providers", async () => {
    demo();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      jobQueries(Array(100).fill("SQL reporting and automation").join("\n"))
        .length,
    ).toBeLessThanOrEqual(5);
    expect(
      (await retrieveCareerEvidence(["SQL"], fixture)).length,
    ).toBeGreaterThan(0);
    expect(retrieve(fixture, "Underwater welding")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
describe("provider and response boundaries", () => {
  it("fails usefully without a Cohere credential", async () => {
    demo();
    vi.stubEnv("COHERE_API_KEY", "");
    await expect(embed(["SQL"], "search_query")).rejects.toThrow(
      "COHERE_API_KEY",
    );
  });
  it("uses Cohere query/document mode and validates returned dimensions", async () => {
    demo();
    vi.stubEnv("COHERE_API_KEY", "test-placeholder");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ embeddings: { float: [Array(1024).fill(0.1)] } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect((await embed(["SQL"], "search_query"))[0]).toHaveLength(1024);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({
      model: "embed-v4.0",
      input_type: "search_query",
      output_dimension: 1024,
      embedding_types: ["float"],
    });
    fetchMock.mockResolvedValue(
      Response.json({ embeddings: { float: [[1, 2]] } }),
    );
    await expect(embed(["SQL"], "search_document")).rejects.toThrow();
  });
  it("rejects unsupported references and malformed structured answers", () => {
    expect(
      answerSchema.safeParse({ answer: "Yes", evidence_ids: [], extra: "bad" })
        .success,
    ).toBe(false);
    expect(matchSchema.safeParse({ overall_summary: "Yes" }).success).toBe(
      false,
    );
    expect(() => validateEvidence(["made-up"], ["project-demo"])).toThrow();
  });
  it("validates the OpenRouter envelope and passes structured output schema", async () => {
    demo();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "Evidence only",
                evidence_ids: [],
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await complete("Grounded system", "SQL?", answerSchema)).toEqual({
      answer: "Evidence only",
      evidence_ids: [],
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).response_format.type,
    ).toBe("json_schema");
    fetchMock.mockResolvedValue(Response.json({ choices: [] }));
    await expect(complete("system", "input", answerSchema)).rejects.toThrow();
  });
  it("makes the complete offline path operational and preserves missing evidence", async () => {
    demo();
    const answer = await analyze("ask", "SQL");
    expect(answer.result).toHaveProperty("answer");
    expect(answer.evidence.length).toBeGreaterThan(0);
    expect((await analyze("ask", "Underwater welding")).result).toHaveProperty(
      "answer",
      "No relevant evidence is currently stored.",
    );
    expect(
      matchSchema.safeParse(
        (await analyze("match", "We need SQL reporting and React automation"))
          .result,
      ).success,
    ).toBe(true);
  });
  it("validates origin, JSON, sizes and payload before expensive work", async () => {
    demo();
    const request = (body: string, origin = "http://localhost:3000") =>
      new Request("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body,
      });
    expect(
      (
        await handleAI(
          request('{"input":"SQL"}', "https://attacker.test"),
          "ask",
        )
      ).status,
    ).toBe(403);
    expect((await handleAI(request("{"), "ask")).status).toBe(400);
    expect((await handleAI(request('{"input":""}'), "ask")).status).toBe(400);
    expect(
      (
        await handleAI(
          request(JSON.stringify({ input: "x".repeat(1001) })),
          "ask",
        )
      ).status,
    ).toBe(400);
    expect((await handleAI(request("x".repeat(50001)), "ask")).status).toBe(
      413,
    );
    expect((await handleAI(request('{"input":"SQL"}'), "ask")).status).toBe(
      200,
    );
  });
});
