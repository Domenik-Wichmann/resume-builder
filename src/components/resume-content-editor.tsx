"use client";
import { useState } from "react";
import {
  fixedContentSchema,
  type FixedContent,
} from "@/lib/resume-design/fixed-content";
export function ResumeContentEditor({
  initial,
}: {
  initial: FixedContent | null;
}) {
  const [value, setValue] = useState(
    initial ? JSON.stringify(initial, null, 2) : "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="surface editor-form">
      <h2>Fixed application content</h2>
      <p>
        The v4 projects stay in this order. Generation cannot rewrite these
        blocks. Header identity and contact details come from your career
        profile and market settings. Set learning_demo to an HTTPS learning-page
        URL, or leave it null to omit the optional link. record_id can bind a
        project to its canonical evidence for conflict review.
      </p>
      <label>
        Approved project text, links and invitations
        <textarea
          rows={18}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const content = fixedContentSchema.parse(JSON.parse(value));
            const response = await fetch("/api/admin/resume-content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setValue(JSON.stringify(result.content, null, 2));
            setMessage(
              "Saved for future applications. Historical snapshots retain their approved content.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Cannot save fixed content.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Save approved content
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
