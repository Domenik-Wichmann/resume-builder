import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { defaultDesign } from "../src/lib/resume-design/model";
let db: PGlite, account: string, otherAccount: string;
const user = randomUUID(),
  other = randomUUID();
beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [user, other]);
  account = (
    await db.query<{ id: string }>("select bootstrap_account($1,false) id", [
      user,
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
async function member(id = user) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
const template = (overrides = {}) => ({
  id: randomUUID(),
  name: "Synthetic design",
  version: 0,
  spec: defaultDesign,
  reference_id: null,
  notes: "Fictional qualification request",
  limitations: [],
  is_default: false,
  ...overrides,
});
async function save(value: ReturnType<typeof template>, aid = account) {
  return db.query<{ version: number }>(
    "select save_resume_template($1,$2::jsonb) version",
    [aid, JSON.stringify(value)],
  );
}
it("keeps templates and original references private across accounts and denies anonymous authoring", async () => {
  await member();
  const t = template();
  await save(t);
  await member(other);
  expect(
    (await db.query("select * from resume_templates where id=$1", [t.id])).rows,
  ).toHaveLength(0);
  await expect(save({ ...t, version: 1 }, account)).rejects.toThrow(
    "ACCOUNT_REQUIRED",
  );
  await db.exec("reset role;set role anon");
  await expect(save(template())).rejects.toThrow("permission denied");
  await expect(db.query("select * from owner_assets")).rejects.toThrow(
    "permission denied",
  );
});
it("preserves revisions, rejects stale updates and activates one design atomically", async () => {
  await member();
  const first = template({ is_default: true });
  await save(first);
  await save({
    ...first,
    version: 1,
    spec: { ...defaultDesign, accent: "#123456" },
  });
  await expect(save({ ...first, version: 1 })).rejects.toThrow(
    "STALE_TEMPLATE",
  );
  const second = template({ is_default: true });
  await save(second);
  expect(
    (
      await db.query(
        "select id from resume_templates where account_id=$1 and is_default",
        [account],
      )
    ).rows,
  ).toEqual([{ id: second.id }]);
  expect(
    (
      await db.query(
        "select version from resume_template_revisions where template_id=$1 order by version",
        [first.id],
      )
    ).rows,
  ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
  await expect(
    db.query("update resume_templates set is_default=true where id=$1", [
      first.id,
    ]),
  ).rejects.toThrow("permission denied");
});
it("rejects cross-account references and unsafe styles without changing the current default", async () => {
  await member(other);
  const reference = randomUUID();
  await db.query(
    "insert into owner_assets(id,account_id,kind,name,storage_path,mime_type) values($1,$2,'REFERENCE','Synthetic',$3,'image/png')",
    [reference, otherAccount, `${otherAccount}/${reference}.png`],
  );
  await member();
  await expect(
    save(template({ reference_id: reference, is_default: true })),
  ).rejects.toThrow("INVALID_REFERENCE");
  const old = (
    await db.query(
      "select id from resume_templates where account_id=$1 and is_default",
      [account],
    )
  ).rows;
  await expect(
    save(
      template({
        spec: { ...defaultDesign, accent: "url(javascript:alert(1))" },
        is_default: true,
      }),
    ),
  ).rejects.toThrow("check constraint");
  expect(
    (
      await db.query(
        "select id from resume_templates where account_id=$1 and is_default",
        [account],
      )
    ).rows,
  ).toEqual(old);
});
it("stores presentation changes separately from canonical facts and checks stale versions", async () => {
  await member();
  const profile = randomUUID();
  await db.query(
    "insert into profile(id,account_id,slug,name,title,introduction,semantic_hash) values($1,$2,'synthetic-profile','Synthetic Name','Synthetic Role','Fictional source',$3)",
    [profile, account, "a".repeat(64)],
  );
  const settings = {
    market: "US",
    location: "Example City",
    address: "",
    contact_email: "example@example.invalid",
    phone: "",
    work_authorization: "",
    photo_url: "",
    is_public: false,
    version: 0,
  };
  await db.query("select save_profile_presentation($1,$2,$3::jsonb)", [
    account,
    profile,
    JSON.stringify(settings),
  ]);
  await expect(
    db.query("select save_profile_presentation($1,$2,$3::jsonb)", [
      account,
      profile,
      JSON.stringify(settings),
    ]),
  ).rejects.toThrow("STALE_PRESENTATION");
  expect(
    (
      await db.query("select name,semantic_hash from profile where id=$1", [
        profile,
      ])
    ).rows[0],
  ).toEqual({ name: "Synthetic Name", semantic_hash: "a".repeat(64) });
});
it("validates portrait ownership and prevents deleting photos used by a contact presentation", async () => {
  await member();
  const photo = randomUUID(),
    reference = randomUUID(),
    profile = randomUUID();
  await db.query(
    "insert into profile(id,account_id,slug,name,title,introduction,semantic_hash) values($1,$2,$3,'Synthetic Name','Synthetic Role','Fictional',$4)",
    [profile, account, `photo-${profile}`, "b".repeat(64)],
  );
  for (const [id, kind] of [
    [photo, "PORTRAIT"],
    [reference, "REFERENCE"],
  ])
    await db.query(
      "insert into owner_assets(id,account_id,kind,name,storage_path,mime_type) values($1,$2,$3,'Synthetic',$4,'image/png')",
      [id, account, kind, `${account}/${id}.png`],
    );
  const settings = {
    market: "US",
    location: "",
    address: "",
    contact_email: "",
    phone: "",
    work_authorization: "",
    photo_url: `/assets/${photo}`,
    is_public: false,
    version: 0,
  };
  await db.query("select save_profile_presentation($1,$2,$3::jsonb)", [
    account,
    profile,
    JSON.stringify(settings),
  ]);
  await expect(
    db.query("delete from owner_assets where id=$1", [photo]),
  ).rejects.toThrow("PORTRAIT_IN_USE");
  await expect(
    db.query("select save_profile_presentation($1,$2,$3::jsonb)", [
      account,
      profile,
      JSON.stringify({
        ...settings,
        version: 1,
        photo_url: `/assets/${reference}`,
      }),
    ]),
  ).rejects.toThrow("PORTRAIT_REQUIRED");
  await db.query("select save_profile_presentation($1,$2,$3::jsonb)", [
    account,
    profile,
    JSON.stringify({ ...settings, version: 1, photo_url: "" }),
  ]);
  await db.query("delete from owner_assets where id=$1", [photo]);
  expect(
    (await db.query("select id from owner_assets where id=$1", [photo])).rows,
  ).toHaveLength(0);
});
