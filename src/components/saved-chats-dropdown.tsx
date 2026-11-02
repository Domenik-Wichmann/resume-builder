"use client";
import { useEffect, useRef, useState } from "react";
import { browserListWorkspaces } from "@/lib/workspaces/browser";
import type { WorkspaceSlots, WorkspaceSlot } from "@/lib/workspaces/slots";

export function SavedChatsDropdown({
  slots,
  activeSlot,
  busy,
  ready,
  onSelect,
}: {
  slots: WorkspaceSlots;
  activeSlot: WorkspaceSlot;
  busy: boolean;
  ready: boolean;
  onSelect: (slot: WorkspaceSlot) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    browserListWorkspaces()
      .then((items) => {
        if (!cancelled) {
          setNames(
            Object.fromEntries(items.map((item) => [item.id, item.title])),
          );
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Chat names could not load. You can still choose a saved chat below.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [open, ready]);
  function choose(slot: WorkspaceSlot) {
    if (busy || !ready) return;
    onSelect(slot);
    if (details.current) details.current.open = false;
  }
  const emptySlot = slots.findIndex((id) => id === null);
  return (
    <details
      ref={details}
      className="saved-chats-dropdown"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span aria-hidden="true">↺</span> Saved chats{" "}
        <span className="saved-chat-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div
        className="saved-chats-list"
        aria-label="Saved chats in this browser"
      >
        {!ready ? (
          <p role="status">Loading chats…</p>
        ) : (
          <>
            {!slots.some(Boolean) && <p>No saved chats yet.</p>}
            {slots.map(
              (id, index) =>
                id && (
                  <button
                    type="button"
                    key={id}
                    disabled={busy}
                    aria-current={activeSlot === index ? "true" : undefined}
                    onClick={() => choose(index as WorkspaceSlot)}
                  >
                    <strong>{names[id] || `Chat ${index + 1}`}</strong>
                    <small>
                      Chat {index + 1}
                      {activeSlot === index ? " · Current" : ""}
                    </small>
                  </button>
                ),
            )}
            {emptySlot !== -1 && (
              <button
                type="button"
                className="saved-chat-new"
                disabled={busy}
                onClick={() => choose(emptySlot as WorkspaceSlot)}
              >
                ＋ New chat
              </button>
            )}
            {error && <p role="status">{error}</p>}
          </>
        )}
      </div>
    </details>
  );
}
