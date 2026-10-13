"use client";
import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  fixedContentSchema,
  fixedProjectSchema,
  type FixedContent,
} from "@/lib/resume-design/fixed-content";
const bindingIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  record_id: z.uuid(),
});
const saveResultSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
  content: fixedContentSchema.optional(),
  invalid_bindings: z.array(bindingIssueSchema).optional(),
  project_options: z
    .array(z.object({ id: z.uuid(), title: z.string() }))
    .optional(),
});
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
  const [version, setVersion] = useState(initial?.version || 0);
  const [bindingIssues, setBindingIssues] = useState<
    z.infer<typeof bindingIssueSchema>[]
  >([]);
  const [projectOptions, setProjectOptions] = useState<
    { id: string; title: string }[]
  >([]);
  const [stale, setStale] = useState(false);
  const [latest, setLatest] = useState<FixedContent | null>(null);
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
        Evidence links are optional for private application text. A block
        without a link cannot be checked against canonical evidence or appear in
        the public resume preview. Saved revision numbers are managed
        automatically.
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
      <p role="status">{message}</p>
      {bindingIssues.length > 0 && (
        <section
          className="surface editor-form"
          aria-label="Resolve project evidence links"
        >
          <h3>Choose project evidence links</h3>
          <p>
            Your text, bullets and homepage stay intact. An unavailable ID may
            be old, from another record type, or from another account.
          </p>
          {bindingIssues.map((issue) => (
            <label key={issue.id}>
              Evidence link for {issue.title}
              <select
                disabled={busy}
                defaultValue={issue.record_id}
                onChange={(event) => {
                  try {
                    const content = fixedContentSchema.parse(JSON.parse(value));
                    setValue(
                      JSON.stringify(
                        {
                          ...content,
                          projects: content.projects.map((p) =>
                            p.id === issue.id
                              ? { ...p, record_id: event.target.value || null }
                              : p,
                          ),
                        },
                        null,
                        2,
                      ),
                    );
                    setBindingIssues((current) =>
                      current.filter((p) => p.id !== issue.id),
                    );
                    setMessage(
                      "Evidence link updated in your draft. Review it, then save approved content.",
                    );
                  } catch {
                    setMessage(
                      "Fix the draft JSON before changing its evidence link.",
                    );
                  }
                }}
              >
                <option value={issue.record_id}>
                  Unavailable record: {issue.record_id}
                </option>
                <option value="">
                  No evidence link — private approved text only
                </option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}
      {stale && (
        <section
          className="surface editor-form"
          aria-label="Review saved revision"
        >
          <button
            disabled={busy}
            type="button"
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch("/api/admin/resume-content", {
                  cache: "no-store",
                });
                if (!response.ok)
                  throw new Error(
                    "Cannot load the saved revision. Your draft is still here.",
                  );
                const result = z
                  .object({ fixed: fixedContentSchema })
                  .parse(await response.json());
                setLatest(result.fixed);
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Cannot load saved content.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Review latest saved content
          </button>
          {latest && (
            <>
              <p>
                Compare the latest saved revision with your draft above. Keeping
                your draft will replace this saved content when you next save.
              </p>
              <label>
                Latest saved content
                <textarea
                  aria-label="Latest saved content"
                  rows={12}
                  readOnly
                  value={JSON.stringify(latest, null, 2)}
                />
              </label>
              <button
                disabled={busy}
                type="button"
                onClick={() => {
                  try {
                    const draft = fixedContentSchema.parse(JSON.parse(value));
                    setValue(
                      JSON.stringify(
                        { ...draft, version: latest.version },
                        null,
                        2,
                      ),
                    );
                    setVersion(latest.version);
                    setStale(false);
                    setLatest(null);
                    setMessage(
                      "Your draft is preserved using the reviewed revision. Save approved content when ready.",
                    );
                  } catch {
                    setMessage(
                      "Fix the draft JSON before updating its revision.",
                    );
                  }
                }}
              >
                Keep my draft using this saved revision
              </button>
            </>
          )}
        </section>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            // The saved baseline belongs to the editor session, not pasted JSON.
            const content = {
              ...fixedContentSchema.parse(JSON.parse(value)),
              version,
            };
            const response = await fetch("/api/admin/resume-content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            });
            const result = saveResultSchema.parse(await response.json());
            if (!response.ok) {
              setBindingIssues(result.invalid_bindings || []);
              setProjectOptions(result.project_options || []);
              setStale(result.code === "STALE_CONTENT");
              throw new Error(result.error || "Cannot save fixed content.");
            }
            if (!result.content)
              throw new Error(
                "Save response was incomplete. Review the saved revision before retrying.",
              );
            setValue(JSON.stringify(result.content, null, 2));
            setVersion(result.content.version);
            setBindingIssues([]);
            setStale(false);
            setLatest(null);
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
    </section>
  );
}
