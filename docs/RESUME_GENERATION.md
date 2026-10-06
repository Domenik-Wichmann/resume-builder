# Clear Signal v4 application drafts

Apply `202610060005_resume_generation.sql` before deploying this version. Existing
designs, applications and tracking codes remain compatible. No canonical career
records or embeddings change, so a reindex is unnecessary.

The application builder saves a private preview before generation. Four bounded
requests understand the job, find evidence, write the résumé and verify the draft.
The UI displays the actual saved stage. Reloading the browser exposes **Resume
saved generation**; stage leases prevent concurrent calls from overwriting work.
Provider failures retain the last completed stage. A crashed lease expires after
four minutes. Previews expire after one day. Resume the same draft to retry;
starting a new generation deliberately creates a new preview.

Job planning distinguishes essential, preferred and contextual requirements and
supplies separate search queries. Retrieval runs up to eight requirement searches
and four transferable follow-up searches. An account-scoped inventory examines
published, unarchived records and their exact confirmed source passages, ranks
useful evidence, expands real achievement relationships and retains employment
and language context. At most 28 records reach writing. Publication, canonical
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
