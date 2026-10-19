"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applicationAction,
  continueApplicationGeneration,
} from "@/lib/applications/client";

export function ResumeRegenerateButton({
  applicationId,
  disabled = false,
}: {
  applicationId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function regenerate() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Starting a new résumé for the same job…");
    try {
      let id = previewId;
      if (!id) {
        const prepared = await applicationAction({
          action: "regenerate",
          id: applicationId,
        });
        if (!prepared.preview_id)
          throw new Error("Cannot start regeneration. Try again.");
        id = prepared.preview_id;
        setPreviewId(id);
        try {
          localStorage.setItem("resume-application-draft", id);
        } catch {
          /* Storage is optional. */
        }
      }
      const state = await continueApplicationGeneration(id, (_stage, label) =>
        setMessage(label),
      );
      if (
        state.stage !== 4 ||
        !state.id ||
        !state.tracking_code ||
        !state.options
      )
        throw new Error(
          "Your new résumé is not saved yet. Retry regeneration to finish it.",
        );
      try {
        if (localStorage.getItem("resume-application-draft") === id)
          localStorage.removeItem("resume-application-draft");
      } catch {
        /* The saved version is available in history without storage. */
      }
      setPreviewId(null);
      setMessage("New résumé saved. Opening it…");
      router.push(`/admin/applications/${state.id}`);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to regenerate. Try again.",
      );
    } finally {
      setBusy(false);
      running.current = false;
    }
  }
  return (
    <div className="resume-regenerate-controls">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void regenerate()}
      >
        {busy
          ? "Regenerating…"
          : failed && previewId
            ? "Retry regeneration"
            : "Regenerate résumé"}
      </button>
      <p className="muted">
        New saved version and tracking link for the same job.
      </p>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </div>
  );
}
