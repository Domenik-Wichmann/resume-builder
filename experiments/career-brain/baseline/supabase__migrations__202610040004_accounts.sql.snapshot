-- Existing records remain attached to the original portfolio; no data is reset.
create table public.accounts (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 kind text not null default 'NORMAL' check(kind in ('NORMAL','DEMO')),
 billing_mode text not null default 'PLATFORM_CREDITS' check(billing_mode in ('PLATFORM_CREDITS','BYOK')),
 created_at timestamptz not null default now()
);
insert into public.accounts(id,slug) values('00000000-0000-4000-8000-000000000001','portfolio');
create table public.account_members (
 account_id uuid references public.accounts on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null default 'OWNER' check(role='OWNER'),
 primary key(account_id,user_id), unique(user_id)
);
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
create function public.is_account_member(p_account uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.account_members where account_id=p_account and user_id=auth.uid());
$$;
revoke all on function public.is_account_member(uuid) from public,anon;
grant execute on function public.is_account_member(uuid) to authenticated,service_role;
create policy member_read on public.accounts for select to authenticated using(public.is_account_member(id));
create policy self_read on public.account_members for select to authenticated using(user_id=auth.uid());
grant select on public.accounts,public.account_members to authenticated;
grant all on public.accounts,public.account_members to service_role;
revoke all on public.accounts,public.account_members from anon;

-- Only the server may request bootstrap after verifying the Auth user.
create function public.bootstrap_account(p_user uuid,p_primary boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare a uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select account_id into a from public.account_members where user_id=p_user;
 if a is not null then return a; end if;
 if p_primary then
   a:='00000000-0000-4000-8000-000000000001';
   if exists(select 1 from public.account_members where account_id=a and user_id<>p_user) then raise exception 'PRIMARY_OWNER_EXISTS'; end if;
 else
   insert into public.accounts(slug) values('account-'||p_user::text) returning id into a;
 end if;
 insert into public.account_members(account_id,user_id) values(a,p_user);
 return a;
end $$;
revoke all on function public.bootstrap_account(uuid,boolean) from public,anon,authenticated;
grant execute on function public.bootstrap_account(uuid,boolean) to service_role;

-- Membership RLS replaces all direct public career reads. Public pages use scoped server queries.
do $$ declare t text; p record; begin
 foreach t in array array['profile','skills','experiences','projects','achievements','education','certifications','experience_skills','project_skills','achievement_skills','job_applications','resume_versions','tracking_links','tracking_events','career_embeddings','profile_presentations','anonymous_visitors','workspaces','workspace_requirements','workspace_evidence','workspace_questions','question_evidence','question_topics','workspace_projections','workspace_events'] loop
  execute format('alter table public.%I add column account_id uuid not null default ''00000000-0000-4000-8000-000000000001'' references public.accounts',t);
  execute format('create index %I on public.%I(account_id)',t||'_account',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy account_owner on public.%I to authenticated using(public.is_account_member(account_id)) with check(public.is_account_member(account_id))',t);
 end loop;
 foreach t in array array['skills','experiences','projects','achievements','education','certifications'] loop
  execute format('alter table public.%I drop constraint %I',t,t||'_slug_key');
  execute format('alter table public.%I add unique(account_id,slug)',t);
 end loop;
end $$;

-- Reject cross-account foreign-key attachments, including service-role writes.
create function public.check_account_references() returns trigger language plpgsql
set search_path=public as $$
declare f record; parent_account uuid; v text;
begin
 if tg_op='UPDATE' and new.account_id<>old.account_id then raise exception 'ACCOUNT_IMMUTABLE'; end if;
 for f in
 select child.attname as child_column, n.nspname as parent_schema, parent.relname as parent_table, pa.attname as parent_column
 from pg_constraint c
 join pg_class parent on parent.oid=c.confrelid join pg_namespace n on n.oid=parent.relnamespace
 join pg_attribute child on child.attrelid=c.conrelid and child.attnum=c.conkey[1]
 join pg_attribute pa on pa.attrelid=c.confrelid and pa.attnum=c.confkey[1]
 where c.conrelid=tg_relid and c.contype='f' and array_length(c.conkey,1)=1
 and child.attname<>'account_id'
 and exists(select 1 from pg_attribute a where a.attrelid=c.confrelid and a.attname='account_id' and not a.attisdropped)
 loop
  v:=to_jsonb(new)->>f.child_column;
  if v is not null then
   execute format('select account_id from %I.%I where %I=$1::uuid',f.parent_schema,f.parent_table,f.parent_column) into parent_account using v;
   if parent_account is distinct from new.account_id then raise exception 'CROSS_ACCOUNT_REFERENCE'; end if;
  end if;
 end loop;
 return new;
end $$;
do $$ declare t text; begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='account_id' and table_name<>'account_members' and table_name in (select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE') loop
  execute format('create trigger account_references before insert or update on public.%I for each row execute function public.check_account_references()',t);
 end loop;
end $$;

create or replace view public.career_entity_visibility with (security_invoker=true) as
 select 'experience'::text as entity_type,id as entity_id,is_public,account_id from public.experiences
 union all select 'project',id,is_public,account_id from public.projects
 union all select 'achievement',id,is_public,account_id from public.achievements
 union all select 'skill',id,is_public,account_id from public.skills
 union all select 'education',id,is_public,account_id from public.education
 union all select 'certification',id,is_public,account_id from public.certifications;
-- Retire the unscoped search entry point, keeping existing history intact.
revoke execute on function public.match_career_embeddings(extensions.vector,text,integer,double precision,text[]) from service_role;
create function public.match_account_embeddings(
 p_account_id uuid,query_embedding extensions.vector(1024),requested_model text,
 match_count integer default 8,min_similarity double precision default 0.25,entity_types text[] default null
) returns table(entity_type text,entity_id uuid,content_hash text,similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
 select e.entity_type,e.entity_id,e.content_hash,1-(e.embedding <=> query_embedding)
 from career_embeddings e join career_entity_visibility v on v.entity_type=e.entity_type and v.entity_id=e.entity_id and v.account_id=e.account_id
 where e.account_id=p_account_id and v.is_public and e.embedding_model=requested_model
 and (entity_types is null or e.entity_type=any(entity_types))
 and 1-(e.embedding <=> query_embedding)>=greatest(0,min_similarity)
 order by e.embedding <=> query_embedding limit least(greatest(match_count,1),20);
$$;
revoke all on function public.match_account_embeddings(uuid,extensions.vector,text,integer,double precision,text[]) from public,anon,authenticated;
grant execute on function public.match_account_embeddings(uuid,extensions.vector,text,integer,double precision,text[]) to service_role;

