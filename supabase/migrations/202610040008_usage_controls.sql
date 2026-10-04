alter table public.anonymous_visitors add column verified_until timestamptz, add column ai_lease_until timestamptz;
create table public.visitor_ai_operations (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 visitor_id uuid not null references public.anonymous_visitors on delete cascade,
 workspace_id uuid references public.workspaces on delete cascade,
 operation text not null check(operation in ('ask','match','compile')),created_at timestamptz not null default now()
);
create index visitor_ai_operations_recent on public.visitor_ai_operations(account_id,visitor_id,created_at);
create table public.provider_usage_events (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 provider text not null check(provider in ('OPENROUTER','COHERE')),model text not null,
 operation_type text not null check(length(operation_type) between 1 and 100),
 input_tokens bigint check(input_tokens>=0),output_tokens bigint check(output_tokens>=0),units bigint check(units>=0),
 provider_cost_micro bigint check(provider_cost_micro>=0),platform_charge_micro bigint check(platform_charge_micro>=0),
 workspace_id uuid references public.workspaces on delete set null,application_id uuid references public.job_applications on delete set null,
 status text not null check(status in ('SUCCESS','FAILED')),created_at timestamptz not null default now()
);
create table public.credit_transactions (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.accounts on delete cascade,
 amount_micro bigint not null check(amount_micro<>0),
 reason text not null check(reason in ('TRIAL_GRANT','PROMOTIONAL_GRANT','PURCHASE','AI_USAGE','REFUND','ADMIN_ADJUSTMENT')),
 usage_event_id uuid unique references public.provider_usage_events on delete restrict,
 idempotency_key text not null check(length(idempotency_key) between 1 and 200),expires_at timestamptz,
 created_at timestamptz not null default now(),unique(account_id,idempotency_key),
 check((reason='AI_USAGE' and amount_micro<0 and usage_event_id is not null) or (reason='ADMIN_ADJUSTMENT') or (reason in ('TRIAL_GRANT','PROMOTIONAL_GRANT','PURCHASE','REFUND') and amount_micro>0))
);
create unique index one_trial_grant on public.credit_transactions(account_id) where reason='TRIAL_GRANT';
do $$ declare t text; begin
 foreach t in array array['visitor_ai_operations','provider_usage_events','credit_transactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy account_read on public.%I for select to authenticated using (public.is_account_member(account_id))',t);
  execute format('create trigger account_reference before insert or update on public.%I for each row execute function public.check_account_references()',t);
  execute format('create index on public.%I(account_id)',t);
 end loop;
end $$;
create trigger immutable before update on public.credit_transactions for each row execute function public.immutable_snapshot();
create function public.immutable_usage() returns trigger language plpgsql as $$ begin
 if (to_jsonb(new)-'workspace_id'-'application_id')=(to_jsonb(old)-'workspace_id'-'application_id')
 and (new.workspace_id is null or new.workspace_id is not distinct from old.workspace_id)
 and (new.application_id is null or new.application_id is not distinct from old.application_id) then return new; end if;
 raise exception 'IMMUTABLE_USAGE';
end $$;
create trigger immutable before update on public.provider_usage_events for each row execute function public.immutable_usage();
-- Prevent tenants altering security verification or impersonating quota reservations through old visitor RLS.
revoke insert,update,delete on public.anonymous_visitors from authenticated;

create function public.reserve_visitor_ai(p_account uuid,p_visitor uuid,p_workspace uuid,p_operation text,p_spacing integer default 5,p_daily integer default 25,p_weekly integer default 50) returns text language plpgsql security definer set search_path=public as $$
declare visitor public.anonymous_visitors;last_op timestamptz;daily integer;weekly integer;
begin
 if p_spacing<1 or p_daily<1 or p_weekly<1 then raise exception 'INVALID_LIMIT'; end if;
 select * into visitor from public.anonymous_visitors where id=p_visitor and account_id=p_account for update;
 if not found then return 'VISITOR_REQUIRED'; end if;
 if p_workspace is not null and not exists(select 1 from public.workspaces where id=p_workspace and visitor_id=p_visitor and account_id=p_account) then return 'WORKSPACE_FORBIDDEN'; end if;
 if visitor.ai_lease_until>now() then return 'CONCURRENT'; end if;
 delete from public.visitor_ai_operations where account_id=p_account and visitor_id=p_visitor and created_at<now()-interval '7 days';
 select max(created_at),count(*) filter(where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),count(*) into last_op,daily,weekly from public.visitor_ai_operations where account_id=p_account and visitor_id=p_visitor;
 if last_op>now()-make_interval(secs=>p_spacing) then return 'SPACING'; end if;
 if daily>=p_daily then return 'DAILY'; end if;
 if weekly>=p_weekly then return 'WEEKLY'; end if;
 update public.anonymous_visitors set ai_lease_until=now()+interval '90 seconds',last_active_at=now() where id=p_visitor;
 insert into public.visitor_ai_operations(account_id,visitor_id,workspace_id,operation) values(p_account,p_visitor,p_workspace,p_operation);
 return 'OK';
end $$;
revoke all on function public.reserve_visitor_ai(uuid,uuid,uuid,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_visitor_ai(uuid,uuid,uuid,text,integer,integer,integer) to service_role;

-- Gross, auditable ledger balance. Expiry is readiness metadata; redemption/lot allocation is not enabled.
create function public.credit_balance(p_account uuid) returns bigint language sql security invoker set search_path=public as $$
 select coalesce(sum(amount_micro),0)::bigint from public.credit_transactions where account_id=p_account;
$$;
revoke all on function public.credit_balance(uuid) from public,anon;
grant execute on function public.credit_balance(uuid) to authenticated,service_role;
create function public.append_credit(p_account uuid,p_amount bigint,p_reason text,p_key text,p_usage uuid default null,p_expires timestamptz default null) returns uuid language plpgsql security definer set search_path=public as $$
declare txn uuid;balance bigint;begin
 perform 1 from public.accounts where id=p_account for update;
 select id into txn from public.credit_transactions where account_id=p_account and idempotency_key=p_key;
 if txn is not null then return txn; end if;
 select public.credit_balance(p_account) into balance;
 if p_amount<0 and balance+p_amount<0 then raise exception 'INSUFFICIENT_CREDIT'; end if;
 insert into public.credit_transactions(account_id,amount_micro,reason,idempotency_key,usage_event_id,expires_at) values(p_account,p_amount,p_reason,p_key,p_usage,p_expires) returning id into txn;
 return txn;
end $$;
revoke all on function public.append_credit(uuid,bigint,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.append_credit(uuid,bigint,text,text,uuid,timestamptz) to service_role;
