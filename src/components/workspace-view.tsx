"use client";
import { useEffect, useState } from "react";

import Link from "next/link";
import { browserLoadWorkspace } from "@/lib/workspaces/browser";
import type { Workspace } from "@/lib/workspaces/model";

import type { ResumeDesign } from "@/lib/resume-design/model";
import { CareerChat } from "./career-chat";
import { exportWorkspaceText } from "@/lib/workspaces/export";
import type { Market } from "@/lib/markets";

import { rememberWorkspace } from "./explore-signal";
export function WorkspaceView({
  id,
  exportView = false,
  design,
}: {
  id: string;
  market: Market;
  exportView?: boolean;
  design?: ResumeDesign;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [input, setInput] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    browserLoadWorkspace(id)
      .then((value) => {
        rememberWorkspace(id);
        setInput(
          new URLSearchParams(window.location.search)
            .get("question")
            ?.slice(0, 1000) || "",
        );
        setWorkspace(value);
      })
      .catch((err) => setError(err.message));
  }, [id]);
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
  return (
    <main id="main" className="public-experience">
      <CareerChat
        initialWorkspace={workspace}
        initialInput={input}
        design={design}
      />
    </main>
  );
}
