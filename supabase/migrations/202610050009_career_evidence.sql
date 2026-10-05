-- Additive evidence state. Existing canonical records remain intact; an absent row
-- means pending backfill, never fabricated claim provenance or confirmation.
create table public.career_record_evidence (
 account_id uuid not null references public.accounts,
 kind text not null check(kind in ('profile','experience','project','achievement','skill','education','certification','language','category')),
 entity_id uuid not null,
 canonical_version timestamptz not null,
 canonical_hash text not null,
 aliases jsonb not null default '[]' check(jsonb_typeof(aliases)='array'),
 claims jsonb not null default '[]' check(jsonb_typeof(claims)='array'),
 import_id uuid not null references public.career_imports,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(account_id,kind,entity_id)
);
alter table public.career_record_evidence enable row level security;
revoke all on public.career_record_evidence from public,anon,authenticated;
grant select on public.career_record_evidence to authenticated;
grant all on public.career_record_evidence to service_role;
create policy member_read on public.career_record_evidence for select to authenticated
 using(public.is_account_member(account_id));

-- Canonical patches and separately reviewed availability/provenance commit in
-- one transaction. Metadata-only reviews keep the historical primary source ID.
create function public.apply_career_brain_import(p_import uuid,p_changes jsonb,p_states jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare batch public.career_imports; state jsonb; patch jsonb; claim jsonb; span jsonb;
 t text; row_id uuid; row_version timestamptz; row_hash text; evidence_version timestamptz;
 changed integer; source_text text;
begin
 select * into batch from career_imports where id=p_import for update;
 if not found or batch.status<>'DRAFT' then raise exception 'IMPORT_NOT_DRAFT'; end if;
 if auth.uid() is null or not public.is_account_member(batch.account_id) then raise exception 'NOT_ACCOUNT_MEMBER'; end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_typeof(p_states)<>'array'
  or jsonb_array_length(p_changes)>150 or jsonb_array_length(p_states)>150 then raise exception 'INVALID_STATE'; end if;
 if (select count(*) from jsonb_array_elements(p_states)) <>
  (select count(distinct (value->>'kind')||':'||(value->>'key')) from jsonb_array_elements(p_states)) then raise exception 'DUPLICATE_STATE'; end if;
 for state in select value from jsonb_array_elements(p_states) loop
  t:=case state->>'kind' when 'profile' then 'profile' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' when 'skill' then 'skills' when 'education' then 'education' when 'certification' then 'certifications' when 'language' then 'languages' when 'category' then 'skill_categories' else null end;
  if t is null or state->>'key' is null then raise exception 'INVALID_ENTITY'; end if;
  row_id:=null; row_hash:=null; row_version:=null; evidence_version:=null;
  execute format('select id,semantic_hash,updated_at from public.%I where account_id=$1 and slug=$2 for update',t)
   into row_id,row_hash,row_version using batch.account_id,state->>'key';
  if row_hash is distinct from (state->>'baseline_hash') or row_version is distinct from nullif(state->>'baseline_version','')::timestamptz then raise exception 'STALE_IMPORT'; end if;
  if row_id is not null then
   select updated_at into evidence_version from career_record_evidence where account_id=batch.account_id and kind=state->>'kind' and entity_id=row_id for update;
  end if;
  if evidence_version is distinct from nullif(state->>'evidence_version','')::timestamptz then raise exception 'STALE_EVIDENCE'; end if;
  if jsonb_typeof(state->'aliases')<>'array' or jsonb_array_length(state->'aliases')>12
   or jsonb_typeof(state->'claims')<>'array' or jsonb_array_length(state->'claims')>100 then raise exception 'INVALID_STATE'; end if;
  for claim in select value from jsonb_array_elements(state->'claims') loop
   if coalesce(claim->>'availability','') not in ('CONFIRMED','PENDING_REVIEW','DISPUTED','SUPERSEDED','REMOVED')
    or coalesce(claim->>'attribute','') not in ('action','tool','metric','ownership','scope','credential','language','depth','context','denial','correction')
    or coalesce(claim->>'attribution','') not in ('PERSONAL','TEAM','EXPOSURE','NEGATED','UNCERTAIN')
    or coalesce(length(claim->>'value'),0) not between 1 and 500
    or jsonb_typeof(claim->'evidence')<>'array' or jsonb_array_length(claim->'evidence') not between 1 and 6 then raise exception 'INVALID_CLAIM'; end if;
   for span in select value from jsonb_array_elements(claim->'evidence') loop
    source_text:=null;
    select evidence_text into source_text from career_sources where id=(span->>'source_id')::uuid and account_id=batch.account_id;
    if source_text is null or coalesce(length(span->>'quote'),0) not between 1 and 2000
     or position((span->>'quote') in source_text)=0 then raise exception 'INVALID_CLAIM_PROVENANCE'; end if;
   end loop;
  end loop;
 end loop;
 for patch in select value from jsonb_array_elements(p_changes) loop
  if not exists(select 1 from jsonb_array_elements(p_states) s where s->>'kind'=patch->>'kind' and s->>'key'=patch->>'key') then raise exception 'MISSING_REVIEWED_STATE'; end if;
  if coalesce(patch->>'action','') not in ('UPSERT','ARCHIVE') then raise exception 'INVALID_ACTION'; end if;
  if patch->>'action'='UPSERT' then
   select evidence_text into source_text from career_sources where id=batch.source_id and account_id=batch.account_id;
   if source_text is null or coalesce(length(patch->>'source_quote'),0)=0 or position((patch->>'source_quote') in source_text)=0 then raise exception 'INVALID_PRIMARY_PROVENANCE'; end if;
  end if;
 end loop;
 changed:=public.apply_career_import(p_import,p_changes);
 for state in select value from jsonb_array_elements(p_states) loop
  t:=case state->>'kind' when 'profile' then 'profile' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' when 'skill' then 'skills' when 'education' then 'education' when 'certification' then 'certifications' when 'language' then 'languages' when 'category' then 'skill_categories' end;
  execute format('select id,semantic_hash,updated_at from public.%I where account_id=$1 and slug=$2',t)
   into row_id,row_hash,row_version using batch.account_id,state->>'key';
  if row_id is null then raise exception 'MISSING_RECORD'; end if;
  insert into career_record_evidence(account_id,kind,entity_id,canonical_version,canonical_hash,aliases,claims,import_id)
   values(batch.account_id,state->>'kind',row_id,row_version,row_hash,state->'aliases',state->'claims',p_import)
   on conflict(account_id,kind,entity_id) do update set canonical_version=excluded.canonical_version,canonical_hash=excluded.canonical_hash,
    aliases=excluded.aliases,claims=excluded.claims,import_id=excluded.import_id,updated_at=greatest(clock_timestamp(),career_record_evidence.updated_at+interval '1 microsecond');
 end loop;
 return changed;
end $$;
revoke all on function public.apply_career_brain_import(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.apply_career_brain_import(uuid,jsonb,jsonb) to authenticated;
