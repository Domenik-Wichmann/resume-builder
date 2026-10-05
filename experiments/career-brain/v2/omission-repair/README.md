# Source-backed omission repair

Continuation of draft PR #1 at `3c355444219edc4d0f375b3aaa6a9946c13011a7`.
This run keeps the selected full-source rich architecture and retrieval unchanged.

`results/manifest.json` freezes the inputs, 214 historical artifact hashes and
the $5 / 70-call maximum before provider work. `ledger.json` retains every
attempt, reservation, cost event, error and cleanup. No automatic provider retry.
Protocol amendments explain scoped refinements and future reservations; previous
responses and failed adjudications are retained.

The guard distinguishes identical **reviewed** source reuse from a changed
revision. Missing supported claims, fields and graph edges are preserved;
contradiction or silence requires owner review. Unavailable historical claims
remain unavailable. A later source correction overrides a repeated old quote.

Results distinguish native proposals, owner-reviewed actual database states,
and the supplemental component-local relationship audit. `human-audit.json`
records source-compatible dispositions, including the original two V3 failures.
It does not replace the old benchmark or call REVIEW automatic acceptance.

Use `npm run omission-repair:qualification` for preservation, deterministic
summary and regression tests. All other offline qualification scripts use
`scripts/verify-qualification.mjs` to retain archived bytes after asserting their
generated reports. Native stages are one-shot and refuse to overwrite a stage.
`--live` requires explicit live environment and the already-frozen budget.

Production modules reside in `src/lib/career-brain`; they import no experiment
code and contain no raw-response filesystem logger. The additive migration
stores claim state transactionally with canonical patches. The private production
smoke uses a verified member JWT, never publishes the fixture, and cleans its
account, Auth user, claims, sources, imports and provider usage.

Final decision and verification: [assessment](../../../../docs/qualification/career-brain-omission-assessment.md).
