"use client";
import { useState, type FormEvent } from "react";
import type { Candidate, Canonical, Change } from "@/lib/ingestion/model";
import type { InterviewQuestion } from "@/lib/interview/questions";
export type ImportDraft = { id: string; status: string; candidates: Change[] };
export function CareerManager({
  initialRecords,
  initialImports,
}: {
  initialRecords: Canonical[];
  initialImports: ImportDraft[];
}) {
  const [records, setRecords] = useState<Canonical[]>(initialRecords),
    [draft, setDraft] = useState<ImportDraft | null>(null),
    [imports, setImports] = useState<ImportDraft[]>(initialImports),
    [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState<number[]>([]),
    [edits, setEdits] = useState<Record<number, string>>({});
  const [mode, setMode] = useState("general"),
    [job, setJob] = useState(""),
    [key, setKey] = useState(""),
    [questions, setQuestions] = useState<InterviewQuestion[]>([]),
    [asked, setAsked] = useState<string[]>([]),
    [answers, setAnswers] = useState("");
  async function refresh() {
    const r = await fetch("/api/admin/career");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setRecords(data.records);
    setImports(data.imports);
  }
  async function action(body: object) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/career", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.import) {
        setDraft(data.import);
        setAccepted([]);
        setEdits({});
      }
      if (data.questions) {
        setQuestions(data.questions);
        setAsked((old) => [
          ...old,
          ...data.questions.map((q: InterviewQuestion) => q.id),
        ]);
      }
      if (data.applied !== undefined) {
        setDraft(null);
        setMessage(
          `${data.applied} changes applied privately. Publish approved records below.`,
        );
      }
      if (data.rejected) {
        setDraft(null);
        setMessage("Draft rejected. Canonical records were not changed.");
      }
      if (data.indexing?.pending) setMessage(data.indexing.message);
      await refresh();
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  function ingest(event: FormEvent) {
    event.preventDefault();
    void action({ action: "extract", text, kind: "MASTER" });
  }
  return (
    <div className="career-manager">
      <section className="section">
        <h2>Career Master</h2>
        <p>
          Paste your career document or upload plain text / Markdown (up to
          40,000 characters). Extraction proposes facts; nothing is published
          automatically. Treat each Master as a complete document. Omitted
          records are proposed for archive.
        </p>
        <form className="ai-panel" onSubmit={ingest}>
          <label htmlFor="master-file">Text or Markdown file</label>
          <input
            id="master-file"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > 160000) {
                  setMessage("File is too large.");
                  return;
                }
                const value = await file.text();
                if (value.length > 40000) {
                  setMessage("Document exceeds 40,000 characters.");
                  return;
                }
                setText(value);
              }
            }}
          />
          <label htmlFor="master">Career document</label>
          <textarea
            id="master"
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={40000}
            required
            minLength={10}
          />
          <button disabled={busy}>
            {busy ? "Working…" : "Extract with Luna Pro"}
          </button>
        </form>
        <h3>Recent imports</h3>
        {imports.map((row) => (
          <button
            key={row.id}
            disabled={busy || row.status !== "DRAFT"}
            onClick={() => {
              setDraft(row);
              setAccepted([]);
              setEdits({});
            }}
          >
            {row.status} · {row.candidates.length} proposals
          </button>
        ))}
      </section>
      {draft && (
        <section className="section">
          <h2>Review import</h2>
          <button
            disabled={busy}
            onClick={() => void action({ action: "reject", id: draft.id })}
          >
            Reject entire draft
          </button>
          <div className="tags">
            {["ADDED", "UPDATED", "UNCHANGED", "REMOVED", "REVIEW"].map(
              (status) => (
                <span key={status}>
                  {status}:{" "}
                  {
                    draft.candidates.filter((row) => row.status === status)
                      .length
                  }
                </span>
              ),
            )}
          </div>
          <p>
            Accepted additions and updates stay private. Removed means archive,
            never delete. Resolve uncertain or ambiguous proposals with an
            explicit edit before accepting. Unsupported quotations must be
            corrected or rejected.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              setAccepted(
                draft.candidates.flatMap((row, index) =>
                  ["ADDED", "UPDATED"].includes(row.status) ? [index] : [],
                ),
              )
            }
          >
            Select safe additions and updates
          </button>
          {draft.candidates.map((change, index) => (
            <article
              className="project-card import-change"
              key={`${change.identity}-${index}`}
            >
              <label>
                <input
                  type="checkbox"
                  disabled={
                    busy || ["UNCHANGED", "REVIEW"].includes(change.status)
                  }
                  checked={accepted.includes(index)}
                  onChange={(event) =>
                    setAccepted((old) =>
                      event.target.checked
                        ? [...old, index]
                        : old.filter((value) => value !== index),
                    )
                  }
                />
                {change.status} · {change.identity}
              </label>
              {change.reason && <p>{change.reason}</p>}
              {change.before && (
                <div>
                  <h4>Before</h4>
                  <p>
                    {change.before.title} · {change.before.subtitle}
                  </p>
                  <p>{change.before.summary}</p>
                  <small>
                    Skills: {change.before.skill_keys.join(", ") || "None"} ·
                    Dates: {change.before.start_date || "Unknown"} –{" "}
                    {change.before.end_date || "Unknown"}
                  </small>
                </div>
              )}
              {change.after && (
                <div>
                  <h4>Proposed</h4>
                  <p>
                    {change.after.title} · {change.after.subtitle}
                  </p>
                  <p>{change.after.summary}</p>
                  <small>
                    Skills: {change.after.skill_keys.join(", ") || "None"} ·
                    Dates: {change.after.start_date || "Unknown"} –{" "}
                    {change.after.end_date || "Unknown"}
                  </small>
                  <blockquote>{change.after.source_quote}</blockquote>
                  <details>
                    <summary>Edit structured proposal</summary>
                    <p>
                      Confirm the key identifies the right record. Clear
                      uncertainties only after resolving them. Saving refreshes
                      the diff.
                    </p>
                    <textarea
                      aria-label={`Edit ${change.identity}`}
                      rows={12}
                      value={
                        edits[index] ?? JSON.stringify(change.after, null, 2)
                      }
                      onChange={(event) =>
                        setEdits((old) => ({
                          ...old,
                          [index]: event.target.value,
                        }))
                      }
                    />
                    <button
                      disabled={busy}
                      onClick={() => {
                        try {
                          const candidate = JSON.parse(
                            edits[index] ?? JSON.stringify(change.after),
                          ) as Candidate;
                          void action({
                            action: "revise",
                            id: draft.id,
                            index,
                            candidate,
                          });
                        } catch {
                          setMessage("Proposal must be valid JSON.");
                        }
                      }}
                    >
                      Save edit and compare again
                    </button>
                  </details>
                </div>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  setAccepted((old) => old.filter((value) => value !== index))
                }
              >
                Reject / leave unselected
              </button>
            </article>
          ))}
          <button
            disabled={busy || !accepted.length}
            onClick={() =>
              void action({ action: "apply", id: draft.id, accepted })
            }
          >
            Apply {accepted.length} selected changes privately
          </button>
        </section>
      )}
      <section className="section">
        <h2>Career interview</h2>
        <p>
          Questions target undocumented ownership, adoption and outcomes. The
          displayed reason explains their priority. Missing evidence is not
          proof that you lack experience.
        </p>
        <form
          className="ai-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void action({
              action: "interview",
              mode,
              job,
              key: key || null,
              asked,
            });
          }}
        >
          <label htmlFor="interview-mode">Interview mode</label>
          <select
            id="interview-mode"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              setAsked([]);
            }}
          >
            <option value="general">Interview me</option>
            <option value="job">Interview me for this job</option>
            <option value="record">Flesh out this project / experience</option>
          </select>
          {mode === "job" && (
            <>
              <label htmlFor="interview-job">Job description</label>
              <textarea
                id="interview-job"
                value={job}
                maxLength={12000}
                rows={6}
                onChange={(event) => setJob(event.target.value)}
                required
              />
            </>
          )}
          {mode === "record" && (
            <>
              <label htmlFor="interview-record">Career record</label>
              <select
                id="interview-record"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                  setAsked([]);
                }}
                required
              >
                <option value="">Choose a record</option>
                {records
                  .filter(
                    (row) =>
                      !row.archived &&
                      ["project", "experience", "achievement"].includes(
                        row.kind,
                      ),
                  )
                  .map((row) => (
                    <option key={row.id} value={`${row.kind}:${row.key}`}>
                      {row.title}
                    </option>
                  ))}
              </select>
            </>
          )}
          <button disabled={busy}>Suggest focused questions</button>
        </form>
        {questions.map((q) => (
          <article className="question-answer" key={q.id}>
            <h3>{q.question}</h3>
            <p className="muted">{q.reason}</p>
          </article>
        ))}
        {questions.length > 0 && (
          <form
            className="ai-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void action({
                action: "extract",
                text: answers,
                kind: "INTERVIEW",
                context: questions.map((q) => q.question).join("\n"),
              });
            }}
          >
            <label htmlFor="interview-answers">
              Your conversational answers
            </label>
            <textarea
              id="interview-answers"
              rows={8}
              value={answers}
              maxLength={30000}
              minLength={10}
              onChange={(event) => setAnswers(event.target.value)}
              required
            />
            <button disabled={busy}>
              Extract answers into review proposals
            </button>
          </form>
        )}
      </section>
      <section className="section">
        <h2>Canonical records & publication</h2>
        <p>
          Publish only approved facts. Updates to an existing fact return it to
          private review. Publishing and unpublishing refresh only changed or
          obsolete retrieval projections.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void action({ action: "reindex" }).then((data) => {
              if (data)
                setMessage(
                  `Index: ${data.indexed} changed, ${data.unchanged} unchanged.`,
                );
            })
          }
        >
          Retry indexing
        </button>
        {records.length === 0 && (
          <p>No career records have been accepted yet.</p>
        )}
        {records.map((row) => (
          <article className="project-card" key={row.id}>
            <h3>{row.title}</h3>
            <p>
              {row.kind} · {row.key} ·{" "}
              {row.archived
                ? "Archived"
                : row.published
                  ? "Published"
                  : "Private"}
            </p>
            <p>{row.summary}</p>
            <button
              disabled={busy || row.archived}
              onClick={() =>
                void action({
                  action: "publish",
                  kind: row.kind,
                  key: row.key,
                  published: !row.published,
                })
              }
            >
              {row.published ? "Unpublish" : "Publish approved record"}
            </button>
          </article>
        ))}
      </section>
      {message && (
        <p className="result" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
