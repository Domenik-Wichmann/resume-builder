-- One real foreign key per supported entity ensures embeddings cannot outlive their source.
-- 1024 is also validated server-side. Changing dimension requires a follow-up migration + reindex.
grant usage on schema extensions to service_role;
create table public.career_embeddings (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid references public.experiences on delete cascade,
  project_id uuid references public.projects on delete cascade,
  achievement_id uuid references public.achievements on delete cascade,
  skill_id uuid references public.skills on delete cascade,
  education_id uuid references public.education on delete cascade,
  certification_id uuid references public.certifications on delete cascade,
  entity_id uuid generated always as (coalesce(experience_id, project_id, achievement_id, skill_id, education_id, certification_id)) stored,
  entity_type text generated always as (case when experience_id is not null then 'experience' when project_id is not null then 'project' when achievement_id is not null then 'achievement' when skill_id is not null then 'skill' when education_id is not null then 'education' else 'certification' end) stored,
  content text not null, content_hash text not null check(length(content_hash)=64),
  embedding extensions.vector(1024) not null, embedding_model text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(num_nonnulls(experience_id,project_id,achievement_id,skill_id,education_id,certification_id)=1),
  unique(entity_type,entity_id)
);
alter table public.career_embeddings enable row level security;
revoke all on public.career_embeddings from anon, authenticated;
grant all on public.career_embeddings to service_role;
create trigger update_timestamp before update on public.career_embeddings for each row execute function public.set_updated_at();
create index career_embeddings_cosine on public.career_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- Visibility is checked against canonical rows at query time, never a stale vector flag.
create view public.career_entity_visibility with (security_invoker=true) as
  select 'experience'::text as entity_type,id as entity_id,is_public from public.experiences
  union all select 'project',id,is_public from public.projects
  union all select 'achievement',id,is_public from public.achievements
  union all select 'skill',id,is_public from public.skills
  union all select 'education',id,is_public from public.education
  union all select 'certification',id,is_public from public.certifications;
revoke all on public.career_entity_visibility from anon, authenticated;
grant select on public.career_entity_visibility to service_role;
create function public.match_career_embeddings(
  query_embedding extensions.vector(1024), requested_model text,
  match_count integer default 8, min_similarity double precision default 0.25,
  entity_types text[] default null
) returns table(entity_type text, entity_id uuid, content_hash text, similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
  select e.entity_type,e.entity_id,e.content_hash,1-(e.embedding <=> query_embedding) as similarity
  from public.career_embeddings e
  join public.career_entity_visibility v on v.entity_type=e.entity_type and v.entity_id=e.entity_id
  where v.is_public and e.embedding_model=requested_model
    and (entity_types is null or e.entity_type=any(entity_types))
    and 1-(e.embedding <=> query_embedding)>=greatest(0,min_similarity)
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count,1),20);
$$;
revoke all on function public.match_career_embeddings(extensions.vector,text,integer,double precision,text[]) from public,anon,authenticated;
grant execute on function public.match_career_embeddings(extensions.vector,text,integer,double precision,text[]) to service_role;
