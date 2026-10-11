"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  browserListWorkspaces,
  browserCreateWorkspace,
  browserDeleteWorkspace,
} from "@/lib/workspaces/browser";
import type { Workspace } from "@/lib/workspaces/model";
export function WorkspaceList({ question = "" }: { question?: string }) {
  const questionQuery = question
    ? `?question=${encodeURIComponent(question)}`
    : "";
  const [items, setItems] = useState<
      Pick<Workspace, "id" | "title" | "market" | "updated_at">[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    browserListWorkspaces()
      .then((saved) => {
        if (!cancelled) setItems(saved);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Cannot load saved chats.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return (
    <div>
      <div className="workspace-list">
        {items.map((workspace) => (
          <article className="project-card" key={workspace.id}>
            <p className="eyebrow">{workspace.market} presentation</p>
            <h2>{workspace.title}</h2>
            <p className="muted">
              Last updated {new Date(workspace.updated_at).toLocaleDateString()}
            </p>
            <div className="workspace-actions">
              <Link
                className="button"
                href={`/workspace/${workspace.id}${questionQuery}`}
              >
                Resume workspace ↗
              </Link>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await browserDeleteWorkspace(workspace.id);
                    setItems(await browserListWorkspaces());
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Cannot delete workspace.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete workspace
              </button>
            </div>
          </article>
        ))}
      </div>
      {loading && <p role="status">Loading your saved chats…</p>}
      {!loading && !error && !items.length && (
        <p>No saved chats in this browser. Start with a role or a question.</p>
      )}
      <button
        disabled={loading || Boolean(error) || busy || items.length >= 2}
        onClick={async () => {
          setBusy(true);
          try {
            const workspace = await browserCreateWorkspace();
            router.push(`/workspace/${workspace.id}${questionQuery}`);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Cannot create workspace.",
            );
            setBusy(false);
          }
        }}
      >
        Start a workspace ↗
      </button>
      <p className="muted">
        {items.length} of 2 slots used. Deleting a workspace removes its saved
        questions and projections.
      </p>
      {error && (
        <div role="alert" className="error">
          {error}
          <button
            type="button"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt(attempt + 1);
            }}
          >
            Retry loading chats
          </button>
        </div>
      )}
    </div>
  );
}
