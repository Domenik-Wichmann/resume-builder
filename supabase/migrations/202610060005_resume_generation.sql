-- Additive v4 application configuration; historical snapshots remain immutable.
create or replace function public.valid_resume_design(s jsonb) returns boolean language sql immutable as $$
 select jsonb_typeof(s)='object'
  and (select count(*) from jsonb_object_keys(s)) in (11,12)
  and not exists(select 1 from jsonb_object_keys(s) k where k not in ('page','layout','font','accent','text','background','margin_mm','font_pt','spacing','headings','header','photo'))
  and s->>'page' in ('A4','LETTER') and s->>'layout' in ('CLASSIC','SIDEBAR') and s->>'font' in ('SANS','SERIF','MONO')
  and s->>'accent' ~ '^#[0-9a-fA-F]{6}$' and s->>'text' ~ '^#[0-9a-fA-F]{6}$'
  and (not s ? 'background' or s->>'background' ~ '^#[0-9a-fA-F]{6}$')
  and s->>'margin_mm' ~ '^(1[0-9]|2[0-9]|30)$' and s->>'font_pt' ~ '^(9|1[0-3])$'
  and s->>'spacing' in ('COMPACT','COMFORTABLE','AIRY') and s->>'headings' in ('RULE','PLAIN','UPPERCASE')
  and s->>'header' in ('LEFT','CENTER') and s->>'photo' in ('NONE','CIRCLE','SQUARE');
$$;
create table public.resume_fixed_content (
 account_id uuid primary key references public.accounts on delete cascade,
 version integer not null check(version>0), spec jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.resume_fixed_content_revisions (
 account_id uuid not null references public.accounts on delete cascade,
 version integer not null, spec jsonb not null,
 created_at timestamptz not null default now(), primary key(account_id,version)
);
alter table public.resume_fixed_content enable row level security;
alter table public.resume_fixed_content_revisions enable row level security;
create policy member_fixed_content on public.resume_fixed_content for select to authenticated using(public.is_account_member(account_id));
create policy member_fixed_revisions on public.resume_fixed_content_revisions for select to authenticated using(public.is_account_member(account_id));
grant select on public.resume_fixed_content,public.resume_fixed_content_revisions to authenticated;
grant all on public.resume_fixed_content,public.resume_fixed_content_revisions to service_role;
create function public.save_resume_fixed_content(p_account uuid,p_spec jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare v integer; project jsonb;
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
 perform 1 from accounts where id=p_account for update;
 select version into v from resume_fixed_content where account_id=p_account for update;
 if coalesce(v,0) is distinct from (p_spec->>'version')::integer then raise exception 'STALE_CONTENT'; end if;
 if length(p_spec::text)>16000 or jsonb_typeof(p_spec->'projects')<>'array' or jsonb_array_length(p_spec->'projects')<>2
  or coalesce(p_spec->>'portfolio','') !~ '^https://[^/@[:space:]]+([/?#]|$)'
  or coalesce(p_spec->>'github','') !~ '^https://[^/@[:space:]]+([/?#]|$)'
  or length(coalesce(p_spec->>'invitation','')) not between 1 and 200
  or length(coalesce(p_spec->>'closing','')) not between 1 and 200 then raise exception 'INVALID_CONTENT'; end if;
 if p_spec->'learning_demo'<>'null'::jsonb and coalesce(p_spec->>'learning_demo','') !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'INVALID_CONTENT'; end if;
 for project in select value from jsonb_array_elements(p_spec->'projects') loop
  if length(coalesce(project->>'title','')) not between 1 and 200 or jsonb_typeof(project->'bullets')<>'array'
    or jsonb_array_length(project->'bullets') not between 1 and 4 then raise exception 'INVALID_CONTENT'; end if;
  if project->>'record_id' is not null and not exists(select 1 from projects where id=(project->>'record_id')::uuid and account_id=p_account) then raise exception 'INVALID_PROJECT'; end if;
 end loop;
 v:=coalesce(v,0)+1;
 p_spec:=jsonb_set(p_spec,'{version}',to_jsonb(v));
 insert into resume_fixed_content(account_id,version,spec) values(p_account,v,p_spec)
 on conflict(account_id) do update set version=excluded.version,spec=excluded.spec,updated_at=now();
 insert into resume_fixed_content_revisions(account_id,version,spec) values(p_account,v,p_spec);
 return v;
end $$;
revoke all on function public.save_resume_fixed_content(uuid,jsonb) from public,anon;
grant execute on function public.save_resume_fixed_content(uuid,jsonb) to authenticated;

-- The first authorized generation installs both settings together. A retry
-- preserves later owner edits and does not create another template revision.
create function public.initialize_resume_v4(p_account uuid,p_spec jsonb,p_design jsonb) returns integer language plpgsql security invoker set search_path=public as $$
declare v integer; tid uuid:=gen_random_uuid();
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('resume-v4:'||p_account::text,0));
 select version into v from resume_fixed_content where account_id=p_account;
 if v is not null then return v; end if;
 perform public.save_resume_template(p_account,jsonb_build_object('id',tid,'name','Clear Signal v4','version',0,'spec',p_design,'reference_id',null,'notes','Owner-approved v4 base imported with fixed project content.','limitations',jsonb_build_array('Inspect pagination for each application.'),'is_default',true));
 return public.save_resume_fixed_content(p_account,p_spec);
end $$;
revoke all on function public.initialize_resume_v4(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.initialize_resume_v4(uuid,jsonb,jsonb) to authenticated;

alter table public.application_previews
 add column generation_stage integer not null default 4 check(generation_stage between 0 and 4),
 add column generation_lease uuid,
 add column generation_lease_until timestamptz,
 add column generation_context jsonb not null default '{}',
 add column generation_plan jsonb not null default '{}',
 add column generation_evidence jsonb not null default '[]',
 add column generation_writing jsonb not null default '{}',
 add column generation_review jsonb not null default '[]',
 add column learning_demo text;
alter table public.application_snapshots add column generation_record jsonb not null default '{}', add column preview_id uuid;
create function public.claim_resume_generation(p_preview uuid,p_stage integer) returns uuid language plpgsql security invoker set search_path=public as $$
declare draft public.application_previews; token uuid:=gen_random_uuid();
begin
 select * into draft from application_previews where id=p_preview for update;
 if not found or not public.is_account_member(draft.account_id) then raise exception 'ACCOUNT_REQUIRED'; end if;
 if draft.expires_at<now() then raise exception 'PREVIEW_EXPIRED'; end if;
 if draft.saved_application_id is not null or draft.generation_stage<>p_stage then return null; end if;
 if draft.generation_lease is not null and draft.generation_lease_until>now() then raise exception 'GENERATION_RUNNING'; end if;
 update application_previews set generation_lease=token,generation_lease_until=now()+interval '4 minutes' where id=p_preview;
 return token;
end $$;
revoke all on function public.claim_resume_generation(uuid,integer) from public,anon;
grant execute on function public.claim_resume_generation(uuid,integer) to authenticated;
create function public.complete_resume_snapshot() returns trigger language plpgsql security invoker set search_path=public as $$
declare draft public.application_previews; url text; project jsonb; projects jsonb:='[]'; links jsonb;
begin
 select * into draft from application_previews where id=new.preview_id and account_id=new.account_id;
 -- The original finalize transaction supplies the actual allocated code. There
 -- is no token allocation during rendering, printing or subsequent exports.
 if new.resume_ir ? 'portfolio_url' then
  if not found or draft.generation_stage<>4 then raise exception 'DRAFT_NOT_READY'; end if;
  url:=regexp_replace(new.resume_ir->>'portfolio_url','^(https://[^/]+).*$', '\1')||'/r/'||new.tracking_code;
  new.resume_ir:=jsonb_set(new.resume_ir,'{portfolio_url}',to_jsonb(url));
  for project in select value from jsonb_array_elements(new.resume_ir->'projects') loop
   select coalesce(jsonb_agg(case when l->>'portfolio'='true' then jsonb_set(l,'{url}',to_jsonb(url)) else l end),'[]') into links from jsonb_array_elements(coalesce(project->'links','[]')) l;
   projects:=projects||jsonb_build_array(jsonb_set(project,'{links}',links));
  end loop;
  new.resume_ir:=jsonb_set(new.resume_ir,'{projects}',projects);
 end if;
 if draft.id is not null then
  if draft.generation_stage<>4 then raise exception 'DRAFT_NOT_READY'; end if;
  new.generation_record:=jsonb_build_object('plan',draft.generation_plan,'evidence',draft.generation_evidence,'writing',draft.generation_writing,'review',draft.generation_review,'context',draft.generation_context);
  new.compiler_version:='clear-signal-4';
 end if;
 return new;
end $$;
create trigger complete_resume_snapshot before insert on public.application_snapshots for each row execute function public.complete_resume_snapshot();
revoke all on function public.complete_resume_snapshot() from public,anon,authenticated;

-- Preserve allocation, experiment balancing, collision handling and idempotency.
create or replace function public.finalize_application(p_account uuid,p_preview uuid,p_code text) returns uuid language plpgsql security invoker set search_path=public as $$
declare draft public.application_previews;exp public.resume_experiments;v public.experiment_variants;app uuid;selected text:='TRADITIONAL';
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('application:'||p_account::text,0));
 select * into draft from public.application_previews where id=p_preview and account_id=p_account for update;
 if not found or draft.expires_at<now() then raise exception 'PREVIEW_EXPIRED'; end if;
 if draft.saved_application_id is not null then return draft.saved_application_id; end if;
 if draft.generation_stage<>4 then raise exception 'DRAFT_NOT_READY'; end if;
 select * into exp from public.resume_experiments e where e.account_id=p_account and e.status='RUNNING' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
 and (e.market is null or e.market=draft.metadata->>'market') and (e.job_family is null or e.job_family=draft.metadata->>'job_family')
 and (select count(*) from public.experiment_variants where experiment_id=e.id)>=2 order by e.created_at,e.id limit 1;
 if exp.id is not null then
  select ev.* into v from public.experiment_variants ev where ev.experiment_id=exp.id
  order by (select count(*) from public.application_snapshots s where s.variant_id=ev.id),ev.label limit 1;
  selected:=v.strategy;
 end if;
 if draft.resume_options->selected is null then raise exception 'PREVIEW_STRATEGY_MISSING'; end if;
 insert into public.job_applications(account_id,organization,role,job_description,metadata)
 values(p_account,draft.organization,draft.role,draft.job_description,draft.metadata) returning id into app;
 insert into public.application_snapshots(account_id,application_id,experiment_id,variant_id,strategy,job_description,metadata,resume_ir,tracking_code,generated_at,preview_id)
 values(p_account,app,exp.id,v.id,selected,draft.job_description,draft.metadata,draft.resume_options->selected,p_code,draft.created_at,draft.id);
 insert into public.tracking_links(account_id,application_id,code,label,market)
 values(p_account,app,p_code,draft.organization||' Â· '||draft.role,draft.metadata->>'market');
 insert into public.application_outcomes(account_id,application_id,status) values(p_account,app,'DRAFT');
 update public.application_previews set saved_application_id=app where id=draft.id;
 return app;
end $$;
