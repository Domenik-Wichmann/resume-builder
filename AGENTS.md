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
