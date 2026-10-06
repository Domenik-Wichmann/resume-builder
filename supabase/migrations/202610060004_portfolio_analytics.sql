-- Optional first-party analytics also support visits without an application link.
alter table public.tracking_events alter column link_id drop not null;
alter table public.tracking_events add column page_path text check (page_path in ('/','/explore','/workspace','/resume','/projects','/answers'));
create index tracking_events_account_time on public.tracking_events(account_id,created_at);
create index tracking_events_session_time on public.tracking_events(account_id,session_id,created_at);

-- Only the server supplies a verified session and resolves an active primary-account link.
-- Serialize writes per session to suppress duplicate mounts and bound repeated events.
create function public.record_portfolio_page_view(p_session uuid,p_path text,p_link uuid default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare a uuid := '00000000-0000-4000-8000-000000000001';
begin
 if p_session is null or p_path is null or p_path not in ('/','/explore','/workspace','/resume','/projects','/answers') then raise exception 'INVALID_PAGE_VIEW'; end if;
 if p_link is not null and not exists(select 1 from tracking_links where id=p_link and account_id=a and active) then raise exception 'INVALID_TRACKING_LINK'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
 if exists(select 1 from tracking_events where account_id=a and session_id=p_session and page_path=p_path and created_at>now()-interval '5 seconds') then return false; end if;
 if (select count(*) from tracking_events where account_id=a and session_id=p_session and created_at>now()-interval '1 day')>=500 then return false; end if;
 perform prune_tracking_events();
 insert into tracking_events(account_id,link_id,session_id,event_type,page_path) values(a,p_link,p_session,'page_view',p_path);
 return true;
end $$;
revoke all on function public.record_portfolio_page_view(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.record_portfolio_page_view(uuid,text,uuid) to service_role;
