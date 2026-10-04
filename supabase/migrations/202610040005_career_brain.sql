create table public.career_sources (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts,
 kind text not null check(kind in ('MASTER','INTERVIEW','MANUAL')),
 content text not null check(length(content)<=40000), evidence_text text not null default '' check(length(evidence_text)<=40000), content_hash text not null check(length(content_hash)=64),
 created_at timestamptz not null default now()
);
create table public.skill_categories (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts,
 slug text not null,title text not null,summary text not null default '',is_public boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(account_id,slug)
);
create table public.languages (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts,
 slug text not null,title text not null,subtitle text not null default '',summary text not null default '',is_public boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(account_id,slug)
);
do $$ declare t text; begin
 foreach t in array array['projects','achievements','education','certifications','languages'] loop
  execute format('alter table public.%I add column organization text',t);
  execute format('alter table public.%I add column start_date date',t);
  execute format('alter table public.%I add column end_date date',t);
  execute format('alter table public.%I add constraint %I check(end_date is null or start_date is null or end_date>=start_date)',t,t||'_dates');
 end loop;
end $$;
create trigger update_timestamp before update on public.skill_categories for each row execute function public.set_updated_at();
create trigger update_timestamp before update on public.languages for each row execute function public.set_updated_at();
alter table public.profile add column slug text not null default 'profile';
alter table public.profile add unique(account_id,slug);
alter table public.skills add column category_id uuid references public.skill_categories on delete set null;
do $$ declare t text; begin
 foreach t in array array['profile','experiences','projects','achievements','skills','education','certifications','languages','skill_categories'] loop
  execute format('alter table public.%I add column semantic_hash text not null default repeat(''0'',64) check(length(semantic_hash)=64)',t);
  execute format('alter table public.%I add column source_id uuid references public.career_sources on delete set null',t);
  execute format('alter table public.%I add column source_quote text not null default ''''',t);
  execute format('alter table public.%I add column archived_at timestamptz',t);
 end loop;
end $$;
create table public.experience_achievements (
 account_id uuid not null references public.accounts,experience_id uuid references public.experiences on delete cascade,
 achievement_id uuid references public.achievements on delete cascade,primary key(experience_id,achievement_id)
);
create table public.project_achievements (
 account_id uuid not null references public.accounts,project_id uuid references public.projects on delete cascade,
 achievement_id uuid references public.achievements on delete cascade,primary key(project_id,achievement_id)
);
create table public.career_imports (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts,
 source_id uuid not null references public.career_sources,
 candidates jsonb not null, status text not null default 'DRAFT' check(status in ('DRAFT','APPLIED','REJECTED')),
 reviewed_by uuid references auth.users, accepted_changes jsonb not null default '[]',
 model text not null, created_at timestamptz not null default now(),applied_at timestamptz
);
do $$ declare t text; begin
 foreach t in array array['career_sources','skill_categories','languages','experience_achievements','project_achievements','career_imports'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy account_owner on public.%I to authenticated using(public.is_account_member(account_id)) with check(public.is_account_member(account_id))',t);
  execute format('create trigger account_references before insert or update on public.%I for each row execute function public.check_account_references()',t);
 end loop;
end $$;

-- Accepted patches commit together. New facts stay private until explicitly published.
create function public.apply_career_import(p_import uuid,p_changes jsonb) returns integer
language plpgsql security invoker set search_path=public as $$
declare batch public.career_imports; patch jsonb; t text; row_id uuid; old_hash text; old_archive timestamptz; old_version timestamptz; changed integer:=0;
begin
 select * into batch from career_imports where id=p_import for update;
 if not found or batch.status<>'DRAFT' then raise exception 'IMPORT_NOT_DRAFT'; end if;
 for patch in select value from jsonb_array_elements(p_changes) loop
  t:=case patch->>'kind' when 'profile' then 'profile' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' when 'skill' then 'skills' when 'education' then 'education' when 'certification' then 'certifications' when 'language' then 'languages' when 'category' then 'skill_categories' else null end;
  if t is null then raise exception 'INVALID_ENTITY'; end if;
  row_id:=null; old_hash:=null;
  execute format('select id,semantic_hash,archived_at,updated_at from public.%I where account_id=$1 and slug=$2 for update',t) into row_id,old_hash,old_archive,old_version using batch.account_id,patch->>'key';
  if old_hash is distinct from (patch->>'baseline_hash') or old_version is distinct from nullif(patch->>'baseline_version','')::timestamptz then raise exception 'STALE_IMPORT'; end if;
  if patch->>'action'='ARCHIVE' then
   if row_id is null then raise exception 'MISSING_RECORD'; end if;
   execute format('update public.%I set archived_at=now(),is_public=false,updated_at=now() where id=$1',t) using row_id;
  else
   if row_id is null then
    row_id:=gen_random_uuid();
    if t='profile' then
     insert into profile(id,account_id,slug,name,title,introduction) values(row_id,batch.account_id,patch->>'key',patch->>'title',patch->>'subtitle',patch->>'summary');
    elsif t='skills' then
     insert into skills(id,account_id,slug,name,description) values(row_id,batch.account_id,patch->>'key',patch->>'title',patch->>'summary');
    elsif t='skill_categories' then
     insert into skill_categories(id,account_id,slug,title,summary) values(row_id,batch.account_id,patch->>'key',patch->>'title',patch->>'summary');
    else
     execute format('insert into public.%I(id,account_id,slug,title,subtitle,summary) values($1,$2,$3,$4,$5,$6)',t) using row_id,batch.account_id,patch->>'key',patch->>'title',patch->>'subtitle',patch->>'summary';
    end if;
   else
    if t='profile' then update profile set name=patch->>'title',title=patch->>'subtitle',introduction=patch->>'summary' where id=row_id;
    elsif t='skills' then update skills set name=patch->>'title',description=patch->>'summary' where id=row_id;
    elsif t='skill_categories' then update skill_categories set title=patch->>'title',summary=patch->>'summary' where id=row_id;
    else execute format('update public.%I set title=$2,subtitle=$3,summary=$4 where id=$1',t) using row_id,patch->>'title',patch->>'subtitle',patch->>'summary'; end if;
   end if;
   execute format('update public.%I set semantic_hash=$2,source_id=$3,source_quote=$4,archived_at=null,is_public=false,updated_at=now() where id=$1',t) using row_id,patch->>'hash',batch.source_id,patch->>'source_quote';
   if t in ('experiences','projects','achievements','education','certifications','languages') then
    execute format('update public.%I set organization=$2,start_date=$3::date,end_date=$4::date where id=$1',t) using row_id,patch->>'organization',nullif(patch->>'start_date',''),nullif(patch->>'end_date','');
   end if;
  end if;
  changed:=changed+1;
 end loop;
 -- Resolve relations only after all accepted rows exist; missing references abort the transaction.
 for patch in select value from jsonb_array_elements(p_changes) where value->>'action'<>'ARCHIVE' loop
  t:=case patch->>'kind' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' else null end;
  if t is not null then
   execute format('select id from public.%I where account_id=$1 and slug=$2',t) into row_id using batch.account_id,patch->>'key';
   execute format('delete from public.%I where %I=$1',case t when 'experiences' then 'experience_skills' when 'projects' then 'project_skills' else 'achievement_skills' end,patch->>'kind'||'_id') using row_id;
   declare k text; s uuid; begin
    for k in select jsonb_array_elements_text(patch->'skill_keys') loop
     select id into s from skills where account_id=batch.account_id and slug=k and archived_at is null;
     if s is null then raise exception 'MISSING_SKILL_REFERENCE'; end if;
     execute format('insert into public.%I(account_id,%I,skill_id) values($1,$2,$3)',case t when 'experiences' then 'experience_skills' when 'projects' then 'project_skills' else 'achievement_skills' end,patch->>'kind'||'_id') using batch.account_id,row_id,s;
    end loop;
   end;
  end if;
  if patch->>'kind' in ('experience','project') then
   declare k text; a uuid; jt text; begin
    jt:=case patch->>'kind' when 'experience' then 'experience_achievements' else 'project_achievements' end;
    execute format('delete from public.%I where %I=$1',jt,patch->>'kind'||'_id') using row_id;
    for k in select jsonb_array_elements_text(patch->'achievement_keys') loop
     select id into a from achievements where account_id=batch.account_id and slug=k and archived_at is null;
     if a is null then raise exception 'MISSING_ACHIEVEMENT_REFERENCE'; end if;
     execute format('insert into public.%I(account_id,%I,achievement_id) values($1,$2,$3)',jt,patch->>'kind'||'_id') using batch.account_id,row_id,a;
    end loop;
   end;
  elsif patch->>'kind'='skill' then
   declare c uuid; begin
    c:=null;
    if patch->>'category_key' is not null then
     select id into c from skill_categories where account_id=batch.account_id and slug=patch->>'category_key' and archived_at is null;
     if c is null then raise exception 'MISSING_CATEGORY_REFERENCE'; end if;
    end if;
    update skills set category_id=c where account_id=batch.account_id and slug=patch->>'key';
   end;
  end if;
 end loop;
 update career_imports set status='APPLIED',applied_at=now(),reviewed_by=auth.uid(),accepted_changes=p_changes where id=p_import;
 return changed;
end $$;
revoke all on function public.apply_career_import(uuid,jsonb) from public,anon;
grant execute on function public.apply_career_import(uuid,jsonb) to authenticated;
