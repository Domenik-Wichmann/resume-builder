"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SafeMarkdown } from "./safe-markdown";
import { submitComposerOnEnter } from "@/lib/workspaces/input";
import {
  messageSchema,
  sessionSchema,
  sessionListSchema,
  emptyMemory,
  type Session,
  type Message,
  type RecordChoice,
  type SessionListItem,
} from "@/lib/interview/model";
import { z } from "zod";

const modes = {
  general: "Explore my career",
  role: "Prepare for a type of role",
  job: "Interview for a job description",
  record: "Deep-dive a project or job",
};
const labels = {
  STRONG: "Strong stored evidence",
  PARTIAL: "Partial stored evidence",
  RELATED: "Related evidence only",
  NONE: "No explicit evidence currently stored",
};
export function CareerInterviews({
  initialSessions,
  records,
  initialSession = null,
  initialMessages = [],
  initialImportStatus = "",
  preview = false,
}: {
  initialSessions: SessionListItem[];
  records: RecordChoice[];
  initialSession?: Session | null;
  initialMessages?: Message[];
  initialImportStatus?: string;
  preview?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions),
    [session, setSession] = useState(initialSession),
    [messages, setMessages] = useState(initialMessages);
  const [listOffset, setListOffset] = useState(initialSessions.length),
    [hasMoreSessions, setHasMoreSessions] = useState(
      !preview && initialSessions.length === 50,
    );
  const [hasEarlierMessages, setHasEarlierMessages] = useState(
    initialMessages.length === 100,
  );
  const [starting, setStarting] = useState(!initialSession),
    [mode, setMode] = useState<Session["mode"]>("general"),
    [goal, setGoal] = useState(""),
    [record, setRecord] = useState("");
  const [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [discoveries, setDiscoveries] = useState(false);
  const [title, setTitle] = useState(initialSession?.title || ""),
    [renaming, setRenaming] = useState(false),
    [importStatus, setImportStatus] = useState(initialImportStatus);
  const contextPanel = useRef<HTMLDetailsElement>(null);
  const sessionPanel = useRef<HTMLDetailsElement>(null);
  const conversation = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    composer = useRef<HTMLTextAreaElement>(null),
    inFlight = useRef(false);
  useEffect(() => {
    if (sessionPanel.current)
      sessionPanel.current.open =
        window.matchMedia("(min-width: 761px)").matches;
  }, []);
  useEffect(() => {
    if (follow.current && conversation.current)
      conversation.current.scrollTo({
        top: conversation.current.scrollHeight,
        behavior: "smooth",
      });
  }, [messages, busy]);
  useEffect(() => {
    if (contextPanel.current)
      contextPanel.current.open = window.matchMedia(
        "(min-width: 1200px)",
      ).matches;
  }, [starting]);
  function update(data: { session: Session; messages: Message[] }) {
    setSession(data.session);
    setMessages(data.messages);
    setHasEarlierMessages(data.messages.length === 100);
    setTitle(data.session.title);
    setStarting(false);
    setSessions((old) => [
      data.session,
      ...old.filter((s) => s.id !== data.session.id),
    ]);
    if (!preview) {
      const url = new URL(window.location.href);
      url.searchParams.set("session", data.session.id);
      window.history.replaceState(null, "", url);
    }
  }
  async function load(id: string, before?: number) {
    const response = await fetch(
      `/api/admin/interviews?id=${encodeURIComponent(id)}${before ? `&before=${before}` : ""}`,
      { cache: "no-store" },
    );
    const raw = await response.json();
    if (!response.ok) throw new Error(raw.error || "Cannot load interview.");
    const data = {
      session: sessionSchema.parse(raw.session),
      messages: z.array(messageSchema).parse(raw.messages),
    };
    setImportStatus(
      typeof raw.importStatus === "string" ? raw.importStatus : "",
    );
    if (before) {
      setMessages((old) => [...data.messages, ...old]);
      setHasEarlierMessages(data.messages.length === 100);
    } else update(data);
    return data;
  }
  async function post(body: object) {
    if (preview)
      throw new Error(
        "Fictional layout preview. Sign in in live mode to save an interview.",
      );
    const response = await fetch("/api/admin/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await response.json();
    if (!response.ok)
      throw new Error(raw.error || "Cannot continue interview.");
    const data = {
      session: sessionSchema.parse(raw.session),
      messages: z.array(messageSchema).parse(raw.messages),
    };
    update(data);
    setImportStatus(
      typeof raw.importStatus === "string" ? raw.importStatus : "",
    );
    if (raw.importId) {
      setNotice(
        raw.hasMore
          ? "A review draft is ready. More answers remain; review another checkpoint before finishing."
          : "Review draft ready. Accept changes in Career Master to add them privately.",
      );
      setDiscoveries(true);
    }
    return data;
  }
  async function run(work: () => Promise<void>, reloadId?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      if (reloadId && !preview) await load(reloadId).catch(() => {});
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function start(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await post({
        action: "start",
        mode,
        title:
          mode === "general"
            ? "General career discovery"
            : mode === "record"
              ? records.find((r) => r.id === record)?.title ||
                "Record deep dive"
              : mode === "role"
                ? goal.slice(0, 160)
                : "Job-description interview",
        target_role: mode === "role" ? goal : "",
        job_description: mode === "job" ? goal : "",
        target_record_id: mode === "record" ? record : null,
      });
      try {
        await post({
          action: "turn",
          id: created.session.id,
          version: created.session.version,
          answer: null,
        });
      } catch (e) {
        await load(created.session.id);
        throw e;
      }
    });
  }
  const awaiting = !messages.length || messages.at(-1)?.role === "user";
  const active = session?.status === "ACTIVE";
  function send(event: FormEvent) {
    event.preventDefault();
    if (!session || !answer.trim()) return;
    const current = session,
      text = answer;
    follow.current = true;
    void run(async () => {
      try {
        await post({
          action: "turn",
          id: current.id,
          version: current.version,
          answer: text,
        });
        setAnswer("");
        composer.current?.focus();
      } catch (e) {
        if (!preview) {
          const saved = await load(current.id);
          if (
            saved.messages.filter((m) => m.role === "user").at(-1)?.content ===
            text
          )
            setAnswer("");
        }
        throw e;
      }
    });
  }
  const checkpoint =
    session &&
    messages.filter(
      (m) => m.role === "user" && m.sequence > session.reviewed_through,
    ).length >= 5;
  return (
    <div className="interview-workspace">
      {preview && (
        <p className="interview-disclosure">
          Fictional demonstration · Domenik Wichmann · Layout preview only.
          These sample career facts are not owner evidence.
        </p>
      )}
      <div className="interview-heading">
        <div>
          <p className="eyebrow">Private career workspace</p>
          <h1>Career Interviews</h1>
          <p className="muted">
            Discover the work worth telling. Review it before it becomes career
            evidence.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => {
            setStarting(true);
            setGoal("");
            setError("");
            setNotice("");
          }}
        >
          New interview
        </button>
      </div>
      <div className="interview-shell">
        <aside className="interview-sessions" aria-label="Saved interviews">
          <details open ref={sessionPanel}>
            <summary>
              Saved interviews <span>{sessions.length}</span>
            </summary>
            {!sessions.length && (
              <p className="muted">Your conversations will be saved here.</p>
            )}
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    disabled={busy}
                    aria-current={
                      !starting && session?.id === s.id ? "page" : undefined
                    }
                    onClick={() => {
                      follow.current = true;
                      setDiscoveries(false);
                      setRenaming(false);
                      setAnswer("");
                      void run(async () => {
                        if (preview) {
                          if (initialSession)
                            setSession({
                              ...initialSession,
                              ...s,
                              state:
                                s.id === initialSession.id
                                  ? initialSession.state
                                  : emptyMemory(),
                              job_description:
                                s.id === initialSession.id
                                  ? initialSession.job_description
                                  : "",
                            });
                          setMessages(
                            s.id === initialSession?.id ? initialMessages : [],
                          );
                          setTitle(s.title);
                          setStarting(false);
                        } else await load(s.id);
                      });
                    }}
                  >
                    <strong>{s.title}</strong>
                    <span>
                      {s.turn_count} turns ·{" "}
                      {s.mode === "job" || s.mode === "role"
                        ? "Targeted"
                        : s.mode === "record"
                          ? "Deep dive"
                          : "General"}
                    </span>
                    <small>
                      {s.status.toLowerCase()} ·{" "}
                      {new Date(s.last_activity_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {hasMoreSessions && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch(
                      `/api/admin/interviews?offset=${listOffset}`,
                      { cache: "no-store" },
                    );
                    if (!response.ok)
                      throw new Error("Cannot load earlier sessions.");
                    const rows = z
                      .array(sessionListSchema)
                      .parse((await response.json()).sessions);
                    setSessions((old) => [
                      ...old,
                      ...rows.filter(
                        (row) => !old.some((s) => s.id === row.id),
                      ),
                    ]);
                    setListOffset((old) => old + rows.length);
                    setHasMoreSessions(rows.length === 50);
                  })
                }
              >
                Load earlier sessions
              </button>
            )}
          </details>
        </aside>
        <section
          className="interview-primary"
          aria-label={
            starting ? "Start an interview" : "Interview conversation"
          }
        >
          {starting ? (
            <form className="interview-start" onSubmit={start}>
              <p className="eyebrow">A conversation with a purpose</p>
              <h2>What would you like to work on?</h2>
              <fieldset>
                <legend className="sr-only">Interview mode</legend>
                {Object.entries(modes).map(([key, label]) => (
                  <label key={key} className="interview-mode">
                    <input
                      type="radio"
                      name="mode"
                      value={key}
                      checked={mode === key}
                      onChange={() => {
                        setMode(key as Session["mode"]);
                        setGoal("");
                      }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {mode === "role" && (
                <label>
                  What kind of role are you targeting?
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Senior Analyst, AI Transformation…"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </label>
              )}
              {mode === "job" && (
                <label>
                  Paste the job description
                  <textarea
                    required
                    maxLength={16000}
                    rows={8}
                    placeholder="Requirements, responsibilities, and context…"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </label>
              )}
              {mode === "record" && (
                <label>
                  Choose a project, experience, or achievement
                  <select
                    required
                    value={record}
                    onChange={(e) => setRecord(e.target.value)}
                  >
                    <option value="">Choose a record</option>
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} · {r.kind}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button disabled={busy}>Start interview</button>
              <p className="muted">
                The interviewer can search your private Career Brain. Answers
                stay private. Discoveries require your review; nothing is
                published automatically.
              </p>
            </form>
          ) : (
            session && (
              <>
                <header className="interview-session-heading">
                  <div>
                    <p className="eyebrow">
                      {session.mode === "record"
                        ? "Record deep dive"
                        : session.mode === "general"
                          ? "General discovery"
                          : "Targeted interview"}
                    </p>
                    <h2>{session.title}</h2>
                  </div>
                  <details className="interview-actions">
                    <summary>Session actions</summary>
                    <div>
                      <button
                        disabled={busy}
                        className="secondary"
                        onClick={() => setRenaming(!renaming)}
                      >
                        Rename
                      </button>
                      <button
                        disabled={busy}
                        className="secondary"
                        onClick={() =>
                          void run(async () => {
                            await post({
                              action: "status",
                              id: session.id,
                              version: session.version,
                              status:
                                session.status === "ARCHIVED"
                                  ? "ACTIVE"
                                  : "ARCHIVED",
                            });
                          }, session.id)
                        }
                      >
                        {session.status === "ARCHIVED"
                          ? "Restore session"
                          : "Archive session"}
                      </button>
                    </div>
                  </details>
                </header>
                {renaming && (
                  <form
                    className="interview-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await post({
                          action: "rename",
                          id: session.id,
                          version: session.version,
                          title,
                        });
                        setRenaming(false);
                      }, session.id);
                    }}
                  >
                    <label>
                      Session title
                      <input
                        maxLength={160}
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </label>
                    <button disabled={busy}>Save title</button>
                  </form>
                )}
                <details className="interview-context" ref={contextPanel}>
                  <summary>
                    Interview context · {session.turn_count} turns ·{" "}
                    {session.state.focus || "Finding a useful starting point"}
                  </summary>
                  <div>
                    <p>
                      <strong>Target</strong>
                      <br />
                      {session.target_role || session.title}
                    </p>
                    <p>
                      <strong>Current focus</strong>
                      <br />
                      {session.state.focus || "Career discovery"}
                    </p>
                    <p>{session.state.topics.length} topics explored</p>
                    {session.job_description && (
                      <details>
                        <summary>Job description</summary>
                        <p className="interview-job">
                          {session.job_description}
                        </p>
                      </details>
                    )}
                    {!!session.state.requirements.length && (
                      <>
                        <h3>Evidence for the target</h3>
                        <ul>
                          {session.state.requirements.map((r, i) => (
                            <li key={i}>
                              <strong>{r.requirement}</strong>
                              <br />
                              {labels[r.strength]}
                              {r.improved && (
                                <small>
                                  New detail found in this interview · awaiting
                                  review
                                </small>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!!session.state.denials.length && (
                      <p className="muted">
                        Topics set aside: {session.state.denials.join("; ")}
                      </p>
                    )}
                  </div>
                </details>
                <div
                  className="interview-conversation"
                  ref={conversation}
                  onScroll={(e) => {
                    const box = e.currentTarget;
                    follow.current =
                      box.scrollHeight - box.scrollTop - box.clientHeight < 100;
                  }}
                >
                  {hasEarlierMessages && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          follow.current = false;
                          await load(session.id, messages[0].sequence);
                        })
                      }
                    >
                      Load earlier messages
                    </button>
                  )}
                  {messages.map((m) => (
                    <article
                      key={m.id}
                      className={`interview-message interview-${m.role}`}
                    >
                      <p className="interview-speaker">
                        {m.role === "assistant" ? "Career interviewer" : "You"}
                      </p>
                      <SafeMarkdown text={m.content} />
                      {m.role === "assistant" && m.rationale && (
                        <details className="interview-rationale">
                          <summary>Why I’m asking</summary>
                          <p>{m.rationale}</p>
                        </details>
                      )}
                    </article>
                  ))}
                  <div
                    className="interview-thinking"
                    role="status"
                    aria-live="polite"
                  >
                    {busy ? "Working with your career evidence…" : ""}
                  </div>
                </div>
                {checkpoint && !discoveries && (
                  <div className="interview-checkpoint">
                    <p>A useful set of answers is ready to review.</p>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() => setDiscoveries(true)}
                    >
                      Review discoveries
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setDiscoveries(false);
                        composer.current?.focus();
                      }}
                    >
                      Keep interviewing
                    </button>
                  </div>
                )}
                {discoveries && (
                  <section className="interview-discoveries">
                    <div className="interview-section-heading">
                      <h3>Temporary discoveries</h3>
                      <button
                        className="secondary"
                        onClick={() => setDiscoveries(false)}
                      >
                        Back to conversation
                      </button>
                    </div>
                    <p className="muted">
                      Working notes from your answers. Career Brain changes
                      still require a reviewed import.
                    </p>
                    {!session.state.findings.length && (
                      <p>
                        The exact answers below will be used for extraction,
                        even if no working notes were generated.
                      </p>
                    )}
                    <ul>
                      {session.state.findings.map((f, i) => (
                        <li key={i}>
                          <p>{f.note}</p>
                          <blockquote>{f.quote}</blockquote>
                        </li>
                      ))}
                    </ul>
                    <button
                      disabled={busy || session.status === "ARCHIVED"}
                      onClick={() =>
                        void run(async () => {
                          await post({
                            action: "review",
                            id: session.id,
                            version: session.version,
                            finish: false,
                          });
                        }, session.id)
                      }
                    >
                      Prepare reviewed Career Brain import
                    </button>
                    {session.last_import_id && (
                      <p>
                        <Link
                          href={`/admin/career?import=${session.last_import_id}`}
                        >
                          Open Career Brain review →
                        </Link>
                      </p>
                    )}
                    {importStatus === "APPLIED" &&
                      ["role", "job"].includes(session.mode) && (
                        <p>
                          <Link href="/admin/applications">
                            Re-run job match & generate updated résumé →
                          </Link>
                        </p>
                      )}
                  </section>
                )}
                {active ? (
                  awaiting ? (
                    <div className="interview-retry">
                      <p>
                        {messages.length
                          ? "Your answer is saved. Continue to get the next question."
                          : "This session is saved. Start the conversation."}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await post({
                              action: "turn",
                              id: session.id,
                              version: session.version,
                              answer: null,
                            });
                          }, session.id)
                        }
                      >
                        Continue interview
                      </button>
                    </div>
                  ) : (
                    <form className="interview-composer" onSubmit={send}>
                      <label className="sr-only" htmlFor="interview-answer">
                        Your answer
                      </label>
                      <textarea
                        id="interview-answer"
                        ref={composer}
                        value={answer}
                        rows={3}
                        maxLength={6000}
                        disabled={busy}
                        placeholder="Type naturally. Estimates and uncertainty are welcome…"
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) =>
                          submitComposerOnEnter(e, !busy && !!answer.trim())
                        }
                      />
                      <div>
                        <small>
                          Enter to send · Shift+Enter for a new line
                        </small>
                        <button disabled={busy || !answer.trim()}>
                          Send answer
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  <p className="interview-closed">
                    {session.status === "ARCHIVED"
                      ? "Archived. Your full transcript is preserved."
                      : "Interview finished. Your answers and review drafts are preserved."}
                  </p>
                )}
                <footer className="interview-footer">
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => setDiscoveries(!discoveries)}
                  >
                    Discoveries
                  </button>
                  {active && (
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        void run(async () => {
                          await post({
                            action: "review",
                            id: session.id,
                            version: session.version,
                            finish: true,
                          });
                        }, session.id)
                      }
                    >
                      Finish interview & review discoveries
                    </button>
                  )}
                  {session.last_import_id && (
                    <Link
                      href={`/admin/career?import=${session.last_import_id}`}
                    >
                      Review draft →
                    </Link>
                  )}
                </footer>
              </>
            )
          )}
          {error && (
            <p className="interview-alert" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="interview-alert" role="status">
              {notice}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
