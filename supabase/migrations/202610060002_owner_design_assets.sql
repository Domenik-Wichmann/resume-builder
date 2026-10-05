-- Uploaded portraits/references are private; public image routes recheck profile publication.
create table public.owner_assets (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts on delete cascade,
 kind text not null check(kind in ('PORTRAIT','REFERENCE')), name text not null check(length(name) between 1 and 120),
 storage_path text not null unique check(length(storage_path)<300), mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp','image/gif','application/pdf')),
 created_at timestamptz not null default now(), check(storage_path like account_id::text || '/%'), check(kind<>'PORTRAIT' or mime_type<>'application/pdf')
);
alter table public.owner_assets enable row level security;
create policy member_assets on public.owner_assets for all to authenticated using(public.is_account_member(account_id)) with check(public.is_account_member(account_id));
grant select,insert,delete on public.owner_assets to authenticated;
grant all on public.owner_assets to service_role;
create function public.check_presentation_portrait() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.photo_url like '/assets/%' then
  perform 1 from owner_assets where id=substring(new.photo_url from 9)::uuid and account_id=new.account_id and kind='PORTRAIT' for key share;
  if not found then raise exception 'PORTRAIT_REQUIRED'; end if;
 end if;
 return new;
end $$;
revoke all on function public.check_presentation_portrait() from public,anon,authenticated;
create trigger check_portrait before insert or update on public.profile_presentations for each row execute function public.check_presentation_portrait();
create function public.retain_used_portraits() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from profile_presentations where photo_url='/assets/'||old.id::text) then raise exception 'PORTRAIT_IN_USE'; end if;
 return old;
end $$;
create trigger retain_portrait before delete on public.owner_assets for each row execute function public.retain_used_portraits();
revoke all on function public.retain_used_portraits() from public,anon,authenticated;
create function public.limit_owner_assets() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from accounts where id=new.account_id for update;
 if (select count(*) from owner_assets where account_id=new.account_id)>=40 then raise exception 'ASSET_LIMIT'; end if;
 return new;
end $$;
create trigger limit_assets before insert on public.owner_assets for each row execute function public.limit_owner_assets();
revoke all on function public.limit_owner_assets() from public,anon,authenticated;
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('owner-assets','owner-assets',false,4194304,array['image/jpeg','image/png','image/webp','image/gif','application/pdf']) on conflict(id) do nothing;
 end if;
end $$;

create function public.valid_resume_design(s jsonb) returns boolean language sql immutable as $$
 select jsonb_typeof(s)='object' and (select count(*) from jsonb_object_keys(s))=11
  and s->>'page' in ('A4','LETTER') and s->>'layout' in ('CLASSIC','SIDEBAR') and s->>'font' in ('SANS','SERIF','MONO')
  and s->>'accent' ~ '^#[0-9a-fA-F]{6}$' and s->>'text' ~ '^#[0-9a-fA-F]{6}$'
  and s->>'margin_mm' ~ '^(1[0-9]|2[0-9]|30)$' and s->>'font_pt' ~ '^(9|1[0-3])$'
  and s->>'spacing' in ('COMPACT','COMFORTABLE','AIRY') and s->>'headings' in ('RULE','PLAIN','UPPERCASE')
  and s->>'header' in ('LEFT','CENTER') and s->>'photo' in ('NONE','CIRCLE','SQUARE');
$$;
create table public.resume_templates (
 id uuid primary key, account_id uuid not null references public.accounts on delete cascade,
 name text not null check(length(name) between 1 and 100), spec jsonb not null check(public.valid_resume_design(spec) is true),
 version integer not null check(version>0), reference_id uuid references public.owner_assets on delete restrict,
 notes text not null default '' check(length(notes)<=3000), limitations jsonb not null default '[]' check(jsonb_typeof(limitations)='array' and jsonb_array_length(limitations)<=10),
 is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_resume_default on public.resume_templates(account_id) where is_default;
create table public.resume_template_revisions (
 template_id uuid not null references public.resume_templates on delete cascade, account_id uuid not null references public.accounts on delete cascade,
 version integer not null, name text not null, spec jsonb not null, notes text not null, limitations jsonb not null, reference_id uuid references public.owner_assets on delete restrict,
 created_at timestamptz not null default now(), primary key(template_id,version)
);
alter table public.resume_templates enable row level security;
alter table public.resume_template_revisions enable row level security;
create policy member_templates on public.resume_templates for select to authenticated using(public.is_account_member(account_id));
create policy member_template_revisions on public.resume_template_revisions for select to authenticated using(public.is_account_member(account_id));
grant select on public.resume_templates,public.resume_template_revisions to authenticated;
grant all on public.resume_templates,public.resume_template_revisions to service_role;
create function public.save_resume_template(p_account uuid,p_template jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare v integer; next_v integer; tid uuid:=(p_template->>'id')::uuid; ref uuid:=nullif(p_template->>'reference_id','')::uuid;
begin
 if auth.uid() is null or not public.is_account_member(p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
 perform 1 from accounts where id=p_account for update;
 if ref is not null and not exists(select 1 from owner_assets where id=ref and account_id=p_account and kind='REFERENCE') then raise exception 'INVALID_REFERENCE'; end if;
 select version into v from resume_templates where id=tid and account_id=p_account for update;
 if exists(select 1 from resume_templates where id=tid and account_id<>p_account) then raise exception 'ACCOUNT_REQUIRED'; end if;
 if coalesce(v,0) is distinct from (p_template->>'version')::integer then raise exception 'STALE_TEMPLATE'; end if;
 if v is null and (select count(*) from resume_templates where account_id=p_account)>=30 then raise exception 'TEMPLATE_LIMIT'; end if;
 next_v:=coalesce(v,0)+1;
 if (p_template->>'is_default')::boolean then update resume_templates set is_default=false,version=version+1,updated_at=now() where account_id=p_account and is_default and id<>tid; end if;
 insert into resume_templates(id,account_id,name,spec,version,reference_id,notes,limitations,is_default)
 values(tid,p_account,p_template->>'name',p_template->'spec',next_v,ref,p_template->>'notes',p_template->'limitations',(p_template->>'is_default')::boolean)
 on conflict(id) do update set name=excluded.name,spec=excluded.spec,version=excluded.version,reference_id=excluded.reference_id,notes=excluded.notes,limitations=excluded.limitations,is_default=excluded.is_default,updated_at=now();
 return next_v;
end $$;
create function public.record_resume_template_revision() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into resume_template_revisions(template_id,account_id,version,name,spec,notes,limitations,reference_id) values(new.id,new.account_id,new.version,new.name,new.spec,new.notes,new.limitations,new.reference_id);
 return new;
end $$;
create trigger template_revision after insert or update on public.resume_templates for each row execute function public.record_resume_template_revision();
revoke all on function public.record_resume_template_revision() from public,anon,authenticated;
revoke all on function public.save_resume_template(uuid,jsonb) from public,anon;
grant execute on function public.save_resume_template(uuid,jsonb) to authenticated;
