-- Optional browser telemetry. No IPs, raw user agents, URLs, text inputs or precise locations.
alter table public.tracking_events
 add column visitor_country text check(visitor_country ~ '^[A-Z]{2}$'),
 add column device text check(device in ('desktop','mobile','tablet','unknown')),
 add column browser text check(browser in ('Chrome','Edge','Firefox','Safari','Opera','Samsung Internet','other','unknown')),
 add column os text check(os in ('Windows','macOS','Linux','Android','iOS','other','unknown')),
 add column referrer text check(referrer in ('direct','search','linkedin','github','social','referral','internal','unknown')),
 add column action text check(action in ('home','projects','project','explore','answers','workspace','resume','email','phone','outbound','question','create_workspace','preview_resume','export_resume','example','story_next','story_previous','story_scene','open_chat')),
 add column page_view_id uuid references public.tracking_events(id) on delete cascade,
 add column active_seconds integer check(active_seconds between 0 and 14400),
 add column scroll_depth integer check(scroll_depth in (0,25,50,75,100));
alter table public.tracking_events drop constraint tracking_events_event_type_check;
alter table public.tracking_events add constraint tracking_events_event_type_check check(event_type in ('page_view','interaction','project_view','ask_question','job_match_started','resume_view','resume_download'));
alter table public.tracking_events add constraint tracking_interaction_parent check(event_type <> 'interaction' or (page_view_id is not null and action is not null and page_path is not null));
create index tracking_events_parent on public.tracking_events(page_view_id) where page_view_id is not null;

-- The session comes from a server-verified cookie. View UUIDs only deduplicate requests;
-- knowing one never grants access to another browser's record. All changes are atomic.
create function public.record_portfolio_activity(
 p_session uuid,p_view uuid,p_path text,p_kind text,p_link uuid default null,p_market text default null,
 p_country text default null,p_device text default 'unknown',p_browser text default 'unknown',p_os text default 'unknown',p_referrer text default 'unknown',
 p_action text default null,p_seconds integer default null,p_scroll integer default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare a uuid := '00000000-0000-4000-8000-000000000001'; region text:=p_market; parent tracking_events%rowtype;
begin
 if p_session is null or p_view is null or p_path is null or p_path not in ('/','/explore','/workspace','/resume','/projects','/answers')
 or p_kind is null or p_kind not in ('page_view','engagement','interaction') then raise exception 'INVALID_PORTFOLIO_EVENT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
 if p_kind='page_view' then
  if p_market is not null and p_market not in ('US','BG') then raise exception 'INVALID_MARKET'; end if;
  if p_link is not null then
   select market into region from tracking_links where id=p_link and account_id=a and active;
   if not found then raise exception 'INVALID_TRACKING_LINK'; end if;
  end if;
  if exists(select 1 from tracking_events where id=p_view) then
   return exists(select 1 from tracking_events where id=p_view and account_id=a and session_id=p_session and page_path=p_path and event_type='page_view');
  end if;
  if (select count(*) from tracking_events where account_id=a and session_id=p_session and created_at>now()-interval '1 day')>=500 then return false; end if;
  perform prune_tracking_events();
  insert into tracking_events(id,account_id,link_id,session_id,event_type,page_path,contact_market,visitor_country,device,browser,os,referrer)
  values(p_view,a,p_link,p_session,'page_view',p_path,region,p_country,p_device,p_browser,p_os,p_referrer);
  return true;
 end if;
 select * into parent from tracking_events where id=p_view and account_id=a and session_id=p_session and page_path=p_path and event_type='page_view' and created_at>now()-interval '1 day' for update;
 if not found then return false; end if;
 if p_kind='engagement' then
  if p_seconds is null or p_seconds not between 0 and 14400 or p_scroll is null or p_scroll not in (0,25,50,75,100) then raise exception 'INVALID_ENGAGEMENT'; end if;
  -- Cumulative measurements tolerate retries and out-of-order delivery. Elapsed server
  -- time caps client claims; heartbeats update the view without inflating event counts.
  update tracking_events set
   active_seconds=greatest(coalesce(active_seconds,0),least(p_seconds,greatest(0,floor(extract(epoch from now()-created_at)))::integer)),
   scroll_depth=greatest(coalesce(scroll_depth,0),p_scroll)
  where id=parent.id;
  return true;
 end if;
 if p_action is null then raise exception 'INVALID_INTERACTION'; end if;
 if exists(select 1 from tracking_events where page_view_id=parent.id and action=p_action and created_at>now()-interval '1 second') then return false; end if;
 if (select count(*) from tracking_events where account_id=a and session_id=p_session and created_at>now()-interval '1 day')>=500 then return false; end if;
 insert into tracking_events(account_id,link_id,session_id,event_type,page_path,contact_market,visitor_country,device,browser,os,referrer,action,page_view_id)
 values(a,parent.link_id,p_session,'interaction',parent.page_path,parent.contact_market,parent.visitor_country,parent.device,parent.browser,parent.os,parent.referrer,p_action,parent.id);
 return true;
end $$;
revoke all on function public.record_portfolio_activity(uuid,uuid,text,text,uuid,text,text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.record_portfolio_activity(uuid,uuid,text,text,uuid,text,text,text,text,text,text,text,integer,integer) to service_role;

-- Keep the existing view's columns in order and append optional browser context.
create or replace view public.owner_analytics_activity with (security_invoker=true) as
select e.id,e.account_id,e.event_type,e.created_at,e.session_id,null::uuid workspace_id,e.link_id tracking_link_id,e.contact_market region,e.page_path,null::text question,null::text answer,coalesce(e.action,e.page_path,'Historical short-link landing') subject,''::text topic_text,
e.visitor_country,e.device,e.browser,e.os,e.referrer,e.action,coalesce(e.active_seconds,p.active_seconds) active_seconds,coalesce(e.scroll_depth,p.scroll_depth) scroll_depth
from public.tracking_events e left join public.tracking_events p on p.id=e.page_view_id and p.account_id=e.account_id and p.session_id=e.session_id where e.event_type in ('page_view','interaction')
union all
select q.id,q.account_id,'question',q.created_at,null::uuid,w.id,w.tracking_link_id,w.market,null::text,q.question,q.answer,q.question,
coalesce((select string_agg(t.topic,' ') from public.question_topics t where t.account_id=q.account_id and t.question_id=q.id),''),
null::text,null::text,null::text,null::text,null::text,null::text,null::integer,null::integer
from public.workspace_questions q join public.workspaces w on w.id=q.workspace_id and w.account_id=q.account_id
union all
select e.id,e.account_id,e.event_type,e.created_at,null::uuid,w.id,w.tracking_link_id,w.market,null::text,null::text,null::text,w.title,''::text,
null::text,null::text,null::text,null::text,null::text,null::text,null::integer,null::integer
from public.workspace_events e join public.workspaces w on w.id=e.workspace_id and w.account_id=e.account_id
union all
select e.id,e.account_id,e.event_type,e.created_at,null::uuid,w.id,w.tracking_link_id,w.market,'/explore',null::text,null::text,coalesce(p.title,s.name,c.title,'Explorer selection'),''::text,
null::text,null::text,null::text,null::text,null::text,null::text,null::integer,null::integer
from public.explorer_events e join public.workspaces w on w.id=e.workspace_id and w.account_id=e.account_id
left join public.projects p on p.id=e.project_id and p.account_id=e.account_id
left join public.skills s on s.id=e.skill_id and s.account_id=e.account_id
left join public.skill_categories c on c.id=e.category_id and c.account_id=e.account_id;

-- Replace the report with optional filters; defaults retain historical report behavior.
drop function public.owner_analytics_report(uuid,date,date,integer,integer,text,text,text,text,text,text,boolean,text,integer);
create function public.owner_analytics_report(p_account uuid,p_from date,p_to date,p_hour_from integer default 0,p_hour_to integer default 23,p_code text default null,p_region text default null,p_source text default null,p_event text default null,p_page text default null,p_status text default null,p_active boolean default null,p_search text default null,p_offset integer default 0,p_country text default null,p_device text default null,p_browser text default null,p_os text default null,p_referrer text default null,p_action text default null,p_min_seconds integer default null,p_max_seconds integer default null,p_session uuid default null)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb; span integer;
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 span:=p_to-p_from+1;
 if p_from is null or p_to is null or span<1 or span>90 or p_hour_from not between 0 and 23 or p_hour_to not between 0 and 23 or p_offset<0 or p_offset>49950 or length(coalesce(p_search,''))>200
 or (p_code is not null and p_code !~ '^[A-Za-z0-9_-]{8}$')
 or (p_region is not null and p_region not in ('US','BG','unknown'))
 or (p_source is not null and p_source not in ('tracked','untracked'))
 or (p_event is not null and p_event not in ('page_view','interaction','question','created','resume_preview','workspace_export','project_viewed','skill_explored','category_explored'))
 or (p_page is not null and p_page not in ('/','/explore','/workspace','/resume','/projects','/answers','legacy'))
 or (p_status is not null and p_status not in ('DRAFT','SENT','VIEWED','REJECTED','INTERVIEW','SECOND_INTERVIEW','OFFER','ACCEPTED','WITHDRAWN'))
 or (p_country is not null and p_country<>'unknown' and p_country !~ '^[A-Z]{2}$')
 or (p_device is not null and p_device not in ('desktop','mobile','tablet','unknown'))
 or (p_browser is not null and p_browser not in ('Chrome','Edge','Firefox','Safari','Opera','Samsung Internet','other','unknown'))
 or (p_os is not null and p_os not in ('Windows','macOS','Linux','Android','iOS','other','unknown'))
 or (p_referrer is not null and p_referrer not in ('direct','search','linkedin','github','social','referral','internal','unknown'))
 or (p_action is not null and p_action not in ('home','projects','project','explore','answers','workspace','resume','email','phone','outbound','question','create_workspace','preview_resume','export_resume','example','story_next','story_previous','story_scene','open_chat'))
 or (p_min_seconds is not null and p_min_seconds not between 0 and 14400)
 or (p_max_seconds is not null and p_max_seconds not between 0 and 14400)
 or coalesce(p_min_seconds,0)>coalesce(p_max_seconds,14400)
 then raise exception 'INVALID_ANALYTICS_FILTER'; end if;
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
  and (p_country is null or coalesce(visitor_country,'unknown')=p_country)
  and (p_device is null or coalesce(device,'unknown')=p_device)
  and (p_browser is null or coalesce(browser,'unknown')=p_browser)
  and (p_os is null or coalesce(os,'unknown')=p_os)
  and (p_referrer is null or coalesce(referrer,'unknown')=p_referrer)
  and (p_action is null or action=p_action)
  and (p_min_seconds is null or active_seconds>=p_min_seconds)
  and (p_max_seconds is null or active_seconds<=p_max_seconds)
  and (p_session is null or session_id=p_session)
  and (p_page is null or (p_page='legacy' and page_path is null and event_type='page_view') or page_path=p_page)
  and (p_status is null or status=p_status) and (p_active is null or active=p_active)
  and (p_search is null or position(lower(p_search) in lower(concat_ws(' ',subject,topic_text,organization,role,label,code,page_path)))>0)
  and ((p_hour_from<=p_hour_to and extract(hour from created_at at time zone 'UTC') between p_hour_from and p_hour_to)
   or (p_hour_from>p_hour_to and (extract(hour from created_at at time zone 'UTC')>=p_hour_from or extract(hour from created_at at time zone 'UTC')<=p_hour_to)))
 ), selected as (select * from matching where created_at>=(p_from::timestamp at time zone 'UTC')),
 prior as (select * from matching where created_at<(p_from::timestamp at time zone 'UTC')),
 totals as (select jsonb_build_object('activities',count(*),'views',count(*) filter(where event_type='page_view'),'sessions',count(distinct session_id),'questions',count(*) filter(where event_type='question'),'workspace_starts',count(*) filter(where event_type='created'),'previews',count(*) filter(where event_type='resume_preview'),'exports',count(*) filter(where event_type='workspace_export'),'explorations',count(*) filter(where event_type in ('project_viewed','skill_explored','category_explored')),'tracked_views',count(*) filter(where event_type='page_view' and code is not null),'clicks',count(*) filter(where event_type='interaction'),'measured_views',count(*) filter(where event_type='page_view' and active_seconds is not null),'active_seconds',coalesce(sum(active_seconds) filter(where event_type='page_view'),0)) value from selected),
 daily as (select to_char(d,'YYYY-MM-DD') label,count(s.id) filter(where event_type='page_view') views,count(s.id) filter(where event_type='question') questions,count(s.id) activity from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d left join selected s on (s.created_at at time zone 'UTC')::date=d::date group by d order by d),
 hourly as (select h as "hour",count(s.id) count from generate_series(0,23) h left join selected s on extract(hour from s.created_at at time zone 'UTC')=h group by h order by h),
 pages as (select coalesce(page_path,'Historical landing') label,count(*) count from selected where event_type='page_view' group by page_path order by count(*) desc,page_path),
 regions as (select coalesce(region,'unknown') label,count(*) count from selected group by region order by count(*) desc),
 sources as (select case when code is null then 'Without application link' else 'Application link' end label,count(*) count from selected group by (code is null)),
 tracking as (select code,max(label) label,case when count(distinct coalesce(region,'unknown'))>1 then 'mixed' else max(coalesce(region,'unknown')) end region,application_id,count(*) filter(where event_type='page_view') views,count(distinct session_id) sessions,count(*) filter(where event_type='question') questions,count(*) filter(where event_type='created') workspace_starts,count(*) filter(where event_type='resume_preview') previews,count(*) filter(where event_type='workspace_export') exports,count(*) filter(where event_type in ('project_viewed','skill_explored','category_explored')) explorations from selected where code is not null group by code,application_id order by count(*) desc,code limit 100),
 topic_counts as (select t.topic label,count(distinct t.question_id) count,count(distinct t.question_id) filter(where t.evidence_strength='STRONG') strong,count(distinct t.question_id) filter(where t.evidence_strength='PARTIAL') partial,count(distinct t.question_id) filter(where t.evidence_strength='NONE') none from question_topics t join selected s on s.id=t.question_id and s.event_type='question' and t.account_id=s.account_id group by t.topic order by count(distinct t.question_id) desc,t.topic limit 50),
 question_counts as (select min(regexp_replace(trim(question),'[[:space:]]+',' ','g')) label,count(*) count from selected where event_type='question' group by lower(regexp_replace(trim(question),'[[:space:]]+',' ','g')) order by count(*) desc limit 20),
 recent as (select id,event_type,created_at,code,region,page_path,subject,question,answer,application_id,organization,role,session_id,visitor_country,device,browser,os,referrer,action,active_seconds,scroll_depth from selected order by case when p_session is not null then created_at end asc,created_at desc,event_type,id limit 50 offset p_offset),
 countries as (select coalesce(visitor_country,'unknown') label,count(distinct session_id) count from selected where session_id is not null group by coalesce(visitor_country,'unknown') order by count(distinct session_id) desc,label),
 devices as (select coalesce(device,'unknown') label,count(distinct session_id) count from selected where session_id is not null group by coalesce(device,'unknown') order by count(distinct session_id) desc,label),
 browsers as (select coalesce(browser,'unknown') label,count(distinct session_id) count from selected where session_id is not null group by coalesce(browser,'unknown') order by count(distinct session_id) desc,label),
 operating_systems as (select coalesce(os,'unknown') label,count(distinct session_id) count from selected where session_id is not null group by coalesce(os,'unknown') order by count(distinct session_id) desc,label),
 referrers as (select coalesce(referrer,'unknown') label,count(distinct session_id) count from selected where session_id is not null group by coalesce(referrer,'unknown') order by count(distinct session_id) desc,label),
 actions as (select action label,count(*) count from selected where event_type='interaction' group by action order by count(*) desc,action),
 page_engagement as (select coalesce(page_path,'Historical landing') label,count(*) views,count(active_seconds) measured_views,round(avg(active_seconds),1) avg_seconds,round(avg(scroll_depth),1) avg_scroll from selected where event_type='page_view' group by page_path order by count(*) desc,page_path),
 sessions as (select session_id,min(created_at) first_seen,max(created_at) last_seen,
  (array_agg(page_path order by created_at,id))[1] entry_page,(array_agg(page_path order by created_at desc,id desc))[1] last_page,
  count(*) filter(where event_type='page_view') views,count(*) filter(where event_type='interaction') clicks,
  sum(active_seconds) filter(where event_type='page_view') active_seconds,
  max(scroll_depth) filter(where event_type='page_view') scroll_depth,
  count(*) filter(where event_type='page_view' and active_seconds is not null) measured_views,
  (array_agg(visitor_country order by created_at,id))[1] visitor_country,(array_agg(device order by created_at,id))[1] device,(array_agg(browser order by created_at,id))[1] browser,(array_agg(os order by created_at,id))[1] os,(array_agg(referrer order by created_at,id))[1] referrer
  from selected where session_id is not null group by session_id),
 engagement as (select jsonb_build_object('avg_session_seconds',round(avg(active_seconds),1),'measured_sessions',count(*) filter(where measured_views>0),'engaged_sessions',count(*) filter(where active_seconds>=10 or views>=2 or clicks>0)) value from sessions),
 journeys as (select * from sessions order by last_seen desc,session_id limit 20),
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
 'countries',coalesce((select jsonb_agg(to_jsonb(countries)) from countries),'[]'),
 'devices',coalesce((select jsonb_agg(to_jsonb(devices)) from devices),'[]'),
 'browsers',coalesce((select jsonb_agg(to_jsonb(browsers)) from browsers),'[]'),
 'operating_systems',coalesce((select jsonb_agg(to_jsonb(operating_systems)) from operating_systems),'[]'),
 'referrers',coalesce((select jsonb_agg(to_jsonb(referrers)) from referrers),'[]'),
 'actions',coalesce((select jsonb_agg(to_jsonb(actions)) from actions),'[]'),
 'page_engagement',coalesce((select jsonb_agg(to_jsonb(page_engagement)) from page_engagement),'[]'),
 'engagement',(select value from engagement),
 'journeys',coalesce((select jsonb_agg(to_jsonb(journeys)) from journeys),'[]'),
 'links',coalesce((select jsonb_agg(to_jsonb(link_options)) from link_options),'[]')) into result;
 return result;
end $$;
revoke all on function public.owner_analytics_report(uuid,date,date,integer,integer,text,text,text,text,text,text,boolean,text,integer,text,text,text,text,text,text,integer,integer,uuid) from public,anon;
grant execute on function public.owner_analytics_report(uuid,date,date,integer,integer,text,text,text,text,text,text,boolean,text,integer,text,text,text,text,text,text,integer,integer,uuid) to authenticated;
notify pgrst, 'reload schema';
