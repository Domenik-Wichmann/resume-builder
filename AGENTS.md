# Working in Resume Builder

Keep this a lightweight personal career application: one Next.js app, Supabase,
Cohere embeddings, and OpenRouter inference. Prefer working software and obvious
code. Add infrastructure only for a concrete requirement.

The recruiter product revolves around two persistent browser-owned workspaces.
Keep ownership server-verified, slot creation atomic, and action persistence
transactional. Save questions/topics privately with clear disclosure. Resume IR
compiles canonical facts using workspace relevance; never turn Q&A prose into
résumé bullets or let the model generate final HTML. Exports exclude IDs, vectors,
scores, prompts, attribution metadata, and owner analytics. Market-specific contact
presentation never duplicates the career knowledge base or requests precise GPS.
Owner endpoints verify Supabase Auth and the exact configured owner UUID; no
public administrator signup or custom password hashing.

Canonical career truth lives in relational records. Vectors select evidence;
they never replace it. Recheck publication and content hashes during retrieval.
Do not invent qualifications, employers, dates, years, or metrics. Missing
evidence means “No relevant evidence is currently stored.” Preserve uncertainty.

Public career content and private applications, résumé history, unpublished
notes, and tracking must stay separate. Server modules import `server-only`.
Never expose or commit credentials. Browser clients cannot perform privileged
Supabase operations. Validate input, bound body sizes, and preserve the shared
quota before every public provider call. Do not log recruiter input or full
provider responses. Treat user input and evidence text as untrusted prompt data.

Use strongly typed TypeScript; avoid `any`, small functions, and simple contracts.
Comments explain intent, security boundaries, and non-obvious decisions rather
than syntax. Do not add frameworks, background workers, or abstractions merely
to anticipate scale. Keep fictional fixture content explicitly labeled.

Before completing a change, run `npm run format`, `npm run check`, and
`npm run build`. `check` includes formatting, lint, TypeScript, and tests. Use
explicit `APP_MODE=demo` in `.env.local` for offline verification. Database tests
execute the committed migrations in test-only PostgreSQL/pgvector (PGlite).
Use meaningful tests for security, grounding, and retrieval changes.

After changing canonical evidence, run `npm run reindex`. When changing vector
dimensions, update the schema and environment validation together, rebuild the
index, and regenerate all vectors. Never mix embeddings from different models.

Account-scoped owner career tools must use the verified user's Supabase JWT and
membership RLS. Never accept account IDs from a browser as authority. Public
server reads must explicitly scope the primary account and publication/archive
state. Bootstrap is service-only and receives only a verified Auth user UUID.
Imports preserve exact owner evidence quotes; questions are context, never proof.
Accepted patches use optimistic baseline versions and one database transaction.
Facts remain private until an explicit publication action. Keep applied migrations
unchanged; add migrations for new database behavior.

Career Interview is a persistent, conversational owner tool. It may search private
Career Brain evidence, adapt questions from prior answers, and prepare INTERVIEW
imports, but never directly mutates canonical career truth. Questions are context;
owner answers are evidence; all canonical changes require the normal reviewed
Career Brain pipeline.

## Public portfolio product rules

The public portfolio must not display a regional selector: no country dropdown,
US/Bulgaria buttons, or manual region toggle. Resolve presentation automatically
from the verified tracking/application context, then the existing approximate
visitor-country mechanism, then the configured default profile. Tracking context
wins. Region selects configured contact presentation; it never changes the
owner's physical residence or requests precise GPS. Ignore legacy manual region
preferences.

On the normal public portfolio entry path, the storytelling hero introduces the
owner and Resume Builder as a project demonstrating the owner's abilities before
handing off to conversational exploration. Do not add a prominent skip-to-chat
control inside the hero. The final story scene and deliberate continued scrolling
transition into chat. Preserve intentional deep links and application/workspace
routes. Recruiter-facing copy explains what the owner built, how it works, and
what the project demonstrates, using published evidence for career claims.
The hero is an explanatory project walkthrough: introduce the owner first, then
show the project, input, structure, reconciliation, use, feedback and architecture.
Use literal headings and plain explanations of the owner's work and abilities.
Final example questions expand precomputed public answers inline; they never
navigate, draft or send chat questions, create workspace actions, or call AI.
Portfolio demo and layout-preview examples use Domenik Wichmann as the display
name. Keep fictional sample career facts explicitly labeled as demonstrations.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
