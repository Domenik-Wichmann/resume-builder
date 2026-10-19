# Clear Signal v4 application drafts

Apply `202610060005_resume_generation.sql` before deploying this version. Existing
designs, applications and tracking codes remain compatible. No canonical career
records or embeddings change, so a reindex is unnecessary.

The application builder saves a private preview before generation. Four bounded
requests understand the job, find evidence, write the résumé and verify the draft.
Writing uses an explicit low reasoning effort and a 16,000-token output budget,
including reasoning, with a 120-second timeout. The job plan appears once beside
the exact evidence packets. Output-limit, incomplete JSON and schema-invalid
responses fail closed and retain billed usage as failed calls. The owner sees a
specific retry message, and the saved generation stage remains resumable.
Independent verification uses medium reasoning effort in parallel batches of at
most 14 statements, with a 10,000-token budget per batch and up to 52 statements.
Owner generation reads verified source evidence with the owner's JWT and membership
RLS, then filters for published, unarchived records. It does not call the service-only
public snapshot RPC with an authenticated client. Hash and exact-source checks still apply.
The résumé library appears first, with search, saved dates, region and attributed
activity. Each saved version opens its preview and private analytics. Region selection
uses the configured US or Bulgarian contact profile and Letter or A4 paper; it does
not change residence or career facts. Advanced metadata and experiments are collapsed.
The UI displays the actual saved stage. Reloading the browser exposes **Resume
saved generation**; stage leases prevent concurrent calls from overwriting work.
Provider failures retain the last completed stage. A crashed lease expires after
four minutes. Previews expire after one day. Resume the same draft to retry;
starting a new generation deliberately creates a new preview.

**Regenerate résumé** is available immediately above a completed preview and in
the saved résumé viewer opened from history. It loads the original organization,
role, job description, metadata and optional application learning-demo URL through
the verified owner's JWT/RLS, then runs the normal staged generation with current
published evidence and template settings. Completion opens a new saved version
with its own tracking link; the source snapshot, link, outcomes and analytics stay
unchanged. Interrupted regeneration retries the same new draft rather than
creating another copy. Its draft is also available through Continue saved generation.

Job planning distinguishes essential, preferred and contextual requirements and
supplies role-specific evidence context. New drafts use the complete account-scoped
published catalog from the first writing pass, with exact source passages and
constraints. They no longer make two semantic-search calls just to order evidence
that the writer must examine in full anyway. Substantial AI implementations rank
ahead of generic tool use for AI roles; other roles keep their own relevance order.
Version 3 packets preserve all claims, including late claims outside the former
shortlist. Legacy packets retain their original reference indexes on retries.
Publication, canonical
hashes and source evidence revisions are checked again before both writing and
verification. A changed revision requires a fresh draft.

The writer returns typed headline, summary sentences, skills, multiple bullets and
private coverage notes. Every statement carries claim references. The existing
complete-assertion verifier checks the entire statement against exact quotes;
unknown references, unsupported statements and incorrect employer bindings are
omitted individually. Conflicting title/employer entries are omitted; conflicting
dates are omitted rather than guessed. The owner sees gaps, omissions and factual
uncertainties separately from the printable résumé. Verification is a bounded
model judgment with deterministic reference/coverage checks, not a guarantee of
factual accuracy. Review the complete draft before applying.

The first writing pass also writes contextual technical capability statements:
what was built or done, the tools or methods actually used, how they were applied,
and the practical purpose. It targets 8–12 items in at most three groups of four,
with up to 300 characters per item to preserve context and material qualifiers.
It prioritizes the job's essential work across the complete published catalog,
rather than filling a quota with narrow project details, routine duties or vendor
lists. Standalone test counts and unexplained precision/recall figures do not belong
in skills. The existing independent verifier returns a separate `skill_quality`
decision alongside factual support and job fit; only an affirmative PASS admits a
skill. A true, relevant but contextless snippet still fails this editorial check.
Tools, methods and purpose must share actual source support; this pass cannot join
unrelated facts into a fictional implementation. Saved application snapshots retain
the content that was sent; the new policy applies when generating a new draft.

The writer receives the original job description and short claim aliases, which
are resolved back to canonical references before verification. For AI roles,
priority project references direct attention to RAG, grounded chatbots, model
integration and related implementation. These are navigation hints, never evidence.
The reviewer accepts a concrete transferable connection to AI operations or model
evaluation without requiring the employer to literally request RAG. Core work
ranks ahead of supporting techniques; within that tier, AI implementation ranks
ahead of routine spreadsheet work for AI roles. Personal-project or prototype
scope stays explicit and positive. Defensive asides such as "not a team-wide tool"
fail the deterministic voice check rather than being stripped into a stronger claim.

A complete full-catalog draft that passes independent review skips the second
writing/review cycle. Failed statements, incomplete coverage, thin or duplicate
skills and omission of available AI implementations trigger the existing bounded
repair pass and independent verification of repairs. Legacy drafts still receive
the full-catalog repair pass. Missing qualifications can remain private GAP notes;
speed never permits accepting an unverified statement. This removes provider calls
from the successful path; live wall-clock savings depend on the model and whether
repairs are needed.

Skill statements must cite at least one actual experience, project or achievement;
a bare method/tool list in a skill record cannot establish completed personal work.
The reviewer identifies exact subject and purpose phrases in the visible sentence,
ties the work to a job requirement and distinguishes core work from supporting
methods. Missing, generic or privately supplied context fails closed. Verified
core work for essential responsibilities ranks ahead of supporting techniques.
Source record titles and kinds accompany the exact quotes as context, never proof.
Classic skills use the full content width in the viewer, browser print, PDF and
Word export. Individual statements stay together without moving an entire group
or paired columns to the next page. The saved owner viewer also exposes the
original private job description; it is excluded from the printed résumé.
Record headings stay with their first bullet; remaining bullets can continue on
the next page instead of leaving space for an entire unbroken project block.
Job planning treats concrete day-to-day responsibilities as essential work unless
the description marks them optional; employer-specific terminology does not make
a responsibility mere background context.

The v4 base is a single column with 11-point text, off-white paper, navy text, teal
rules and underlined links. Select **Use Clear Signal v4 base** in Templates to
save it as the default. Without a saved default it is the application fallback.
Application paper is Letter for the existing US presentation and A4 for BG; the
existing market controls do not imply work authorization or universal European
conventions. The renderer targets two pages without reducing font size or deleting
fixed bullets. The print dialog remains the export mechanism. Review pagination
when a draft is unusually long; no automatic two-page guarantee is made.

The primary owner's first application atomically installs the v4 default design and imports the approved v4 project blocks into
versioned private settings. Only unambiguous canonical project matches are bound
automatically; otherwise `record_id` stays null and a private review note requests
binding. Generation never treats the imported presentation text as canonical
proof. Bound projects with disputed evidence block generation until the owner
resolves the conflict. Header identity/contact fields remain in the career profile
and market settings. Other accounts do not inherit this owner's project content.

Edit approved project text, metadata, invitations and URLs under **Fixed
application content**. Edits use optimistic versions and retain every revision.
The projects are always first portfolio, then SystemWright LMS. The optional
`learning_demo` must be a separate HTTPS learning-page URL. Leave it null to omit
it; an application-specific input overrides the template value. Generation cannot
change fixed project text or order. The summary, skills and role bullets can vary
with the job. No outside employer research runs in this version.

Saving still uses the original `finalize_application` transaction, eight-character
URL-safe code generator, collision retries, experiment assignment and idempotency.
The snapshot trigger carries that actual code into the header, portfolio project
and closing link. There is no code allocation in rendering or printing. The code
still resolves through `/r/{code}` and attributes to the original job description,
metadata, session and analytics. The preview shows a pending-link notice. Save
before printing an application. Repeated saves and exports keep the same code.

Snapshots freeze content, design, design version, fixed-content version and the
private planning/source-revision record. Historical rendering uses the captured
design. Browser PDF filenames include organization, role, public tracking code
and saved generation time. Private source IDs, prompts, scores and review notes
are excluded from the rendered document. Existing old snapshots without a design
retain their previous compatible default treatment.

Tests use fictional records and mocked providers for three distinct role families,
overlooked evidence, unsupported tooling, conflicts, attribution, quotas, private
settings, leases, RLS, tracking collisions and snapshot immutability. PDF QA checks
real browser-generated bytes for text, pagination and link annotations. Offline
demo generation is explicitly labeled as a deterministic fictional fallback; it
does not represent an AI writing pass. Live provider quality requires owner review
with the actual career inventory and an authorized provider budget.

The public `/resume` view uses the same saved v4 design and fixed project blocks as the application builder. A fixed project appears only while its bound canonical record is published and usable. General r?sum? prose uses reviewed canonical display summaries rather than concatenating the entire retrieval claim inventory; chat and job-specific generation retain full claim evidence. Saving template settings does not publish career facts.
