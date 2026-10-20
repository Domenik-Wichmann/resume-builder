-- Reuse an immutable document without generating prose or assigning a new experiment.
alter table public.application_snapshots
 add column reused_from uuid references public.application_snapshots(id) on delete restrict,
 add column reuse_request_id uuid,
 add constraint application_reuse_request unique(account_id,reuse_request_id);

create or replace function public.complete_resume_snapshot() returns trigger
language plpgsql security invoker set search_path=public as $$
declare
 draft public.application_previews; source public.application_snapshots;
 url text; project jsonb; projects jsonb:='[]'; links jsonb; learning text;
begin
 if new.reused_from is not null then
  select * into source from application_snapshots where id=new.reused_from and account_id=new.account_id;
  if not found or not public.is_account_member(new.account_id) then raise exception 'SOURCE_NOT_FOUND'; end if;
  learning:=new.generation_record->'reuse_request'->>'learning_demo';
  if learning is not null and (length(learning)>2000 or learning !~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$') then
   raise exception 'INVALID_LEARNING_LINK';
  end if;
  -- Copy from the account-owned snapshot, never accept replacement prose from a caller.
  new.resume_ir:=source.resume_ir;
  new.strategy:=source.strategy;
  new.template:=source.template;
  new.compiler_version:=source.compiler_version;
  new.experiment_id:=null;
  new.variant_id:=null;
  new.preview_id:=null;
  if learning is not null and not exists(select 1 from jsonb_array_elements(new.resume_ir->'projects') p where p->>'locked_id'='lms') then
   raise exception 'LMS_PROJECT_MISSING';
  end if;
  for project in select value from jsonb_array_elements(new.resume_ir->'projects') loop
   if project->>'locked_id'='lms' then
    if learning is not null and exists(select 1 from jsonb_array_elements(coalesce(project->'links','[]')) l where l->>'label'='Homepage' and rtrim(l->>'url','/')=rtrim(learning,'/')) then
     raise exception 'LEARNING_LINK_IS_HOMEPAGE';
    end if;
    select coalesce(jsonb_agg(l order by n),'[]') into links
     from jsonb_array_elements(coalesce(project->'links','[]')) with ordinality t(l,n)
     where l->>'label' is distinct from 'Learning demo';
    if learning is not null then
     links:=links||jsonb_build_array(jsonb_build_object('label','Learning demo','url',learning));
    end if;
    if jsonb_array_length(links)>3 then raise exception 'TOO_MANY_PROJECT_LINKS'; end if;
    project:=jsonb_set(project,'{links}',links);
   end if;
   projects:=projects||jsonb_build_array(project);
  end loop;
  new.resume_ir:=jsonb_set(new.resume_ir,'{projects}',projects);
  -- The old job's review and generation context stay with the source application.
  new.generation_record:=jsonb_build_object('mode','links_only','reused_from',source.id,'reuse_request',new.generation_record->'reuse_request');
 else
  select * into draft from application_previews where id=new.preview_id and account_id=new.account_id;
  if new.resume_ir ? 'portfolio_url' and (draft.id is null or draft.generation_stage<>4) then raise exception 'DRAFT_NOT_READY'; end if;
 end if;
 if new.resume_ir ? 'portfolio_url' or new.reused_from is not null then
  url:=regexp_replace(coalesce(new.resume_ir->>'portfolio_url','https://domenik-wichmann.com'),'^(https://[^/]+).*$', '\1')||'/r/'||new.tracking_code;
  new.resume_ir:=jsonb_set(new.resume_ir,'{portfolio_url}',to_jsonb(url));
  projects:='[]';
  for project in select value from jsonb_array_elements(new.resume_ir->'projects') loop
   select coalesce(jsonb_agg(case when l->>'portfolio'='true' then jsonb_set(l,'{url}',to_jsonb(url)) else l end order by n),'[]') into links
    from jsonb_array_elements(coalesce(project->'links','[]')) with ordinality t(l,n);
   if project ? 'links' or new.reused_from is null then project:=jsonb_set(project,'{links}',links); end if;
   projects:=projects||jsonb_build_array(project);
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

create function public.reuse_saved_resume(
 p_account uuid,p_source uuid,p_request uuid,p_organization text,p_role text,
 p_job_description text,p_learning_demo text,p_code text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare source public.application_snapshots; saved public.application_snapshots;
 app uuid; request_data jsonb;
begin
 if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
 if p_request is null or p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$'
  or p_organization is null or length(btrim(p_organization)) not between 1 and 200
  or p_role is null or length(btrim(p_role)) not between 1 and 200
  or p_job_description is null or length(p_job_description)>12000 then raise exception 'INVALID_REUSE_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended('reuse:'||p_account::text||':'||p_request::text,0));
 select * into source from application_snapshots where account_id=p_account and application_id=p_source;
 if not found then raise exception 'SOURCE_NOT_FOUND'; end if;
 request_data:=jsonb_build_object('organization',btrim(p_organization),'role',btrim(p_role),'job_description',p_job_description,'learning_demo',p_learning_demo);
 select * into saved from application_snapshots where account_id=p_account and reuse_request_id=p_request;
 if found then
  if saved.reused_from<>source.id or saved.generation_record->'reuse_request' is distinct from request_data then raise exception 'REUSE_REQUEST_CHANGED'; end if;
  return jsonb_build_object('id',saved.application_id,'tracking_code',saved.tracking_code);
 end if;
 insert into job_applications(account_id,organization,role,job_description,metadata)
 values(p_account,btrim(p_organization),btrim(p_role),p_job_description,source.metadata) returning id into app;
 insert into application_snapshots(account_id,application_id,strategy,job_description,metadata,resume_ir,tracking_code,generated_at,reused_from,reuse_request_id,generation_record)
 values(p_account,app,source.strategy,p_job_description,source.metadata,source.resume_ir,p_code,now(),source.id,p_request,jsonb_build_object('reuse_request',request_data));
 insert into tracking_links(account_id,application_id,code,label,market)
 values(p_account,app,p_code,btrim(p_organization)||' / '||btrim(p_role),source.metadata->>'market');
 insert into application_outcomes(account_id,application_id,status) values(p_account,app,'DRAFT');
 return jsonb_build_object('id',app,'tracking_code',p_code);
end $$;
revoke all on function public.reuse_saved_resume(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.reuse_saved_resume(uuid,uuid,uuid,text,text,text,text,text) to authenticated;
