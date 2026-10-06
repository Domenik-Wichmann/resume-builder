# Performance pass — 6 October 2026

Warm career loading fell from a 679 ms median to 269.3 ms (60% less time).
Public career loading now uses one database HTTP request instead of nineteen.
The 300 ms target is **not an unconditional end-to-end guarantee**: cold starts,
network outliers, and uncached provider calls remain.

## Single-call Luna update — 6 October 2026

Q&A and job matching now use **one `openai/gpt-6-luna` call** to answer from
freshly verified source packets. The separate support-classification call and
independent answer audit were removed at the user's request. Source hashes,
publication, exact quote offsets, availability, shared quota, and allowed
citation IDs are still checked in application code. Final prose no longer has
an independent model audit. Public resume generation also uses Luna for claim
selection and bullet verification, while keeping its claim-level checks.

The same approved software-engineering benchmark question succeeded in all
three measured versions:

| Answer pipeline         | Full operation ms | Inference stages                 |
| ----------------------- | ----------------: | -------------------------------- |
| Historical Pro/Luna/Pro |          37,914.8 | 17,214.2 + 5,598.8 + 12,824.6 ms |
| Two Luna calls          |          26,948.5 | 12,022.8 + 12,790.8 ms           |
| Final single Luna call  |          13,563.7 | 11,244.2 ms                      |

The final sample took **64% less time** than the historical three-call sample.
These are individual live-provider observations from the development machine,
not medians or a controlled model-quality comparison. The current context and
answer prompts also provide broader career coverage than the historical run;
provider latency and output length vary. No provider responses or evidence text
are retained in the timing artifacts.

| Final single-call stage                      | Measured ms |
| -------------------------------------------- | ----------: |
| Initial career load                          |       328.8 |
| Cohere request                               |       338.1 |
| Embedding including usage accounting         |       445.0 |
| Fresh vector search                          |       101.0 |
| Retrieval including embedding and search     |       553.9 |
| Fresh evidence recheck                       |       217.6 |
| Shared quota reservations, combined          |     1,202.5 |
| Usage writes, combined                       |       223.9 |
| LLM fetch and body time                      |    11,112.2 |
| Answer generation including usage accounting |    11,244.2 |
| Complete answer operation                    |    13,563.7 |

Spans overlap and must not be added. This benchmark still excludes saved
workspace loading/persistence, browser paint, and deployed HTTP transport.
The 300 ms target remains exceeded by uncached embedding and some cold or
contended operations. New raw records: [two-call Luna](performance/live-luna-two-call-readings.jsonl)
and [single-call Luna](performance/live-luna-single-call-readings.jsonl).

## Deployed production verification

The release is pushed to `main` as `e616cfc60096cd81e949658c838396a9873fa117`.
GitHub [release CI](https://github.com/Domenik-Wichmann/resume-builder/actions/runs/37396781124)
passed. Vercel deployment `dpl_pszzLDRYhuo19T4mxcFESDsNNdaQ` is ready and
serves [the production site](https://resume-builder-amber-sigma.vercel.app).
Inspection confirms **all deployed server functions use Dublin (`dub1`)**,
beside the linked Ireland Supabase project. The build machine remains in
Washington; that is separate from where requests execute.

Both production sample sets contain six GETs per route, all HTTP 200. They
measure complete responses from the development machine, including network
transfer. Initial medians and follow-up medians each exclude their first sample.
The initial set immediately followed deployment; the follow-up investigated its
remaining outliers. Both are retained, with the combined warm range below.

| Route                           | Initial first ms | Initial warm median ms | Follow-up warm median ms | Combined warm range ms |
| ------------------------------- | ---------------: | ---------------------: | -----------------------: | ---------------------: |
| Homepage `/`                    |          1,659.6 |                  369.8 |                    245.8 |            225.5–476.0 |
| Explorer `/explore`             |            298.0 |                  284.8 |                    222.2 |            216.6–407.4 |
| Resume `/resume`                |            279.6 |                  240.6 |                    233.2 |            217.3–270.0 |
| Workspaces `/workspace`         |            216.3 |                  216.3 |                    197.3 |            187.5–236.2 |
| Projects `/projects`            |            200.3 |                  209.3 |                    166.0 |            147.4–404.2 |
| Reviewed answers `/answers`     |            128.7 |                  123.0 |                    117.8 |            114.0–157.8 |
| Catalog API                     |          1,087.4 |                  233.0 |                    205.3 |            183.7–256.8 |
| Workspace list, anonymous/empty |            106.7 |                   92.0 |                    100.6 |             91.6–131.8 |

The follow-up catalog API's server-side timing isolates the work from network
transfer and platform startup:

| Server stage                     | Warm median ms | Warm range ms |
| -------------------------------- | -------------: | ------------: |
| Fresh public career snapshot RPC |           85.7 |     77.1–93.2 |
| Canonical hash/source grounding  |            3.5 |       2.7–4.5 |
| Complete catalog                 |          100.6 |    84.3–105.5 |
| Complete API handler             |          101.2 |    84.8–121.0 |

These spans overlap. The initial catalog response took 1,087.4 ms overall while
its handler measured 300.4 ms, demonstrating startup/transport cost outside the
handler. All follow-up warm route medians are below 300 ms, but some individual
responses and cold starts are not. Browser paint/hydration, signed-in owner
routes, populated recruiter workspace actions, and live resume compilation were
not measured. The approved live AI benchmark below was run from the development
machine, not through the deployed HTTP endpoint.

## Measurement conditions

Measurements ran from the development machine against the configured live
Supabase database. HTTP measurements used the optimized `next start` build on
localhost, with live public data. They include the full response body, but do
not measure browser paint, hydration, or image downloads. Deployed-host
measurements are reported separately above.
No signed-in owner or saved recruiter workspace was used.

Each database operation has ten samples; each HTTP route has six. The first
sample is shown separately; medians and ranges exclude that sample. These are
small sequential samples, not a production load test or a p95 SLO. The final
pass ran after formatting, tests, and compilation finished.

## Live database operations

All values are milliseconds, including network time and application validation.

| Operation                                      | First sample | Warm median |  Warm range |
| ---------------------------------------------- | -----------: | ----------: | ----------: |
| Career snapshot, grounding, and mapping        |        376.2 |       269.3 | 250.8–275.4 |
| pgvector search, synthetic query vector        |        157.0 |        84.8 |  83.4–118.7 |
| Complete career catalog                        |        267.9 |       266.1 | 206.9–279.1 |
| Market contact presentation                    |        167.9 |       159.9 | 157.1–168.7 |
| Résumé design                                  |         82.2 |        81.3 |   78.3–84.7 |
| Published answer cards                         |         85.3 |        80.9 |   77.5–82.4 |
| Fresh evidence recheck and packet construction |        256.5 |       264.9 | 254.0–272.9 |

The vector benchmark uses a fixed synthetic 1024-dimensional unit vector. It
measures the live database search stage, not embedding latency or semantic
retrieval quality. The answer-card measurement reflects the currently stored
public cards; populated catalogs can have different costs.

Before changes, five career loads took **1,248, 623, 688, 698, and 670 ms**.
The initial warm median was 679 ms, with a 623–698 ms range. The old loader
used five serial database waves; a workspace question loaded career data six
times. The current question path loads it three times: initial context,
pre-generation evidence verification, and a fresh persistence check.

## Live-data production-build HTTP responses

| Route                                           | First sample | Warm median |  Warm range |
| ----------------------------------------------- | -----------: | ----------: | ----------: |
| Homepage `/`                                    |        960.0 |       297.2 | 275.6–313.6 |
| Explorer `/explore`                             |        268.6 |       271.6 | 260.2–289.7 |
| Résumé `/resume`                                |        303.8 |       276.9 | 268.1–301.1 |
| Workspaces `/workspace`                         |        274.5 |       263.5 | 214.1–272.8 |
| Projects `/projects`                            |        215.0 |       183.1 | 175.4–726.1 |
| Reviewed answers `/answers`                     |         90.3 |        89.2 |   87.5–93.5 |
| Catalog API                                     |        299.9 |       264.9 | 223.5–288.7 |
| Workspace list API, anonymous/no visitor cookie |          4.1 |         3.5 |     2.9–4.0 |

The workspace page previously measured a 383.8 ms warm median in this session.
Parallel identity/contact loading reduced it to 263.5 ms. The anonymous list
measurement does not represent loading an existing browser-owned workspace.

The homepage and résumé slightly exceeded 300 ms in some warm samples; projects
had a 726.1 ms outlier. Earlier measurements made during concurrent local checks
also recorded career loads as high as 720.1 ms warm and 2,414.7 ms on the first
sample. Those results are retained, rather than hidden by the final medians.

## Offline application overhead

The same production build, using explicitly fictional demo data and no provider
calls, produced these warm HTTP medians:

| Route              | Median ms |  Range ms |
| ------------------ | --------: | --------: |
| Homepage           |      23.4 | 21.9–27.6 |
| Explorer           |      14.9 | 13.0–19.8 |
| Résumé             |      12.8 | 11.1–16.5 |
| Workspaces         |       9.8 |  8.9–10.8 |
| Projects           |      10.1 |  8.0–11.4 |
| Reviewed answers   |      11.3 |  8.9–11.6 |
| Catalog API        |       6.1 |   6.0–7.7 |
| Workspace list API |       5.5 |   3.2–6.8 |
| Ask API            |       7.0 |   6.3–7.2 |
| Match API          |       7.6 |  6.2–12.6 |

These demo results must not be presented as live AI latency. The first demo
homepage response still took 356.6 ms.

## Historical approved three-call AI benchmark

The subsequently approved live answer benchmark completed successfully in
**37,914.8 ms** from the development machine. It reserved the existing shared
quota and recorded normal usage; no limit was bypassed.

| Stage                                     | Measured ms |
| ----------------------------------------- | ----------: |
| Initial career load                       |       483.5 |
| Cohere provider fetch                     |       347.3 |
| Embedding including accounting/validation |       515.9 |
| Fresh vector search                       |       235.2 |
| Retrieval including embedding/search      |       754.3 |
| Fresh evidence recheck                    |       334.8 |
| Support adjudication LLM stage            |    17,214.2 |
| Answer drafting LLM stage                 |     5,598.8 |
| Independent faithfulness LLM stage        |    12,824.6 |
| Shared quota reservations, combined       |       702.0 |
| Provider usage writes, combined           |       639.6 |
| LLM fetch/body time, combined             |    35,150.5 |
| Complete answer operation                 |    37,914.8 |

Nested rows overlap; they must not be summed. The three LLM stages include their
individual usage writes and response validation. This benchmark does not load or
save a recruiter workspace. The uncached embedding and evidence recheck exceeded
the 300 ms target in this sample.

Production inspection found Vercel functions in Washington (`iad1`) while the
linked Supabase database runs in Ireland (`eu-west-1`). `vercel.json` now selects
Dublin (`dub1`) for the next deployment to avoid crossing the Atlantic on each
database request. See Vercel's [region configuration](https://vercel.com/docs/functions/configuring-functions/region)
and [region mapping](https://vercel.com/docs/regions). The deployment's Dublin
region and production timings are verified above.

## Full AI request instrumentation

The APIs now return privacy-safe `Server-Timing` headers. Fixed operation labels
and milliseconds are returned; questions, IDs, facts, vectors, and provider
responses are not included. Repeated labels aggregate time within the request.

| Stage/header                                       | Work covered                                                          | Live measurement status                                            |
| -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ownership`, `lease`                               | Browser workspace ownership and action lease                          | Instrumented; not benchmarked with a live saved workspace          |
| `workspace`, `career`                              | Context loading and the initial verified career snapshot              | Snapshot measured above; full saved-workspace context not measured |
| `access`, `quota`                                  | Auth, human-verification state, visitor/shared reservations           | 702.0 ms shared reservations across four calls                     |
| `embedding`                                        | Query-vector cache or Cohere request plus usage accounting            | 515.9 ms uncached query embedding and accounting                   |
| `cohere`                                           | Embedding provider fetch                                              | 347.3 ms                                                           |
| `vector_search`                                    | Fresh account/model-scoped vector search                              | 235.2 ms with a real Cohere query vector                           |
| `evidence_recheck`, `public_snapshot`, `grounding` | Fresh publication, canonical hashes, exact source offsets and packets | Measured above                                                     |
| `support_adjudication`                             | LLM support classification                                            | 17,214.2 ms                                                        |
| `answer_candidate_evidence`                        | LLM answer drafting                                                   | 5,598.8 ms                                                         |
| `answer_faithfulness`                              | Independent LLM audit                                                 | 12,824.6 ms                                                        |
| `llm`, `llm_body`, `usage_write`                   | Provider fetch, body handling, and durable usage writes               | 35,150.5 ms provider I/O; 639.6 ms accounting                      |
| `persistence`                                      | Fresh career check and transactional workspace save                   | Instrumented; not benchmarked with a live saved workspace          |
| `release`                                          | Awaited lease cleanup                                                 | Instrumented                                                       |
| `total`                                            | Complete handler through cleanup                                      | 37,914.8 ms answer; saved-workspace persistence excluded           |

Nested spans overlap: do not add every header to calculate elapsed time.
The historical benchmark used three sequential LLM calls; current Q&A uses one
Luna call and no longer emits `support_adjudication` or `answer_faithfulness`.
Résumé compilation has
additional claim selection, composition, verification, and possible fallback
verification. The answer stages were measured; live resume compilation was not benchmarked.

The original live benchmark attempt was blocked by automatic approval review.
The user then explicitly approved provider data transfer and shared quota use;
the successful measurements above replace that earlier limitation.

## Implemented changes and verification

- Added and applied `202610060003_public_career_snapshot.sql`. The new RPC is
  service-only, account-scoped, and returns only published, active canonical
  records plus the proof required by server-side verification. Existing facts
  and applied migrations were not rewritten. Missing-RPC rolling deployments
  retain the original verified read path; other database failures fail closed.
- Preserved fresh hash, publication, source-offset, ownership, RLS, quota, and
  transactional persistence checks. Private relationship keys are used only
  internally to verify canonical hashes; public labels still require published
  evidence. No fact cache was introduced.
- Parallelized independent reads, reused the initial request's career snapshot,
  eliminated the full pre-lease workspace load, and removed two browser list
  requests before question submission.
- Cached only query embeddings for five minutes, at most 128 batches, keyed by
  account, model, dimension, and hashed query text. Failures are never cached;
  vector search and evidence verification remain fresh on cache hits.
- Reused the catalog's public snapshot for answer visibility; standalone answer
  cards load only referenced publication identities and skip that work when empty.
- Parallelized homepage, résumé, workspace, export, and project page data loads.
- Passed `npm run format`, `npm run check` (264 tests in 40 files), and
  `npm run build`, with `APP_MODE=demo` explicitly set in `.env.local` during
  verification. All five offline CI qualification suites passed. Its original live mode was restored. Benchmark servers stopped.

The Supabase migration is applied. The application is pushed and live, and the
release passed GitHub CI. Production GETs all succeeded; timings are reported
above.

## Reproducing measurements

Read-only live database stages:

```powershell
$env:APP_MODE='live'
$env:PERF_RUNS='10'
node --conditions=react-server --import tsx --env-file-if-exists=.env.local scripts/benchmark-performance.ts --reads
```

Public HTTP GETs against a running production build:

```powershell
$env:PERF_BASE='http://127.0.0.1:3125'
node scripts/benchmark-http.mjs --public-only
```

Omitting `--public-only` requires the target server to report demo mode before
the script POSTs fictional ask/match inputs. `benchmark-performance.ts --ai`
explicitly enables a live answer benchmark and reserves normal shared quota;
it also records provider usage. The approved run above completed successfully.

Raw timing-only records:
[live database](performance/live-readings.jsonl),
[live HTTP](performance/live-http-readings.jsonl),
[demo HTTP](performance/demo-http-readings.jsonl), and
[concurrent-check outliers](performance/contended-readings.jsonl).
The approved provider-stage timings are in [live AI readings](performance/live-ai-readings.jsonl).
Deployed timings are in [initial production HTTP readings](performance/production-http-readings.jsonl)
and [follow-up production HTTP readings](performance/production-http-repeat-readings.jsonl).
