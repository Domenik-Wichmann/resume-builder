-- Preserve optimistic versioning, owner membership and immutable revisions.
-- Count is presentation feedback, not a restriction on approved project blocks.
create or replace function public.save_resume_fixed_content(p_account uuid,p_spec jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare v integer; project jsonb; bullet jsonb; ids text[]:='{}';
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
 perform 1 from accounts where id=p_account for update;
 select version into v from resume_fixed_content where account_id=p_account for update;
 if coalesce(v,0) is distinct from (p_spec->>'version')::integer then raise exception 'STALE_CONTENT'; end if;
 if length(p_spec::text)>100000 or jsonb_typeof(p_spec->'projects') is distinct from 'array'
  or coalesce(p_spec->>'portfolio','') !~ '^https://[^/@[:space:]]+([/?#]|$)'
  or coalesce(p_spec->>'github','') !~ '^https://[^/@[:space:]]+([/?#]|$)'
  or length(coalesce(p_spec->>'invitation','')) not between 1 and 200
  or length(coalesce(p_spec->>'closing','')) not between 1 and 200 then raise exception 'INVALID_CONTENT'; end if;
 if p_spec->'learning_demo'<>'null'::jsonb and coalesce(p_spec->>'learning_demo','') !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'INVALID_CONTENT'; end if;
 for project in select value from jsonb_array_elements(p_spec->'projects') loop
  if jsonb_typeof(project) is distinct from 'object' or length(coalesce(project->>'id','')) not between 1 and 100
   or project->>'id'=any(ids) or length(coalesce(project->>'title','')) not between 1 and 200
   or length(coalesce(project->>'metadata','')) not between 1 and 400
   or jsonb_typeof(project->'bullets') is distinct from 'array' or jsonb_array_length(project->'bullets')<1 then raise exception 'INVALID_CONTENT'; end if;
  ids:=array_append(ids,project->>'id');
  for bullet in select value from jsonb_array_elements(project->'bullets') loop
   if jsonb_typeof(bullet) is distinct from 'string' or length(bullet#>>'{}') not between 1 and 700 then raise exception 'INVALID_CONTENT'; end if;
  end loop;
  if project->'homepage'<>'null'::jsonb and (length(coalesce(project->>'homepage',''))>2000 or coalesce(project->>'homepage','') !~ '^https://[^/@[:space:]]+([/?#]|$)') then raise exception 'INVALID_CONTENT'; end if;
  if project->>'id'='lms' and p_spec->>'learning_demo' is not null and rtrim(p_spec->>'learning_demo','/')=rtrim(project->>'homepage','/') then raise exception 'INVALID_CONTENT'; end if;
  if project->>'record_id' is not null and not exists(select 1 from projects where id=(project->>'record_id')::uuid and account_id=p_account) then raise exception 'INVALID_PROJECT'; end if;
 end loop;
 v:=coalesce(v,0)+1;
 p_spec:=jsonb_set(p_spec,'{version}',to_jsonb(v));
 insert into resume_fixed_content(account_id,version,spec) values(p_account,v,p_spec)
 on conflict(account_id) do update set version=excluded.version,spec=excluded.spec,updated_at=now();
 insert into resume_fixed_content_revisions(account_id,version,spec) values(p_account,v,p_spec);
 return v;
end $$;
revoke all on function public.save_resume_fixed_content(uuid,jsonb) from public,anon;
grant execute on function public.save_resume_fixed_content(uuid,jsonb) to authenticated;
