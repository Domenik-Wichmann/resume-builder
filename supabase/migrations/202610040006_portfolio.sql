-- Additive portfolio authoring; canonical projects and existing relationships remain authoritative.
alter table public.projects
 add column description text not null default '' check(length(description)<=20000),
 add column status text not null default 'OTHER' check(status in ('PLANNED','ACTIVE','COMPLETED','PAUSED','OTHER')),
 add column featured boolean not null default false,
 add column display_order integer not null default 0 check(display_order between 0 and 10000);

create table public.project_links (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 label text not null check(length(label) between 1 and 100),
 link_type text not null check(link_type in ('LIVE','GITHUB','DEMO','TRIAL','CASE_STUDY','DOCUMENTATION','OTHER')),
 url text not null check(length(url)<=2000 and (url ~ '^https://[^[:space:]\\]+$' or url ~ '^/(projects|explore|answers|workspace|resume)(/[a-z0-9-]+)?(#[a-z0-9-]+)?$')),
 display_order integer not null default 0 check(display_order between 0 and 10000), is_public boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.project_media (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 storage_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','image/gif')),
 alt text not null check(length(alt) between 1 and 300), caption text not null default '' check(length(caption)<=500),
 is_cover boolean not null default false, display_order integer not null default 0 check(display_order between 0 and 10000),
 created_at timestamptz not null default now(),
 check(storage_path like account_id::text || '/' || project_id::text || '/%')
);
create unique index project_one_cover on public.project_media(project_id) where is_cover;
-- Private bucket: there are deliberately no direct anonymous/authenticated object policies.
-- Server media routes verify the parent project before downloading with the service credential.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('project-media','project-media',false,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do nothing;
 end if;
end $$;

create table public.answer_cards (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 question text not null check(length(question) between 3 and 1000), answer text not null check(length(answer) between 1 and 5000),
 is_public boolean not null default false, display_priority integer not null default 0 check(display_priority between 0 and 10000),
 generated_at timestamptz, expires_at timestamptz not null default now()+interval '90 days', stale boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(account_id,slug)
);
create table public.answer_card_sources (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 card_id uuid not null references public.answer_cards on delete cascade,
 profile_id uuid references public.profile on delete restrict,
 experience_id uuid references public.experiences on delete restrict,
 project_id uuid references public.projects on delete restrict,
 achievement_id uuid references public.achievements on delete restrict,
 skill_id uuid references public.skills on delete restrict,
 education_id uuid references public.education on delete restrict,
 certification_id uuid references public.certifications on delete restrict,
 language_id uuid references public.languages on delete restrict,
 category_id uuid references public.skill_categories on delete restrict,
 check(num_nonnulls(profile_id,experience_id,project_id,achievement_id,skill_id,education_id,certification_id,language_id,category_id)=1)
);
create table public.explorer_events (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 workspace_id uuid not null references public.workspaces on delete cascade,
 event_type text not null check(event_type in ('skill_explored','category_explored','project_viewed')),
 skill_id uuid references public.skills on delete cascade,
 category_id uuid references public.skill_categories on delete cascade,
 project_id uuid references public.projects on delete cascade,
 created_at timestamptz not null default now(),
 check((event_type='skill_explored' and skill_id is not null and category_id is null and project_id is null)
 or (event_type='category_explored' and category_id is not null and skill_id is null and project_id is null)
 or (event_type='project_viewed' and project_id is not null and skill_id is null and category_id is null))
);
create index explorer_events_account_time on public.explorer_events(account_id,created_at);
do $$ declare t text; begin
 foreach t in array array['project_links','project_media','answer_cards','answer_card_sources','explorer_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant all on public.%I to authenticated,service_role',t);
  execute format('create policy account_owner on public.%I for all to authenticated using (public.is_account_member(account_id)) with check (public.is_account_member(account_id))',t);
  execute format('create trigger account_reference before insert or update on public.%I for each row execute function public.check_account_references()',t);
  execute format('create index on public.%I(account_id)',t);
 end loop;
end $$;
create trigger update_timestamp before update on public.answer_cards for each row execute function public.set_updated_at();

-- Direct dependencies only; no regeneration, model call, or recursive dependency traversal.
create function public.stale_answer_cards() returns trigger language plpgsql security definer set search_path=public as $$
declare ref text; entity uuid;
begin
 ref:=case tg_table_name when 'profile' then 'profile_id' when 'experiences' then 'experience_id' when 'projects' then 'project_id'
 when 'achievements' then 'achievement_id' when 'skills' then 'skill_id' when 'education' then 'education_id'
 when 'certifications' then 'certification_id' when 'languages' then 'language_id' when 'skill_categories' then 'category_id'
 when 'project_skills' then 'project_id' when 'project_achievements' then 'project_id'
 when 'experience_skills' then 'experience_id' when 'experience_achievements' then 'experience_id' when 'achievement_skills' then 'achievement_id' end;
 if tg_table_name in ('project_skills','project_achievements','experience_skills','experience_achievements','achievement_skills') then
  entity:=coalesce(to_jsonb(new)->>ref,to_jsonb(old)->>ref)::uuid;
 else
  if tg_op='UPDATE' and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
  entity:=old.id;
 end if;
 execute format('update public.answer_cards set stale=true where id in (select card_id from public.answer_card_sources where %I=$1)',ref) using entity;
 return coalesce(new,old);
end $$;
revoke all on function public.stale_answer_cards() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['profile','experiences','projects','achievements','skills','education','certifications','languages','skill_categories'] loop
  execute format('create trigger stale_cards after update on public.%I for each row execute function public.stale_answer_cards()',t);
 end loop;
 foreach t in array array['project_skills','project_achievements','experience_skills','experience_achievements','achievement_skills'] loop
  execute format('create trigger stale_cards after insert or update or delete on public.%I for each row execute function public.stale_answer_cards()',t);
 end loop;
end $$;

-- One transaction for content, links and canonical relationships. RLS remains the authority.
create function public.save_project(p_account uuid,p_project jsonb,p_hash text) returns uuid language plpgsql security invoker set search_path=public as $$
declare pid uuid; old_version timestamptz; item jsonb; sid uuid;
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 pid:=nullif(p_project->>'id','')::uuid;
 if pid is not null then
  select updated_at into old_version from public.projects where id=pid and account_id=p_account for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if old_version is distinct from (p_project->>'baseline_version')::timestamptz then raise exception 'STALE_PROJECT'; end if;
 else
  pid:=gen_random_uuid();
  insert into public.projects(id,account_id,slug,title,summary) values(pid,p_account,p_project->>'slug',p_project->>'title',p_project->>'summary');
 end if;
 update public.projects set slug=p_project->>'slug',title=p_project->>'title',subtitle=p_project->>'subtitle',summary=p_project->>'summary',
 description=p_project->>'description',organization=nullif(p_project->>'organization',''),start_date=(p_project->>'start_date')::date,end_date=(p_project->>'end_date')::date,
 status=p_project->>'status',featured=(p_project->>'featured')::boolean,display_order=(p_project->>'display_order')::integer,
 is_public=(p_project->>'is_public')::boolean and not (p_project->>'archived')::boolean,
 archived_at=case when (p_project->>'archived')::boolean then now() else null end,semantic_hash=p_hash where id=pid;
 delete from public.project_skills where project_id=pid;
 for sid in select distinct value::uuid from jsonb_array_elements_text(p_project->'skill_ids') loop
  if not exists(select 1 from public.skills where id=sid and account_id=p_account and archived_at is null) then raise exception 'INVALID_SKILL'; end if;
  insert into public.project_skills(account_id,project_id,skill_id) values(p_account,pid,sid);
 end loop;
 delete from public.project_achievements where project_id=pid;
 for sid in select distinct value::uuid from jsonb_array_elements_text(p_project->'achievement_ids') loop
  if not exists(select 1 from public.achievements where id=sid and account_id=p_account and archived_at is null) then raise exception 'INVALID_ACHIEVEMENT'; end if;
  insert into public.project_achievements(account_id,project_id,achievement_id) values(p_account,pid,sid);
 end loop;
 delete from public.project_links where project_id=pid;
 for item in select value from jsonb_array_elements(p_project->'links') loop
  insert into public.project_links(account_id,project_id,label,link_type,url,display_order,is_public)
  values(p_account,pid,item->>'label',item->>'link_type',item->>'url',(item->>'display_order')::integer,(item->>'is_public')::boolean);
 end loop;
 return pid;
end $$;
revoke all on function public.save_project(uuid,jsonb,text) from public,anon;
grant execute on function public.save_project(uuid,jsonb,text) to authenticated;

create function public.save_answer_card(p_account uuid,p_card jsonb,p_sources jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare cid uuid; item jsonb; field text;
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 if jsonb_array_length(p_sources)<1 or jsonb_array_length(p_sources)>20 then raise exception 'CARD_REQUIRES_SOURCES'; end if;
 cid:=nullif(p_card->>'id','')::uuid;
 if cid is null then
  cid:=gen_random_uuid();
  insert into public.answer_cards(id,account_id,slug,question,answer) values(cid,p_account,p_card->>'slug',p_card->>'question',p_card->>'answer');
 else
  perform 1 from public.answer_cards where id=cid and account_id=p_account for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
 end if;
 update public.answer_cards set slug=p_card->>'slug',question=p_card->>'question',answer=p_card->>'answer',is_public=false,
 display_priority=(p_card->>'display_priority')::integer,expires_at=now()+make_interval(days=>(p_card->>'review_days')::integer),stale=false,
 generated_at=case when (p_card->>'generated')::boolean then now() else generated_at end where id=cid;
 delete from public.answer_card_sources where card_id=cid;
 for item in select value from jsonb_array_elements(p_sources) loop
  if item->>'kind' not in ('profile','experience','project','achievement','skill','education','certification','language','category') then raise exception 'INVALID_SOURCE'; end if;
  field:=item->>'kind'||'_id';
  execute format('insert into public.answer_card_sources(account_id,card_id,%I) values($1,$2,$3)',field) using p_account,cid,(item->>'id')::uuid;
 end loop;
 return cid;
end $$;
revoke all on function public.save_answer_card(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_answer_card(uuid,jsonb,jsonb) to authenticated;
