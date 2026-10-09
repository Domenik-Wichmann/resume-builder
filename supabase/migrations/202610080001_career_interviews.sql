-- Interview transcripts and disposable memory are private; no public policy.
create table public.career_interview_sessions (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts,
 mode text not null check(mode in ('general','role','job','record')),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','FINISHED','ARCHIVED')),
 title text not null check(length(title) between 1 and 160),
 target_role text not null default '' check(length(target_role)<=1000),
 job_description text not null default '' check(length(job_description)<=16000),
 target_record_id uuid,
 state jsonb not null default '{"summary":"","focus":"","topics":[],"denials":[],"unresolved":[],"findings":[],"requirements":[]}' check(jsonb_typeof(state)='object' and octet_length(state::text)<=60000),
 version integer not null default 0 check(version>=0), turn_count integer not null default 0 check(turn_count>=0),
 reviewed_through bigint not null default 0,
 last_import_id uuid references public.career_imports,
 pending_token uuid, pending_until timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_activity_at timestamptz not null default now(),
 unique(account_id,id), check((pending_token is null)=(pending_until is null)),
 check(mode<>'role' or length(target_role)>0),check(mode<>'job' or length(job_description)>0),check(mode<>'record' or target_record_id is not null)
);
create table public.career_interview_messages (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts,
 session_id uuid not null, sequence bigint generated always as identity,
 role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 6000),
 rationale text not null default '' check(length(rationale)<=600), created_at timestamptz not null default now(),
 foreign key(account_id,session_id) references public.career_interview_sessions(account_id,id), unique(session_id,sequence)
);
create index career_interview_recent on public.career_interview_sessions(account_id,last_activity_at desc);
create index career_interview_transcript on public.career_interview_messages(session_id,sequence);
do $$ declare t text; begin
 foreach t in array array['career_interview_sessions','career_interview_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy interview_member on public.%I to authenticated using(public.is_account_member(account_id)) with check(public.is_account_member(account_id))',t);
  execute format('create trigger account_references before insert or update on public.%I for each row execute function public.check_account_references()',t);
 end loop;
end $$;
revoke update on public.career_interview_messages from authenticated;
create function public.check_interview_target() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.target_record_id is not null and not exists(
  select id from projects where id=new.target_record_id and account_id=new.account_id and archived_at is null
  union all select id from experiences where id=new.target_record_id and account_id=new.account_id and archived_at is null
  union all select id from achievements where id=new.target_record_id and account_id=new.account_id and archived_at is null
 ) then raise exception 'CROSS_ACCOUNT_INTERVIEW_TARGET'; end if;
 return new;
end $$;
create trigger interview_target before insert or update of target_record_id on public.career_interview_sessions for each row execute function public.check_interview_target();
grant usage,select on sequence public.career_interview_messages_sequence_seq to authenticated,service_role;
create trigger update_timestamp before update on public.career_interview_sessions for each row execute function public.set_updated_at();

-- Hold a bounded lease across inference, never a database transaction. Persist
-- the answer first so a failed provider call can be retried without losing proof.
create function public.begin_career_interview(p_id uuid,p_version integer,p_token uuid,p_answer text,p_review boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s career_interview_sessions; last_role text;
begin
 select * into s from career_interview_sessions where id=p_id for update;
 if not found then raise exception 'INTERVIEW_NOT_FOUND'; end if;
 if s.version<>p_version or s.pending_until>now() then raise exception 'INTERVIEW_BUSY_OR_STALE'; end if;
 if s.status='ARCHIVED' or (not p_review and s.status<>'ACTIVE') then raise exception 'INTERVIEW_CLOSED'; end if;
 select role into last_role from career_interview_messages where session_id=p_id order by sequence desc limit 1;
 if not p_review then
  if s.turn_count>=400 then raise exception 'INTERVIEW_TURN_LIMIT'; end if;
  if p_answer is not null then
   if last_role is distinct from 'assistant' then raise exception 'INTERVIEW_RETRY_REQUIRED'; end if;
   insert into career_interview_messages(account_id,session_id,role,content) values(s.account_id,s.id,'user',p_answer);
  elsif last_role='assistant' then raise exception 'INTERVIEW_ANSWER_REQUIRED';
  end if;
 end if;
 update career_interview_sessions set pending_token=p_token,pending_until=now()+interval '5 minutes',version=version+1,last_activity_at=now() where id=p_id returning * into s;
 return to_jsonb(s);
end $$;

create function public.complete_career_interview(p_id uuid,p_token uuid,p_content text,p_rationale text,p_state jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare s career_interview_sessions;
begin
 select * into s from career_interview_sessions where id=p_id for update;
 if not found or p_token is null or s.pending_token is distinct from p_token then raise exception 'INTERVIEW_STALE_LEASE'; end if;
 insert into career_interview_messages(account_id,session_id,role,content,rationale) values(s.account_id,p_id,'assistant',p_content,p_rationale);
 update career_interview_sessions set state=p_state,turn_count=turn_count+1,pending_token=null,pending_until=null,last_activity_at=now() where id=p_id;
end $$;

-- Only a draft/source and the session checkpoint commit here. Canonical apply
-- remains the existing, separately reviewed Career Brain transaction.
create function public.review_career_interview(p_id uuid,p_token uuid,p_source text,p_context text,p_hash text,p_candidates jsonb,p_through bigint,p_finish boolean)
returns uuid language plpgsql security invoker set search_path=public as $$
declare s career_interview_sessions; source_id uuid; batch_id uuid;
begin
 select * into s from career_interview_sessions where id=p_id for update;
 if not found or p_token is null or s.pending_token is distinct from p_token then raise exception 'INTERVIEW_STALE_LEASE'; end if;
 if length(p_source) not between 10 and 40000 or p_through<=s.reviewed_through then raise exception 'INTERVIEW_EMPTY_REVIEW'; end if;
 insert into career_sources(account_id,kind,content,evidence_text,content_hash) values(s.account_id,'INTERVIEW',p_source,p_source,p_hash) returning id into source_id;
 insert into career_imports(account_id,source_id,candidates,model) values(s.account_id,source_id,p_candidates,'openai/gpt-6-luna-pro:career-interview-owner-review') returning id into batch_id;
 update career_interview_sessions set reviewed_through=p_through,last_import_id=batch_id,status=case when p_finish then 'FINISHED' else status end,pending_token=null,pending_until=null,last_activity_at=now() where id=p_id;
 return batch_id;
end $$;
-- p_context is deliberately NOT written into evidence_text. The full persisted
-- transcript retains questions; extraction receives bounded context separately.
revoke all on function public.begin_career_interview(uuid,integer,uuid,text,boolean),public.complete_career_interview(uuid,uuid,text,text,jsonb),public.review_career_interview(uuid,uuid,text,text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.begin_career_interview(uuid,integer,uuid,text,boolean),public.complete_career_interview(uuid,uuid,text,text,jsonb),public.review_career_interview(uuid,uuid,text,text,text,jsonb,bigint,boolean) to authenticated;
