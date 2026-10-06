-- One statement snapshot replaces nineteen public-serving HTTP reads. This is
-- service-only: source quotes and private relationship identity keys must never
-- be returned directly to a browser. TypeScript still verifies hashes/spans.
create function public.read_public_career_snapshot(p_account uuid)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare
  spec record;
  r jsonb;
  canonical jsonb := '[]'::jsonb;
  skill_keys jsonb;
  achievement_keys jsonb;
  category_key text;
  evidence jsonb;
  sources jsonb;
begin
  for spec in select * from (values
    ('profile','profile'),('experience','experiences'),('project','projects'),
    ('achievement','achievements'),('skill','skills'),('education','education'),
    ('certification','certifications'),('language','languages'),('category','skill_categories')
  ) as kinds(kind,table_name) loop
    for r in execute format('select to_jsonb(t) from public.%I t where account_id=$1 and is_public and archived_at is null',spec.table_name) using p_account loop
      skill_keys := '[]'::jsonb;
      achievement_keys := '[]'::jsonb;
      category_key := null;
      if spec.kind in ('experience','project','achievement') then
        execute format('select coalesce(jsonb_agg(s.slug),''[]''::jsonb) from public.%I l join public.skills s on s.id=l.skill_id and s.account_id=$1 where l.account_id=$1 and l.%I=$2',spec.kind||'_skills',spec.kind||'_id')
          into skill_keys using p_account,(r->>'id')::uuid;
      end if;
      if spec.kind in ('experience','project') then
        execute format('select coalesce(jsonb_agg(a.slug),''[]''::jsonb) from public.%I l join public.achievements a on a.id=l.achievement_id and a.account_id=$1 where l.account_id=$1 and l.%I=$2',spec.kind||'_achievements',spec.kind||'_id')
          into achievement_keys using p_account,(r->>'id')::uuid;
      end if;
      if spec.kind='skill' then
        select slug into category_key from skill_categories where account_id=p_account and id=(r->>'category_id')::uuid;
      end if;
      canonical := canonical || jsonb_build_array(jsonb_build_object(
        'id',r->>'id','kind',spec.kind,'key',r->>'slug',
        'title',case when spec.kind in ('profile','skill') then r->>'name' else r->>'title' end,
        'subtitle',case when spec.kind='profile' then r->>'title' else coalesce(r->>'subtitle','') end,
        'summary',case when spec.kind='profile' then r->>'introduction' when spec.kind='skill' then r->>'description' else r->>'summary' end,
        'organization',nullif(r->>'organization',''),'start_date',nullif(r->>'start_date',''),'end_date',nullif(r->>'end_date',''),
        'skill_keys',skill_keys,'achievement_keys',achievement_keys,'category_key',category_key,
        'source_quote',coalesce(nullif(r->>'source_quote',''),'Legacy record; provenance pending'),
        'uncertainties','[]'::jsonb,'hash',coalesce(r->>'semantic_hash',''),
        'published',true,'archived',false,'updated_at',r->>'updated_at'
      ));
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(e)-'account_id'-'import_id'),'[]'::jsonb) into evidence
    from career_record_evidence e where e.account_id=p_account and exists (
      select 1 from jsonb_array_elements(canonical) c where c->>'id'=e.entity_id::text and c->>'kind'=e.kind
    );
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'evidence_text',s.evidence_text)),'[]'::jsonb) into sources
    from career_sources s where s.account_id=p_account and exists (
      select 1 from jsonb_array_elements(evidence) e,
      lateral jsonb_array_elements(case when jsonb_typeof(e->'claims')='array' then e->'claims' else '[]'::jsonb end) c,
      lateral jsonb_array_elements(case when jsonb_typeof(c->'evidence')='array' then c->'evidence' else '[]'::jsonb end) span
      where span->>'source_id'=s.id::text
    );
  return jsonb_build_object('canonical',canonical,'evidence',evidence,'sources',sources);
end;
$$;
revoke all on function public.read_public_career_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.read_public_career_snapshot(uuid) to service_role;
