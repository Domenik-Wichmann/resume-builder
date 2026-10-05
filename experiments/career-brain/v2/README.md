# Career Brain repair benchmark, revision 2

The historical corpus, raw results, baseline and assessment in the parent directory remain unchanged. `benchmark.json` freezes revision 2; `results/annotations-2.1.json` separately freezes source-based supplemental corrections. Original per-run metrics remain in `results/results.json`. The new evaluator prefers exact titles and whole aliases, so PostgreSQL cannot accidentally match SQL.

## Budget and reproduction

The hard conservative reservation ceiling is **$12**, with no automatic retries. The final bounded allowance is 160 inference attempts and 16 embedding batches. Actual execution used 160 OpenRouter attempts and five Cohere batches. The initial 80-call plan reserved $0.12 per inference; recorded amendments used $0.08 and then $0.04 for later Luna calls, keeping earlier reservations consumed. Sol reserves $0.40; embedding batches reserve $0.05. Native billed cost and unknown costs are reported separately from reservations.

```powershell
npm run requalification
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/run.ts --stage=ablation --live
node --conditions=react-server --import tsx experiments/career-brain/v2/replay.ts
node --import tsx experiments/career-brain/v2/report.ts
```

Provider stages require `APP_MODE=live` and `--live`. Stages are sequential because the reservation ledger is single-process. Recorded runs, including failures, are not silently retried. The completed ledger is exhausted for inference: another provider experiment requires a new explicitly bounded experiment, not a reset of this ledger. Offline qualification requires no provider credentials.

Completed stages: `ablation`, `rich` (R1/R2 failed protocols and R3), `repair` (R4), `revisions` (stopped), `revisions2` (bounded audits), `boundaries`, `sol`, `token-boundary`, `retrieval`, and `interpretation`. `approved-repeat` is an unexecuted diagnostic preparation; the reviewed-rich seed is source-review evidence, not a native repeat result. Protocol snapshots preserve the failed R1 and later audit/typed-name contracts; the initial manifest does not describe every later variant.

Every live stage creates a disposable, non-primary private account. Canonical apply uses an actual account member JWT, RLS and the existing optimistic transactional RPC. No email is sent. Each stage deletes its temporary data and Auth user. Final independent read-only verification confirms one original account/member/Auth user, zero temporary Auth users and zero canonical, source, import, embedding, workspace, application or project-media rows; the owner's 19 original usage events remain.

The ablation initially reserved the existing shared quota. Later service-only experiments used the separately recorded qualification budget in disposable tenants. Public endpoint quotas were not raised or reset.

## Measurement boundaries

A0/A1/B0/B1 use the same model, schema, 16,000-token output request and 180-second timeout. Only improved instructions and the fallible document map differ. A0 reproduces the frozen production prompt, not its historical timeout/output budget. There are five messy repeats per variant plus clean, sparse and pathological inputs.

R3 introduces aliases, factual claims, ownership and multiple exact spans, but its simulated state includes proposals and cannot establish approved-state stability. R4 uses a fixed, real, source-reviewed 15-record database seed and full-source extraction. Omitted entities get a conditional source-coverage audit. A corrected entity cannot be archived merely because its old facts changed. SEQ2 reads real database state after each manually reviewed V1/V2/V3 apply; raw model proposals are measured separately and never automatically accepted.

The existing RPC stores experimental metadata in `accepted_changes`; there are no new production claim columns or migrations. Application code stamps source UUIDs and calculates UTF-16 offsets. Historical approved claims may retain their original source references. Exact offsets/quotes prove traceability, not semantic entailment. Audits are bounded to 12 records with exact expected counts. Workflow diagnostics are excluded from factual audit inputs.

Fact hashes exclude display wording and quote selection, but retain claim values, dates, attribution and relationships. Bounded model equivalence is allowed only when deterministic structured state agrees. Five fixed-gold repeats prove core UUID matching; they do not prove repeated claim-inventory equivalence against a previous fully approved rich import.

Retrieval is isolated from generated ingest with manually source-reviewed clean packet gold, published only in the disposable tenant. Cohere/pgvector and weighted lexical ranking supply candidates. Bounded published evidence packets then receive support labels. Named technologies, named credentials and languages require typed direct evidence; team-only usage and limited exposure cannot establish personal professional qualifications. Partial/related context remains available for cautious Q&A. Related-only evidence cannot enter r�sum� admission. Actual ResumeIR compilation was checked on all 100 original candidate sets.

`retrieval.json` preserves the complete indexed run, 12 answers and independent audit. `interpretation.json` is a four-call typed-name comparison on the **same cached candidate sets**, blind to prior labels. It does not regenerate rankings, answers or r�sum� output. Binary question coverage is reported; full five-way packet-label accuracy has not been established.

The 145-project boundary tests use explicit synthetic paragraph boundaries. Raw chunks repeat SQL and carry local offsets. `boundary-consolidated.json` is a separately labeled deterministic replay that merges exact named skills and recomputes global offsets. It is not an audited extraction of an arbitrary real narrative. The forced 128-token output test returned `finish_reason=length` and null content; no partial candidates were applied.

All repairs remain experimental. See the assessment for the production rollout decision and remaining factual/diff failures.
