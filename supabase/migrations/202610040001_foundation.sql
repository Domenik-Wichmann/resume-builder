-- Public career truth and private application data have separate RLS boundaries.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create function public.set_updated_at() returns trigger language plpgsql
set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

create table public.profile (
  id uuid primary key default gen_random_uuid(),
  name text not null, title text not null, introduction text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.skills (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, description text not null default '', is_public boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- These entities share a small presentation shape but remain separate relational tables.
do $$ declare t text; begin
  foreach t in array array['experiences','projects','achievements','education','certifications'] loop
    execute format('create table public.%I (
      id uuid primary key default gen_random_uuid(), slug text unique not null,
      title text not null, subtitle text not null default '''', summary text not null,
      is_public boolean not null default false,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )', t);
  end loop;
end $$;
create table public.experience_skills (experience_id uuid references public.experiences on delete cascade, skill_id uuid references public.skills on delete cascade, created_at timestamptz not null default now(), primary key(experience_id, skill_id));
create table public.project_skills (project_id uuid references public.projects on delete cascade, skill_id uuid references public.skills on delete cascade, created_at timestamptz not null default now(), primary key(project_id, skill_id));
create table public.achievement_skills (achievement_id uuid references public.achievements on delete cascade, skill_id uuid references public.skills on delete cascade, created_at timestamptz not null default now(), primary key(achievement_id, skill_id));

create table public.job_applications (
  id uuid primary key default gen_random_uuid(), organization text not null, role text not null,
  job_description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resume_versions (
  id uuid primary key default gen_random_uuid(), application_id uuid references public.job_applications on delete cascade,
  content jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tracking_links (
  id uuid primary key default gen_random_uuid(), code text unique not null check (code ~ '^[A-Za-z0-9_-]{8}$'),
  application_id uuid not null references public.job_applications on delete cascade,
  resume_id uuid references public.resume_versions on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tracking_events (
  id uuid primary key default gen_random_uuid(), link_id uuid not null references public.tracking_links on delete cascade,
  session_id uuid not null,
  event_type text not null check (event_type in ('page_view','project_view','ask_question','job_match_started','resume_view','resume_download')),
  created_at timestamptz not null default now()
);
create index tracking_events_link_time on public.tracking_events(link_id, created_at);

-- No anon/authenticated policies on private tables: only the server secret can access them.
do $$ declare t text; begin
  foreach t in array array['profile','skills','experiences','projects','achievements','education','certifications','job_applications','resume_versions','tracking_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger update_timestamp before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['profile','skills','experiences','projects','achievements','education','certifications'] loop
    execute format('create policy published_read on public.%I for select to anon, authenticated using (is_public)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;
alter table public.tracking_events enable row level security;
alter table public.experience_skills enable row level security;
alter table public.project_skills enable row level security;
alter table public.achievement_skills enable row level security;
create policy published_read on public.experience_skills for select to anon, authenticated using (exists(select 1 from public.experiences e where e.id=experience_id and e.is_public) and exists(select 1 from public.skills s where s.id=skill_id and s.is_public));
create policy published_read on public.project_skills for select to anon, authenticated using (exists(select 1 from public.projects p where p.id=project_id and p.is_public) and exists(select 1 from public.skills s where s.id=skill_id and s.is_public));
create policy published_read on public.achievement_skills for select to anon, authenticated using (exists(select 1 from public.achievements a where a.id=achievement_id and a.is_public) and exists(select 1 from public.skills s where s.id=skill_id and s.is_public));
grant select on public.experience_skills, public.project_skills, public.achievement_skills to anon, authenticated;
revoke all on public.job_applications, public.resume_versions, public.tracking_links, public.tracking_events from anon, authenticated;

-- A tiny shared quota bounds all public provider spending, even across Vercel instances.
create table public.ai_quota (id integer primary key check(id=1), day date not null, daily_count integer not null, minute timestamptz not null, minute_count integer not null);
alter table public.ai_quota enable row level security;
revoke all on public.ai_quota from anon, authenticated;
insert into public.ai_quota values(1, current_date, 0, date_trunc('minute',now()), 0);
create function public.consume_ai_quota() returns boolean language plpgsql security definer
set search_path=public as $$
declare q public.ai_quota;
begin
  select * into q from public.ai_quota where id=1 for update;
  if q.day <> current_date then q.day:=current_date; q.daily_count:=0; end if;
  if q.minute <> date_trunc('minute',now()) then q.minute:=date_trunc('minute',now()); q.minute_count:=0; end if;
  if q.daily_count>=100 or q.minute_count>=10 then return false; end if;
  update public.ai_quota set day=q.day, daily_count=q.daily_count+1, minute=q.minute, minute_count=q.minute_count+1 where id=1;
  return true;
end $$;
revoke all on function public.consume_ai_quota() from public, anon, authenticated;
grant execute on function public.consume_ai_quota() to service_role;

create function public.prune_tracking_events() returns void language sql security definer
set search_path=public as $$ delete from public.tracking_events where created_at < now()-interval '90 days'; $$;
revoke all on function public.prune_tracking_events() from public, anon, authenticated;
grant execute on function public.prune_tracking_events() to service_role;

-- Explicit grants support Supabase projects with restrictive default privileges.
grant all on all tables in schema public to service_role;
