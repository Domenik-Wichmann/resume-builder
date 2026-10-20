"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { applicationAction } from "@/lib/applications/client";
import { reuseInput } from "@/lib/applications/reuse-input";

export function ResumeReuseForm({
  applicationId,
  organization,
  role,
  disabled = false,
}: {
  applicationId: string;
  organization: string;
  role: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const prefix = useId();
  const running = useRef(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    const values = new FormData(event.currentTarget);
    const details = {
      action: "reuse" as const,
      id: applicationId,
      organization: String(values.get("organization") || "").trim(),
      role: String(values.get("role") || "").trim(),
      job_description: String(values.get("job_description") || "").trim(),
      learning_demo: String(values.get("learning_demo") || "").trim() || null,
    };
    // Repeating a request after a lost response opens the same saved copy.
    const fingerprint = JSON.stringify(details);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    const parsed = reuseInput.safeParse({
      ...details,
      request_id: request.current.id,
    });
    if (!parsed.success) {
      setFailed(true);
      setMessage(
        parsed.error.issues[0]?.message || "Check the form and try again.",
      );
      return;
    }
    running.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("Saving a copy with fresh links…");
    try {
      const result = await applicationAction(
        parsed.data,
        "The save response was interrupted. Retry with the same details to open the saved copy.",
      );
      if (!result.id || !result.tracking_code)
        throw new Error(
          "The save response was interrupted. Retry to open the same copy.",
        );
      setMessage("Saved. Opening your new résumé…");
      router.push(`/admin/applications/${result.id}`);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save. Please retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <details className="resume-reuse snapshot-note">
      <summary>Reuse résumé</summary>
      <p>
        Keep this résumé’s wording, layout and contact profile. Save a separate
        copy with a new tracking link. No AI rewriting.
      </p>
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={disabled || busy}>
          <div className="resume-reuse-fields">
            <label htmlFor={`${prefix}-company`}>
              Company
              <input
                id={`${prefix}-company`}
                name="organization"
                required
                maxLength={200}
                defaultValue={organization}
                autoComplete="organization"
              />
            </label>
            <label htmlFor={`${prefix}-role`}>
              Role
              <input
                id={`${prefix}-role`}
                name="role"
                required
                maxLength={200}
                defaultValue={role}
              />
            </label>
          </div>
          <label htmlFor={`${prefix}-learning`}>
            SystemWright LMS demo link
            <input
              id={`${prefix}-learning`}
              name="learning_demo"
              type="url"
              maxLength={2000}
              placeholder="https://…"
              aria-describedby={`${prefix}-learning-help`}
            />
          </label>
          <p className="muted" id={`${prefix}-learning-help`}>
            Paste the recipient’s learning link. Leave blank to remove the
            previous demo link. The LMS homepage link stays.
          </p>
          <label htmlFor={`${prefix}-description`}>
            Job description (optional)
            <textarea
              id={`${prefix}-description`}
              name="job_description"
              rows={3}
              maxLength={12000}
              placeholder="Save the new job description for reference. This will not rewrite the résumé."
            />
          </label>
          <button type="submit">
            {busy ? "Saving…" : "Regenerate links & save copy"}
          </button>
        </fieldset>
      </form>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </details>
  );
}
