-- Incremental extension: workspaces belong to an opaque browser identity, not a recruiter account.
alter table public.experiences add column organization text;
alter table public.experiences add column start_date date;
alter table public.experiences add column end_date date;
alter table public.experiences add constraint experience_dates check(end_date is null or start_date is null or end_date>=start_date);
alter table public.tracking_links alter column application_id drop not null;
alter table public.tracking_links add column label text not null default 'Application link';
alter table public.tracking_links add column market text not null default 'US' check(market in ('US','BG'));
alter table public.job_applications add column market text not null default 'US' check(market in ('US','BG'));
create table public.profile_presentations (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profile on delete cascade,
  market text not null check(market in ('US','BG')), location text not null default '',
  contact_email text not null default '', phone text not null default '', work_authorization text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(profile_id,market)
);
alter table public.profile_presentations enable row level security;
create policy published_read on public.profile_presentations for select to anon,authenticated
using(is_public and exists(select 1 from public.profile p where p.id=profile_id and p.is_public));
grant select on public.profile_presentations to anon,authenticated;
create trigger update_timestamp before update on public.profile_presentations for each row execute function public.set_updated_at();

create table public.anonymous_visitors (
  id uuid primary key, created_at timestamptz not null default now(), last_active_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(), visitor_id uuid not null references public.anonymous_visitors on delete cascade,
  tracking_link_id uuid references public.tracking_links on delete set null,
  market text not null check(market in ('US','BG')), title text not null default 'Career exploration',
  job_description text check(length(job_description)<=12000), match_analysis jsonb,
  lease_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_active_at timestamptz not null default now()
);
create index workspaces_visitor on public.workspaces(visitor_id);
create table public.workspace_requirements (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
  requirement text not null, position integer not null, created_at timestamptz not null default now()
);
create table public.workspace_evidence (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
  experience_id uuid references public.experiences on delete cascade,
  project_id uuid references public.projects on delete cascade,
  achievement_id uuid references public.achievements on delete cascade,
  skill_id uuid references public.skills on delete cascade,
  education_id uuid references public.education on delete cascade,
  certification_id uuid references public.certifications on delete cascade,
  entity_id uuid generated always as (coalesce(experience_id,project_id,achievement_id,skill_id,education_id,certification_id)) stored,
  entity_type text generated always as (case when experience_id is not null then 'experience' when project_id is not null then 'project' when achievement_id is not null then 'achievement' when skill_id is not null then 'skill' when education_id is not null then 'education' else 'certification' end) stored,
  created_at timestamptz not null default now(),
  check(num_nonnulls(experience_id,project_id,achievement_id,skill_id,education_id,certification_id)=1), unique(workspace_id,entity_type,entity_id)
);
create table public.workspace_questions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
  question text not null check(length(question)<=1000), answer text not null check(length(answer)<=5000),
  created_at timestamptz not null default now()
);
create table public.question_evidence (
  question_id uuid references public.workspace_questions on delete cascade,
  evidence_id uuid references public.workspace_evidence on delete cascade, primary key(question_id,evidence_id)
);
create table public.question_topics (
  question_id uuid references public.workspace_questions on delete cascade, topic text not null,
  evidence_strength text not null check(evidence_strength in ('STRONG','PARTIAL','NONE')),
  created_at timestamptz not null default now(), primary key(question_id,topic)
);
create table public.workspace_projections (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
  resume_ir jsonb not null, created_at timestamptz not null default now(), unique(workspace_id)
);
create table public.workspace_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade,
  event_type text not null check(event_type in ('created','resume_preview','workspace_export')),
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['anonymous_visitors','workspaces','workspace_requirements','workspace_evidence','workspace_questions','question_evidence','question_topics','workspace_projections','workspace_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant all on public.profile_presentations to service_role;
create trigger update_timestamp before update on public.workspaces for each row execute function public.set_updated_at();

-- Lock the visitor row so concurrent creates cannot exceed the two slots.
create function public.create_workspace(p_visitor_id uuid,p_market text,p_tracking_link_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare workspace_id uuid;
begin
  insert into public.anonymous_visitors(id) values(p_visitor_id) on conflict(id) do nothing;
  perform 1 from public.anonymous_visitors where id=p_visitor_id for update;
  if (select count(*) from public.workspaces where visitor_id=p_visitor_id)>=2 then raise exception 'WORKSPACE_LIMIT'; end if;
  insert into public.workspaces(visitor_id,market,tracking_link_id) values(p_visitor_id,p_market,p_tracking_link_id) returning id into workspace_id;
  insert into public.workspace_events(workspace_id,event_type) values(workspace_id,'created');
  update public.anonymous_visitors set last_active_at=now() where id=p_visitor_id;
  return workspace_id;
end $$;
revoke all on function public.create_workspace(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_workspace(uuid,text,uuid) to service_role;

create function public.begin_workspace_action(p_workspace_id uuid,p_visitor_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.workspaces set lease_until=now()+interval '90 seconds',last_active_at=now()
  where id=p_workspace_id and visitor_id=p_visitor_id and (lease_until is null or lease_until<now());
  return found;
end $$;
revoke all on function public.begin_workspace_action(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_workspace_action(uuid,uuid) to service_role;

create function public.prune_workspaces() returns void language sql security definer set search_path=public as $$
delete from public.anonymous_visitors where last_active_at<now()-interval '90 days';
$$;
revoke all on function public.prune_workspaces() from public,anon,authenticated;
grant execute on function public.prune_workspaces() to service_role;

-- Persist a completed action as one transaction; provider failures never save half a question.
create function public.save_workspace_context(p_workspace_id uuid,p_visitor_id uuid,p_title text,p_market text,p_job text,p_match jsonb,p_requirements text[],p_evidence jsonb,p_question jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare q_id uuid;
begin
  perform 1 from public.workspaces where id=p_workspace_id and visitor_id=p_visitor_id for update;
  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  update public.workspaces set title=p_title,market=p_market,job_description=p_job,match_analysis=p_match,last_active_at=now() where id=p_workspace_id;
  insert into public.workspace_evidence(workspace_id,experience_id,project_id,achievement_id,skill_id,education_id,certification_id)
  select p_workspace_id,
    case when e->>'entity_type'='experience' then (e->>'entity_id')::uuid end,
    case when e->>'entity_type'='project' then (e->>'entity_id')::uuid end,
    case when e->>'entity_type'='achievement' then (e->>'entity_id')::uuid end,
    case when e->>'entity_type'='skill' then (e->>'entity_id')::uuid end,
    case when e->>'entity_type'='education' then (e->>'entity_id')::uuid end,
    case when e->>'entity_type'='certification' then (e->>'entity_id')::uuid end
  from jsonb_array_elements(p_evidence) e
  on conflict(workspace_id,entity_type,entity_id) do nothing;
  delete from public.workspace_requirements where workspace_id=p_workspace_id;
  insert into public.workspace_requirements(workspace_id,requirement,position)
  select p_workspace_id,value,ordinality::integer from unnest(p_requirements) with ordinality as r(value,ordinality);
  if p_question is not null then
    if (select count(*) from public.workspace_questions where workspace_id=p_workspace_id)>=50 then raise exception 'QUESTION_LIMIT'; end if;
    insert into public.workspace_questions(workspace_id,question,answer) values(p_workspace_id,p_question->>'question',p_question->>'answer') returning id into q_id;
    insert into public.question_topics(question_id,topic,evidence_strength)
    select q_id,t->>'topic',t->>'strength' from jsonb_array_elements(p_question->'topics') t;
    insert into public.question_evidence(question_id,evidence_id)
    select q_id,id from public.workspace_evidence where workspace_id=p_workspace_id and entity_id::text in (select jsonb_array_elements_text(p_question->'evidence_ids'));
  end if;
  update public.anonymous_visitors set last_active_at=now() where id=p_visitor_id;
end $$;
revoke all on function public.save_workspace_context(uuid,uuid,text,text,text,jsonb,text[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_workspace_context(uuid,uuid,text,text,text,jsonb,text[],jsonb,jsonb) to service_role;
