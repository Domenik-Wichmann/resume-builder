"use client";
import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { kinds } from "@/lib/ingestion/model";
import type { BrainRecord } from "@/lib/career-brain/repository";
import {
  connectedRecords,
  filterRecords,
  kindLabels,
  publishable,
  selectionFor,
  type ExplorerData,
  type RecordAction,
  type RecordEdit,
  type RecordFilters,
  type SourceSummary,
} from "@/lib/career-brain/record-view";
import { CareerRecordEditor } from "./career-record-editor";
const initialFilters: RecordFilters = {
  query: "",
  kind: "all",
  status: "all",
  evidence: "all",
  connections: "all",
  sort: "name",
};
const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");
function RecordDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="record-dialog-surface">
        <header>
          <h2 id={headingId}>{title}</h2>
          <button
            className="record-icon-button"
            type="button"
            aria-label="Close details"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
function RecordDetails({
  row,
  records,
  sources,
  onOpen,
}: {
  row: BrainRecord;
  records: BrainRecord[];
  sources: SourceSummary[];
  onOpen: (id: string) => void;
}) {
  const links = connectedRecords(row, records);
  return (
    <div className="record-detail-grid">
      <div>
        <p className="record-description">
          {row.summary || "No description yet."}
        </p>
        <dl className="record-facts">
          {row.subtitle && (
            <>
              <dt>Subtitle</dt>
              <dd>{row.subtitle}</dd>
            </>
          )}
          {row.organization && (
            <>
              <dt>Organization</dt>
              <dd>{row.organization}</dd>
            </>
          )}
          {(row.start_date || row.end_date) && (
            <>
              <dt>Dates</dt>
              <dd>
                {row.start_date || "Unknown start"} →{" "}
                {row.end_date || "Unknown end"}
              </dd>
            </>
          )}
          {row.aliases.length > 0 && (
            <>
              <dt>Also known as</dt>
              <dd>{row.aliases.join(", ")}</dd>
            </>
          )}
          <dt>Last updated</dt>
          <dd>{new Date(row.updated_at).toISOString().slice(0, 10)}</dd>
        </dl>
        <h3>
          Facts & source evidence{" "}
          <span className="record-count">{row.claims.length}</span>
        </h3>
        {row.claims.length === 0 && (
          <p className="muted">
            No reviewed facts yet. Add supported facts in the editor before
            publishing.
          </p>
        )}
        {row.claims.map((claim, index) => (
          <details className="record-evidence" key={index}>
            <summary>
              <span>{claim.value}</span>
              <span
                className={`record-badge ${claim.availability === "CONFIRMED" ? "ready" : "review"}`}
              >
                {readable(claim.availability)}
              </span>
            </summary>
            <div>
              <p className="muted">
                {readable(claim.attribute)} · {readable(claim.attribution)}
              </p>
              {claim.conflict && (
                <p className="record-review-note">{claim.conflict}</p>
              )}
              {claim.evidence.map((span, i) => {
                const sourceId = (span as typeof span & { source_id?: string })
                  .source_id;
                const source = sources.find((s) => s.id === sourceId);
                return (
                  <figure key={i}>
                    <blockquote>{span.quote}</blockquote>
                    <figcaption>
                      {source?.kind === "MASTER"
                        ? "Career Master"
                        : source?.kind === "INTERVIEW"
                          ? "Interview"
                          : "Owner / supplemental source"}
                      {source && ` · ${source.created_at.slice(0, 10)}`}
                      <details>
                        <summary>Source reference</summary>
                        <code>{sourceId || "Pending provenance"}</code>
                        <p>
                          Characters {span.start ?? "?"}–{span.end ?? "?"}
                        </p>
                      </details>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </details>
        ))}
        <details className="record-identity">
          <summary>Record identity</summary>
          <p>
            Stable ID: <code>{row.id}</code>
          </p>
          <p>
            Reference: <code>{row.key}</code>
          </p>
          <p>Editing the name keeps this identity and its connections.</p>
        </details>
      </div>
      <aside className="record-connections">
        <h3>
          Connected records <span className="record-count">{links.length}</span>
        </h3>
        <p className="muted">Follow a connection to explore its details.</p>
        {links.length === 0 && <p className="muted">No connections yet.</p>}
        {links.map((other) => (
          <button
            key={other.id}
            className="record-connection"
            onClick={() => onOpen(other.id)}
          >
            <span>
              <small>{kindLabels[other.kind]}</small>
              <strong>{other.title}</strong>
              {other.archived && <small>In Trash</small>}
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </aside>
    </div>
  );
}
export function CareerRecordWorkspace({
  initialData,
}: {
  initialData: ExplorerData;
}) {
  const [data, setData] = useState(initialData);
  return <CareerRecordExplorer data={data} onChange={setData} />;
}
export function CareerRecordExplorer({
  data,
  onChange,
}: {
  data: ExplorerData;
  onChange: (data: ExplorerData) => void;
}) {
  const { records, sources } = data;
  const [filters, setFilters] = useState(initialFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editBaseline, setEditBaseline] = useState<BrainRecord | null>(null);
  const editing = editBaseline !== null;
  const [pending, setPending] = useState<{
    action: RecordAction;
    rows: BrainRecord[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const active = records.find((row) => row.id === activeId);
  const filtered = filterRecords(records, { ...filters, query: deferredQuery });
  const facets = filterRecords(records, {
    ...filters,
    query: deferredQuery,
    kind: "all",
  });
  const chosen = records.filter((row) => selected.includes(row.id));
  const eligible = (rows: BrainRecord[], action: RecordAction) =>
    rows.filter((row) =>
      action === "publish"
        ? publishable(row) && !row.published
        : action === "unpublish"
          ? row.published
          : action === "archive"
            ? !row.archived
            : row.archived,
    );
  const selectedVisible = filtered.filter((row) =>
    selected.includes(row.id),
  ).length;
  function updateFilters(patch: Partial<RecordFilters>) {
    if (editing) {
      setError("Save or cancel your edit before changing filters.");
      return;
    }
    setFilters((old) => ({ ...old, ...patch }));
    setLimit(24);
  }
  function open(id: string, reveal = false) {
    if (editing || busy) return;
    if (reveal) {
      setFilters(initialFilters);
      setLimit(Math.max(24, records.length));
    }
    setActiveId(id);
    setEditBaseline(null);
    setError("");
  }
  useEffect(() => {
    if (!activeId) return;
    const frame = requestAnimationFrame(() => {
      const toggle = document.getElementById(`record-toggle-${activeId}`);
      toggle
        ?.closest("article")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
      toggle?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId]);
  async function refresh() {
    try {
      const response = await fetch("/api/admin/records", { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      onChange(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to refresh records.",
      );
    }
  }
  useEffect(() => {
    const receive = async (changed = false) => {
      if (editing || busy) {
        if (changed)
          setMessage(
            "Records changed in another view. Refresh when you finish reviewing your edit.",
          );
        return;
      }
      try {
        const response = await fetch("/api/admin/records", {
          cache: "no-store",
        });
        if (response.ok) onChange(await response.json());
      } catch {
        /* Existing records remain usable; explicit refresh reports errors. */
      }
    };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("career-records");
      channel.current.onmessage = () => void receive(true);
    }
    const focus = () => void receive();
    window.addEventListener("focus", focus);
    return () => {
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", focus);
    };
  }, [onChange, editing, busy]);
  async function mutate(body: object) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      onChange({ records: next.records, sources: next.sources });
      setMessage(
        next.indexing?.pending
          ? next.indexing.message
          : `${next.changed} ${next.changed === 1 ? "record" : "records"} updated. All views use the saved canonical state.`,
      );
      channel.current?.postMessage({ changed: true });
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Changes could not be saved.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function requestAction(action: RecordAction, rows: BrainRecord[]) {
    const applicable = eligible(rows, action);
    if (!applicable.length) {
      setError(
        "No selected records are eligible for this action. Review their status and evidence.",
      );
      return;
    }
    setError("");
    setPending({ action, rows: applicable });
  }
  async function applyAction() {
    if (!pending) return;
    if (
      await mutate({
        action: pending.action,
        records: pending.rows.map(selectionFor),
      })
    ) {
      setPending(null);
      setSelected([]);
    }
  }
  async function saveEdit(edit: RecordEdit) {
    if (
      editBaseline &&
      (await mutate({
        action: "edit",
        record: selectionFor(editBaseline),
        edit,
      }))
    )
      setEditBaseline(null);
  }
  function toggleSelection(id: string, checked: boolean) {
    if (checked && selected.length >= 150) {
      setError("Select up to 150 records per bulk action.");
      return;
    }
    setSelected((old) =>
      checked
        ? [...new Set([...old, id])]
        : old.filter((value) => value !== id),
    );
  }
  return (
    <div className="canonical-explorer" aria-busy={busy}>
      <div className="record-toolbar">
        <label className="record-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search career records"
            placeholder="Search names, descriptions or companies…"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
          />
        </label>
        <button
          className="record-button secondary"
          disabled={busy || editing}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      <div className="record-type-tabs" aria-label="Record types">
        <button
          className={filters.kind === "all" ? "active" : ""}
          aria-pressed={filters.kind === "all"}
          onClick={() => updateFilters({ kind: "all" })}
        >
          All records <span>{facets.length}</span>
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            className={filters.kind === kind ? "active" : ""}
            aria-pressed={filters.kind === kind}
            onClick={() => updateFilters({ kind })}
          >
            {kindLabels[kind]}{" "}
            <span>{facets.filter((r) => r.kind === kind).length}</span>
          </button>
        ))}
      </div>
      <div className="record-filters">
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) => {
              updateFilters({ status: event.target.value });
              setSelected([]);
            }}
          >
            <option value="all">All active records</option>
            <option value="private">Private</option>
            <option value="published">Published</option>
            <option value="trash">Trash</option>
          </select>
        </label>
        <label>
          Evidence
          <select
            value={filters.evidence}
            onChange={(event) =>
              updateFilters({ evidence: event.target.value })
            }
          >
            <option value="all">Any review status</option>
            <option value="ready">Has confirmed evidence</option>
            <option value="review">Needs review</option>
          </select>
        </label>
        <label>
          Connections
          <select
            value={filters.connections}
            onChange={(event) =>
              updateFilters({ connections: event.target.value })
            }
          >
            <option value="all">All connections</option>
            <option value="connected">Connected</option>
            <option value="unlinked">No connections</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value })}
          >
            <option value="name">Name A–Z</option>
            <option value="recent">Recently updated</option>
            <option value="connections">Most connections</option>
          </select>
        </label>
      </div>
      <div className="record-results-heading">
        <p>
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1 ? "record" : "records"}
          {filters.status === "trash" ? " in Trash" : " found"}
        </p>
        <div>
          <button
            className="record-text-button"
            disabled={busy || !filtered.length}
            onClick={() =>
              setSelected(filtered.slice(0, 150).map((row) => row.id))
            }
          >
            Select{" "}
            {filtered.length > 150
              ? "first 150 results"
              : `all ${filtered.length} results`}
          </button>
          {selected.length > 0 && (
            <button
              className="record-text-button"
              disabled={busy}
              onClick={() => setSelected([])}
            >
              Clear selection
            </button>
          )}
        </div>
      </div>
      {chosen.length > 0 && (
        <div className="record-bulk-bar">
          <div>
            <strong>{chosen.length} selected</strong>
            {chosen.length > selectedVisible && (
              <small>
                {chosen.length - selectedVisible} outside these filters
              </small>
            )}
          </div>
          <div className="record-bulk-actions">
            {filters.status === "trash" ? (
              <button
                className="record-button"
                disabled={busy}
                onClick={() => requestAction("restore", chosen)}
              >
                Restore selected
              </button>
            ) : (
              <>
                <button
                  className="record-button"
                  disabled={busy || !eligible(chosen, "publish").length}
                  onClick={() => requestAction("publish", chosen)}
                >
                  Publish eligible ({eligible(chosen, "publish").length})
                </button>
                <button
                  className="record-button secondary"
                  disabled={busy || !eligible(chosen, "unpublish").length}
                  onClick={() => requestAction("unpublish", chosen)}
                >
                  Unpublish
                </button>
                <button
                  className="record-button danger"
                  disabled={busy}
                  onClick={() => requestAction("archive", chosen)}
                >
                  Move to Trash
                </button>
              </>
            )}
          </div>
          {filters.status !== "trash" &&
            chosen.some((r) => !publishable(r)) && (
              <p>
                {chosen.filter((r) => !publishable(r)).length} selected{" "}
                {chosen.filter((r) => !publishable(r)).length === 1
                  ? "record needs"
                  : "records need"}{" "}
                confirmed evidence and will be excluded from publication.
              </p>
            )}
        </div>
      )}
      {message && (
        <p className="record-notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="record-notice error" role="alert">
          {error}
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="record-empty">
          <span aria-hidden="true">◇</span>
          <h3>
            {records.length ? "No matching records" : "Your career starts here"}
          </h3>
          <p>
            {records.length
              ? "Try another type, a broader search, or a different status."
              : "Import your Career Master to build your first connected records."}
          </p>
          {records.length > 0 && (
            <button
              className="record-button secondary"
              onClick={() => {
                setFilters(initialFilters);
                setLimit(24);
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="record-card-grid">
          {filtered.slice(0, limit).map((row) => {
            const links = connectedRecords(row, records);
            return (
              <article
                key={row.id}
                className={`canonical-card ${selected.includes(row.id) ? "selected" : ""}`}
              >
                <div className="record-row-header">
                  <label className="record-select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title}`}
                      checked={selected.includes(row.id)}
                      disabled={busy}
                      onChange={(event) =>
                        toggleSelection(row.id, event.target.checked)
                      }
                    />
                  </label>
                  <button
                    className="canonical-card-open"
                    disabled={busy || editing}
                    id={`record-toggle-${row.id}`}
                    aria-expanded={activeId === row.id}
                    aria-controls={
                      activeId === row.id
                        ? `record-details-${row.id}`
                        : undefined
                    }
                    onClick={() => {
                      if (activeId === row.id) {
                        setActiveId(null);
                        setError("");
                      } else open(row.id);
                    }}
                  >
                    <span className="record-row-content">
                      <span className="record-row-title">
                        <span
                          className={`record-type-dot ${row.kind}`}
                          aria-hidden="true"
                        />
                        <strong>{row.title}</strong>
                        <span className="canonical-kind">
                          {kindLabels[row.kind]}
                        </span>
                      </span>
                      <span className="record-row-description">
                        {[row.organization, row.summary || row.subtitle]
                          .filter(Boolean)
                          .join(" / ") || "Add a description to this record."}
                      </span>
                    </span>
                    <span className="record-row-meta">
                      <span
                        className={`record-badge ${row.archived ? "trash" : row.published ? "published" : "private"}`}
                      >
                        {row.archived
                          ? "In Trash"
                          : row.published
                            ? "Published"
                            : "Private"}
                      </span>
                      <span>{links.length} connections</span>
                      <span>
                        {
                          row.claims.filter(
                            (c) => c.availability === "CONFIRMED",
                          ).length
                        }{" "}
                        facts
                      </span>
                      {(!publishable(row) ||
                        row.claims.some((c) =>
                          ["PENDING_REVIEW", "DISPUTED"].includes(
                            c.availability,
                          ),
                        )) && (
                        <span className="record-review-indicator">
                          Needs review
                        </span>
                      )}
                      <span className="record-row-chevron" aria-hidden="true">
                        {activeId === row.id ? "-" : "+"}
                      </span>
                    </span>
                  </button>
                </div>
                {active?.id === row.id && (
                  <section
                    className="record-inline-details"
                    id={`record-details-${row.id}`}
                    aria-label={`${row.title} details`}
                  >
                    <div className="record-detail-top">
                      <div className="record-detail-labels">
                        <span className="record-badge">
                          {kindLabels[active.kind]}
                        </span>
                        <span
                          className={`record-badge ${active.published ? "published" : "private"}`}
                        >
                          {active.archived
                            ? "In Trash"
                            : active.published
                              ? "Published"
                              : "Private"}
                        </span>
                      </div>
                      {!editing && (
                        <div className="record-detail-actions">
                          {active.archived ? (
                            <button
                              className="record-button"
                              disabled={busy}
                              onClick={() => requestAction("restore", [active])}
                            >
                              Restore record
                            </button>
                          ) : (
                            <>
                              <button
                                className="record-button"
                                disabled={busy}
                                onClick={() => setEditBaseline(active)}
                              >
                                Edit record
                              </button>
                              <button
                                className="record-button secondary"
                                disabled={
                                  busy ||
                                  (!active.published && !publishable(active))
                                }
                                onClick={() =>
                                  requestAction(
                                    active.published ? "unpublish" : "publish",
                                    [active],
                                  )
                                }
                              >
                                {active.published ? "Unpublish" : "Publish"}
                              </button>
                              <button
                                className="record-button danger"
                                disabled={busy}
                                onClick={() =>
                                  requestAction("archive", [active])
                                }
                              >
                                Move to Trash
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {error && (
                      <p className="record-notice error" role="alert">
                        {error}
                      </p>
                    )}
                    {editing ? (
                      <CareerRecordEditor
                        key={active.id}
                        row={editBaseline || active}
                        records={records}
                        busy={busy}
                        onSave={saveEdit}
                        onCancel={() => setEditBaseline(null)}
                      />
                    ) : (
                      <RecordDetails
                        row={active}
                        records={records}
                        sources={sources}
                        onOpen={(id) => open(id, true)}
                      />
                    )}
                  </section>
                )}
              </article>
            );
          })}
        </div>
      )}
      {filtered.length > limit && (
        <div className="record-load-more">
          <button
            className="record-button secondary"
            onClick={() => setLimit((old) => old + 24)}
          >
            Show more records{" "}
            <span>({Math.min(24, filtered.length - limit)} more)</span>
          </button>
        </div>
      )}
      {pending && (
        <RecordDialog
          title={
            pending.action === "archive"
              ? "Move records to Trash?"
              : pending.action === "restore"
                ? "Restore these records?"
                : pending.action === "publish"
                  ? "Publish these records?"
                  : "Unpublish these records?"
          }
          onClose={() => setPending(null)}
          busy={busy}
        >
          <p>
            {pending.action === "publish"
              ? "These records and their confirmed evidence become available on your public portfolio and to recruiter tools."
              : pending.action === "archive"
                ? "These records leave the active career and public views. Their identities, evidence and connections are kept so you can restore them."
                : pending.action === "restore"
                  ? "These records return to your active career privately. You can review and publish them afterward."
                  : "These records and their evidence leave public and recruiter views."}
          </p>
          <p>
            <strong>
              {pending.rows.length}{" "}
              {pending.rows.length === 1 ? "record" : "records"}
            </strong>{" "}
            will change together.
          </p>
          <ul className="record-confirm-list">
            {pending.rows.map((row) => (
              <li key={row.id}>
                {row.title}
                <small>{kindLabels[row.kind]}</small>
              </li>
            ))}
          </ul>
          {error && (
            <p className="record-notice error" role="alert">
              {error}
            </p>
          )}
          <div className="record-editor-actions">
            <button
              className={`record-button ${pending.action === "archive" ? "danger" : ""}`}
              disabled={busy}
              onClick={() => void applyAction()}
            >
              {busy
                ? "Saving…"
                : pending.action === "archive"
                  ? "Move to Trash"
                  : pending.action === "restore"
                    ? "Restore privately"
                    : pending.action === "publish"
                      ? "Publish records"
                      : "Unpublish records"}
            </button>
            <button
              className="record-button secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </RecordDialog>
      )}
    </div>
  );
}
