import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const publicId = "11111111-1111-4111-8111-111111111111";
const privateId = "22222222-2222-4222-8222-222222222222";
const vectorText = JSON.stringify([1, ...Array(1023).fill(0)]);
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  for (const name of [
    "202610040001_foundation.sql",
    "202610040002_semantic_retrieval.sql",
    "202610040003_workspaces_and_markets.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query(
    "insert into projects(id,slug,title,summary,is_public) values($1,'public-project','Published','SQL evidence',true),($2,'private-project','Private','Private notes',false)",
    [publicId, privateId],
  );
  await db.query(
    "insert into career_embeddings(project_id,content,content_hash,embedding,embedding_model) values($1,'public content',repeat('a',64),$3::extensions.vector,'embed-v4.0'),($2,'private content',repeat('b',64),$3::extensions.vector,'embed-v4.0')",
    [publicId, privateId, vectorText],
  );
});
afterAll(async () => {
  await db?.close();
});
describe("committed migrations in PostgreSQL + pgvector", () => {
  it("enforces two workspace slots atomically and allows replacement after deletion", async () => {
    const visitorId = "33333333-3333-4333-8333-333333333333";
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        db.query<{ id: string }>("select create_workspace($1,'US') as id", [
          visitorId,
        ]),
      ),
    );
    const successes = results.filter((result) => result.status === "fulfilled");
    expect(successes).toHaveLength(2);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await db.query(
      "delete from workspaces where id=(select id from workspaces where visitor_id=$1 limit 1)",
      [visitorId],
    );
    await expect(
      db.query("select create_workspace($1,'BG')", [visitorId]),
    ).resolves.toBeDefined();
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer as count from workspaces where visitor_id=$1",
          [visitorId],
        )
      ).rows[0].count,
    ).toBe(2);
  });
  it("locks actions by ownership and commits question context atomically", async () => {
    const visitorId = "44444444-4444-4444-8444-444444444444";
    const id = (
      await db.query<{ id: string }>("select create_workspace($1,'BG') as id", [
        visitorId,
      ])
    ).rows[0].id;
    expect(
      (
        await db.query<{ locked: boolean }>(
          "select begin_workspace_action($1,$2) as locked",
          [id, "55555555-5555-4555-8555-555555555555"],
        )
      ).rows[0].locked,
    ).toBe(false);
    expect(
      (
        await db.query<{ locked: boolean }>(
          "select begin_workspace_action($1,$2) as locked",
          [id, visitorId],
        )
      ).rows[0].locked,
    ).toBe(true);
    expect(
      (
        await db.query<{ locked: boolean }>(
          "select begin_workspace_action($1,$2) as locked",
          [id, visitorId],
        )
      ).rows[0].locked,
    ).toBe(false);
    const evidence = JSON.stringify([
      { entity_type: "project", entity_id: publicId },
    ]);
    const question = JSON.stringify({
      question: "SQL?",
      answer: "SQL evidence.",
      evidence_ids: [publicId],
      topics: [{ topic: "SQL", strength: "STRONG" }],
    });
    await expect(
      db.query(
        "select save_workspace_context($1,$2,'Stolen','BG',null,null,array['SQL'],$3::jsonb,$4::jsonb)",
        [id, "55555555-5555-4555-8555-555555555555", evidence, question],
      ),
    ).rejects.toThrow("WORKSPACE_NOT_FOUND");
    await db.query(
      "select save_workspace_context($1,$2,'Exploration','BG',null,null,array['SQL reporting'],$3::jsonb,$4::jsonb)",
      [id, visitorId, evidence, question],
    );
    expect(
      (
        await db.query(
          "select * from workspace_questions where workspace_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from question_evidence")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "select save_workspace_context($1,$2,'Changed','BG',null,null,array['SQL'],$3::jsonb,$4::jsonb)",
        [
          id,
          visitorId,
          JSON.stringify([
            {
              entity_type: "project",
              entity_id: "66666666-6666-4666-8666-666666666666",
            },
          ]),
          question,
        ],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ title: string }>(
          "select title from workspaces where id=$1",
          [id],
        )
      ).rows[0].title,
    ).toBe("Exploration");
  });
  it("allows the server role to search vectors while maintaining publication filters", async () => {
    await db.exec("set role service_role");
    try {
      const result = await db.query<{ entity_id: string }>(
        "select * from match_career_embeddings($1::extensions.vector,$2)",
        [vectorText, "embed-v4.0"],
      );
      expect(result.rows.map((row) => row.entity_id)).toEqual([publicId]);
    } finally {
      await db.exec("reset role");
    }
  });
  it("allows public reads only for published career rows", async () => {
    await db.exec("set role anon");
    try {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.projects",
      );
      expect(rows.map((row) => row.id)).toEqual([publicId]);
    } finally {
      await db.exec("reset role");
    }
  });
  it("denies browser access to applications, embeddings, tracking and privileged RPCs", async () => {
    await db.exec("set role anon");
    try {
      for (const table of [
        "job_applications",
        "resume_versions",
        "tracking_links",
        "tracking_events",
        "career_embeddings",
        "ai_quota",
        "anonymous_visitors",
        "workspaces",
        "workspace_questions",
        "workspace_evidence",
        "question_topics",
        "workspace_projections",
      ])
        await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
          "permission denied",
        );
      await expect(db.query("select consume_ai_quota()")).rejects.toThrow(
        "permission denied",
      );
      await expect(
        db.query(
          "insert into projects(slug,title,summary) values('injected','bad','bad')",
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
  it("retrieves with cosine similarity and filters unpublished/model/type mismatches", async () => {
    const args = [vectorText, "embed-v4.0"];
    const { rows } = await db.query<{ entity_id: string; similarity: number }>(
      "select * from match_career_embeddings($1::extensions.vector,$2)",
      args,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_id).toBe(publicId);
    expect(rows[0].similarity).toBeCloseTo(1);
    expect(
      (
        await db.query(
          "select * from match_career_embeddings($1::extensions.vector,$2)",
          [vectorText, "other-model"],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select * from match_career_embeddings($1::extensions.vector,$2,8,0.25,array['skill'])",
          args,
        )
      ).rows,
    ).toEqual([]);
    await db.query("update projects set is_public=false where id=$1", [
      publicId,
    ]);
    expect(
      (
        await db.query(
          "select * from match_career_embeddings($1::extensions.vector,$2)",
          args,
        )
      ).rows,
    ).toEqual([]);
    await db.query("update projects set is_public=true where id=$1", [
      publicId,
    ]);
  });
  it("requires exactly one canonical foreign key and removes vectors on source deletion", async () => {
    await expect(
      db.query(
        "insert into career_embeddings(project_id,content,content_hash,embedding,embedding_model) values(gen_random_uuid(),'bad',repeat('c',64),$1::extensions.vector,'embed-v4.0')",
        [vectorText],
      ),
    ).rejects.toThrow();
    await db.query("delete from projects where id=$1", [privateId]);
    expect(
      (
        await db.query("select * from career_embeddings where entity_id=$1", [
          privateId,
        ])
      ).rows,
    ).toEqual([]);
  });
  it("atomically enforces shared minute and daily quotas", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        db.query<{ consume_ai_quota: boolean }>("select consume_ai_quota()"),
      ),
    );
    expect(
      results.filter((result) => result.rows[0].consume_ai_quota),
    ).toHaveLength(10);
    await db.exec(
      "update ai_quota set minute=now()-interval '2 minutes',daily_count=100",
    );
    expect(
      (
        await db.query<{ consume_ai_quota: boolean }>(
          "select consume_ai_quota()",
        )
      ).rows[0].consume_ai_quota,
    ).toBe(false);
    await db.exec(
      "update ai_quota set day=current_date-1,minute=now()-interval '2 minutes'",
    );
    expect(
      (
        await db.query<{ consume_ai_quota: boolean }>(
          "select consume_ai_quota()",
        )
      ).rows[0].consume_ai_quota,
    ).toBe(true);
  });
});
