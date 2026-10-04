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
export function WorkspaceList() {
  const [items, setItems] = useState<
      Pick<Workspace, "id" | "title" | "market" | "updated_at">[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    browserListWorkspaces()
      .then(setItems)
      .catch((err) => setError(err.message));
  }, []);
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
              <Link className="button" href={`/workspace/${workspace.id}`}>
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
      {!items.length && (
        <p>No saved workspaces yet. Start with a role or a question.</p>
      )}
      <button
        disabled={busy || items.length >= 2}
        onClick={async () => {
          setBusy(true);
          try {
            const workspace = await browserCreateWorkspace();
            router.push(`/workspace/${workspace.id}`);
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
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
