-- Preserve source identities and exact evidence while allowing bounded full documents.
alter table public.career_sources
  drop constraint career_sources_content_check,
  drop constraint career_sources_evidence_text_check,
  add constraint career_sources_content_check check(length(content)<=100000),
  add constraint career_sources_evidence_text_check check(length(evidence_text)<=100000);
