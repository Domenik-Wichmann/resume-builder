-- Owner actions preserve canonical UUIDs and historical evidence. Selected rows
-- commit together, with account membership and optimistic versions checked again.
create function public.change_career_records(p_account uuid,p_action text,p_records jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare selected jsonb; t text; entity uuid; version timestamptz; h text; archived timestamptz; e public.career_record_evidence; changed integer:=0;
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'NOT_ACCOUNT_MEMBER'; end if;
 if coalesce(p_action,'') not in ('publish','unpublish','archive','restore') or jsonb_typeof(p_records) is distinct from 'array'
  or jsonb_array_length(p_records) not between 1 and 150 then raise exception 'INVALID_ACTION'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'DUPLICATE_RECORD'; end if;
 for selected in select value from jsonb_array_elements(p_records) order by value->>'kind',value->>'id' loop
  t:=case selected->>'kind' when 'profile' then 'profile' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' when 'skill' then 'skills' when 'education' then 'education' when 'certification' then 'certifications' when 'language' then 'languages' when 'category' then 'skill_categories' else null end;
  if t is null then raise exception 'INVALID_ENTITY'; end if;
  entity:=null;
  execute format('select id,updated_at,semantic_hash,archived_at from public.%I where account_id=$1 and id=$2 for update',t)
   into entity,version,h,archived using p_account,(selected->>'id')::uuid;
  if entity is null then raise exception 'MISSING_RECORD'; end if;
  select * into e from career_record_evidence where account_id=p_account and kind=selected->>'kind' and entity_id=entity for update;
  if h is distinct from selected->>'hash' or version is distinct from nullif(selected->>'updated_at','')::timestamptz
   or e.updated_at is distinct from nullif(selected->>'evidence_version','')::timestamptz then raise exception 'STALE_RECORD'; end if;
  if p_action='publish' then
   if archived is not null or e.canonical_hash is distinct from h or not exists(
    select 1 from jsonb_array_elements(e.claims) c where c->>'availability'='CONFIRMED' and c->>'attribution' not in ('NEGATED','UNCERTAIN')
     and exists(select 1 from jsonb_array_elements(c->'evidence'))
     and not exists(select 1 from jsonb_array_elements(c->'evidence') span left join career_sources s on s.id=(span->>'source_id')::uuid and s.account_id=p_account
      where s.id is null or nullif(span->>'start','') is null or nullif(span->>'end','') is null or position(span->>'quote' in s.evidence_text)=0)
   ) then raise exception 'UNREVIEWED_RECORD'; end if;
   execute format('update public.%I set is_public=true where id=$1 and account_id=$2',t) using entity,p_account;
  elsif p_action='unpublish' then
   execute format('update public.%I set is_public=false where id=$1 and account_id=$2',t) using entity,p_account;
  elsif p_action='archive' then
   execute format('update public.%I set is_public=false,archived_at=coalesce(archived_at,now()) where id=$1 and account_id=$2',t) using entity,p_account;
  else
   execute format('update public.%I set is_public=false,archived_at=null where id=$1 and account_id=$2',t) using entity,p_account;
  end if;
  if p_action<>'publish' then delete from career_embeddings where account_id=p_account and entity_type=selected->>'kind' and entity_id=entity; end if;
  changed:=changed+1;
 end loop;
 return changed;
end $$;
revoke all on function public.change_career_records(uuid,text,jsonb) from public,anon;
grant execute on function public.change_career_records(uuid,text,jsonb) to authenticated;

-- The manual source, audit import, canonical patch, relationships and reviewed
-- claim state all roll back if any validation or version check fails.
create function public.save_career_record(p_account uuid,p_record jsonb,p_source_id uuid,p_source text,p_source_hash text,p_patch jsonb,p_state jsonb)
returns integer language plpgsql security invoker set search_path=public as $$
declare t text; entity uuid; key text; version timestamptz; h text; ev timestamptz; archived timestamptz; batch uuid;
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'NOT_ACCOUNT_MEMBER'; end if;
 t:=case p_record->>'kind' when 'profile' then 'profile' when 'experience' then 'experiences' when 'project' then 'projects' when 'achievement' then 'achievements' when 'skill' then 'skills' when 'education' then 'education' when 'certification' then 'certifications' when 'language' then 'languages' when 'category' then 'skill_categories' else null end;
 if t is null then raise exception 'INVALID_ENTITY'; end if;
 execute format('select id,slug,updated_at,semantic_hash,archived_at from public.%I where account_id=$1 and id=$2 for update',t)
  into entity,key,version,h,archived using p_account,(p_record->>'id')::uuid;
 if entity is null or archived is not null then raise exception 'MISSING_ACTIVE_RECORD'; end if;
 select updated_at into ev from career_record_evidence where account_id=p_account and kind=p_record->>'kind' and entity_id=entity;
 if version is distinct from nullif(p_record->>'updated_at','')::timestamptz or h is distinct from p_record->>'hash' or ev is distinct from nullif(p_record->>'evidence_version','')::timestamptz then raise exception 'STALE_RECORD'; end if;
 if p_patch->>'kind' is distinct from p_record->>'kind' or p_state->>'kind' is distinct from p_record->>'kind'
  or p_patch->>'key' is distinct from key or p_state->>'key' is distinct from key or p_patch->>'action'<>'UPSERT'
  or p_patch->>'baseline_hash' is distinct from h or p_state->>'baseline_hash' is distinct from h
  or nullif(p_patch->>'baseline_version','')::timestamptz is distinct from version
  or nullif(p_state->>'baseline_version','')::timestamptz is distinct from version
  or nullif(p_state->>'evidence_version','')::timestamptz is distinct from ev then raise exception 'INVALID_PATCH'; end if;
 if length(p_source) not between 10 and 100000 or p_source_hash is distinct from encode(sha256(convert_to(p_source,'UTF8')),'hex') then raise exception 'INVALID_SOURCE'; end if;
 insert into career_sources(id,account_id,kind,content,evidence_text,content_hash) values(p_source_id,p_account,'MANUAL',p_source,p_source,p_source_hash);
 insert into career_imports(account_id,source_id,candidates,model)
  values(p_account,p_source_id,jsonb_build_array(jsonb_build_object('identity',(p_record->>'kind')||':'||key,'status','UPDATED','before',p_record,'after',p_patch,'reason','Explicit owner edit')),'owner-manual-edit') returning id into batch;
 return public.apply_career_brain_import(batch,jsonb_build_array(p_patch),jsonb_build_array(p_state));
end $$;
revoke all on function public.save_career_record(uuid,jsonb,uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_career_record(uuid,jsonb,uuid,text,text,jsonb,jsonb) to authenticated;
