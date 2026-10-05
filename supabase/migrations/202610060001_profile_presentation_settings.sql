-- Contact variants share the canonical profile; saving never changes career facts.
alter table public.profile_presentations add column address text not null default '' check(length(address)<=500);
alter table public.profile_presentations add column photo_url text not null default '' check(length(photo_url)<=2000);
alter table public.profile_presentations add column version integer not null default 1 check(version>0);

create function public.save_profile_presentation(p_account uuid,p_profile uuid,p_settings jsonb) returns integer
language plpgsql security invoker set search_path=public as $$
declare current_version integer; next_version integer;
begin
  if not public.is_account_member(p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
  -- A profile lock also serializes first-time slot creation.
  perform 1 from public.profile where id=p_profile and account_id=p_account and archived_at is null for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  select version into current_version from public.profile_presentations
    where profile_id=p_profile and account_id=p_account and market=p_settings->>'market' for update;
  if coalesce(current_version,0) is distinct from (p_settings->>'version')::integer then raise exception 'STALE_PRESENTATION'; end if;
  next_version:=coalesce(current_version,0)+1;
  insert into public.profile_presentations(account_id,profile_id,market,location,address,contact_email,phone,work_authorization,photo_url,is_public,version)
  values(p_account,p_profile,p_settings->>'market',p_settings->>'location',p_settings->>'address',p_settings->>'contact_email',p_settings->>'phone',p_settings->>'work_authorization',p_settings->>'photo_url',(p_settings->>'is_public')::boolean,next_version)
  on conflict(profile_id,market) do update set location=excluded.location,address=excluded.address,contact_email=excluded.contact_email,phone=excluded.phone,work_authorization=excluded.work_authorization,photo_url=excluded.photo_url,is_public=excluded.is_public,version=excluded.version;
  return next_version;
end $$;
revoke all on function public.save_profile_presentation(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_profile_presentation(uuid,uuid,jsonb) to authenticated;
