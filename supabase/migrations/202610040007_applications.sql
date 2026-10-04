alter table public.job_applications add column status text not null default 'DRAFT' check(status in ('DRAFT','SENT','VIEWED','REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN')),
 add column metadata jsonb not null default '{}', add column sent_at timestamptz;
create table public.resume_experiments (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 name text not null check(length(name) between 1 and 200),status text not null default 'DRAFT' check(status in ('DRAFT','RUNNING','PAUSED','COMPLETED')),
 job_family text check(job_family in ('ENGINEERING','DATA','OPERATIONS','PRODUCT','BUSINESS','OTHER')),
 market text check(market in ('US','BG')),starts_at timestamptz not null default now(),ends_at timestamptz,
 created_at timestamptz not null default now(),check(ends_at is null or ends_at>starts_at)
);
create table public.experiment_variants (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 experiment_id uuid not null references public.resume_experiments on delete cascade,
 label text not null check(label in ('A','B','C')),strategy text not null check(strategy in ('TRADITIONAL','PROJECT_FORWARD','OUTCOME_FORWARD')),
 template text not null default 'CLASSIC_V1' check(template='CLASSIC_V1'), unique(experiment_id,label),unique(experiment_id,strategy)
);
create table public.application_previews (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 organization text not null check(length(organization) between 1 and 200),role text not null check(length(role) between 1 and 200),
 job_description text not null check(length(job_description) between 3 and 12000),metadata jsonb not null,
 resume_options jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 day',
 saved_application_id uuid references public.job_applications on delete cascade
);
create table public.application_snapshots (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 application_id uuid not null unique references public.job_applications on delete cascade,
 experiment_id uuid references public.resume_experiments on delete restrict,variant_id uuid references public.experiment_variants on delete restrict,
 strategy text not null check(strategy in ('TRADITIONAL','PROJECT_FORWARD','OUTCOME_FORWARD')),
 job_description text not null,metadata jsonb not null,resume_ir jsonb not null,template text not null default 'CLASSIC_V1',
 compiler_version text not null default '2B.1',tracking_code text not null unique check(tracking_code ~ '^[A-Za-z0-9_-]{8}$'),
 generated_at timestamptz not null,created_at timestamptz not null default now(),
 check((experiment_id is null)=(variant_id is null))
);
create table public.application_outcomes (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 application_id uuid not null references public.job_applications on delete cascade,
 status text not null check(status in ('DRAFT','SENT','VIEWED','REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN')),
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['resume_experiments','experiment_variants','application_previews','application_snapshots','application_outcomes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant all on public.%I to authenticated,service_role',t);
  execute format('create policy account_owner on public.%I for all to authenticated using (public.is_account_member(account_id)) with check (public.is_account_member(account_id))',t);
  execute format('create trigger account_reference before insert or update on public.%I for each row execute function public.check_account_references()',t);
  execute format('create index on public.%I(account_id)',t);
 end loop;
end $$;
create function public.immutable_snapshot() returns trigger language plpgsql as $$ begin raise exception 'IMMUTABLE_SNAPSHOT'; end $$;
create trigger immutable before update on public.application_snapshots for each row execute function public.immutable_snapshot();
create trigger immutable before update on public.application_outcomes for each row execute function public.immutable_snapshot();
create function public.lock_used_variant() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from public.application_snapshots where variant_id=old.id) then raise exception 'VARIANT_HAS_SNAPSHOTS'; end if;return new;
end $$;
create trigger immutable_used before update on public.experiment_variants for each row execute function public.lock_used_variant();
revoke all on function public.lock_used_variant() from public,anon,authenticated;

-- Account lock serializes assignment across serverless instances. No model chooses a treatment.
create function public.finalize_application(p_account uuid,p_preview uuid,p_code text) returns uuid language plpgsql security invoker set search_path=public as $$
declare draft public.application_previews;exp public.resume_experiments;v public.experiment_variants;app uuid;selected text:='TRADITIONAL';
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('application:'||p_account::text,0));
 select * into draft from public.application_previews where id=p_preview and account_id=p_account for update;
 if not found or draft.expires_at<now() then raise exception 'PREVIEW_EXPIRED'; end if;
 if draft.saved_application_id is not null then return draft.saved_application_id; end if;
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
 insert into public.application_snapshots(account_id,application_id,experiment_id,variant_id,strategy,job_description,metadata,resume_ir,tracking_code,generated_at)
 values(p_account,app,exp.id,v.id,selected,draft.job_description,draft.metadata,draft.resume_options->selected,p_code,draft.created_at);
 insert into public.tracking_links(account_id,application_id,code,label,market)
 values(p_account,app,p_code,draft.organization||' · '||draft.role,draft.metadata->>'market');
 insert into public.application_outcomes(account_id,application_id,status) values(p_account,app,'DRAFT');
 update public.application_previews set saved_application_id=app where id=draft.id;
 return app;
end $$;
revoke all on function public.finalize_application(uuid,uuid,text) from public,anon;
grant execute on function public.finalize_application(uuid,uuid,text) to authenticated;

create function public.record_application_outcome(p_application uuid,p_status text) returns void language plpgsql security invoker set search_path=public as $$
declare app public.job_applications;
begin
 select * into app from public.job_applications where id=p_application for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 if p_status=app.status then return; end if;
 if not (case app.status
 when 'DRAFT' then p_status in ('SENT','WITHDRAWN')
 when 'SENT' then p_status in ('VIEWED','REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN')
 when 'VIEWED' then p_status in ('REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN')
 when 'INTERVIEW' then p_status in ('SECOND_INTERVIEW','OFFER','ACCEPTED','REJECTED','WITHDRAWN')
 when 'SECOND_INTERVIEW' then p_status in ('OFFER','ACCEPTED','REJECTED','WITHDRAWN')
 when 'OFFER' then p_status in ('ACCEPTED','REJECTED','WITHDRAWN') else false end) then raise exception 'INVALID_OUTCOME_TRANSITION'; end if;
 update public.job_applications set status=p_status,sent_at=case when app.status='DRAFT' and p_status='SENT' then now() else sent_at end where id=app.id;
 insert into public.application_outcomes(account_id,application_id,status) values(app.account_id,app.id,p_status);
end $$;
revoke all on function public.record_application_outcome(uuid,text) from public,anon;
grant execute on function public.record_application_outcome(uuid,text) to authenticated;

create function public.create_resume_experiment(p_account uuid,p_name text,p_family text,p_market text) returns uuid language plpgsql security invoker set search_path=public as $$
declare eid uuid;begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 insert into public.resume_experiments(account_id,name,job_family,market) values(p_account,p_name,p_family,p_market) returning id into eid;
 insert into public.experiment_variants(account_id,experiment_id,label,strategy) values(p_account,eid,'A','TRADITIONAL'),(p_account,eid,'B','PROJECT_FORWARD'),(p_account,eid,'C','OUTCOME_FORWARD');
 return eid;
end $$;
revoke all on function public.create_resume_experiment(uuid,text,text,text) from public,anon;
grant execute on function public.create_resume_experiment(uuid,text,text,text) to authenticated;
