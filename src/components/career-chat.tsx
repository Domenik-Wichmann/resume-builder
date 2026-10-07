"use client";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type FormEvent,
} from "react";
import Link from "next/link";
import type { Workspace } from "@/lib/workspaces/model";
import type { ResumeIR } from "@/lib/resume-ir";
import {
  browserCreateWorkspace,
  browserWorkspaceAction,
  browserWorkspaceSlots,
  browserLoadWorkspace,
  browserRememberWorkspaceSlot,
} from "@/lib/workspaces/browser";
import type { WorkspaceSlot, WorkspaceSlots } from "@/lib/workspaces/slots";
import {
  initialInputKind,
  submitComposerOnEnter,
} from "@/lib/workspaces/input";
import { rememberWorkspace } from "./explore-signal";
import { SafeMarkdown } from "./safe-markdown";
import { HumanVerification } from "./human-verification";
import { EvidenceMap } from "./evidence-map";
import { answerDisplay } from "@/lib/answer-display";
import { ResumeDocument } from "./resume-document";
import { ResumeRenderer } from "./resume-renderer";
import type { ResumeDesign } from "@/lib/resume-design/model";
import { RecruiterExplorer, type StudioPanel } from "./recruiter-explorer";

export function CareerChat({
  initialWorkspace = null,
  initialInput = "",
  design,
}: {
  initialWorkspace?: Workspace | null;
  initialInput?: string;
  design?: ResumeDesign;
}) {
  const [panel, setPanel] = useState<StudioPanel>("chat");
  const [openedPanels, setOpenedPanels] = useState<
    Exclude<StudioPanel, "chat">[]
  >([]);
  const [panelVersions, setPanelVersions] = useState({
    explorer: 0,
    projects: 0,
    answers: 0,
  });
  function selectPanel(next: StudioPanel) {
    if (next !== "chat") {
      if (next === panel) {
        setPanelVersions((versions) => ({
          ...versions,
          [next]: versions[next] + 1,
        }));
      } else {
        setOpenedPanels((opened) =>
          opened.includes(next) ? opened : [...opened, next],
        );
      }
    }
    setPanel(next);
  }
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [ir, setIR] = useState<ResumeIR | null>(null);
  const [input, setInput] = useState(initialInput);
  const [mode, setMode] = useState<"auto" | "ask" | "match">("auto");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    input: string;
    kind: "ask" | "match";
  } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<WorkspaceSlots>([null, null]);
  const [slot, setSlot] = useState<WorkspaceSlot>(0);
  const [slotsReady, setSlotsReady] = useState(false);
  const [slotsAttempt, setSlotsAttempt] = useState(0);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [evidenceCollapsed, setEvidenceCollapsed] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const messageField = useRef<HTMLTextAreaElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const pendingMessage = useRef<HTMLElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    const draft = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== "string" || detail.length > 1000 || lock.current)
        return;
      setPanel("chat");
      setInput(detail);
      setMode("ask");
      messageField.current?.focus({ preventScroll: true });
    };
    window.addEventListener("portfolio-question", draft);
    return () => window.removeEventListener("portfolio-question", draft);
  }, []);
  useEffect(() => {
    let cancelled = false;
    browserWorkspaceSlots()
      .then(async (available) => {
        const remembered =
          initialWorkspace?.id ||
          sessionStorage.getItem("rb_selected_workspace");
        const selected: WorkspaceSlot =
          available[1] && (available[1] === remembered || !available[0])
            ? 1
            : 0;
        const id = available[selected];
        const loaded = id
          ? initialWorkspace?.id === id
            ? initialWorkspace
            : await browserLoadWorkspace(id)
          : null;
        if (cancelled) return;
        setSlots(available);
        setSlot(selected);
        setWorkspace(loaded);
        setSlotsReady(true);
        if (loaded) rememberWorkspace(loaded.id);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Cannot load workspaces. Reload to try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [initialWorkspace, slotsAttempt]);
  useLayoutEffect(() => {
    const field = messageField.current;
    if (!field) return;
    const resize = () => {
      field.style.height = "auto";
      const limit = Math.min(360, Math.max(100, window.innerHeight * 0.45));
      field.style.height = `${Math.min(field.scrollHeight, limit)}px`;
      field.style.overflowY = field.scrollHeight > limit ? "auto" : "hidden";
    };
    resize();
    let width = field.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = field.getBoundingClientRect().width;
      if (Math.abs(nextWidth - width) < 0.5) return;
      width = nextWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [input]);
  useLayoutEffect(() => {
    const container = results.current;
    const message = pendingMessage.current;
    if (!pending || !container || !message || panel !== "chat") return;
    // Scroll only this conversation, without moving the page or its side panels.
    container.scrollTo({
      top:
        container.scrollTop +
        message.getBoundingClientRect().top -
        container.getBoundingClientRect().top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [pending, panel]);
  const started = Boolean(
    workspace?.questions.length || workspace?.job_description,
  );
  const kind =
    mode === "auto" ? (started ? "ask" : initialInputKind(input)) : mode;
  const canSubmit =
    !busy &&
    slotsReady &&
    input.trim().length >= 3 &&
    (kind !== "ask" ||
      (input.length <= 1000 && (workspace?.questions.length || 0) < 50));
  async function switchWorkspace(next: WorkspaceSlot) {
    if (lock.current || next === slot) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const available = await browserWorkspaceSlots();
      const id = available[next];
      const loaded = id ? await browserLoadWorkspace(id) : null;
      setSlots(available);
      setSlot(next);
      setWorkspace(loaded);
      setIR(null);
      setInput("");
      setMode("auto");
      if (loaded) rememberWorkspace(loaded.id);
      else sessionStorage.removeItem("rb_selected_workspace");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cannot switch workspaces.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function compile(value: Workspace) {
    setStatus("Composing your résumé from published evidence…");
    const result = await browserWorkspaceAction(value, "compile");
    setWorkspace(result.workspace);
    if (result.ir) setIR(result.ir);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !canSubmit) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const submitted = { input, kind };
    const submittedMode = mode;
    let committed = false;
    setPending(submitted);
    setInput("");
    messageField.current?.focus();
    try {
      const existing = slots[slot];
      const current =
        workspace && workspace.id === existing
          ? workspace
          : existing
            ? await browserLoadWorkspace(existing)
            : await browserCreateWorkspace();
      setWorkspace(current);
      browserRememberWorkspaceSlot(current.id, slot);
      setSlots((previous) =>
        slot === 0 ? [current.id, previous[1]] : [previous[0], current.id],
      );
      rememberWorkspace(current.id);
      const result = await browserWorkspaceAction(
        current,
        submitted.kind,
        submitted.input,
      );
      committed = true;
      setWorkspace(result.workspace);
      setPending(null);
      setIR(null);
      setMode("auto");
      if (submitted.kind === "match") await compile(result.workspace);
    } catch (err) {
      // A failed preview must not turn a persisted role match into a second send.
      if (!committed) {
        setInput(submitted.input);
        setMode(submittedMode);
      }
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(null);
      lock.current = false;
      setBusy(false);
      setStatus("");
    }
  }
  async function preview() {
    if (!workspace || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await compile(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot compile résumé.");
    } finally {
      lock.current = false;
      setBusy(false);
      setStatus("");
    }
  }
  return (
    <div
      className={`career-studio${explorerCollapsed ? " explorer-collapsed" : ""}${evidenceCollapsed ? " evidence-collapsed" : ""}${evidenceExpanded ? " evidence-expanded" : ""}`}
    >
      <aside
        className={`explorer-rail${explorerCollapsed ? " is-collapsed" : ""}`}
        aria-label="Career explorer"
      >
        <div className="rail-heading">
          <span className="eyebrow">Career explorer</span>
          <button
            type="button"
            className="rail-toggle"
            aria-controls="explorer-panel-content"
            aria-expanded={!explorerCollapsed}
            aria-label={
              explorerCollapsed
                ? "Expand career explorer"
                : "Collapse career explorer"
            }
            title={
              explorerCollapsed
                ? "Expand career explorer"
                : "Collapse career explorer"
            }
            onClick={() => setExplorerCollapsed(!explorerCollapsed)}
          >
            {explorerCollapsed ? "›" : "‹"}
          </button>
        </div>
        <div id="explorer-panel-content" hidden={explorerCollapsed}>
          <Link className="studio-brand" href="/">
            career<span> / </span>connected
          </Link>
          <nav aria-label="Career explorer">
            {(
              [
                ["chat", "✧", "Ask anything"],
                ["explorer", "⌘", "Career explorer"],
                ["projects", "□", "Projects"],
                ["answers", "↗", "Quick answers"],
              ] as const
            ).map(([value, icon, label]) => (
              <button
                type="button"
                key={value}
                aria-current={panel === value ? "page" : undefined}
                onClick={() => selectPanel(value)}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
            <Link href="/resume">
              <span>≡</span> Full résumé
            </Link>
          </nav>
          <div className="rail-bottom">
            <p>
              One career.
              <br />A view shaped around your questions.
            </p>
            <Link href="/workspace">Saved workspaces ↗</Link>
            <Link href="/privacy">Privacy & data</Link>
          </div>
        </div>
      </aside>
      <section
        id="ask"
        className="chat-column"
        aria-label="Career conversation"
      >
        {openedPanels.map((opened) => (
          <div
            className="catalog-view"
            hidden={panel !== opened}
            key={`${opened}-${panelVersions[opened]}`}
          >
            <RecruiterExplorer panel={opened} />
          </div>
        ))}
        <div className="chat-view" hidden={panel !== "chat"}>
          <form id="composer" className="chat-composer" onSubmit={submit}>
            <div className="chat-input-shell">
              <label className="sr-only" htmlFor="career-message">
                Ask a question or paste a job description
              </label>
              <textarea
                ref={messageField}
                id="career-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => submitComposerOnEnter(event, canSubmit)}
                placeholder={
                  started
                    ? "Ask a follow-up question…"
                    : "Ask a question or paste a job description…"
                }
                minLength={3}
                maxLength={12000}
                required
                rows={1}
                readOnly={busy}
                disabled={!slotsReady}
              />
              <button
                className="composer-send"
                type="submit"
                disabled={!canSubmit}
                aria-busy={busy}
                aria-label={
                  kind === "match" ? "Build tailored résumé" : "Send question"
                }
              >
                {busy ? "…" : "↑"}
              </button>
            </div>
            <div className="composer-tools">
              <label>
                <span className="sr-only">Message type</span>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as typeof mode)
                  }
                  disabled={busy || !slotsReady}
                >
                  <option value="auto">
                    {started
                      ? "Follow-up question"
                      : "Auto-detect first message"}
                  </option>
                  <option value="ask">Question</option>
                  <option value="match">Job description</option>
                </select>
              </label>
              <div className="workspace-tools">
                <details className="workspace-privacy">
                  <summary
                    title={
                      workspace?.demo
                        ? "Fictional demo evidence; workspaces are saved in this browser only."
                        : "Questions and topics are saved privately and visible to the portfolio owner."
                    }
                  >
                    Privacy
                  </summary>
                  <div className="workspace-privacy-note">
                    <p>
                      {workspace?.demo
                        ? "Fictional demo evidence. Workspaces are saved only in this browser."
                        : "Questions and topics are saved privately for this browser and can be reviewed by the portfolio owner."}
                    </p>
                    <Link href="/privacy">Privacy & data ↗</Link>
                  </div>
                </details>
                <label>
                  <span className="sr-only">Workspace</span>
                  <select
                    aria-label="Workspace"
                    title={
                      slots[slot]
                        ? "Saved workspace"
                        : "This workspace starts when you send a message"
                    }
                    value={slot}
                    disabled={busy || !slotsReady}
                    onChange={(event) =>
                      void switchWorkspace(event.target.value === "1" ? 1 : 0)
                    }
                  >
                    <option value="0">Workspace 1</option>
                    <option value="1">Workspace 2</option>
                  </select>
                </label>
              </div>
            </div>
          </form>
          {input.trim() && (
            <div className="composer-note">
              <span>
                {input.trim()
                  ? `Sending as ${kind === "match" ? "a job description" : "a question"}.`
                  : ""}
                {kind === "ask" && input.length > 1000
                  ? " Questions are limited to 1,000 characters; choose Job description for a role."
                  : ""}
              </span>
            </div>
          )}
          <HumanVerification />
          {status && (
            <div role="status" className="chat-status">
              {status}
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}{" "}
              {!slotsReady && (
                <button
                  type="button"
                  className="workspace-load-retry"
                  onClick={() => {
                    setError("");
                    setSlotsAttempt((attempt) => attempt + 1);
                  }}
                >
                  Retry
                </button>
              )}{" "}
              <Link href="/workspace">Manage workspaces</Link>
            </p>
          )}
          <div className="chat-results" ref={results}>
            {ir &&
              (design ? (
                <ResumeRenderer ir={ir} design={design} />
              ) : (
                <ResumeDocument ir={ir} />
              ))}
            {workspace?.match && (
              <article className="chat-answer">
                {workspace.job_description && (
                  <p className="question-bubble">
                    <span className="sr-only">You: </span>
                    {workspace.job_description}
                  </p>
                )}
                <p className="eyebrow">Role fit</p>
                <h3>Where the experience connects</h3>
                <SafeMarkdown
                  bulletLists
                  text={answerDisplay(workspace.match.overall_summary)}
                />
                <h4>Supported matches</h4>
                <ul>
                  {workspace.match.strong_matches.map((item, i) => (
                    <li key={i}>
                      <SafeMarkdown bulletLists text={answerDisplay(item)} />
                    </li>
                  ))}
                </ul>
                {workspace.match.gaps.length > 0 && (
                  <>
                    <h4>Evidence gaps</h4>
                    <ul>
                      {workspace.match.gaps.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            )}
            {[
              ...(workspace?.questions || []),
              ...(pending ? [{ question: pending.input, answer: null }] : []),
            ].map((question, index) => (
              <article
                className={`chat-answer${question.answer === null ? " pending-answer" : ""}`}
                key={index}
                ref={question.answer === null ? pendingMessage : undefined}
              >
                <p className="question-bubble">
                  <span className="sr-only">You: </span>
                  {question.question}
                </p>
                {question.answer === null ? (
                  <div className="answer-waiting" role="status">
                    <span className="sr-only">Waiting for an answer</span>
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </div>
                ) : (
                  <div className="answer-content">
                    <SafeMarkdown
                      bulletLists
                      text={answerDisplay(question.answer)}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
          {started && (
            <div className="conversation-footer">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={preview}
              >
                {ir ? "Refresh résumé" : "Preview résumé"}
              </button>
              {ir && (
                <button
                  className="secondary-button"
                  onClick={() => window.print()}
                >
                  Print résumé / PDF
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      <EvidenceMap
        key={workspace?.id || `empty-${slot}`}
        records={workspace?.evidence || []}
        busy={busy}
        collapsed={evidenceCollapsed}
        expanded={evidenceExpanded}
        onExpand={() => setEvidenceExpanded(!evidenceExpanded)}
        onToggle={() => {
          setEvidenceExpanded(false);
          setEvidenceCollapsed(!evidenceCollapsed);
        }}
      />
    </div>
  );
}
