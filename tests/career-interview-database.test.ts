import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { emptyMemory } from "../src/lib/interview/model";
let db: PGlite, account: string, otherAccount: string;
const user = randomUUID(),
  otherUser = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const name of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [user, otherUser]);
  account = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      user,
    ])
  ).rows[0].id;
  otherAccount = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      otherUser,
    ])
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
async function member(id = user) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function create(mode = "general", role = "", job = "") {
  await member();
  return (
    await db.query<{ id: string }>(
      "insert into career_interview_sessions(account_id,mode,title,target_role,job_description) values($1,$2,'Fictional controlled interview',$3,$4) returning id",
      [account, mode, role, job],
    )
  ).rows[0].id;
}
async function begin(
  id: string,
  version = 0,
  answer: string | null = null,
  review = false,
) {
  const token = randomUUID();
  await db.query("select begin_career_interview($1,$2,$3,$4,$5)", [
    id,
    version,
    token,
    answer,
    review,
  ]);
  return token;
}
async function complete(
  id: string,
  token: string,
  question = "Who used the fictional tool?",
) {
  await db.query(
    "select complete_career_interview($1,$2,$3,'Evidence gap', $4)",
    [id, token, question, JSON.stringify(emptyMemory())],
  );
}
it("persists independent session goals and transcripts through fresh reads and archived history", async () => {
  const first = await create("role", "AI transformation"),
    second = await create(
      "job",
      "",
      "Fictional job requires SQL and adoption.",
    );
  await complete(first, await begin(first));
  await complete(
    first,
    await begin(first, 1, "I showed a coworker the validation rules."),
  );
  const fresh = (
    await db.query<{
      target_role: string;
      turn_count: number;
      version: number;
    }>(
      "select target_role,turn_count,version from career_interview_sessions where id=$1",
      [first],
    )
  ).rows[0];
  expect(fresh.target_role).toBe("AI transformation");
  expect(fresh.turn_count).toBe(2);
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1",
        [second],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<{ job_description: string }>(
        "select job_description from career_interview_sessions where id=$1",
        [second],
      )
    ).rows[0].job_description,
  ).toContain("SQL");
  await db.query(
    "update career_interview_sessions set status='ARCHIVED',title='Renamed interview' where id=$1",
    [first],
  );
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1",
        [first],
      )
    ).rows,
  ).toHaveLength(3);
  await expect(begin(first, 2)).rejects.toThrow("INTERVIEW_CLOSED");
  await expect(
    db.query("delete from career_interview_messages where session_id=$1", [
      first,
    ]),
  ).rejects.toThrow("permission denied");
});
it("isolates sessions/messages and rejects cross-account session references and anonymous access", async () => {
  const id = await create();
  await complete(id, await begin(id));
  await member(otherUser);
  expect(
    (
      await db.query("select * from career_interview_sessions where id=$1", [
        id,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1",
        [id],
      )
    ).rows,
  ).toEqual([]);
  await expect(begin(id)).rejects.toThrow("INTERVIEW_NOT_FOUND");
  await expect(
    db.query(
      "insert into career_interview_messages(account_id,session_id,role,content) values($1,$2,'user','Forged')",
      [otherAccount, id],
    ),
  ).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select * from career_interview_sessions"),
  ).rejects.toThrow("permission denied");
  await expect(begin(id)).rejects.toThrow("permission denied");
});
it("saves answers before inference, blocks concurrent/stale turns, and retries without duplication", async () => {
  const id = await create();
  await complete(id, await begin(id));
  const token = await begin(id, 1, "I introduced the tool myself.");
  await expect(begin(id, 1, "Another tab")).rejects.toThrow(
    "INTERVIEW_BUSY_OR_STALE",
  );
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1 and role='user'",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await db.query(
    "update career_interview_sessions set pending_until=now()-interval '1 second' where id=$1",
    [id],
  );
  const retry = await begin(id, 2);
  await expect(complete(id, token)).rejects.toThrow("INTERVIEW_STALE_LEASE");
  await complete(id, retry, "How did your coworker start using it?");
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1 and role='user'",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(begin(id, 3)).rejects.toThrow("INTERVIEW_ANSWER_REQUIRED");
});
it("checkpoint and finish create only private reviewed INTERVIEW drafts; canonical tables stay unchanged", async () => {
  const id = await create();
  await complete(id, await begin(id));
  const answer =
    "I explained fictional technical failures to customers in German.";
  await complete(id, await begin(id, 1, answer));
  const through = (
    await db.query<{ sequence: number }>(
      "select sequence from career_interview_messages where session_id=$1 and role='user'",
      [id],
    )
  ).rows[0].sequence;
  const before = (
    await db.query<{ count: number }>(
      "select count(*)::int count from projects where account_id=$1",
      [account],
    )
  ).rows[0].count;
  const token = await begin(id, 2, null, true);
  const batch = (
    await db.query<{ id: string }>(
      "select review_career_interview($1,$2,$3,'Question: Did you train 100 people?',repeat('a',64),'[]',$4,true) id",
      [id, token, answer, through],
    )
  ).rows[0].id;
  const stored = (
    await db.query<{ kind: string; evidence_text: string; status: string }>(
      "select s.kind,s.evidence_text,i.status from career_sources s join career_imports i on i.source_id=s.id where i.id=$1",
      [batch],
    )
  ).rows[0];
  expect(stored).toEqual({
    kind: "INTERVIEW",
    evidence_text: answer,
    status: "DRAFT",
  });
  expect(
    (
      await db.query<{ status: string }>(
        "select status from career_interview_sessions where id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("FINISHED");
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from projects where account_id=$1",
        [account],
      )
    ).rows[0].count,
  ).toBe(before);
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(3);
});
it("rolls back failed checkpoint drafts and rejects another account's deep-dive target", async () => {
  const id = await create();
  await complete(id, await begin(id));
  await complete(
    id,
    await begin(id, 1, "I wrote fictional validation checks."),
  );
  const through = (
    await db.query<{ sequence: number }>(
      "select sequence from career_interview_messages where session_id=$1 and role='user'",
      [id],
    )
  ).rows[0].sequence;
  const count = (
    await db.query<{ n: number }>(
      "select count(*)::int n from career_sources where account_id=$1",
      [account],
    )
  ).rows[0].n;
  const token = await begin(id, 2, null, true);
  await expect(
    db.query(
      "select review_career_interview($1,$2,'I wrote fictional validation checks.','', repeat('a',64),null,$3,false)",
      [id, token, through],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from career_sources where account_id=$1",
        [account],
      )
    ).rows[0].n,
  ).toBe(count);
  await db.exec("reset role");
  const otherRecord = (
    await db.query<{ id: string }>(
      "insert into projects(account_id,slug,title,summary) values($1,'foreign','Other tenant','Fictional foreign fixture') returning id",
      [otherAccount],
    )
  ).rows[0].id;
  await member();
  await expect(
    db.query(
      "insert into career_interview_sessions(account_id,mode,title,target_record_id) values($1,'record','Foreign target',$2)",
      [account, otherRecord],
    ),
  ).rejects.toThrow("CROSS_ACCOUNT_INTERVIEW_TARGET");
});
it("rejects completion and review without a real acquired lease, including null tokens", async () => {
  const id = await create();
  await expect(
    db.query(
      "select complete_career_interview($1,null,'Unleased question','', $2)",
      [id, JSON.stringify(emptyMemory())],
    ),
  ).rejects.toThrow("INTERVIEW_STALE_LEASE");
  await expect(
    db.query(
      "select review_career_interview($1,null,'Unleased fictional evidence','',repeat('a',64),'[]',1,false)",
      [id],
    ),
  ).rejects.toThrow("INTERVIEW_STALE_LEASE");
  expect(
    (
      await db.query(
        "select * from career_interview_messages where session_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
});
