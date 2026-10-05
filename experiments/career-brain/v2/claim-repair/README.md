# Claim admission and grounding repair

Continue draft PR #1 from `03650f2`; preserve the completed v2 and continuation
runs. This namespace repairs the record-to-bullet boundary, claim availability,
and bounded actor equivalence. It does not change retrieval, embeddings, broad
ingestion structure, or production behavior.

The frozen manifest hashes both prior result namespaces and the old benchmark.
`inputs.json` freezes the reviewed rich seed and source-based canaries. The budget
is $5 and 70 calls, with reservations written before submission. Each native stage
uses a disposable private account, a verified member JWT for canonical writes,
exports account-scoped usage, then deletes the synthetic account and Auth user.
Native stages cannot be overwritten or automatically retried.

The path is individual source-grounded claim selection, Luna composition,
independent Luna Pro whole-bullet verification, and ResumeIR compilation. Sol is
measured only for Pro FAIL/REVIEW. A failed generated bullet gets at most one
single-admitted-proposition simplification and independent recheck. Missing or
malformed decisions, uncovered bullet words, foreign claim refs, unavailable
claims, and provider failures withhold automatic admission. Summaries and linked
skill lists never enter the compiler as factual shortcuts.

Conflict detection operates over all indexed parent/child claims. Historical
assertions remain present with DISPUTED availability; independently source-reviewed
quantity-free facts remain usable. Availability is experimentally persisted in
existing accepted import metadata, not a newly invented public database schema.
Legacy metadata has PENDING_REVIEW availability by default and never fabricated
claim evidence. This persistence adapter is qualification infrastructure.

Bounded referent normalization uses the known fixture profile, explicit accepted
name aliases, and known first-person source ownership. It changes only comparison,
never evidence text or ownership strength. Rich factual compatibility is measured
separately from compact old gold. Enrichment, representation-only changes, reviews,
and false material updates must be reported separately.

Native stages (run sequentially with `.env.local` in live mode):

```powershell
node --conditions=react-server --import tsx experiments/career-brain/v2/claim-repair/run.ts --stage=freeze
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/claim-repair/run.ts --stage=resume --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/claim-repair/run.ts --stage=repeat --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/claim-repair/run.ts --stage=sequence --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/claim-repair/run.ts --stage=qa --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/claim-repair/run.ts --stage=fallback-canaries --live
```

Offline preservation check and regressions:

```powershell
node --conditions=react-server --import tsx experiments/career-brain/v2/claim-repair/run.ts --stage=verify-preserved
npx vitest run tests/career-claim-repair.test.ts
```

The existing ordinary, original qualification, repair, and continuation suites
remain required. Production promotion is conditional on the final source-based
assessment, including any native failures; successful minimal canaries alone do
not establish end-to-end production readiness.
