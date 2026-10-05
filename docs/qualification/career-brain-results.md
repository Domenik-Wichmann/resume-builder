# Career Brain qualification — measured results

Date: 2026-10-05. Frozen baseline: `56a286e6750be96dccfa35f378862f1d7d33507a`.

This is a synthetic qualification corpus, not proof across real careers. Read the companion assessment for semantic audit, gold errata, selection and release decision.

## Extraction cases

| Fixture        | Variant/run | Records | Critical recall screen | Relationship recall | Exact quotes | Review | Latency |
| -------------- | ----------- | ------: | ---------------------: | ------------------: | -----------: | -----: | ------: |
| A-clean-v1     | A/1         |      15 |                 100.0% |               86.4% |         6/15 |      9 |   46.8s |
| B-messy        | A/1         |      15 |                  91.7% |               86.4% |        12/15 |      5 |   34.0s |
| C-overlapping  | A/1         |      15 |                  91.7% |              100.0% |        10/15 |      6 |   30.8s |
| D-ownership    | A/1         |       6 |                 100.0% |               14.3% |          5/6 |      2 |   26.6s |
| E-sparse       | A/1         |       4 |                    n/a |              100.0% |          3/4 |      2 |   20.7s |
| F-large        | A/1         |      53 |                 100.0% |               93.3% |        53/53 |     42 |   46.2s |
| G-pathological | A/1         |      16 |                 100.0% |              100.0% |        11/16 |      6 |   40.4s |
| A-clean-v2     | A/1         |      15 |                 100.0% |               87.0% |         6/15 |     10 |   37.6s |
| A-clean-v3     | A/1         |      16 |                 100.0% |              100.0% |         5/16 |     11 |   45.2s |
| B-reordered    | A/1         |      16 |                 100.0% |               95.5% |        12/16 |      6 |   35.6s |
| B-messy        | A/2         |      15 |                  91.7% |               86.4% |        13/15 |      4 |   27.0s |
| B-messy        | A/3         |      15 |                  91.7% |               81.8% |        12/15 |      5 |   34.2s |
| B-messy        | A/4         |      15 |                  91.7% |               95.5% |        14/15 |      4 |   28.6s |
| B-messy        | A/5         |      15 |                  91.7% |               72.7% |        11/15 |      5 |   37.1s |
| B-messy        | B/1         |      15 |                  91.7% |              100.0% |        15/15 |      1 |   61.7s |
| B-messy        | C/1         |      17 |                  91.7% |               95.5% |        17/17 |      2 |  136.7s |
| B-messy        | D/1         |      15 |                 100.0% |               95.5% |        15/15 |      3 |  158.1s |
| A-clean-v1     | E/1         |       0 |                   0.0% |                0.0% |          0/0 |      0 |   55.1s |
| B-messy        | E/1         |       0 |                   0.0% |                0.0% |          0/0 |      0 |   55.5s |
| C-overlapping  | E/1         |      15 |                 100.0% |               95.5% |        15/15 |      0 |   48.8s |
| D-ownership    | E/1         |       8 |                  62.5% |               28.6% |          8/8 |      1 |   42.1s |
| E-sparse       | E/1         |       8 |                    n/a |              100.0% |          8/8 |      1 |   31.2s |
| F-large        | E/1         |       0 |                   0.0% |                0.0% |          0/0 |      0 |   55.1s |
| G-pathological | E/1         |      16 |                  91.7% |               86.4% |        16/16 |      2 |   52.5s |
| A-clean-v2     | E/1         |      18 |                  83.3% |               95.7% |        18/18 |      2 |   50.4s |
| A-clean-v3     | E/1         |       0 |                   0.0% |                0.0% |          0/0 |      0 |   55.1s |
| B-reordered    | E/1         |      21 |                  91.7% |               90.9% |        21/21 |      0 |   50.4s |
| B-messy        | E/2         |      15 |                  91.7% |               95.5% |        15/15 |      1 |   40.1s |
| B-messy        | E/3         |      15 |                  83.3% |               95.5% |        15/15 |      0 |   47.8s |
| B-messy        | E/4         |      15 |                  91.7% |              100.0% |        15/15 |      2 |   50.8s |
| B-messy        | E/5         |       0 |                   0.0% |                0.0% |          0/0 |      0 |   55.1s |

Regex recall is an aid to manual review, not semantic precision. D's inherited relationship labels and E's omitted activity-role label contain gold errors; their raw relation scores are not valid architecture evidence.

## Repeatability

| Variant | Runs | Counts             | Key intersection/union | Count variance |
| ------- | ---: | ------------------ | ---------------------: | -------------: |
| A       |    5 | 15, 15, 15, 15, 15 |                  10/21 |           0.00 |
| E       |    5 | 0, 15, 15, 15, 0   |                   0/18 |          54.00 |

Key consistency is intersection/union of literal kind:key across identical-source runs, with no identity context. It does not reward alias normalization. Per-run diffs, all changed keys and revision scoring are in summary.json.

## Retrieval

| Strategy/threshold | Recall@1 | Recall@3 | Recall@5 | MRR | Negative false positives | No-evidence correctness |
| ------------------ | -------: | -------: | -------: | --: | -----------------------: | ----------------------: |

## Architecture cost and latency

| Variant | Inference calls | Returned usage events | Reported USD subtotal | Failed extraction cases | Total extraction latency |
| ------- | --------------: | --------------------: | --------------------: | ----------------------: | -----------------------: |
| A       |              14 |                    14 |             $0.066822 |                       0 |                   490.7s |
| B       |               2 |                     2 |             $0.007608 |                       0 |                    61.7s |
| C       |               4 |                     4 |             $0.016118 |                       0 |                   136.7s |
| D       |               4 |                     4 |             $0.019636 |                       0 |                   158.1s |
| E       |              14 |                     9 |             $0.045598 |                       5 |                   690.0s |

Five E response bodies timed out before baseline accounting could save an event. Their billing is unknown and reservations remain consumed. The production repair covers this path; regression tests verify one failed event rather than fabricated zero cost.
| Lexical | 32.5% | 55.0% | 56.9% | 0.535 | 55.0% | 45.0% |
| Semantic 0.25 | 42.5% | 73.8% | 78.8% | 0.701 | 85.0% | 15.0% |
| Hybrid 0.25 | 43.8% | 78.1% | 83.8% | 0.724 | 85.0% | 15.0% |
| Semantic 0.4 | 23.8% | 29.4% | 30.6% | 0.334 | 20.0% | 80.0% |
| Hybrid 0.4 | 37.5% | 59.4% | 64.4% | 0.588 | 55.0% | 45.0% |
| Semantic 0.5 | 6.3% | 6.3% | 6.3% | 0.075 | 0.0% | 100.0% |
| Hybrid 0.5 | 33.1% | 55.6% | 58.8% | 0.538 | 55.0% | 45.0% |
| Semantic 0.6 | 1.3% | 1.3% | 1.3% | 0.013 | 0.0% | 100.0% |
| Hybrid 0.6 | 32.5% | 55.0% | 56.9% | 0.535 | 55.0% | 45.0% |
| Semantic 0.7 | 1.3% | 1.3% | 1.3% | 0.013 | 0.0% | 100.0% |
| Hybrid 0.7 | 32.5% | 55.0% | 56.9% | 0.535 | 55.0% | 45.0% |
| Semantic 0.8 | 0.0% | 0.0% | 0.0% | 0.000 | 0.0% | 100.0% |
| Hybrid 0.8 | 32.5% | 55.0% | 56.9% | 0.535 | 55.0% | 45.0% |
| RRF fusion / 0.25 | 41.9% | 76.3% | 85.0% | 0.702 | 85.0% | 15.0% |
| Associated-work projection / 0.25 | 36.9% | 74.4% | 79.4% | 0.680 | 85.0% | 15.0% |

## Sparse holdout

| Strategy/threshold | Recall@1 | Recall@3 | Recall@5 |   MRR | Negative false positives | No-evidence correctness |
| ------------------ | -------: | -------: | -------: | ----: | -----------------------: | ----------------------: |
| Semantic 0.25      |    75.0% |   100.0% |   100.0% | 1.000 |                    66.7% |                   33.3% |
| Hybrid 0.25        |    75.0% |   100.0% |   100.0% | 1.000 |                    66.7% |                   33.3% |
| Semantic 0.4       |    75.0% |    75.0% |    75.0% | 1.000 |                    33.3% |                   66.7% |
| Hybrid 0.4         |    75.0% |   100.0% |   100.0% | 1.000 |                    33.3% |                   66.7% |
| Semantic 0.5       |     0.0% |     0.0% |     0.0% | 0.000 |                     0.0% |                  100.0% |
| Hybrid 0.5         |    25.0% |    25.0% |    25.0% | 0.500 |                     0.0% |                  100.0% |
| Semantic 0.6       |     0.0% |     0.0% |     0.0% | 0.000 |                     0.0% |                  100.0% |
| Hybrid 0.6         |    25.0% |    25.0% |    25.0% | 0.500 |                     0.0% |                  100.0% |
| Semantic 0.7       |     0.0% |     0.0% |     0.0% | 0.000 |                     0.0% |                  100.0% |
| Hybrid 0.7         |    25.0% |    25.0% |    25.0% | 0.500 |                     0.0% |                  100.0% |
| Semantic 0.8       |     0.0% |     0.0% |     0.0% | 0.000 |                     0.0% |                  100.0% |
| Hybrid 0.8         |    25.0% |    25.0% |    25.0% | 0.500 |                     0.0% |                  100.0% |

## Index, revisions, interviews and end to end

```json
{
  "index": {
    "mode": "live",
    "indexed": 11,
    "unchanged": 0
  },
  "noChangeIndex": {
    "mode": "live",
    "indexed": 0,
    "unchanged": 11
  },
  "versions": {
    "v2Changes": [
      {
        "identity": "profile:profile",
        "status": "UNCHANGED"
      },
      {
        "identity": "experience:harbor-operations",
        "status": "UPDATED"
      },
      {
        "identity": "project:dispatch-loom",
        "status": "UNCHANGED"
      },
      {
        "identity": "achievement:loom-time",
        "status": "UNCHANGED"
      },
      {
        "identity": "achievement:loom-training",
        "status": "UPDATED"
      },
      {
        "identity": "skill:python",
        "status": "UNCHANGED"
      },
      {
        "identity": "skill:sql",
        "status": "UNCHANGED"
      },
      {
        "identity": "skill:postgresql",
        "status": "UNCHANGED"
      },
      {
        "identity": "skill:git",
        "status": "UNCHANGED"
      },
      {
        "identity": "skill:coworker-training",
        "status": "UNCHANGED"
      },
      {
        "identity": "category:data-tools",
        "status": "UNCHANGED"
      },
      {
        "identity": "category:collaboration",
        "status": "UNCHANGED"
      },
      {
        "identity": "education:cedar-bsc",
        "status": "UNCHANGED"
      },
      {
        "identity": "language:english",
        "status": "UNCHANGED"
      },
      {
        "identity": "project:roster-note",
        "status": "ADDED"
      },
      {
        "identity": "certification:cedar-sql",
        "status": "REMOVED"
      }
    ],
    "v2index": {
      "mode": "live",
      "indexed": 4,
      "unchanged": 7
    },
    "staleRejected": 1,
    "v3index": {
      "mode": "live",
      "indexed": 3,
      "unchanged": 10
    }
  },
  "jobs": [
    {
      "id": "operations",
      "queries": [
        "Operations automation analyst\nBuild Python parsers for dispatch exports\nWrite SQL validation checks\nGather warehouse supervisor requirements\nTrain coworkers with clear handbooks",
        "Operations automation analyst",
        "Build Python parsers for dispatch exports",
        "Write SQL validation checks",
        "Gather warehouse supervisor requirements"
      ],
      "relevant": [
        "project:dispatch-loom",
        "achievement:loom-training",
        "skill:python",
        "skill:sql"
      ],
      "ranking": [
        "project:dispatch-loom",
        "experience:harbor-operations",
        "skill:sql",
        "skill:python",
        "achievement:loom-time",
        "achievement:loom-training",
        "skill:postgresql",
        "skill:coworker-training",
        "certification:cedar-sql",
        "skill:git",
        "education:cedar-bsc"
      ],
      "coverage": 1,
      "irBullets": [
        "Personally built a Python parser and SQL checks for dispatch reconciliation; gathered warehouse supervisor requirements.",
        "Designed Dispatch Loom and trained dispatch coworkers.",
        "Team reconciliation time fell from 5 to 2 hours per week over six runs; Ada contributed the parser and checks.",
        "Personally trained 12 dispatch coworkers in two workshops and wrote a handbook.",
        "BSc in Information Systems.",
        "Fictional Cedar SQL Foundations certificate."
      ],
      "allBulletsCanonical": true
    },
    {
      "id": "late-niche",
      "queries": [
        "Analyst position for an internal operations team\nSupport internal operational workflows\nCommunicate with operations colleagues\nImprove operational processes\nDocument internal tools\nA BSc in Information Systems is required\nCedar SQL Foundations certification is desirable",
        "Analyst position for an internal operations team",
        "Support internal operational workflows",
        "Communicate with operations colleagues",
        "Improve operational processes"
      ],
      "relevant": [
        "project:dispatch-loom",
        "education:cedar-bsc",
        "certification:cedar-sql"
      ],
      "ranking": [
        "experience:harbor-operations",
        "education:cedar-bsc",
        "certification:cedar-sql",
        "project:dispatch-loom",
        "skill:sql",
        "achievement:loom-time",
        "skill:postgresql"
      ],
      "coverage": 1,
      "irBullets": [
        "Personally built a Python parser and SQL checks for dispatch reconciliation; gathered warehouse supervisor requirements.",
        "Designed Dispatch Loom and trained dispatch coworkers.",
        "Team reconciliation time fell from 5 to 2 hours per week over six runs; Ada contributed the parser and checks.",
        "BSc in Information Systems.",
        "Fictional Cedar SQL Foundations certificate."
      ],
      "allBulletsCanonical": true
    },
    {
      "id": "unsupported-cloud",
      "queries": [
        "Cloud platform engineer\nManage Kubernetes clusters\nDeploy production AWS infrastructure\nLead 100 direct reports\nOwn medical compliance systems",
        "Cloud platform engineer",
        "Manage Kubernetes clusters",
        "Deploy production AWS infrastructure",
        "Lead 100 direct reports"
      ],
      "relevant": [],
      "ranking": [
        "experience:harbor-operations",
        "project:dispatch-loom",
        "skill:postgresql",
        "skill:git",
        "achievement:loom-training",
        "education:cedar-bsc"
      ],
      "coverage": null,
      "irBullets": [
        "Personally built a Python parser and SQL checks for dispatch reconciliation; gathered warehouse supervisor requirements.",
        "Designed Dispatch Loom and trained dispatch coworkers.",
        "Personally trained 12 dispatch coworkers in two workshops and wrote a handbook.",
        "BSc in Information Systems."
      ],
      "allBulletsCanonical": true
    }
  ],
  "interview": {
    "questions": [
      {
        "id": "project:sql-checking:adoption",
        "question": "About “SQL Checking”: Who used this work, and how did you help them adopt it?",
        "reason": "adoption is not explicit in the current evidence. Missing documentation does not imply missing experience.",
        "priority": 15,
        "record_key": "project:sql-checking"
      },
      {
        "id": "project:sql-checking:outcome",
        "question": "About “SQL Checking”: What changed afterward? If you know the scale or time saved, what supports that estimate?",
        "reason": "outcome is not explicit in the current evidence. Missing documentation does not imply missing experience.",
        "priority": 15,
        "record_key": "project:sql-checking"
      },
      {
        "id": "project:sql-checking:purpose",
        "question": "About “SQL Checking”: What problem existed beforehand, and why did solving it matter?",
        "reason": "purpose is not explicit in the current evidence. Missing documentation does not imply missing experience.",
        "priority": 15,
        "record_key": "project:sql-checking"
      },
      {
        "id": "project:sql-checking:stakeholders",
        "question": "About “SQL Checking”: Who helped define the requirements, and how did you explain decisions to them?",
        "reason": "stakeholders is not explicit in the current evidence. Missing documentation does not imply missing experience.",
        "priority": 15,
        "record_key": "project:sql-checking"
      }
    ],
    "followup": [],
    "repeated": 0
  },
  "endToEnd": {
    "review": "Synthetic gold manually reconciles source facts before transactional apply; no automatic acceptance of model output.",
    "answer": {
      "answer": "Ada personally built a Python parser and SQL checks for dispatch reconciliation and gathered requirements from warehouse supervisors. Across six runs, the team’s reconciliation time fell from 5 to 2 hours per week; the evidence says Ada contributed the parser and checks. Ada also personally trained 12 dispatch coworkers in two workshops and wrote a handbook.",
      "evidence_ids": [
        "9276d0d2-35f0-4e2f-968d-c2a59d466738",
        "5ad36455-5d6a-47ed-ac2b-5837a61eed62",
        "689abacc-f9ff-4d0d-a214-3b449e4c4fbe"
      ]
    },
    "resumeBulletsCanonical": true,
    "negative": {
      "question": "Has Ada managed 100 employees?",
      "retrieved": [
        {
          "id": "8b8da975-13e6-45cf-8331-c320307e953d",
          "title": "Reconciliation time reduction",
          "summary": "Team reconciliation time fell from 5 to 2 hours per week over six runs; Ada contributed the parser and checks."
        },
        {
          "id": "95d985f6-c6d0-4646-9d37-29c61bc13083",
          "title": "Dispatch Loom",
          "summary": "Personally built a Python parser and SQL checks for dispatch reconciliation; gathered warehouse supervisor requirements."
        },
        {
          "id": "f35f7bdc-7f15-489b-8631-72520531ede4",
          "title": "Dispatch coworker training",
          "summary": "Personally trained 12 dispatch coworkers in two workshops and wrote a handbook."
        }
      ],
      "answer": {
        "answer": "No relevant evidence is currently stored showing that Ada managed 100 employees. The available evidence says she trained 12 dispatch coworkers in two workshops; it does not establish that she managed them. [95d985f6-c6d0-4646-9d37-29c61bc13083, f35f7bdc-7f15-489b-8631-72520531ede4]",
        "evidence_ids": [
          "95d985f6-c6d0-4646-9d37-29c61bc13083",
          "f35f7bdc-7f15-489b-8631-72520531ede4"
        ]
      },
      "noEvidenceCorrect": true,
      "outsideCitations": 0
    }
  }
}
```

## Provider accounting

| Provider/model                   | Calls | Input tokens | Output tokens | Reported USD | Unknown-cost calls |
| -------------------------------- | ----: | -----------: | ------------: | -----------: | -----------------: |
| OPENROUTER:openai/gpt-6-luna-pro |    33 |       531741 |        225823 |    $0.155782 |                  0 |
| COHERE:embed-v4.0                |    13 |         2717 |             0 |      unknown |                 13 |
| OPENROUTER:openai/gpt-6-luna     |     2 |         1416 |           450 |    $0.000368 |                  0 |

Conservative reservations: $4.65 of $5. Actual total cost is incomplete where provider billing is unavailable. Per-call latency p50 34.1s; p95 55.0s. Multi-call architecture latency is measured separately in the extraction-case table.
Total attempted provider calls: 53; {"OPENROUTER":40,"COHERE":13}. Returned usage events: 48; missing events from observed body timeouts: 5. Unknown-cost calls: 18. Per-provider latency: {"OPENROUTER":{"p50Ms":40258,"p95Ms":55016},"COHERE":{"p50Ms":472,"p95Ms":1783}}.

OpenRouter published Luna token prices were checked before runs at [the official model catalog](https://openrouter.ai/api/v1/models). The committed ledger stores reservations before calls; usage events preserve returned token counts and cost without prompt logs.

## Cleanup

```json
[
  {
    "stage": "baseline",
    "accountRemoved": true,
    "authRemoved": true,
    "primaryRecordsBefore": 0,
    "primaryRecordsAfter": 0
  },
  {
    "stage": "retrieval",
    "accountRemoved": true,
    "authRemoved": true,
    "primaryRecordsBefore": 0,
    "primaryRecordsAfter": 0
  },
  {
    "stage": "candidates",
    "accountRemoved": true,
    "authRemoved": true,
    "primaryRecordsBefore": 0,
    "primaryRecordsAfter": 0
  },
  {
    "stage": "confirm-E",
    "accountRemoved": true,
    "authRemoved": true,
    "primaryRecordsBefore": 0,
    "primaryRecordsAfter": 0
  },
  {
    "stage": "end-to-end",
    "accountRemoved": true,
    "authRemoved": true,
    "primaryRecordsBefore": 0,
    "primaryRecordsAfter": 0
  }
]
```

Raw synthetic outputs and detailed gold labels are under `experiments/career-brain/`. No owner sources, credentials, sessions or embeddings are included.
