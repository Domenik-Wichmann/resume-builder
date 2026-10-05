# Career Brain qualification assessment

## Qualification verdict

**NOT YET QUALIFIED.** Recommendation: **NOT YET QUALIFIED** for trusting a real
Career Master import without careful record-by-record review. Schema validity and
successful requests are insufficient. Exact quotation failures, changing keys,
lost qualifiers and broad negative-query matches remain material failures.

This benchmark authorizes no automatic acceptance or publication. The existing
review transaction and account isolation remain important safeguards. The result
does not mean every extracted fact is wrong; much of the explicit factual content
is recovered accurately.

## Baseline and datasets

The baseline is commit `56a286e6750be96dccfa35f378862f1d7d33507a`. Exact source
snapshots and SHA-256 hashes preserve the prompt, strict schema, 12,000-token
output limit, 55-second timeout, identity/diff rules, semantic projection,
1,024-dimensional `embed-v4.0`, cosine RPC, eight matches, 0.25 threshold,
lexical fallback, five bounded JD queries and provider accounting.

The committed fictional corpus has ten documents across seven families: clean,
messy, overlapping, personal/team/relative ownership, sparse skill depth, large,
and pathological. Clean V1/V2/V3 introduce corrections, additions, an accidental
omission, restoration, rewording and unresolved attendance. A reordered messy
document tests position effects. The largest document has 38,868 characters and
53 expected canonical units; it stresses the current input bound, but does not
prove behavior at the 150-record schema ceiling. Long conversational documents
reuse context paragraphs; they are less diverse than seven independent careers.

Gold sources, content criteria, aliases, provenance locations, relationships and
diff states were written before responses. Automated recall tests content terms,
not generated prose equality. However, these criteria are imperfect and do not
constitute a complete semantic judge.

## Gold defects and interpretation

Frozen labels are preserved rather than silently rewritten after seeing outputs.
The following defects limit raw metrics:

- Ownership fixture D inherited relationships to PostgreSQL, Git, training and
  achievements that its shortened source does not establish. Its relationship
  recall is invalid as architecture evidence. Python and SQL skill records are
  supported extras, not hallucinations.
- Sparse fixture E omits a potentially valid professional activity frame at
  Harbor Tools. An extra activity record is not automatically a false relation;
  its title must not be represented as an explicitly stated job title.
- Requirements gathering and supervisor communication can legitimately become
  supported skill records. Their omission from gold makes closed-set precision
  undercount these valid extra relationships in the sectioned variant.
- The V3 handover criterion uses a literal title and can undercount equivalent
  wording or facts retained inside the project. This is meaningful decomposition
  disagreement, not proof the fact disappeared completely.
- The certificate source does not explicitly identify its issuer. Gold's
  organization “Cedar” is too strong. The independent claim audit flags issuer
  invention instead of relying on this gold field.
- A workshop date being unknown is not a contradiction. Many baseline records
  unnecessarily require review merely because optional information is absent.

Do not present any of these raw scores as rigorous precision for all facts.
`results/claim-audit.json` records human-reviewed statement groups and explicit
unsupported examples. A populated identity, context, organization, date,
relationship edge or summary sentence is one unit. A sentence can contain several
clauses, so this measures statement-group precision rather than fully atomized
claim precision. Literal quote validity is reported separately from entailment.

## Measured failure taxonomy

| Category                         | Observation and evidence                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXTRACTION_MISS                  | Baseline sparse input omits the one-off Docker exercise; several messy project summaries omit supervisor requirements. Frozen missing-fact lists show per-run counts.                                                                    |
| HALLUCINATION                    | A repeated messy run assigns Cedar College as certificate issuer although only the degree institution is stated; several runs invent a certificate end date equal to its award date.                                                     |
| OVERSTATEMENT                    | A preference for late-file warnings becomes an implemented feature. One achievement keeps team attribution only in uncertainties, leaving the canonical summary unqualified.                                                             |
| IDENTITY_DRIFT                   | Five identical messy inputs all yield 15 records, but only 10 keys occur in every run out of 21 distinct keys.                                                                                                                           |
| DUPLICATION / OVER_DECOMPOSITION | Reordering splits the training/handbook unit into separate achievements. Refined ownership output also separates parser implementation and guide writing into extra achievements. These facts are supported, but unit boundaries change. |
| UNDER_DECOMPOSITION              | The V3 night-shift documentation can remain inside Roster Note instead of becoming the expected achievement.                                                                                                                             |
| RELATIONSHIP_MISS                | Baseline often omits achievement-to-skill links, despite capturing the skill and achievement records separately.                                                                                                                         |
| RELATIONSHIP_FALSE_POSITIVE      | Closed-set gold flags some legitimate added skills; these are excluded from claims of actual false-positive links. No measured cross-account link leak occurred.                                                                         |
| PROVENANCE_WEAK                  | Only 6/15 clean baseline quotes are exact contiguous source passages. Across 14 baseline runs, 58/231 quotes fail exact verification. Even an exact quote can fail to support every clause of a broad summary.                           |
| GLOBAL_CONTEXT_FAILURE           | Late metrics are often recovered, but supervisor context and team qualifiers move between records or uncertainties. Reordered input changes unit boundaries.                                                                             |
| DIFF_FAILURE                     | Rephrasing factually unchanged summaries produces UPDATED because the hash compares text. Different keys can produce REVIEW plus REMOVED. Gold canonical transitions are sound; generated transitions are noisy.                         |
| SCALE_FAILURE                    | Baseline recovers all 53 large-fixture units, but flags 42 for review. The refined one-call experiment also times out on small and large inputs at the frozen 55-second limit.                                                           |
| RETRIEVAL_FAILURE                | Current hybrid returns evidence for 17/20 unsupported questions. Sparse holdout also returns depth-limited Docker evidence for a professional-deployment question.                                                                       |
| RANKING_FAILURE                  | Current hybrid Recall@1 is 43.8%; fusion slightly improves Recall@5 while worsening top-rank behavior and leaving negatives unchanged.                                                                                                   |

The machine-readable outputs provide per-case misses, unexpected links, duplicate
unit flags, diff states, rankings, scores, call ledger and timings. Category counts
are not additive: one bad proposal can have several failure categories. Absence
of an observed security violation does not establish universal semantic quality.

## Diff measurement boundary

The live, manually reviewed gold V1/V2/V3 workflow has 100% expected state accuracy
for V2 and V3, including private additions, reviewed omission/archival, restoration
and unresolved attendance. The standalone revision audit scores generated
baseline V2/V3 proposals against the same approved keys actually supplied to the
extractor. It also demonstrates that an equivalent project rewording becomes
UPDATED. Inspect `results/revision-audit.json` for the valid generated-state scores.

The older raw-to-raw diagnostic in `summary.json` compares fresh V1 model keys to
V2's approved gold key context. Its literal scores are not valid sequential-import
accuracy and must not be presented as such. Experimental E never establishes a
complete revision chain because V1/V3 fail. A failed extraction does not create
a removal proposal in the production API. These measurement limits are retained
explicitly rather than hiding unfavorable outputs.

## Architecture selection

Retain the existing **one-call full-source Luna Pro extraction with mandatory
human review**. No experimental ingest architecture is promoted by this run.
All variants retain the exact-quote guard and the current canonical schema.

The map-assisted, section/reconciliation and omission-audit variants were tested
on the same messy source, without access to gold labels. All repaired its stitched
quotes; the omission-audit variant recovered the missing supervisor context.
However, these were single comparisons, have longer total latency, retain semantic
or relationship defects and lack repeated large-document validation. They are
not qualified replacements.

The extra one-call refinement is the smallest candidate and is tested across
the complete corpus plus five messy repeats. It preserves more usage detail and
contiguous quotations where it succeeds, but introduces denied technologies as
skill records and encounters response timeouts. A skill record named AWS can
contaminate skill lists even when its description says it was never used. It is
not accepted merely for better literal quote scores.

No schema, ontology, vector dimension, extraction model or production prompt
changes follow from these results. Sol escalation was not performed: the fixed
inference budget prioritizes baseline, the four required architecture comparisons,
full-corpus refinement, repeatability and grounded end-to-end verification.
There is no evidence yet that a larger model would repair the text-hash diff or
retrieval tradeoff.

## Retrieval and indexing

The live test uses manually approved synthetic canonical records, independently
of extraction, with native Cohere document/query embeddings and the real
account-scoped pgvector RPC. The corpus has 100 pre-labeled queries: 80 positive
and 20 negative, plus five sparse-career holdout queries and three JDs.

Current hybrid Recall@1/@3/@5 is **43.8% / 78.1% / 83.8%**; MRR is **0.724**.
Negative false-positive rate is **85%**; retrieval no-evidence correctness is
**15%**. These measure retrieval, not final answer refusal. A top-one recall can
be below 100% even when the first result is useful because some queries have two
relevant gold records.

The selected production threshold remains **0.25**, with current semantic-first
ordering and lexical union. This is retention of the baseline, not a declaration
that it is calibrated. At 0.4, semantic negative false positives fall to 20% but
Recall@5 falls to 30.6%. At 0.5 semantic negatives disappear, but Recall@5 is only
6.3%; the lexical union still produces 55% negative false positives. Sparse
holdout confirms the tradeoff. Raising a threshold alone is not a justified fix.

Adding associated project/role context to achievement projections does not
materially improve retrieval. Simple reciprocal-rank fusion improves Recall@5
from 83.8% to 85.0%, lowers Recall@1 and does not fix negative queries. Neither
experiment is promoted. Keep canonical data correct; do not add career records
to conceal search misses.

Index verification: V1 embeds 11 records; an unchanged repeat embeds zero. V2
embeds four changed records and retains seven vectors. This includes a project
projection changing when a linked achievement changes. The archived certificate
is removed. V3 rejects an old hash before reindexing and embeds three changed/new
records, retaining ten. Approved restores reuse canonical identity. These are
selective indexing successes, separate from extraction/diff qualification.

JD coverage is complete for the two supported job descriptions, although generic
matches and extraneous evidence remain. The late degree/certificate requirements
are present in the full-JD query despite not receiving dedicated queries. The
unsupported cloud JD retrieves six irrelevant records. Three short JDs do not
prove long-JD niche-requirement coverage beyond the five-query limit.

## Review, provenance and end-to-end checks

Canonical application uses a real verified Auth JWT, membership RLS and the
existing transactional import RPC. Human-reviewed gold resolves source facts
before application; this is not an automatic acceptance test of raw model output.
Publication eligibility is confined to a disposable non-primary tenant. Public
routes read the primary account, which has zero records before and after each
stage. No synthetic owner publication, visitor analytics or tracking is created.

The positive grounded answer preserves personal parser/check ownership, the team
5-to-2-hour result and 12-person training. Citations remain inside supplied
canonical evidence. Generated résumé bullets exactly match canonical summaries;
unsupported recruiter prose does not become résumé facts. A separate negative
test exercises the actual retrieval function and answering prompt. Inspect the
measured-results artifact for its refusal result; a single response is not a
negative-answer reliability benchmark.

Provenance tests also deliberately pair an exact quote with an unsupported
Kubernetes/100-employees summary. The substring guard accepts the quote while
semantic audit rejects the claim. Never weaken the substring guard or mistake it
for entailment verification. Multi-passage source support remains a review task;
this run does not add microscopic records or a new provenance ontology.

## Repairs justified by evidence

Two small production repairs are independent of experimental model selection:

1. Numeric department identifiers suppressed outcome interview probes on all 38
   projects lacking measured outcomes. Remove the digit shortcut and exclude
   explicit “no measured result” language from positive outcome evidence. All 38
   now receive the relevant probe; actual reduced-time evidence still suppresses
   it. Novelty, bounded question count and cautious wording remain intact.
2. OpenRouter can return successful headers and then time out while reading the
   body. The observed refined-extraction timeouts created no usage event. Record
   one failed event with unknown cost and return a controlled provider error in
   that case. A regression test simulates exactly that sequence and checks that
   successful responses retain native billing quantities.

No migrations are needed. The extraction prompt, data representation, diff,
embedding projection and retrieval threshold are unchanged.

## Budget, accounting and remaining limitations

The budget was fixed before experiments: $5 conservative reservations, at most
40 inference calls and 20 embedding batches, no automatic retries. Every paid
inference also reserves the existing production global quota. Ledger reservations
remain consumed on failures. Exact calls, returned token counts, native cost,
unknown-cost calls and latency distributions are in the measured-results report.
Cohere returns billed tokens, but this adapter does not receive native dollar
cost; it is explicitly unknown. Failed response bodies can also have unknown
provider cost. Reported cost totals are therefore a known subtotal, not a complete
invoice. [Cohere explains embedding billing by tokens](https://docs.cohere.com/docs/how-does-cohere-pricing-work).

Remaining qualification gaps: diverse independent real-scale careers, the
150-record output boundary, year-only/contradictory-date cases beyond the current
examples, controlled ablations separating map benefit from prompt changes,
repeated large-document architecture comparisons, full atomized human claim
precision, better identity reconciliation and fact-preserving diff comparison,
reliable negative retrieval and long-JD coverage. A live interview-answer import
round trip and Sol escalation are deferred within the fixed call cap. The existing
owner route restricts quotations to the owner's answer, and deterministic
tests cover partial imports not implying removals; that does not replace semantic
interview testing.

The next qualification should fix the gold errata before new runs, then measure
the smallest candidate that rejects denied-skill records, preserves existing
identity and wording for unchanged facts, and distinguishes relevant evidence
from superficial similarity. Preserve the current safety boundaries throughout.

## Artifacts and release evidence

- [Measured results](career-brain-results.md)
- [Harness and reproduction instructions](../../experiments/career-brain/README.md)
- [Frozen baseline](../../experiments/career-brain/baseline/manifest.json)
- [Sources and gold](../../experiments/career-brain/corpus/)
- [Raw synthetic outputs and accounting](../../experiments/career-brain/results/results.json)
- [Final database and Auth cleanup verification](../../experiments/career-brain/results/cleanup-verification.json)
- [Claim-group audit](../../experiments/career-brain/results/claim-audit.json)
- [Aggregate metrics and generated diffs](../../experiments/career-brain/results/summary.json)

Commit, CI and deployment identifiers are supplied in the completion report.
Account cleanup evidence is preserved in the raw results.

The deployed production smoke test passed: an outcome probe was generated for a
project without measured results, four bounded questions were returned, asked
questions did not repeat, anonymous career access returned the established 403
response, and the private qualification tenant was absent from public content.
The harness initially expected 401; correcting that assertion required no
application change. Both smoke attempts removed their disposable accounts and
Auth users, with primary canonical record counts unchanged. Local verification
passed formatting, lint, TypeScript, all 80 tests, the qualification suite and
the production build; CI also passed.

Final read-only verification found one original account, one membership and one
Auth user, zero qualification Auth users, and zero canonical records, sources,
imports, embeddings or other tested career/application records. The owner's 19
pre-existing provider usage events were retained.
