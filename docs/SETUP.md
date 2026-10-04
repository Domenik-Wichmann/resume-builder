# Local and production setup

## Offline development

Install Node 24 LTS, then `npm ci`. Copy `.env.example` to `.env.local`, which is
ignored by Git. Keep `APP_MODE=demo`. Run `npm run dev` and open localhost:3000.
`npm run check` runs formatting, lint, types, and tests; `npm run build` verifies
the production bundle. `npm run reindex` confirms the no-provider demo path.

## GitHub

The GitHub CLI can use the existing authenticated owner session. If it expires,
authenticate without pasting a password or token into chat:

```bash
gh auth login -h github.com
gh repo create resume-builder --public --source=. --remote=origin --push
```

Use `--private` instead if you prefer private initial review. The local repository
is on `main`. An authenticated session permits Codex to create and push the repo
without further engineering work. Existing repository names may need another
name or a configured remote.

## Supabase

1. Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
   Choose a region near the expected audience. Keep the database password in your
   password manager; do not commit it or paste it into chat.
2. Use the CLI commands below. `link` may prompt for the database password locally.
3. In Project Settings → API Keys, copy the **secret** key into
   `SUPABASE_SECRET_KEY`. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
   The publishable key may be placed in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   and configure `OWNER_USER_ID` for the protected owner area.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase migration list
```

These migrations include the vector extension, source foreign keys, HNSW index,
RLS, private records, shared quota, and server-only RPCs. No SQL copy/paste is
required. The public tables default to `is_public=false`. Never set an unpublished
note public just to make retrieval work.

## Approved career content

Use Supabase's Table Editor for the initial small dataset: insert a profile,
experience/project/skill records, and junction relationships. Each content record
has a UUID and slug; roles/projects use `title`, `subtitle`, `summary`. Skills use
`name` and optional `description`. Set `is_public=true` only after approval.
Use `profile_presentations` for approved US/BG contact details, referencing the
same profile. Each presentation needs its own publication approval. Role
organization/start/end dates are optional structured fields. No fictional seed
is applied to your live database. Live mode also supports an empty database:
the portfolio reports that the profile is awaiting publication, AI returns
"No relevant evidence is currently stored," and reindexing reports zero records.
The Career Master at `/admin/career` now provides structured import and review.

## Cohere and OpenRouter

Obtain a Cohere key from the [Cohere dashboard](https://dashboard.cohere.com/api-keys).
Set `COHERE_API_KEY`, `COHERE_EMBED_MODEL=embed-v4.0`, and
`COHERE_EMBED_DIMENSION=1024`. The adapter uses the native v2 HTTP Embed API,
float output, `search_document` for indexing, and `search_query` for retrieval.

Obtain an OpenRouter key from [OpenRouter Keys](https://openrouter.ai/settings/keys).
Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to a model supporting JSON Schema
structured outputs. Set provider spending limits appropriate for a small portfolio.
The current recruiter Q&A and matching model is `openai/gpt-6-luna`.
For initial ingestion, use `openai/gpt-6-luna-pro`; escalate difficult
extraction to `openai/gpt-6.1-sol` with bounded delegated review when necessary.
Career Master ingestion is implemented; automatic delegated review remains deferred. Publication still requires
owner approval of extracted facts; model output cannot publish itself.
The optional attribution fields are in `.env.example`. Keep all provider keys
server-side. Review provider data policies before submitting confidential content.

After configuring all live variables, set `APP_MODE=live` and run:

```bash
npm run reindex
```

The command reports indexed/unchanged counts without printing career content or
keys. Run it after career updates. A model change re-embeds all published entities.
For a dimension change, add a new migration that drops the HNSW index/search
function, removes old embeddings, changes the vector column dimension, and
recreates the search function/index. Update the guard in `src/lib/env.ts`, set the
new supported dimension, apply the migration, and reindex. Never silently truncate
or mix incompatible vectors.

## Vercel

1. Authorize Vercel's GitHub integration and import `resume-builder` in the
   [Vercel dashboard](https://vercel.com/new). Use Next.js, npm, Node 24, and the
   repository root. Production branch: `main`.
2. Add `.env.example` variables under Project → Settings → Environment Variables.
   Set `APP_MODE=live`, supply server secrets, and set `NEXT_PUBLIC_SITE_URL` to
   the canonical HTTPS domain. Preview deployments need their own matching site
   URL; demo previews should use `APP_MODE=demo` explicitly. Redeploy after changes.
3. Verify homepage, Ask About Me, job matching, `/resume`, and a real short link.
   Check the functions' initialization errors if live configuration is incomplete.

This repository uses the existing GitHub-connected Vercel project `resume-builder`
and the existing Supabase project `Resume Builder`. Link to these existing projects
when local metadata is absent; do not create duplicates. Runtime variables come
from the ignored `.env.local`. Production uses live mode; previews use demo mode.
Provisioning tokens, project references and database passwords stay local.

## Owner tracking inspection

Create the owner user in Supabase Dashboard → Authentication → Users. Set their
UUID as `OWNER_USER_ID` and supply the publishable key. Disable public signup in
Auth settings if it is not needed elsewhere. Sign in at `/admin` with the
Supabase-managed email/password. The server verifies the user with Supabase and
requires the exact owner UUID before any private read or tracking-link creation.
Sessions last at most one hour; sign in again after expiry. This application
does not hash or store passwords, and has no public administrator signup.

The owner area shows measured retained counts, recent questions/workspaces,
topic signals, and tracking-link creation. Completed PDF saves and ordinary
untracked visits are not claimed as measured metrics.

Create a private `job_applications` record, then run:

```bash
npm run tracking -- YOUR_APPLICATION_UUID
npm run tracking
```

The first command creates a random link and prints its URL. The second displays
the latest 20 coarse events in the owner's terminal. There is no public analytics
dashboard. These CLI commands load `.env.local` and must only run in trusted owner
environments. To remove expired events from an inactive portfolio, call the
`prune_tracking_events` RPC with the secret server client or through Supabase SQL.
Call `prune_workspaces` to delete visitor records inactive for 90 days and cascade
their context. Cleanup also runs when a new workspace is created. These are
on-demand retention boundaries; schedule cleanup in Supabase if strict continuous
expiry is needed.

## Workspace behavior

Homepage forms create a workspace before analyzing a role or question. Returning
visitors use `/workspace` to resume or delete one of two slots. Live ownership uses
a signed 90-day HttpOnly cookie. Context is relational: separate requirements,
questions, citations, topics, and projections. Slot creation is atomic; complete
context saves use a transaction. Questions are capped at 50/workspace, evidence
at 60 records, and an action lease prevents overlapping edits.

Demo mode stores two workspaces in local storage. Clearing browser storage clears
demo context. Live users can reset browser identity by clearing cookies, so this
is a product storage limit rather than visitor identification.

Résumé preview compiles canonical facts using requirements and explored topics.
At most three extra retrieval queries fill sparse coverage. Q&A prose never
becomes résumé bullets. Résumé and workspace export have separate print layouts;
choose Save as PDF in your browser. Text export is also available. Export omits
IDs, vectors, scores, prompts, private application metadata, and analytics.

Tracking links select market before preferences or coarse request country.
Manual switching clears the current link presentation override and remembers
the choice; a subsequent tracking-link visit overrides it again. The Vercel-only
country header is never stored as location history. Browser GPS is never used.

## Operational limits

The built-in global AI budget is 10 requests/minute and 100/database day, shared
across all visitors and all application instances. It prioritizes bounded spending
over per-user fairness. Exhaustion returns 429. Embedding/provider/database failure
returns a generic 503 without exposing input or upstream error bodies. Configure
a Vercel WAF rule on `/api/ask` and `/api/match` if additional availability
protection is needed. The owner indexing command remains synchronous and separate.

## Phase 2: accounts and Career Brain

The implemented Phase 2 slice follows priorities 1–4: accounts, Career Master
review, selective projections, and career interviews. Phase 2B adds showcase/media,
the explorer, Quick Answers, application experiments and layered visitor limits;
see the management section below. No normal-account public portfolio router is
exposed yet.

`202610040004_accounts.sql` assigns existing durable records to the primary
portfolio account without deleting them. An authenticated, server-verified user
is bootstrapped idempotently into one OWNER membership. The configured original
owner receives the existing account; other existing Auth users receive separate
accounts. The server holds the bootstrap capability; browsers cannot request an
arbitrary user UUID or claim the primary account. Membership RLS protects private
reads and writes. Foreign-key attachment triggers reject cross-account sources,
career links, vectors and analytics even for privileged writes. Public career
queries run server-side and explicitly scope the primary account and publication.

`202610040005_career_brain.sql` adds source documents/quotes, semantic hashes,
archive state, languages, categories, achievement junctions and import drafts.
Career Master imports compare stable kind/key identities. UUIDs remain database
controlled. A complete Master may propose removals; interview answers are partial
updates and never imply removals. Duplicate identity, unverified quotation and
uncertainty become REVIEW. Editing a proposal recomputes its diff. A selected
patch set commits atomically, records the authenticated reviewer, and rejects
outdated baseline hashes/timestamps. Missing relationship references abort the
whole transaction. Changes remain private, including updates to previously
published facts. Archive hides a fact without destroying it. Explicit publication
and reindexing update only changed approved vectors; unchanged semantic text
makes no embedding call. Indexing failure leaves an actionable retry message,
and existing freshness/visibility checks prevent stale vectors supplying facts.

Open `/admin/career` after owner sign-in. Paste text or upload `.md`/`.txt` within
40,000 characters. `OPENROUTER_INGEST_MODEL` defaults to
`openai/gpt-6-luna-pro`; the normal Q&A/matching model remains Luna. This is one
bounded extraction call, not an autonomous ingestion system. Inputs larger than
the limit must be reduced; automatic chunk reconciliation is not implemented.
The escalation policy is Sol with bounded delegated review when a real difficult
source requires it. No automatic escalation or sub-agent service is implemented.

Interview questions use deterministic gap/relevance/novelty scoring and show
reasons. Asking questions costs no model call. Owner conversational answers use
Luna Pro extraction into the same draft/review path. Question context is stored
separately from owner-authored evidence text; a question cannot serve as source
proof. Published languages appear in the full résumé; language-specific vector
retrieval remains a future extension; approved categories now appear in the explorer.

Existing Auth users can sign in at `/auth/login` and manage their own private
Career Master via `/account`. This does not enable public signup, grant credits
or provide BYOK secrets. Accounts have NORMAL/DEMO and PLATFORM_CREDITS/BYOK mode
boundaries; an accounting ledger is available, while credit redemption and secure
tenant secret persistence remain deferred.

Google and GitHub are hidden by default. To enable a provider, configure its
credentials in Supabase Auth, allow the canonical `/auth/callback` redirect, then
set the matching `AUTH_GOOGLE_ENABLED=true` or `AUTH_GITHUB_ENABLED=true` runtime
flag. OAuth uses a short-lived HttpOnly PKCE verifier and server-side code
exchange. No provider credentials are stored in the application repository.

## Phase 2B management and runtime setup

Migrations 006–008 add portfolio/media/cards/events, experiments/previews/snapshots/
outcomes, and visitor/provider/credit accounting. Apply them additively with
`supabase db push --linked`; never reset or edit already applied migrations.
The primary owner account and membership are preserved. Public routes expose
only published, unarchived primary-account data; normal accounts remain private.

From `/account` or the owner overview, open `/admin/projects`, `/admin/answers`,
`/admin/applications` or `/admin/usage`. Project images upload to the private
`project-media` bucket created by migration 006. Choose one cover, edit alt text,
caption and order, then explicitly publish the parent. Publication exposes all
its images; link publication remains independent. Public `/projects`, `/explore`
and `/answers` have truthful empty states until content is approved.

Quick Answer saves are private. Choose supporting canonical sources, review the
answer and publish it separately. Source changes hide stale cards publicly;
resave after review, or generate a new evidence-grounded draft. Default review
period is 90 days, configurable per card. No automatic regeneration runs.

Application preparation requires a published profile and relevant evidence.
Review company/role/JD metadata and all three private previews, then approve and
save. The final page contains the assigned historical snapshot, tracking URL and
browser print/Save as PDF. Set SENT manually when actually sent, then record
outcomes as they arrive. Experiments are created DRAFT with A/B/C; explicitly set
RUNNING to enable eligible balanced assignment. The oldest eligible running
experiment takes precedence. The dashboard reports observations, not a winner.

Set both `TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY` in production
to enable human checks. Register the canonical Vercel hostname with Cloudflare.
Only the site key is returned to the browser; Siteverify checks hostname/action.
Without keys, the UI has no fake challenge and per-visitor limits/global fuse
remain active. Configure `AI_VISITOR_SPACING_SECONDS` (5),
`AI_VISITOR_DAILY_LIMIT` (25) and `AI_VISITOR_WEEKLY_LIMIT` (50) if needed. Direct
API callers must first POST `{}` to `/api/visitor`, retain its security cookie,
and complete verification when required. Tracked links skip only verification.

Leave `TRIAL_CREDIT_ENABLED=false`. There is no public trial grant, purchase,
redemption or credit-expiry engine. The service-only eligibility function requires
configured `TRIAL_CREDIT_MICRO` and `TRIAL_CREDIT_DAYS`; expiry is readiness metadata.
Actual credit charging and secure tenant BYOK persistence remain future work.
Provider accounting records only quantities/model/available cost, never prompts.
No new infrastructure project, public demo tenant or payment provider is needed.
