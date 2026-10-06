"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HumanVerification } from "./human-verification";
import { submitComposerOnEnter } from "@/lib/workspaces/input";
import {
  browserCreateWorkspace,
  browserWorkspaceAction,
} from "@/lib/workspaces/browser";
export function AIPanel({ kind }: { kind: "ask" | "match" }) {
  const [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [createdId, setCreatedId] = useState<string | null>(null);
  const router = useRouter();
  const lock = useRef(false);
  const canSubmit = !busy && !createdId && input.trim().length >= 3;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !canSubmit) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const workspace = await browserCreateWorkspace();
      setCreatedId(workspace.id);
      await browserWorkspaceAction(workspace, kind, input);
      router.push(`/workspace/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setBusy(false);
    } finally {
      lock.current = false;
    }
  }
  return (
    <div className="ai-panel">
      <HumanVerification />
      <form onSubmit={submit}>
        <label htmlFor={kind}>
          {kind === "ask"
            ? "What would you like to know?"
            : "Paste the role requirements"}
        </label>
        <textarea
          id={kind}
          rows={kind === "ask" ? 3 : 6}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => submitComposerOnEnter(event, canSubmit)}
          disabled={busy || Boolean(createdId)}
          maxLength={kind === "ask" ? 1000 : 12000}
          minLength={3}
          required
          placeholder={
            kind === "ask"
              ? "What experience is there with SQL and automation?"
              : "We need SQL, React, and experience building internal tools."
          }
        />
        <div className="form-footer">
          <span>
            Creates a workspace. Questions are saved in live mode for
            exploration and owner topic analytics.
          </span>
          <button disabled={!canSubmit}>
            {busy
              ? "Opening your workspace..."
              : kind === "ask"
                ? "Start with a question"
                : "Explore the role"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {createdId && error && (
        <Link className="workspace-return" href={`/workspace/${createdId}`}>
          Open the created workspace to retry
        </Link>
      )}
      <Link className="workspace-return" href="/workspace">
        Resume or manage your saved workspaces
      </Link>
    </div>
  );
}
