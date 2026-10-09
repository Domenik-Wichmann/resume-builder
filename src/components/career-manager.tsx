"use client";
import { useState, type FormEvent } from "react";
import type { Candidate, Change } from "@/lib/ingestion/model";
import type { BrainRecord } from "@/lib/career-brain/repository";
import type { SourceSummary } from "@/lib/career-brain/record-view";
import { CareerRecordExplorer } from "./career-record-explorer";
import Link from "next/link";
import type { StateClaim } from "@/lib/career-brain/state";
import { careerSourceLimit } from "@/lib/career-brain/source";
function ClaimEvidence({ record }: { record: Candidate }) {
  const claims = (record as Candidate & { claims?: StateClaim[] }).claims || [];
  return claims.length ? (
    <details>
      <summary>Review individual claims and source evidence</summary>
      <ul>
        {claims.map((claim, index) => (
          <li key={index}>
            <p>
              {claim.value} · {claim.attribution} ·{" "}
              {claim.availability || "PENDING_REVIEW"}
            </p>
            {claim.conflict && <p>{claim.conflict}</p>}
            {claim.evidence.map((span, i) => (
              <blockquote key={i}>{span.quote}</blockquote>
            ))}
          </li>
        ))}
      </ul>
    </details>
  ) : (
    <p>
      Claim evidence is pending review. This record cannot yet support generated
      qualifications.
    </p>
  );
}
export type ImportDraft = { id: string; status: string; candidates: Change[] };
export function CareerManager({
  initialRecords,
  initialSources,
  initialImports,
  initialImportId,
}: {
  initialRecords: BrainRecord[];
  initialSources: SourceSummary[];
  initialImports: ImportDraft[];
  initialImportId?: string;
}) {
  const [records, setRecords] = useState<BrainRecord[]>(initialRecords),
    [draft, setDraft] = useState<ImportDraft | null>(
      initialImports.find((row) => row.id === initialImportId) || null,
    ),
    [imports, setImports] = useState<ImportDraft[]>(initialImports),
    [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState<number[]>([]),
    [edits, setEdits] = useState<Record<number, string>>({});
  const [sources, setSources] = useState(initialSources);
  const [sourceKind, setSourceKind] = useState<"MASTER" | "MANUAL">("MASTER");
  async function refresh() {
    const r = await fetch("/api/admin/career");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setRecords(data.records);
    setSources(data.sources);
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
    void action({ action: "extract", text, kind: sourceKind });
  }
  return (
    <div className="career-manager">
      <section className="section">
        <h2>Career Master</h2>
        <p>
          Paste your career document or upload plain text / Markdown (up to
          100,000 characters). Extraction proposes facts; nothing is published
          automatically. Treat each Master as a complete document. Omitted
          records are proposed for archive.
        </p>
        <form className="ai-panel" onSubmit={ingest}>
          <label htmlFor="source-kind">Document role</label>
          <select
            id="source-kind"
            value={sourceKind}
            onChange={(event) =>
              setSourceKind(
                event.target.value === "MASTER" ? "MASTER" : "MANUAL",
              )
            }
          >
            <option value="MASTER">Complete Career Master</option>
            <option value="MANUAL">
              Supplemental document (adds evidence; does not replace unrelated
              records)
            </option>
          </select>
          <label htmlFor="master-file">Text or Markdown file</label>
          <input
            id="master-file"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > careerSourceLimit * 4) {
                  setMessage("File is too large.");
                  return;
                }
                const value = await file.text();
                if (value.length > careerSourceLimit) {
                  setMessage("Document exceeds 100,000 characters.");
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
            maxLength={careerSourceLimit}
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
            Select additions and updates for approval
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
                  <ClaimEvidence record={change.before} />
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
                  <ClaimEvidence record={change.after} />
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
        <h2>Career Interviews</h2>
        <p>
          Explore your career through a private conversation that remembers
          earlier answers and searches Career Brain.
        </p>
        <Link href="/admin/interviews">
          Start or continue a Career Interview →
        </Link>
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
        <CareerRecordExplorer
          data={{ records, sources }}
          onChange={(next) => {
            setRecords(next.records);
            setSources(next.sources);
          }}
        />
      </section>
      {message && (
        <p className="result" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
