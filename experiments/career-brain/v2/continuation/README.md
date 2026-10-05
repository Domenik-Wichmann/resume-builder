# Career Brain qualification continuation

This continues repair commit `eacaf03c0f39dbd40aaef2acd57980bf12addec8`. It does not restart the ablation, regenerate the index, replace raw runs, reset the exhausted historical ledger, or change production. The [manifest](results/manifest.json) hashes all 38 historical revision-2 artifacts. [Frozen inputs](results/inputs.json) contain source-reviewed rich seeds, 24 contrastive grounding cases, 30 independently labeled five-way support probes, and a separate source-corrected rich-state diff oracle.

The supplemental hard reservation ceiling is **$5**, at most **80 inference attempts**, no automatic retries. Luna Pro reserves $0.08 per attempt, Luna answers $0.025, and a targeted Sol attempt $0.30. Native billed dollars, unknown cost, tokens and latency are retained independently in [ledger.json](results/ledger.json). The earlier $12 ceiling and its consumed reservations remain unchanged. Public quotas are not raised or reset.

The staged native checks reuse the existing pipeline:

- `grounding`: compare the existing bounded record audit with a selectable-assertion audit on the same 12 safe/12 overstated records; retest the exact historical R4 warning paragraph.
- `repeat`: five independent full native imports against the same actual RLS-approved 15-record rich database seed. Generated candidates are never automatically applied.
- `sequence`: actual V1 rich state → explicitly reviewed rich V2 → explicitly reviewed rich V3. Raw candidates and their diffs are measured before each reviewed apply. The review evolves the rich inventory rather than replacing it with compact gold.
- `support`: re-adjudicate the original cached 100 candidate sets with source-backed course-completion qualifiers, then classify 30 frozen probes spanning all five support labels. No new rankings are claimed.
- `answers`: one Luna request per probe, supplied only that question's compact packets, using the previously tightened answer prompt.
- `answer-audit`: independent bounded Luna Pro factual/citation audits, supplemented by assistant inspection of every generated answer.
- `warning-sol`: targeted Sol audit of the unchanged historical warning overstatement; no provider-side subagents.
- `post-equivalence`: diagnostic source-context audit of the retained final V3 candidates, checking whether equivalence restored stale or disputed claims after the initial audit.

Each live stage creates a disposable private, non-primary tenant. Reviewed apply uses a real member JWT and existing optimistic transactional RPC. No email is sent. Usage is exported before tenant/Auth cleanup. Pending review entries are not accepted merely to improve scores. The existing canonical repository does not expose pending-review uncertainties; that limitation is explicitly evaluated rather than hidden by a fixture.

```powershell
node --conditions=react-server --import tsx experiments/career-brain/v2/continuation/run.ts --stage=freeze
node --conditions=react-server --import tsx --env-file=.env.local experiments/career-brain/v2/continuation/run.ts --stage=repeat --live
npm run continuation:qualification
```

Live stages require `APP_MODE=live` and `--live`. Once a stage has been attempted, the runner refuses to rerun it, including a failed stage. Offline verification never invokes providers. The report recomputes separate summaries from retained artifacts; it never rewrites historical results.

The initial snapshot precedes a narrowly scoped protocol amendment: adding the planned targeted Sol probe and mapping the reviewed new Roster Note SQL relationship to the existing application-owned SQL key. Executed source snapshots are retained separately under `results/protocol-executed/`; neither correction changes the frozen source propositions or five-way labels.

[Support supplement 1](results/support-supplement-1.json) preserves the initial labels and records two source-based corrections made before the first support call: explicit Docker deployment denial is contradictory, and the license question must refer to the course certificate rather than every possible license.

Résumé checks run the actual existing ResumeIR compiler. A separate malformed-canonical canary reproduces the warning defect beside a valid SQL claim, showing whether packet-level support can license an unsupported complete canonical bullet. This is separate from clean, source-reviewed gold measurements.

The final recommendation and measurement limits are documented in [the continuation assessment](../../../../docs/qualification/career-brain-continuation-assessment.md).
