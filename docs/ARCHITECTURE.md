# Architecture and boundaries

## Persistent workspaces and compilation

The portfolio creates one of two browser-owned workspaces. Live ownership uses
a signed opaque visitor cookie, verified before private reads. PostgreSQL locks
the visitor row to enforce two slots under concurrent creation. Action leases
serialize edits; an RPC atomically saves requirements, evidence relationships,
questions, and topic signals. These tables have no browser policies. Visitors can
delete context; 90-day inactivity cleanup cascades from visitor records. Demo
uses two local-storage workspaces and makes no provider calls.

Questions add evidence and simple STRONG/PARTIAL/NONE topic signals for the owner.
These do not prove qualifications or gaps. Compilation uses requirements and
explored topics to prioritize current canonical facts. Sparse coverage permits
at most three conservative retrieval queries. A typed Resume IR is rendered by
application-owned HTML/CSS. Q&A prose never becomes résumé bullets. Printable
workspace export uses an allowlist, excluding IDs, scores, vectors, prompts, and
attribution. The latest résumé projection is persisted separately from event counts.

One canonical profile has separately approved US/BG presentations. Market order
is tracking selection, saved preference, coarse Vercel country, then US. Manual
selection clears the current presentation override; another tracking-link visit
selects its market again. Country information is not stored and browser GPS is
never requested. Functional preferences and workspace ownership are separate
from analytics attribution.

The owner area verifies a Supabase Auth access token with `getUser`, then requires
the exact `OWNER_USER_ID`. Tokens are HttpOnly, same-site, and limited to one hour;
no refresh token or custom password storage is implemented. Every owner API repeats
authorization. The overview uses actual retained counts and distinguishes export
opens from completed downloads. Link creation, recent workspaces/questions, topic
signals, and career maintenance remain small rather than becoming a CMS.

## Career data

`getCareer()` selects only published canonical records. Profile, roles, projects,
skills, accomplishments, education, and certifications remain separate tables;
three junction tables express skill relationships. The first schema deliberately
uses concise title/context/summary fields, with optional role organization and
start/end dates. Market contact rows share the same canonical profile.

Demo mode returns explicitly fictional fixtures. Live mode requires all service
configuration and a published profile; a database error never falls back to demo.
No browser Supabase client or privileged API is exposed.

## Embeddings and retrieval

Each supported canonical entity has a concise semantic representation and
SHA-256 content hash. `reindexCareer()` compares hash and model, requests changed
document embeddings in batches of 32, and upserts the vectors. It is an owner
CLI or authenticated account-management operation, never a public endpoint.
At this scale there is no job runner.
Reindex after publishing, changing relationships, or changing models. Concurrent
edits are safe for grounding because stale hashes are excluded during retrieval;
run indexing again to restore semantic coverage.

`career_embeddings` uses explicit nullable source foreign keys with an
exactly-one-source constraint, generated entity type/ID, and cascade deletion.
This preserves actual referential integrity rather than trusting a polymorphic
UUID. A 1024-dimensional pgvector column and cosine HNSW index match the Cohere
output setting. A model filter prevents comparing incompatible vector spaces.

Live queries use Cohere `search_query`, retrieve nearest neighbors, check current
canonical publication in SQL, and expand into the published relational snapshot.
Matching hashes exclude obsolete semantic content. Only the resulting canonical
records enter prompts. Deterministic keyword retrieval supplements semantics.
Job analysis makes at most five deduplicated queries from the description and
requirement lines. Evidence is deduplicated and capped at 12 records. The initial
0.25 similarity threshold needs evaluation against real owner content.

Demo uses keyword retrieval only; no arbitrary mock vectors or provider calls.
Private source documents and accepted unpublished facts are available only to
their account members. They are not embedded into public retrieval. Career Master
and interview answers share the authenticated ingestion/review boundary.

## Grounding and inference

The API validates origin, content type, streamed body size, and typed input before
using provider resources. It reserves the shared database quota before Cohere or
OpenRouter. Missing quota service fails closed. One atomic row bounds global
spending at 10 requests/minute and 100/day; a job analysis may contain five query
embeddings and one generation within that request. The owner indexing command
is separate and is not charged to the public quota. Set provider account spending
limits as an additional control. Vercel WAF rules can further protect availability.

Prompt construction, retrieval, generation, contracts, API handlers, and UI are
separate small modules. OpenRouter receives a system grounding rule and untrusted
user input in a user message. Zod validates generated JSON. Evidence IDs and skill
names must belong to the retrieved bundle. The UI renders text, never model HTML.
Provider timeouts and response limits bound work. Unsupported models fail clearly
instead of parsing free-form text as a success. Narrative hallucination remains
a model risk even with valid IDs; grounded answer evaluation is a next step.

## Tracking

Only valid application short links create a session. Codes use six random bytes
(eight URL-safe characters, 48 bits). Database uniqueness and CLI retries handle
collisions. Invalid and inactive codes share a 404 response. Tracking mappings and
events are denied to anonymous roles; authenticated account members see only their
own records through RLS.

Landing events are best effort and contain no recruiter input or IP information.
A signed, HttpOnly, same-site cookie associates future interaction work with the
link for 24 hours. Workspace questions, previews/exports and explorer events are
linked through owned workspaces; other legacy tracking event types remain schema
foundations. `readSession()` validates signatures and expiry. Browser privacy
signals suppress optional tracking. A shared
forwarded link identifies link engagement, not a particular person.

`/api/tracking` accepts only bounded, same-origin public page categories. It
uses signed HttpOnly 24-hour cookies, resolves active links in the primary
account, and excludes verified owner traffic and DNT/GPC. The service-only
`record_portfolio_page_view` RPC suppresses repeated same-page writes within
five seconds and caps a session at 500 views per rolling day. Direct visits
have a null link; no query strings, project slugs or referrers are stored.
The private Analytics page verifies the configured owner and reads through
their Supabase JWT and membership RLS.

`prune_tracking_events()` deletes records older than 90 days and is called on
new page-view writes. For a silent portfolio the owner should invoke it manually
or enable a Supabase scheduled task if strict continuous expiry is required.

## Verification and hosting

Vitest exercises utilities, mocked provider contracts, API validation, and
committed migrations in PostgreSQL/pgvector through test-only PGlite. Database
tests verify RLS, privileged RPC isolation, canonical FK cascades, visibility,
model/type filtering, cosine similarity, and atomic quotas. They do not prove
remote credentials or provider quality. No external project has been provisioned
without authenticated access. Vercel runs one Next.js application; Supabase is the
only state store. GitHub Actions verifies code before deployment.

Provider references:

- [Cohere Embed v2 API](https://docs.cohere.com/v2/reference/embed)
- [Supabase cosine HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)

## Account and ingestion boundaries

Public server reads are restricted to the original account and published records.
Authenticated career management uses the user's verified Supabase JWT, so RLS,
rather than a service key plus client-supplied tenant ID, authorizes each query.
The service key is used only for verified bootstrap and explicitly scoped public
projections. Tenant foreign-key checks defend against cross-account attachments.

Extraction proposes typed facts with exact quotations. Accepted record identity,
diff classification, transaction boundaries, publication and semantic hashes are
application/database concerns. Interview questions are explainable deterministic
probes; answers reuse extraction and review. No AI output becomes canonical or
public without an authenticated human acceptance and publication action.

## Phase 2B portfolio and experimentation loop

Projects use the original canonical `projects` table. Showcase authoring and
canonical skill/achievement links commit through a JWT/RLS transaction with an
optimistic version check. Long descriptions support text-only Markdown headings,
paragraphs and lists, with no raw HTML or executable Markdown links. CTA links
accept credential-free HTTPS or a small internal-route allowlist. Description
and approved outcomes participate in vector content hashes; reindexing scans
projection state but embeds only changed published entities.

Project images live in the private `project-media` Storage bucket. There are no
anonymous/authenticated object policies. Tenant-prefixed paths, parent FKs and
membership RLS protect metadata. The server media route requires a published,
unarchived primary-account parent, or authenticated membership for private
preview. Browser image requests bypass the Next image optimization cache and
use no-store so an unpublish is checked on every request. Uploads are bounded to
4 MB and reject SVG/HTML; only PNG/JPEG/WebP/GIF signatures are accepted. The app
limit stays below [Vercel's function payload limit](https://vercel.com/docs/functions/limitations);
the private bucket has a separate 5 MB ceiling.

The category/skill explorer derives supporting records and co-occurring skills
from relational links. It does not persist graph edges. Optional events require
an existing browser-owned workspace, verify published targets and respect
DNT/GPC. Repeated selections are debounced. Public workspace reads expand only
current published evidence from these signals. They influence compilation and
follow-up context without conferring truth on prior answer text.

Quick Answers are explicit owner-reviewed cards with direct FK dependencies.
Canonical content/publication/relationship updates mark referencing cards stale.
Public reads exclude stale, expired, private cards or cards whose sources are no
longer published. Manual saves and generated drafts require review and separate
publication; no automatic regeneration or semantic answer interception occurs.
Public projects, explorer and cards make zero inference/embedding calls.

Applications use owner-reviewed small-vocabulary metadata (deterministic
suggestions, no classifier inference). Published canonical retrieval produces
three private Resume IR previews. Saving serializes assignment by account using
an advisory transaction lock, chooses the least-assigned variant of the oldest
eligible running experiment, then atomically stores an immutable snapshot and
tracking link. Assignment counts all saved snapshots, including drafts. All
variants keep the CLASSIC_V1 visual template: strategies affect evidence priority
and section order, never factual wording. Snapshot generation time is the
preview time; later career changes cannot rewrite it. Manual state transitions
append immutable outcomes. Analytics deduplicate link/session visits, count
observed engagement and show raw sent-application rates without a winner. The
owner dashboard caps each input table at 1,000 rows and discloses truncation.
Coverage suggestions are current published evidence versus observed interests
and historical snapshot inclusion, not automatic strategy changes or causal
claims.

## Public AI access and usage boundaries

Every public AI route, including standalone API calls, verifies an opaque signed
visitor cookie and uses the same service-only atomic quota RPC. Defaults are
5-second spacing, 25 operations per UTC day, 50 per rolling seven days, and a
90-second visitor lease; workspaces also retain their existing action lease.
The global spending fuse remains independent. A valid signed access cookie is
rechecked against an active primary-account tracking link and skips only the
initial challenge. It is separate from optional analytics, including DNT/GPC.
Deleting cookies can obtain a new opaque identity; no fingerprinting/IP tracking
is added, so the global fuse remains necessary.

When both Turnstile keys are configured, untracked visitors must complete
Siteverify before their first paid operation. Success, canonical hostname and
`ai_access` action must match; tokens are single-use. No raw IP is sent. Missing
keys retain quota-protected existing access (LIMITS_ONLY), not a simulated human
check. Partial configuration fails startup. Verification lasts 24 hours.
See [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Provider usage events record account/model/operation, quantities and available
cost in integer micro-dollars, with nullable unknown values and no accounting
prompt/response retention. Platform charges are unset: credit enforcement is not
active. The service-only credit ledger provides signed integer transactions,
idempotency, one trial grant per account and overdraft prevention. Gross ledger
balance is auditable. Expiry metadata and a disabled eligibility-gated trial
service prepare future work; redemption and expiry allocation are deferred.
BYOK is still a billing-mode boundary without plaintext key storage or a UI.
Stripe, subscriptions, public trial/purchase flows and cross-tenant aggregation
remain outside this phase.
