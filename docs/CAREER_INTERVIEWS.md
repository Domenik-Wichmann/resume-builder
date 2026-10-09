# Career Interviews

The primary owner interview workflow is `/admin/interviews`, linked from Manage,
the overview, and Career Master. The old deterministic question generator remains
a supporting fallback endpoint; Career Master no longer presents its questionnaire.

## Agent loop and retrieval

An authenticated action first acquires a five-minute session lease and checks its
optimistic version. The transaction saves the exact owner answer before inference.
The server reloads private Career Brain with the owner's Supabase JWT and account
membership RLS. Existing `loadBrain` verification checks canonical hashes and
original evidence spans; archived records are excluded. Publication is not required
for this private owner tool.

Application-orchestrated `searchCareer` and `getCareerRecord` return up to six rich
records, bounded confirmed claims, original quotes, relationships, and separately
labeled uncertainties. The selected deep-dive record and its associations receive
priority. `inspectRequirement` searches confirmed claims across the private snapshot,
including records outside those six hits, and supplies up to three lexical candidate
claims per requirement. Lexical overlap selects candidates; the interviewer judges
direct, partial, or related support. This retrieval is deliberately lexical in V1;
it neither creates another vector index nor sends the entire career corpus to AI.

One structured Luna Pro completion chooses the next question and updates bounded
working memory. It receives the objective, fourteen recent messages, eighty bounded
question-history entries, compact memory, and retrieved evidence. It can change
focus when the answer reveals something useful. General discovery prioritizes thin
documentation and unresolved facts; targeted modes prioritize relevant partial or
missing evidence and suppress redundant strong-evidence probes. Missing evidence
does not establish that the owner lacks a skill.

Application guards reject exact repeated questions, questionnaires, and renewed
questions about named denied topics. Findings require an exact quote from an owner
message. Requirement evidence IDs must refer to supplied verified evidence. These
guards complement model judgment; they cannot guarantee semantic question novelty
or the optimal next question. A rejected/provider-failed turn retains the owner
answer and releases its lease for retry, without another automatic model call.

## Persistent schema and working memory

`202610080001_career_interviews.sql` adds:

- `career_interview_sessions`: account, four-mode objective, title/status, selected
  record, bounded state, optimistic version, lease, turn count, review cursor,
  latest draft link, and activity timestamps.
- `career_interview_messages`: immutable owner/agent content, role, ordered sequence,
  rationale, timestamps, and a composite account/session foreign key.

Sessions can be renamed, archived, restored, continued, or finished. Messages cannot
be updated or deleted by the authenticated client. The session list pages through
fifty small metadata rows at a time; transcript history pages through one hundred
messages. Up to four hundred planning turns per session bound server work.

State contains a compact summary, current focus, investigated topics, denials,
unresolved questions, quoted temporary discoveries, and at most sixteen requirements.
The summary is refreshed by the same planning response. Raw messages remain
authoritative and are retained. None of this JSON is another canonical ontology,
a public claim, or a résumé source.

## Four modes

| Mode              | Input                                         | Interview behavior                                                                                                      |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| General discovery | No additional input                           | Find under-documented work, uncertainty, missing context, and useful narrative examples.                                |
| Target role       | Free-text role objective                      | Infer relevant competencies and investigate evidence gaps.                                                              |
| Actual job        | Pasted description, at most 16,000 characters | Maintain a bounded requirement map and distinguish stored evidence from unreviewed discoveries.                         |
| Record deep dive  | An active experience, project, or achievement | Explore the selected record's decisions, ownership, adoption, communication, and outcomes through successive questions. |

## Career Brain handoff and provenance

After five new visible answers, the UI offers a checkpoint. Discovery notes can be
inspected at any time. Preparing a review or finishing an interview takes exact
owner answers after the previous checkpoint, preserving their text without
rewriting. Each source is bounded to 38,000 characters and twenty-four answers;
long sessions use additional explicit checkpoints without losing raw answers.

Questions are supplied separately as bounded referent context with answer IDs and
source offsets. They never enter `evidence_text`. Extraction and its independent
audit can use that context to identify existing records, but facts and quantities
must be supported by owner answers. A bare “yes” does not make facts suggested by
a question into evidence.

The existing `proposeBrain(..., full=false)` performs rich extraction, identity
reconciliation, grounding/audit, conflict checks, and partial-source diffing. Silence
does not remove unrelated records. `review_career_interview` transactionally creates
an `INTERVIEW` source, a `DRAFT` import, and a session review cursor. It does not call
canonical apply. `/admin/career?import=<draft-id>` opens the existing owner review.
Acceptance still uses the existing optimistic, transactional Career Brain apply;
publication remains a separate explicit action.

After the latest targeted draft is applied, the discovery panel links to the
existing Applications workflow for another job match and updated résumé. It does
not create a separate résumé system or automatically submit a job description.

## UX and privacy

The desktop view has a small session list, readable conversation, narrow optional
context panel, reasons expandable under questions, and composer. Mobile collapses
the session list and context; the composer follows the conversation without
covering it. Enter sends, Shift+Enter adds a newline, composition input does not
send, and autoscroll follows only near the bottom. Loading reserves space. Markdown
uses the existing escaped renderer; raw HTML and executable links stay inert.

Both the page and API verify the exact configured owner identity, then obtain the
account's verified JWT client. Requests accept no browser account authority,
validate bounded bodies and same-site origin, and return private/no-store data.
RLS isolates sessions and transcripts; selected records and draft references cannot
cross accounts. Interview tables have no anonymous policies or public reads.
Interview text is not logged or sent to visitor analytics. Public career reads and
recruiter workspaces do not query these tables.

Planning uses `CAREER_INTERVIEW_MODEL` or `openai/gpt-6-luna-pro`, one response per
normal turn, and existing provider token/cost accounting (`career_interview_plan`).
Reviewed extraction uses the established bounded Career Brain pipeline rather than
an autonomous agent loop. No new agent framework, worker, or embeddings are added.

## Qualification and examples

All examples here are fictional. Actual selected Luna Pro outputs are in
[the live synthetic qualification report](qualification/career-interview-live.md).

| Situation                                                          | Example follow-up observed                                                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Coworkers used the tool, strong SQL already documented             | “How did you get them to start using it, and what did you do when you introduced it to them?”                                            |
| Owner: “No, I have never used AWS.”                                | The interviewer records AWS as denied and asks about the validation tool's purpose and coworker requirements.                            |
| Owner mentions explaining technical failures to a client in German | “Can you walk me through one technical failure you explained to the client in German—what did you say or do to help them understand it?” |
| Owner cannot remember time savings                                 | The interviewer leaves time savings unresolved and asks how coworkers first started using the tool.                                      |

The qualification script makes six explicitly synthetic provider calls, writes only
selected question/rationale summaries, and records usage through the existing
ledger. It reads no private Career Brain records and writes no canonical records,
sources, or interview sessions. Run with explicitly configured live credentials:

```powershell
$env:APP_MODE = 'live'
node --conditions=react-server --import tsx --env-file=.env.local scripts/qualify-career-interview.ts
```

Automated coverage includes claim-level retrieval and availability, bounded context,
denial/repetition guards, exact owner quotes, source chunking, mode validation,
unauthenticated API rejection, the server planner/handoff contracts, provider retry,
and PGlite tests executing every committed migration for tenant isolation,
independent objectives, archived history, leases, transaction rollback, and reviewed
drafts that leave canonical records unchanged. Browser qualification uses fictional
demo fixtures at desktop 1440×1000 and mobile 390×844 to inspect modes, long job
descriptions, session switching, reasons, discoveries, overflow, and console errors.
It does not substitute for an authenticated production interview smoke test.

## Deployment

Apply the additive migration before deploying this feature; missing persistence
tables fail closed. No prior migrations change. Use `APP_MODE=demo` in `.env.local`
for offline `npm run format`, `npm run check`, and `npm run build`. The visual-only
fixture route `/admin/interviews?preview=1` is available only in explicit demo mode;
it does not bypass live authentication or enable persistence APIs.

No canonical evidence or vector dimensions change in this implementation, so a
career reindex is unnecessary. Reviewed owner acceptance continues to use the
existing reindex path. Production migration/promotion is a separate deployment
step; local qualification does not apply migrations to the live database.
