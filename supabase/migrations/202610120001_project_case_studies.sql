-- Presentation drafts are separate from canonical project facts and evidence.
create table public.project_case_studies (
  project_id uuid primary key references public.projects on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 60000),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  selected boolean not null default false,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.project_case_studies enable row level security;
revoke all on public.project_case_studies from anon;
grant all on public.project_case_studies to authenticated, service_role;
create policy account_owner on public.project_case_studies for all to authenticated
  using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
create index on public.project_case_studies(account_id);
create trigger update_timestamp before update on public.project_case_studies
  for each row execute function public.set_updated_at();
create trigger account_references before insert or update on public.project_case_studies
  for each row execute function public.check_account_references();

create function public.save_project_case_study(p_account uuid, p_project uuid,
  p_project_version timestamptz, p_baseline timestamptz, p_content jsonb,
  p_hash text, p_selected boolean, p_public boolean) returns timestamptz
language plpgsql security invoker set search_path=public as $$
declare parent public.projects; old_version timestamptz; saved_version timestamptz;
begin
  if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
  select * into parent from public.projects
    where id=p_project and account_id=p_account and archived_at is null for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if parent.updated_at is distinct from p_project_version then raise exception 'STALE_PROJECT'; end if;
  if p_public and not parent.is_public then raise exception 'PROJECT_NOT_PUBLISHED'; end if;
  select updated_at into old_version from public.project_case_studies
    where project_id=p_project and account_id=p_account for update;
  if old_version is distinct from p_baseline then raise exception 'STALE_CASE_STUDY'; end if;
  insert into public.project_case_studies(project_id,account_id,content,source_hash,selected,is_public)
    values(p_project,p_account,p_content,p_hash,p_selected,p_public)
    on conflict(project_id) do update set content=excluded.content,source_hash=excluded.source_hash,
      selected=excluded.selected,is_public=excluded.is_public
    returning updated_at into saved_version;
  return saved_version;
end $$;
revoke all on function public.save_project_case_study(uuid,uuid,timestamptz,timestamptz,jsonb,text,boolean,boolean) from public,anon;
grant execute on function public.save_project_case_study(uuid,uuid,timestamptz,timestamptz,jsonb,text,boolean,boolean) to authenticated;

-- Preserve existing publication choices; new screenshot uploads start private.
alter table public.project_media add column source_filename text not null default '' check(length(source_filename)<=255),
  add column is_public boolean not null default true;
alter table public.project_media alter column is_public set default false;

-- Changing covers and image metadata shares the parent lock, so concurrent
-- edits cannot leave two covers or partially apply publication and captions.
create function public.save_project_media(p_account uuid,p_media jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare mid uuid := (p_media->>'id')::uuid; pid uuid;
begin
  if not public.is_account_member(p_account) then raise exception 'ACCOUNT_FORBIDDEN'; end if;
  select project_id into pid from public.project_media where id=mid and account_id=p_account;
  if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
  perform 1 from public.projects where id=pid and account_id=p_account and archived_at is null for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if (p_media->>'is_cover')::boolean then
    update public.project_media set is_cover=false where project_id=pid and account_id=p_account and is_cover;
  end if;
  update public.project_media set alt=p_media->>'alt',caption=p_media->>'caption',
    display_order=(p_media->>'display_order')::integer,is_cover=(p_media->>'is_cover')::boolean,
    is_public=coalesce((p_media->>'is_public')::boolean,is_public)
    where id=mid and account_id=p_account;
  return mid;
end $$;
revoke all on function public.save_project_media(uuid,jsonb) from public,anon;
grant execute on function public.save_project_media(uuid,jsonb) to authenticated;
