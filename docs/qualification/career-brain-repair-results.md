# Career Brain repair measurements, benchmark revision 2

Historical results are preserved. See the repair assessment for interpretation, human audit and rollout decision.

## Architecture cases

| Variant    | Cases | Failed | Records | Critical recall screen | Relationship recall | Exact primary quotes | Review | Median end-to-end seconds |
| ---------- | ----: | -----: | ------: | ---------------------: | ------------------: | -------------------: | -----: | ------------------------: |
| A0         |     8 |      0 |     112 |                  92.9% |               86.4% |               84/112 |     41 |                      30.2 |
| A1         |     8 |      0 |     111 |                  91.7% |               93.8% |              110/111 |     12 |                      56.5 |
| B0         |     8 |      0 |     110 |                  84.5% |               88.6% |               83/110 |     42 |                      55.8 |
| B1         |     8 |      0 |     110 |                  92.9% |               94.9% |              110/110 |     14 |                      76.7 |
| R1         |     3 |      3 |       0 |                   0.0% |                0.0% |                  0/0 |      0 |                      73.4 |
| R2         |    11 |     11 |       0 |                   0.0% |                0.0% |                  0/0 |      0 |                       0.9 |
| R3         |    12 |      0 |     174 |                  87.8% |               80.6% |              173/174 |     18 |                      95.4 |
| R4         |    11 |      0 |     140 |                  95.5% |               95.5% |              140/140 |     19 |                     118.3 |
| SEQ        |     2 |      1 |      19 |                  45.8% |               47.7% |                19/19 |      3 |                     112.6 |
| one-output |     1 |      0 |     146 |                 100.0% |                 n/a |              146/146 |      0 |                     100.1 |
| staged     |     1 |      0 |     151 |                 100.0% |                 n/a |              151/151 |      0 |                     383.5 |
| SEQ2       |     2 |      0 |      36 |                  95.8% |               82.8% |                36/36 |      5 |                     123.6 |
| SOL-audit  |     1 |      0 |       5 |                  58.3% |                9.1% |                  5/5 |      3 |                      16.7 |
| token-128  |     1 |      1 |       0 |                   0.0% |                 n/a |                  0/0 |      0 |                       6.1 |

Recall screens use title/content criteria rather than an automated semantic judge. Optional supported frames and allowed V3 decomposition require human interpretation; closed-set precision is not factual precision.

## Identity repetitions

```json
[
  {
    "variant": "A0",
    "runs": 5,
    "recordCounts": [15, 14, 15, 15, 15],
    "keyIntersection": 10,
    "keyUnion": 23,
    "keyConsistency": 0.43478260869565216,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [5, 4, 5, 4, 4]
  },
  {
    "variant": "A1",
    "runs": 5,
    "recordCounts": [15, 15, 15, 15, 15],
    "keyIntersection": 11,
    "keyUnion": 24,
    "keyConsistency": 0.4583333333333333,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [1, 2, 2, 2, 1]
  },
  {
    "variant": "B0",
    "runs": 5,
    "recordCounts": [15, 15, 15, 15, 15],
    "keyIntersection": 12,
    "keyUnion": 24,
    "keyConsistency": 0.5,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [4, 5, 4, 6, 5]
  },
  {
    "variant": "B1",
    "runs": 5,
    "recordCounts": [14, 15, 15, 15, 15],
    "keyIntersection": 11,
    "keyUnion": 22,
    "keyConsistency": 0.5,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [2, 2, 2, 2, 1]
  },
  {
    "variant": "R1",
    "runs": 2,
    "recordCounts": [0, 0],
    "keyIntersection": 0,
    "keyUnion": 0,
    "keyConsistency": null,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [0, 0]
  },
  {
    "variant": "R2",
    "runs": 5,
    "recordCounts": [0, 0, 0, 0, 0],
    "keyIntersection": 0,
    "keyUnion": 0,
    "keyConsistency": null,
    "matchedExisting": 0,
    "identityDecisions": 0,
    "ambiguous": 0,
    "review": [0, 0, 0, 0, 0]
  },
  {
    "variant": "R3",
    "runs": 5,
    "recordCounts": [16, 5, 10, 16, 9],
    "keyIntersection": 4,
    "keyUnion": 17,
    "keyConsistency": 0.23529411764705882,
    "matchedExisting": 39,
    "identityDecisions": 40,
    "ambiguous": 0,
    "review": [2, 2, 2, 2, 1]
  },
  {
    "variant": "R4",
    "runs": 5,
    "recordCounts": [15, 15, 15, 15, 15],
    "keyIntersection": 15,
    "keyUnion": 15,
    "keyConsistency": 1,
    "matchedExisting": 60,
    "identityDecisions": 60,
    "ambiguous": 0,
    "review": [2, 1, 1, 1, 1]
  }
]
```

## Sequential factual diffs against real approved database state

SEQ2 used real member-JWT database state with manually source-reviewed gold applied between proposals. Earlier SEQ stopped on incomplete audit and remains preserved. UUID reconciliation and generated state accuracy are different metrics.

```json
[
  {
    "fixture": "A-clean-v2",
    "accuracy": 0.6875,
    "scored": [
      {
        "key": "profile:profile",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "experience:harbor-operations",
        "expected": "UPDATED",
        "actual": "UPDATED",
        "correct": true
      },
      {
        "key": "project:dispatch-loom",
        "expected": "UNCHANGED",
        "actual": "REVIEW",
        "correct": false
      },
      {
        "key": "achievement:loom-time",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "achievement:loom-training",
        "expected": "UPDATED",
        "actual": "UPDATED",
        "correct": true
      },
      {
        "key": "skill:python",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:sql",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:postgresql",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:git",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:coworker-training",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "category:data-tools",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "category:collaboration",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "education:cedar-bsc",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "language:english",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "project:roster-note",
        "expected": "ADDED",
        "actual": "ADDED",
        "correct": true
      },
      {
        "key": "certification:cedar-sql",
        "expected": "REMOVED",
        "actual": "REVIEW",
        "correct": false
      }
    ],
    "matchedUuids": 15
  },
  {
    "fixture": "A-clean-v3",
    "accuracy": 0.5882352941176471,
    "scored": [
      {
        "key": "profile:profile",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "experience:harbor-operations",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "project:dispatch-loom",
        "expected": "UNCHANGED",
        "actual": "REVIEW",
        "correct": false
      },
      {
        "key": "achievement:loom-time",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "achievement:loom-training",
        "expected": "REVIEW",
        "actual": "REVIEW",
        "correct": true
      },
      {
        "key": "skill:python",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:sql",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "skill:postgresql",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:git",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "skill:coworker-training",
        "expected": "UNCHANGED",
        "actual": "UPDATED",
        "correct": false
      },
      {
        "key": "category:data-tools",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "category:collaboration",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "education:cedar-bsc",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "language:english",
        "expected": "UNCHANGED",
        "actual": "UNCHANGED",
        "correct": true
      },
      {
        "key": "project:roster-note",
        "expected": "UPDATED",
        "actual": "UPDATED",
        "correct": true
      },
      {
        "key": "certification:cedar-sql",
        "expected": "UPDATED",
        "actual": "UPDATED",
        "correct": true
      },
      {
        "key": "achievement:roster-handover",
        "expected": "ADDED",
        "actual": "MISSING",
        "correct": false
      }
    ],
    "matchedUuids": 16
  }
]
```

## Provenance

```json
[
  {
    "variant": "R3",
    "claims": 580,
    "spans": 643,
    "validSpans": 641,
    "multiSpanClaims": 55
  },
  {
    "variant": "R4",
    "claims": 462,
    "spans": 490,
    "validSpans": 489,
    "multiSpanClaims": 25
  },
  {
    "variant": "SEQ",
    "claims": 57,
    "spans": 64,
    "validSpans": 63,
    "multiSpanClaims": 7
  },
  {
    "variant": "staged",
    "claims": 616,
    "spans": 617,
    "validSpans": 0,
    "multiSpanClaims": 1
  },
  {
    "variant": "SEQ2",
    "claims": 120,
    "spans": 125,
    "validSpans": 125,
    "multiSpanClaims": 5
  },
  {
    "variant": "SOL-audit",
    "claims": 34,
    "spans": 38,
    "validSpans": 38,
    "multiSpanClaims": 4
  }
]
```

Exact quotation/offset validity does not establish entailment. Separate audit decisions remain in raw results.

## Usage, latency and cleanup

```json
{
  "calls": 165,
  "reservedUsd": 11.44999999999995,
  "usage": [
    {
      "model": "openai/gpt-6-luna-pro",
      "events": 146,
      "inputTokens": 2732367,
      "outputTokens": 1029182,
      "knownUsd": 0.726579,
      "unknownCostEvents": 11,
      "failed": 11
    },
    {
      "model": "openai/gpt-6-sol",
      "events": 1,
      "inputTokens": 3734,
      "outputTokens": 1191,
      "knownUsd": 0.021244,
      "unknownCostEvents": 0,
      "failed": 0
    },
    {
      "model": "embed-v4.0",
      "events": 5,
      "inputTokens": 1147,
      "outputTokens": 0,
      "knownUsd": 0,
      "unknownCostEvents": 5,
      "failed": 0
    },
    {
      "model": "openai/gpt-6-luna",
      "events": 12,
      "inputTokens": 23791,
      "outputTokens": 2646,
      "knownUsd": 0.004303,
      "unknownCostEvents": 0,
      "failed": 0
    }
  ],
  "latency": {
    "p50Ms": 30117,
    "p95Ms": 81036
  },
  "cleanup": [
    {
      "stage": "ablation",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "rich-interrupted",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "rich",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "rich",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "repair",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "revisions",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "boundaries",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "revisions2",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "sol",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "token-boundary",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "retrieval",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    },
    {
      "stage": "interpretation",
      "accountRemoved": true,
      "authRemoved": true,
      "primaryBefore": 0,
      "primaryAfter": 0
    }
  ]
}
```

## Retrieval and downstream safety

```json
{
  "metrics": {
    "queries": 100,
    "positives": 80,
    "negatives": 20,
    "recall1": 0.44375,
    "recall3": 0.7875,
    "recall5": 0.85,
    "mrr": 0.7408333333333335,
    "negativeFalsePositiveRate": 0.85,
    "noEvidenceCorrectness": 0.15
  },
  "classification": {
    "positiveEvidenceCoverage": 0.85,
    "unsupportedQuestionsWithCandidates": 17,
    "unsupportedDirectSupportErrors": [],
    "unsupportedResumeAdmissions": []
  },
  "answers": [
    {
      "id": "negative-1",
      "question": "Does Ada know Kubernetes?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored about Ada’s Kubernetes knowledge. The adjacent evidence records her personal work building a Python parser and SQL checks for Dispatch Loom and using Git and PostgreSQL, but it does not establish Kubernetes experience.",
        "evidence_ids": [
          "ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b",
          "f8759c02-72d1-4f26-bb94-c6c9e516f1e5",
          "38d9e8ad-d829-4a1e-8720-f3615d355c91"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "negative-2",
      "question": "Has this person deployed to AWS?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored to establish that this person has deployed to AWS. The adjacent evidence describes personally building Dispatch Loom with Python and SQL and using PostgreSQL for its production database, but it does not document AWS deployment (ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b; 38d9e8ad-d829-4a1e-8720-f3615d355c91).",
        "evidence_ids": [
          "ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b",
          "38d9e8ad-d829-4a1e-8720-f3615d355c91"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "negative-4",
      "question": "Has Ada managed 100 employees?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored that Ada managed 100 employees. The adjacent evidence is that she personally trained 12 dispatch coworkers in two workshops and wrote a handbook; this does not establish employee management. [2d0f5e20-ec68-49f9-86be-de9aacb89356]",
        "evidence_ids": ["2d0f5e20-ec68-49f9-86be-de9aacb89356"]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "negative-7",
      "question": "Has Ada built a neural network?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored showing that Ada built a neural network. Adjacent evidence says she personally built Dispatch Loom using Python and SQL, writing its parser and checks; that evidence is labeled RELATED_ONLY and does not establish neural-network experience.",
        "evidence_ids": ["ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b"]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "negative-11",
      "question": "Has Ada personally built an AI assistant?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored that Ada personally built an AI assistant. The adjacent evidence documents her personally building a dispatch reconciliation tool, including its Python parser and SQL checks; it does not establish that the tool was an AI assistant. [ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b]",
        "evidence_ids": ["ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b"]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "sql-1",
      "question": "Does Ada know SQL?",
      "negative": false,
      "result": {
        "answer": "Yes. Ada has evidence of applied SQL experience: she personally wrote SQL checks for Dispatch Loom, a dispatch reconciliation tool. The record supports that specific use, but does not establish a broader level of SQL proficiency.",
        "evidence_ids": [
          "ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b",
          "176b7b8d-e10b-4da5-bd7a-f2a81218c7cb"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "automation-1",
      "question": "Has Ada automated repetitive work?",
      "negative": false,
      "result": {
        "answer": "No relevant evidence is currently stored that explicitly establishes Ada automated repetitive work. Adjacent evidence shows she personally wrote a Python parser and SQL checks for dispatch reconciliation; the team’s reconciliation time fell from 5 to 2 hours per week over six weekly runs, but that result does not establish that she automated the work. [ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b]",
        "evidence_ids": ["ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b"]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "training-1",
      "question": "Has Ada trained coworkers?",
      "negative": false,
      "result": {
        "answer": "Yes. Ada personally trained 12 dispatch coworkers in two workshops and wrote a plain-language handbook.",
        "evidence_ids": [
          "c5782fad-412f-420a-8203-4f3e5d4d6d97",
          "2d0f5e20-ec68-49f9-86be-de9aacb89356"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "stakeholders-1",
      "question": "Has Ada managed stakeholder requirements?",
      "negative": false,
      "result": {
        "answer": "The evidence supports that Ada gathered Dispatch Loom requirements from warehouse supervisors and explained validation failures to them. It does not establish that she owned or managed the broader stakeholder-requirements process. [ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b]",
        "evidence_ids": ["ea46c9c7-ba1a-40cd-bbeb-f52d66253c3b"]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "nuance-leadership",
      "question": "Does this person have leadership experience?",
      "negative": false,
      "result": {
        "answer": "Yes, there is evidence of limited, informal leadership: they personally trained 12 dispatch coworkers in two workshops and wrote a handbook. They also gathered requirements from warehouse supervisors and explained validation failures to them. This supports instructional and collaborative leadership, but does not establish broader management experience or managing a team.",
        "evidence_ids": [
          "731b472f-88f3-4539-aa7f-604d6412f499",
          "ae0a2653-6416-421f-b7d6-850c8aa88ad5"
        ]
      },
      "audit": {
        "unsupported": [
          "The claim that the evidence supports “collaborative leadership” goes beyond the documented requirement-gathering and explanation activities; those show stakeholder interaction, not leadership."
        ],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "nuance-cloud",
      "question": "Does this person's Docker exposure establish professional AWS deployment experience?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored to establish professional AWS deployment experience. The stored evidence describes Docker as a one-off exercise only. Separately, the person built a dispatch reconciliation tool using Python and SQL, but that does not establish AWS deployment experience.",
        "evidence_ids": [
          "732868b2-53dc-4f76-b1bc-2e6b2f34533d",
          "731b472f-88f3-4539-aa7f-604d6412f499"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    },
    {
      "id": "nuance-depth",
      "question": "Is this person a production Docker engineer?",
      "negative": true,
      "result": {
        "answer": "No relevant evidence is currently stored to establish that this person is a production Docker engineer. The evidence records only a one-off Docker exercise, indicating limited exposure. Separately, the person built a Python parser and SQL checks for a dispatch reconciliation tool; that adjacent software experience does not establish production Docker engineering.",
        "evidence_ids": [
          "732868b2-53dc-4f76-b1bc-2e6b2f34533d",
          "731b472f-88f3-4539-aa7f-604d6412f499"
        ]
      },
      "audit": {
        "unsupported": [],
        "unfaithfulCitations": [],
        "adequate": true
      }
    }
  ]
}
```
