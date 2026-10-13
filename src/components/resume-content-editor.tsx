"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  fixedContentSchema,
  fixedProjectSchema,
  type FixedContent,
} from "@/lib/resume-design/fixed-content";
export function ResumeContentEditor({
  initial,
}: {
  initial: FixedContent | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    initial ? JSON.stringify(initial, null, 2) : "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [addition, setAddition] = useState("");
  let projectCount: number | null = null;
  let bulletCount = 0;
  try {
    const parsed = fixedContentSchema.safeParse(JSON.parse(value));
    if (parsed.success) {
      projectCount = parsed.data.projects.length;
      bulletCount = parsed.data.projects.reduce(
        (total, project) => total + project.bullets.length,
        0,
      );
    }
  } catch {
    /* Count updates once the edited JSON is valid. */
  }
  return (
    <section className="surface editor-form">
      <h2>Fixed application content</h2>
      <p>
        Fixed projects appear in the order listed. Generation cannot rewrite
        these blocks. Header identity and contact details come from your career
        profile and market settings. Set learning_demo to an HTTPS learning-page
        URL, or leave it null to omit the optional link. record_id can bind a
        project to its canonical evidence for conflict review. There is no
        project or bullet count cap. The personal_portfolio block gets your
        tracking link; learning_demo applies only to the block with id lms.
      </p>
      <p className="resume-badge" role="status" aria-live="polite">
        {projectCount === null
          ? "Item count available when the JSON is valid"
          : `${projectCount} fixed ${projectCount === 1 ? "project" : "projects"} · ${bulletCount} ${bulletCount === 1 ? "bullet" : "bullets"}`}
      </p>
      <label>
        Approved project text, links and invitations
        <textarea
          aria-label="Approved project text, links and invitations"
          rows={18}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <details className="admin-overview-details">
        <summary>Add a fixed project</summary>
        <p>
          Paste one project object below. Add it to your draft, review the
          updated count, then save approved content.
        </p>
        <label>
          New project JSON
          <textarea
            rows={10}
            value={addition}
            onChange={(event) => setAddition(event.target.value)}
            placeholder={
              '{ "id": "your-project", "record_id": null, "title": "Project name", "metadata": "Your role and scope", "bullets": ["Your approved text"], "homepage": null }'
            }
          />
        </label>
        <button
          type="button"
          disabled={busy || !addition.trim()}
          onClick={() => {
            try {
              const content = fixedContentSchema.parse(JSON.parse(value));
              const project = fixedProjectSchema.parse(JSON.parse(addition));
              const next = fixedContentSchema.parse({
                ...content,
                projects: [...content.projects, project],
              });
              setValue(JSON.stringify(next, null, 2));
              setAddition("");
              setMessage(
                `Added ${project.title} to your draft. Save approved content to use it in future applications.`,
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Check the project JSON.",
              );
            }
          }}
        >
          Add project to draft
        </button>
      </details>
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
            router.refresh();
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
