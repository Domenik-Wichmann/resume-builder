# Career Brain qualification

This corpus is fictional and deliberately isolated from the owner's career data.
The baseline was frozen at `56a286e6750be96dccfa35f378862f1d7d33507a` before runs.
The `.snapshot` files preserve exact prompts, schema, diff, vector projection,
retrieval RPC and accounting implementation; `baseline/manifest.json` records
configuration and the hard experiment budget. Do not regenerate the baseline
after a production repair.

## Reproduce

From the repository root, with dependencies installed:

```powershell
node --conditions=react-server --import tsx experiments/career-brain/run.ts --stage=offline
```

Live runs explicitly require existing `.env.local` credentials and `--live`:

```powershell
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/run.ts --stage=baseline --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/run.ts --stage=candidates --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/run.ts --stage=confirm-E --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/run.ts --stage=retrieval --live
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/run.ts --stage=end-to-end --live
```

The runner resumes completed extraction cases from `results/results.json`. To
start a separate benchmark, preserve the previous results directory and run with
an empty one. Never run two stages concurrently: the shared budget ledger and
results are deliberately single-process. No retries are automatic. Failed calls
retain their reservations. Inference respects the production global quota.
Ceilings: 40 inference calls, 20 embedding calls, $5 in conservative reservations.
Each inference reserves $0.10 and each embedding batch reserves $0.05; the
configured Luna models' published token prices are far below the reservation for
these bounded inputs. Unknown Cohere billing stays unknown, rather than zero.

Each live stage creates an Auth user and a non-primary account, uses a real JWT
for canonical application through the production transaction, and deletes its
owned records, account and Auth user in `finally`. Retrieval tests mark approved
records eligible only inside that tenant: public reads explicitly use the
primary account, whose record count is checked before and afterward. An
unexpected termination can bypass `finally`; inspect disposable accounts before
restarting. Credentials and sessions are never written to artifacts.

## Evaluation boundaries

Gold facts, aliases, relationships, revision states and query labels are authored
before provider responses. Sources and gold JSON are committed in `corpus/`.
Semantic facts use content criteria, not exact generated prose. Automated regex
coverage is a recall screen; it cannot prove entailment, ownership or precision.
Unmatched records and forbidden-term flags require human review (a negated term
can be legitimate). Broad project summaries often require several source
passages: passing a literal quotation check does not prove every summary claim.

Recall@k is the fraction of all gold relevant identities found in the first k
results, averaged over positive queries. MRR uses the first relevant result.
Negative false positives mean any returned record, irrespective of whether the
answering model later refuses the unsupported claim. Query families are reported
separately; these handcrafted related paraphrases are not 100 independent careers.
No learned threshold is considered externally validated on this one career.

Variants are experimental only: A is the unchanged one-call extractor; B adds a
temporary global map and measured prompt clarifications; C uses a map, two
paragraph-boundary sections and reconciliation; D uses an independent coverage
audit, targeted extraction and reconciliation. B's comparison is not an isolated
map-only ablation because its prompt also addresses baseline failures. A causal
claim about the map alone would require another controlled experiment.

Variant E adds measured one-call prompt clarifications and no map. It is rejected
in this run because of timeouts and denied technologies becoming skill records.
The baseline revision extraction uses approved gold identities as context; score
it against that same canonical state with `revisions.ts`. Never turn failed
extraction into removal proposals. See the assessment for frozen-gold errata.

After runs, generate the source-reviewed claim inventory, revision audit and
machine-readable/Markdown reports:

```powershell
node --import tsx experiments/career-brain/audit.ts
node --import tsx experiments/career-brain/revisions.ts
node --import tsx experiments/career-brain/report.ts
```

`audit.ts` contains human review annotations for this corpus and these specific
runs. Reusing it on a new corpus requires new human review; its default labels are
not an automatic entailment judge. `production-smoke` is a provider-free stage
that verifies the deployed interviewer repair and account isolation after release.
