"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  browserLoadWorkspace,
  browserWorkspaceAction,
} from "@/lib/workspaces/browser";
import type { Workspace } from "@/lib/workspaces/model";
import type { ResumeIR } from "@/lib/resume-ir";
import { ResumeRenderer } from "./resume-renderer";
import { exportWorkspaceText } from "@/lib/workspaces/export";
import type { Market } from "@/lib/markets";
export function WorkspaceView({
  id,
  market,
  exportView = false,
}: {
  id: string;
  market: Market;
  exportView?: boolean;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [ir, setIR] = useState<ResumeIR | null>(null),
    [input, setInput] = useState(""),
    [job, setJob] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    browserLoadWorkspace(id)
      .then((value) => {
        setWorkspace(value);
        setJob(value.job_description || "");
      })
      .catch((err) => setError(err.message));
  }, [id]);
  async function act(
    action: "ask" | "match" | "compile" | "export",
    text?: string,
  ) {
    if (!workspace) return;
    setBusy(true);
    setError("");
    try {
      const result = await browserWorkspaceAction(
        { ...workspace, market },
        action,
        text,
      );
      setWorkspace(result.workspace);
      if (result.ir) setIR(result.ir);
      else if (action === "ask" || action === "match") setIR(null);
      if (action === "ask") setInput("");
      if (action === "export") router.push(`/workspace/${id}/export`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  function textDownload() {
    if (!workspace) return;
    const url = URL.createObjectURL(
      new Blob([exportWorkspaceText(workspace)], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "career-workspace.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  if (!workspace)
    return (
      <div className="wrap prose" aria-live="polite">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Link href="/workspace">Back to workspaces</Link>
          </>
        ) : (
          <p>Loading your workspace…</p>
        )}
      </div>
    );
  if (exportView)
    return (
      <main id="main" className="workspace-export wrap">
        <div className="resume-toolbar">
          <Link href={`/workspace/${id}`}>← Workspace</Link>
          <div className="workspace-actions">
            <button onClick={textDownload}>Download text</button>
            <button onClick={() => window.print()}>
              Print / save workspace PDF ↗
            </button>
          </div>
        </div>
        <article className="resume-sheet">
          <h1>{workspace.title}</h1>
          {workspace.demo && (
            <p className="eyebrow">Demo workspace · fictional evidence</p>
          )}
          <p>{workspace.market} presentation</p>
          {workspace.job_description && (
            <section>
              <h2>Role requirements</h2>
              <p className="preserve-lines">{workspace.job_description}</p>
            </section>
          )}
          {workspace.match && (
            <section>
              <h2>Match findings</h2>
              <p>{workspace.match.overall_summary}</p>
              <h3>Supported matches</h3>
              <ul>
                {workspace.match.strong_matches.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>Evidence gaps</h3>
              <ul>
                {workspace.match.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2>Relevant career evidence</h2>
            {workspace.evidence.map((record, index) => (
              <div className="resume-record" key={index}>
                <h3>{record.title}</h3>
                <p>{record.subtitle}</p>
                <p>{record.summary}</p>
                <p>{record.skills.join(" · ")}</p>
              </div>
            ))}
          </section>
          <section>
            <h2>Questions & answers</h2>
            {workspace.questions.map((question, index) => (
              <div className="resume-record" key={index}>
                <h3>{question.question}</h3>
                <p>{question.answer}</p>
                <p className="muted">
                  Supporting evidence:{" "}
                  {question.evidence_ids
                    .flatMap((source) =>
                      workspace.evidence
                        .filter((record) => record.id === source)
                        .map((record) => record.title),
                    )
                    .join(" · ") || "No relevant evidence stored"}
                </p>
              </div>
            ))}
          </section>
        </article>
      </main>
    );
  async function ask(event: FormEvent) {
    event.preventDefault();
    await act("ask", input);
  }
  return (
    <main id="main" className="wrap workspace-main">
      <div className="workspace-top">
        <div>
          <p className="eyebrow">
            Persistent career workspace / {workspace.market}
          </p>
          <h1>
            {workspace.match
              ? "A candidate view for your role."
              : "Explore the evidence."}
          </h1>
          <p>
            {workspace.demo
              ? "Demo: saved in this browser only."
              : "Saved privately for this browser. Questions and topic signals are visible to the portfolio owner."}
          </p>
        </div>
        <div className="workspace-actions">
          <button disabled={busy} onClick={() => act("compile")}>
            Preview résumé ↗
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => act("export")}
          >
            Export workspace
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {ir && (
        <section className="resume-preview">
          <div className="resume-toolbar">
            <span>Compiled from the current workspace</span>
            <button onClick={() => window.print()}>
              Print / save résumé PDF ↗
            </button>
          </div>
          <ResumeRenderer ir={ir} />
        </section>
      )}
      <div className="workspace-grid">
        <section className="candidate-view">
          <p className="eyebrow">Structured candidate view</p>
          {workspace.match ? (
            <>
              <h2>Relevant capabilities</h2>
              <p>{workspace.match.overall_summary}</p>
              <div className="tags">
                {workspace.match.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <h3>Supported matches</h3>
              <ul>
                {workspace.match.strong_matches.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>Potential evidence gaps</h3>
              <ul>
                {workspace.match.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>Start with a question or role.</h2>
              <p>
                As you explore, relevant career records accumulate here. A
                résumé preview compiles those records into one clear document.
              </p>
            </>
          )}
          {workspace.evidence.length > 0 && (
            <>
              <h2>Relevant experience & projects</h2>
              {workspace.evidence.map((record) => (
                <article className="resume-record" key={record.id}>
                  <h3>{record.title}</h3>
                  <p className="muted">{record.subtitle}</p>
                  <p>{record.summary}</p>
                  <div className="tags">
                    {record.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </article>
              ))}
            </>
          )}
        </section>
        <aside className="workspace-conversation">
          <div className="ai-panel">
            <form onSubmit={ask}>
              <label htmlFor="follow-up">Ask a follow-up question</label>
              <textarea
                id="follow-up"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="What has this person built with SQL?"
              />
              <button disabled={busy || workspace.questions.length >= 50}>
                {busy ? "Reviewing evidence…" : "Explore this question ↗"}
              </button>
            </form>
            <p className="muted">
              Questions influence future résumé emphasis. They never become
              résumé claims.
            </p>
            <div aria-live="polite">
              {workspace.questions.map((question, index) => (
                <article className="question-answer" key={index}>
                  <h3>{question.question}</h3>
                  <p>{question.answer}</p>
                  <small>
                    {question.evidence_ids.length} supporting records
                  </small>
                </article>
              ))}
            </div>
          </div>
          <details className="job-editor" open={!workspace.job_description}>
            <summary>
              {workspace.job_description
                ? "Update role requirements"
                : "Add a job description"}
            </summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void act("match", job);
              }}
            >
              <label htmlFor="workspace-job">Role requirements</label>
              <textarea
                id="workspace-job"
                rows={7}
                value={job}
                onChange={(event) => setJob(event.target.value)}
                minLength={3}
                maxLength={12000}
                required
              />
              <button disabled={busy}>Analyze into this workspace ↗</button>
            </form>
          </details>
        </aside>
      </div>
    </main>
  );
}
