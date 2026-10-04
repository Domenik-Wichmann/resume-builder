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
is applied to your live database. Publish a profile before
starting live mode. A future ingestion command can replace this small manual pass.

## Cohere and OpenRouter

Obtain a Cohere key from the [Cohere dashboard](https://dashboard.cohere.com/api-keys).
Set `COHERE_API_KEY`, `COHERE_EMBED_MODEL=embed-v4.0`, and
`COHERE_EMBED_DIMENSION=1024`. The adapter uses the native v2 HTTP Embed API,
float output, `search_document` for indexing, and `search_query` for retrieval.

Obtain an OpenRouter key from [OpenRouter Keys](https://openrouter.ai/settings/keys).
Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to a model supporting JSON Schema
structured outputs. Set provider spending limits appropriate for a small portfolio.
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

Vercel and Supabase CLI authentication were not configured in the inspected
environment. Once their sessions and project details are available, Codex can
continue provisioning/linking, migrations, indexing, deployment, and verification.
No local fake deployment credentials or URLs are provided.

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
