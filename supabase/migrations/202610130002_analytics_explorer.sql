-- Contact presentation is coarse functional context, not a visitor's location.
-- Only known application-link regions can be recovered for historical visits.
alter table public.tracking_events add column contact_market text check(contact_market in ('US','BG'));
update public.tracking_events e set contact_market=l.market from public.tracking_links l where e.link_id=l.id and e.account_id=l.account_id;
drop function public.record_portfolio_page_view(uuid,text,uuid);
create function public.record_portfolio_page_view(p_session uuid,p_path text,p_link uuid default null,p_market text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare a uuid := '00000000-0000-4000-8000-000000000001'; region text:=p_market;
begin
 if p_session is null or p_path is null or p_path not in ('/','/explore','/workspace','/resume','/projects','/answers') or (p_market is not null and p_market not in ('US','BG')) then raise exception 'INVALID_PAGE_VIEW'; end if;
 if p_link is not null then
  select market into region from tracking_links where id=p_link and account_id=a and active;
  if not found then raise exception 'INVALID_TRACKING_LINK'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
 if exists(select 1 from tracking_events where account_id=a and session_id=p_session and page_path=p_path and created_at>now()-interval '5 seconds') then return false; end if;
 if (select count(*) from tracking_events where account_id=a and session_id=p_session and created_at>now()-interval '1 day')>=500 then return false; end if;
 perform prune_tracking_events();
 insert into tracking_events(account_id,link_id,session_id,event_type,page_path,contact_market) values(a,p_link,p_session,'page_view',p_path,region);
 return true;
end $$;
revoke all on function public.record_portfolio_page_view(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_portfolio_page_view(uuid,text,uuid,text) to service_role;

-- The view inherits each source table's membership RLS. No public analytics read.
create view public.owner_analytics_activity with (security_invoker=true) as
select e.id,e.account_id,'page_view'::text event_type,e.created_at,e.session_id,null::uuid workspace_id,e.link_id tracking_link_id,e.contact_market region,e.page_path,null::text question,null::text answer,coalesce(e.page_path,'Historical short-link landing') subject,''::text topic_text
from public.tracking_events e where e.event_type='page_view'
union all
select q.id,q.account_id,'question',q.created_at,null::uuid,w.id,w.tracking_link_id,w.market,null::text,q.question,q.answer,q.question,
coalesce((select string_agg(t.topic,' ') from public.question_topics t where t.account_id=q.account_id and t.question_id=q.id),'')
from public.workspace_questions q join public.workspaces w on w.id=q.workspace_id and w.account_id=q.account_id
union all
select e.id,e.account_id,e.event_type,e.created_at,null::uuid,w.id,w.tracking_link_id,w.market,null::text,null::text,null::text,w.title,''::text
from public.workspace_events e join public.workspaces w on w.id=e.workspace_id and w.account_id=e.account_id
union all
select e.id,e.account_id,e.event_type,e.created_at,null::uuid,w.id,w.tracking_link_id,w.market,'/explore',null::text,null::text,coalesce(p.title,s.name,c.title,'Explorer selection'),''::text
from public.explorer_events e join public.workspaces w on w.id=e.workspace_id and w.account_id=e.account_id
left join public.projects p on p.id=e.project_id and p.account_id=e.account_id
left join public.skills s on s.id=e.skill_id and s.account_id=e.account_id
left join public.skill_categories c on c.id=e.category_id and c.account_id=e.account_id;
revoke all on public.owner_analytics_activity from public,anon;
grant select on public.owner_analytics_activity to authenticated;

create function public.owner_analytics_report(p_account uuid,p_from date,p_to date,p_hour_from integer default 0,p_hour_to integer default 23,p_code text default null,p_region text default null,p_source text default null,p_event text default null,p_page text default null,p_status text default null,p_active boolean default null,p_search text default null,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb; span integer;
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 span:=p_to-p_from+1;
 if p_from is null or p_to is null or span<1 or span>90 or p_hour_from not between 0 and 23 or p_hour_to not between 0 and 23 or p_offset<0 or p_offset>49950 or length(coalesce(p_search,''))>200
 or (p_code is not null and p_code !~ '^[A-Za-z0-9_-]{8}$')
 or (p_region is not null and p_region not in ('US','BG','unknown'))
 or (p_source is not null and p_source not in ('tracked','untracked'))
 or (p_event is not null and p_event not in ('page_view','question','created','resume_preview','workspace_export','project_viewed','skill_explored','category_explored'))
 or (p_page is not null and p_page not in ('/','/explore','/workspace','/resume','/projects','/answers','legacy'))
 or (p_status is not null and p_status not in ('DRAFT','SENT','VIEWED','REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN')) then raise exception 'INVALID_ANALYTICS_FILTER'; end if;
 with candidates as (
  select e.*,l.code,l.label,l.application_id,l.active,a.organization,a.role,a.status
  from owner_analytics_activity e
  left join tracking_links l on l.id=e.tracking_link_id and l.account_id=e.account_id
  left join job_applications a on a.id=l.application_id and a.account_id=e.account_id
  where e.account_id=p_account and e.created_at>=((p_from-span)::timestamp at time zone 'UTC') and e.created_at<((p_to+1)::timestamp at time zone 'UTC')
 ), matching as (
  select * from candidates where
  (p_code is null or code=p_code) and (p_region is null or coalesce(region,'unknown')=p_region)
  and (p_source is null or (p_source='tracked' and code is not null) or (p_source='untracked' and code is null))
  and (p_event is null or event_type=p_event)
  and (p_page is null or (p_page='legacy' and page_path is null and event_type='page_view') or page_path=p_page)
  and (p_status is null or status=p_status) and (p_active is null or active=p_active)
  and (p_search is null or position(lower(p_search) in lower(concat_ws(' ',subject,topic_text,organization,role,label,code,page_path)))>0)
  and ((p_hour_from<=p_hour_to and extract(hour from created_at at time zone 'UTC') between p_hour_from and p_hour_to)
   or (p_hour_from>p_hour_to and (extract(hour from created_at at time zone 'UTC')>=p_hour_from or extract(hour from created_at at time zone 'UTC')<=p_hour_to)))
 ), selected as (select * from matching where created_at>=(p_from::timestamp at time zone 'UTC')),
 prior as (select * from matching where created_at<(p_from::timestamp at time zone 'UTC')),
 totals as (select jsonb_build_object('activities',count(*),'views',count(*) filter(where event_type='page_view'),'sessions',count(distinct session_id) filter(where event_type='page_view'),'questions',count(*) filter(where event_type='question'),'workspace_starts',count(*) filter(where event_type='created'),'previews',count(*) filter(where event_type='resume_preview'),'exports',count(*) filter(where event_type='workspace_export'),'explorations',count(*) filter(where event_type in ('project_viewed','skill_explored','category_explored')),'tracked_views',count(*) filter(where event_type='page_view' and code is not null)) value from selected),
 daily as (select to_char(d,'YYYY-MM-DD') label,count(s.id) filter(where event_type='page_view') views,count(s.id) filter(where event_type='question') questions,count(s.id) activity from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d left join selected s on (s.created_at at time zone 'UTC')::date=d::date group by d order by d),
 hourly as (select h as "hour",count(s.id) count from generate_series(0,23) h left join selected s on extract(hour from s.created_at at time zone 'UTC')=h group by h order by h),
 pages as (select coalesce(page_path,'Historical landing') label,count(*) count from selected where event_type='page_view' group by page_path order by count(*) desc,page_path),
 regions as (select coalesce(region,'unknown') label,count(*) count from selected group by region order by count(*) desc),
 sources as (select case when code is null then 'Without application link' else 'Application link' end label,count(*) count from selected group by (code is null)),
 tracking as (select code,max(label) label,case when count(distinct coalesce(region,'unknown'))>1 then 'mixed' else max(coalesce(region,'unknown')) end region,application_id,count(*) filter(where event_type='page_view') views,count(distinct session_id) sessions,count(*) filter(where event_type='question') questions,count(*) filter(where event_type='created') workspace_starts,count(*) filter(where event_type='resume_preview') previews,count(*) filter(where event_type='workspace_export') exports,count(*) filter(where event_type in ('project_viewed','skill_explored','category_explored')) explorations from selected where code is not null group by code,application_id order by count(*) desc,code limit 100),
 topic_counts as (select t.topic label,count(distinct t.question_id) count,count(distinct t.question_id) filter(where t.evidence_strength='STRONG') strong,count(distinct t.question_id) filter(where t.evidence_strength='PARTIAL') partial,count(distinct t.question_id) filter(where t.evidence_strength='NONE') none from question_topics t join selected s on s.id=t.question_id and s.event_type='question' and t.account_id=s.account_id group by t.topic order by count(distinct t.question_id) desc,t.topic limit 50),
 question_counts as (select min(regexp_replace(trim(question),'[[:space:]]+',' ','g')) label,count(*) count from selected where event_type='question' group by lower(regexp_replace(trim(question),'[[:space:]]+',' ','g')) order by count(*) desc limit 20),
 recent as (select id,event_type,created_at,code,region,page_path,subject,question,answer,application_id,organization,role from selected order by created_at desc,event_type,id limit 50 offset p_offset),
 link_options as (select code,label,market,active from tracking_links where account_id=p_account order by created_at desc,id limit 500)
 select jsonb_build_object(
 'totals',(select value from totals),
 'previous',(select jsonb_build_object('views',count(*) filter(where event_type='page_view'),'sessions',count(distinct session_id),'questions',count(*) filter(where event_type='question')) from prior),
 'daily',coalesce((select jsonb_agg(to_jsonb(daily) order by label) from daily),'[]'),
 'hourly',coalesce((select jsonb_agg(to_jsonb(hourly) order by "hour") from hourly),'[]'),
 'pages',coalesce((select jsonb_agg(to_jsonb(pages)) from pages),'[]'),
 'regions',coalesce((select jsonb_agg(to_jsonb(regions)) from regions),'[]'),
 'sources',coalesce((select jsonb_agg(to_jsonb(sources)) from sources),'[]'),
 'tracking',coalesce((select jsonb_agg(to_jsonb(tracking)) from tracking),'[]'),
 'topics',coalesce((select jsonb_agg(to_jsonb(topic_counts)) from topic_counts),'[]'),
 'questions',coalesce((select jsonb_agg(to_jsonb(question_counts)) from question_counts),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(recent)) from recent),'[]'),
 'links',coalesce((select jsonb_agg(to_jsonb(link_options)) from link_options),'[]')) into result;
 return result;
end $$;
revoke all on function public.owner_analytics_report(uuid,date,date,integer,integer,text,text,text,text,text,text,boolean,text,integer) from public,anon;
grant execute on function public.owner_analytics_report(uuid,date,date,integer,integer,text,text,text,text,text,text,boolean,text,integer) to authenticated;
notify pgrst, 'reload schema';
