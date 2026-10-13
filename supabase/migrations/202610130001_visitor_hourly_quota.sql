-- Keep quota ownership and reservation atomic; all browser access uses this
-- service-only function, whether or not an application link is present.
drop function public.reserve_visitor_ai(uuid,uuid,uuid,text,integer,integer,integer);
create function public.reserve_visitor_ai(p_account uuid,p_visitor uuid,p_workspace uuid,p_operation text,p_spacing integer default 5,p_daily integer default 25,p_weekly integer default 50,p_hourly integer default 20) returns text language plpgsql security definer set search_path=public as $$
declare visitor public.anonymous_visitors;last_op timestamptz;daily integer;weekly integer;hourly integer;
begin
 if p_spacing<1 or p_daily<1 or p_weekly<1 or p_hourly<1 then raise exception 'INVALID_LIMIT'; end if;
 select * into visitor from public.anonymous_visitors where id=p_visitor and account_id=p_account for update;
 if not found then return 'VISITOR_REQUIRED'; end if;
 if p_workspace is not null and not exists(select 1 from public.workspaces where id=p_workspace and visitor_id=p_visitor and account_id=p_account) then return 'WORKSPACE_FORBIDDEN'; end if;
 if visitor.ai_lease_until>now() then return 'CONCURRENT'; end if;
 delete from public.visitor_ai_operations where account_id=p_account and visitor_id=p_visitor and created_at<now()-interval '7 days';
 select max(created_at),count(*) filter(where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),count(*),count(*) filter(where created_at>now()-interval '1 hour') into last_op,daily,weekly,hourly from public.visitor_ai_operations where account_id=p_account and visitor_id=p_visitor;
 if last_op>now()-make_interval(secs=>p_spacing) then return 'SPACING'; end if;
 if daily>=p_daily then return 'DAILY'; end if;
 if weekly>=p_weekly then return 'WEEKLY'; end if;
 if hourly>=p_hourly then return 'HOURLY'; end if;
 update public.anonymous_visitors set ai_lease_until=now()+interval '90 seconds',last_active_at=now() where id=p_visitor;
 insert into public.visitor_ai_operations(account_id,visitor_id,workspace_id,operation) values(p_account,p_visitor,p_workspace,p_operation);
 return 'OK';
end $$;
revoke all on function public.reserve_visitor_ai(uuid,uuid,uuid,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_visitor_ai(uuid,uuid,uuid,text,integer,integer,integer,integer) to service_role;
notify pgrst, 'reload schema';
