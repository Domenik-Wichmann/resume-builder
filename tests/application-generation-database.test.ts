import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  clearSignalContent,
  applyFixedContent,
} from "../src/lib/resume-design/fixed-content";
import { clearSignalDesign } from "../src/lib/resume-design/model";
import { designPreview } from "../src/lib/resume-design/preview";
let db: PGlite, account: string, otherAccount: string;
const owner = randomUUID(),
  other = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  account = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      owner,
    ])
  ).rows[0].id;
  otherAccount = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      other,
    ])
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
async function member(user = owner) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function preview(stage = 4) {
  const ir = applyFixedContent(
    { ...designPreview, design: clearSignalDesign, demo: false },
    { ...clearSignalContent, version: 1 },
  );
  return (
    await db.query<{ id: string }>(
      "insert into application_previews(account_id,organization,role,job_description,metadata,resume_options,generation_stage,generation_context,generation_plan,generation_evidence,generation_review) values($1,'Fictional employer','Fictional role','Synthetic RAG job description',$2,$3,$4,$5,$6,$7,$8) returning id",
      [
        account,
        JSON.stringify({ market: "US", job_family: "ENGINEERING" }),
        JSON.stringify({
          TRADITIONAL: ir,
          PROJECT_FORWARD: ir,
          OUTCOME_FORWARD: ir,
        }),
        stage,
        JSON.stringify({
          fixed: { ...clearSignalContent, version: 1 },
          design: clearSignalDesign,
          design_version: 2,
        }),
        JSON.stringify({ focus: "Private fictional plan" }),
        JSON.stringify([
          { id: "private-record", hash: "private-hash", revision: "v1" },
        ]),
        JSON.stringify(["Private coverage gap"]),
      ],
    )
  ).rows[0].id;
}
it("version-controls fixed blocks privately, rejects stale writes and cross-account project authority", async () => {
  await member();
  expect(
    (
      await db.query<{ v: number }>(
        "select save_resume_fixed_content($1,$2) v",
        [account, JSON.stringify(clearSignalContent)],
      )
    ).rows[0].v,
  ).toBe(1);
  await expect(
    db.query("select save_resume_fixed_content($1,$2)", [
      account,
      JSON.stringify(clearSignalContent),
    ]),
  ).rejects.toThrow("STALE_CONTENT");
  await member(other);
  expect(
    (
      await db.query("select * from resume_fixed_content where account_id=$1", [
        account,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select save_resume_fixed_content($1,$2)", [
      account,
      JSON.stringify({ ...clearSignalContent, version: 1 }),
    ]),
  ).rejects.toThrow("ACCOUNT_REQUIRED");
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select * from resume_fixed_content_revisions"),
  ).rejects.toThrow("permission denied");
  await member();
  const foreign = (
    await db.query<{ id: string }>(
      "insert into projects(account_id,slug,title,summary,is_public) values($1,'synthetic-project','Synthetic project','Synthetic proof',false) returning id",
      [account],
    )
  ).rows[0].id;
  await member(other);
  await expect(
    db.query("select save_resume_fixed_content($1,$2)", [
      otherAccount,
      JSON.stringify({
        ...clearSignalContent,
        projects: [
          { ...clearSignalContent.projects[0], record_id: foreign },
          clearSignalContent.projects[1],
        ],
      }),
    ]),
  ).rejects.toThrow("INVALID_PROJECT");
});
it("leases each saved generation stage atomically and prevents premature/cross-account finalization", async () => {
  await member();
  const id = await preview(0);
  const lease = (
    await db.query<{ token: string }>(
      "select claim_resume_generation($1,0) token",
      [id],
    )
  ).rows[0].token;
  expect(lease).toBeTruthy();
  await expect(
    db.query("select claim_resume_generation($1,0)", [id]),
  ).rejects.toThrow("GENERATION_RUNNING");
  await expect(
    db.query("select finalize_application($1,$2,'stage001')", [account, id]),
  ).rejects.toThrow("DRAFT_NOT_READY");
  await db.query(
    "update application_previews set generation_stage=1,generation_lease=null where id=$1",
    [id],
  );
  expect(
    (
      await db.query<{ token: string | null }>(
        "select claim_resume_generation($1,0) token",
        [id],
      )
    ).rows[0].token,
  ).toBeNull();
  await member(other);
  expect(
    (await db.query("select * from application_previews where id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.query("select claim_resume_generation($1,1)", [id]),
  ).rejects.toThrow("ACCOUNT_REQUIRED");
  await expect(
    db.query("select finalize_application($1,$2,'stage002')", [account, id]),
  ).rejects.toThrow("ACCOUNT_FORBIDDEN");
});
it("reuses the original code transactionally in all portfolio links and freezes design, fixed version and source revision", async () => {
  await member();
  const id = await preview();
  const saved = (
    await db.query<{ id: string }>(
      "select finalize_application($1,$2,'saved001') id",
      [account, id],
    )
  ).rows[0].id;
  const retried = (
    await db.query<{ id: string }>(
      "select finalize_application($1,$2,'unused01') id",
      [account, id],
    )
  ).rows[0].id;
  expect(retried).toBe(saved);
  const snapshot = (
    await db.query<{
      resume_ir: {
        portfolio_url: string;
        projects: { links: { url: string }[] }[];
        design: unknown;
        fixed_content_version: number;
      };
      tracking_code: string;
      generation_record: {
        evidence: unknown;
        review: string[];
        context: { design_version: number };
      };
    }>("select * from application_snapshots where application_id=$1", [saved])
  ).rows[0];
  expect(snapshot.resume_ir.portfolio_url).toBe(
    "https://domenik-wichmann.com/r/saved001",
  );
  expect(snapshot.resume_ir.projects[0].links[0].url).toBe(
    snapshot.resume_ir.portfolio_url,
  );
  expect(snapshot.resume_ir.projects[1].links[0].url).toBe(
    "https://systemwright-lms.web.app/",
  );
  expect(snapshot.tracking_code).toBe("saved001");
  expect(snapshot.generation_record.evidence).toEqual([
    { id: "private-record", hash: "private-hash", revision: "v1" },
  ]);
  expect(snapshot.generation_record.context.design_version).toBe(2);
  expect(
    (
      await db.query("select * from tracking_links where application_id=$1", [
        saved,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from tracking_links where code='unused01'")).rows,
  ).toHaveLength(0);
  await db.query("select save_resume_fixed_content($1,$2)", [
    account,
    JSON.stringify({
      ...clearSignalContent,
      version: 1,
      closing: "Future closing",
    }),
  ]);
  expect(
    (
      await db.query<{ resume_ir: unknown }>(
        "select resume_ir from application_snapshots where application_id=$1",
        [saved],
      )
    ).rows[0].resume_ir,
  ).toEqual(snapshot.resume_ir);
  await expect(
    db.query(
      "update application_snapshots set resume_ir='{}' where application_id=$1",
      [saved],
    ),
  ).rejects.toThrow("IMMUTABLE_SNAPSHOT");
  const collision = await preview();
  await expect(
    db.query("select finalize_application($1,$2,'saved001')", [
      account,
      collision,
    ]),
  ).rejects.toThrow("duplicate key");
  expect(
    (
      await db.query(
        "select * from job_applications where id=(select saved_application_id from application_previews where id=$1)",
        [collision],
      )
    ).rows,
  ).toHaveLength(0);
});

it("initializes the v4 design and fixed content together once, retaining subsequent owner edits", async () => {
  await member(other);
  const initialize = () =>
    db.query<{ v: number }>("select initialize_resume_v4($1,$2,$3) v", [
      otherAccount,
      JSON.stringify(clearSignalContent),
      JSON.stringify(clearSignalDesign),
    ]);
  expect((await initialize()).rows[0].v).toBe(1);
  await db.query("select save_resume_fixed_content($1,$2)", [
    otherAccount,
    JSON.stringify({
      ...clearSignalContent,
      version: 1,
      closing: "Owner revised closing",
    }),
  ]);
  expect((await initialize()).rows[0].v).toBe(2);
  expect(
    (
      await db.query(
        "select * from resume_templates where account_id=$1 and is_default",
        [otherAccount],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ spec: { closing: string } }>(
        "select spec from resume_fixed_content where account_id=$1",
        [otherAccount],
      )
    ).rows[0].spec.closing,
  ).toBe("Owner revised closing");
});
