"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  caseStudySchema,
  type CaseStudy,
  type CaseContent,
} from "@/lib/portfolio/case-study";
import type { Project, ProjectMedia } from "@/lib/portfolio/model";
import { ProjectDisplay } from "./project-display";

const responseSchema = z.object({
  draft: caseStudySchema.optional(),
  error: z.string().optional(),
});
export function ProjectCaseEditor({
  project,
  media,
  skills,
  onSaved,
}: {
  project: Project;
  media: ProjectMedia[];
  skills: string[];
  onSaved?: (value: CaseStudy) => void;
}) {
  const [draft, setDraft] = useState<CaseStudy | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/project-case-studies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", project_id: project.id }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = responseSchema.parse(await response.json());
        if (!response.ok || !result.draft)
          throw new Error(result.error || "Cannot load the case-study draft.");
        if (!controller.signal.aborted) setDraft(result.draft);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Cannot load draft.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [project.id]);
  async function run(action: "fill" | "save") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/project-case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save"
            ? { action, draft }
            : { action, project_id: project.id },
        ),
      });
      const result = responseSchema.parse(await response.json());
      if (!response.ok || !result.draft)
        throw new Error(result.error || "Cannot save case study.");
      setDraft(result.draft);
      if (action === "save") onSaved?.(result.draft);
      setMessage(
        action === "fill"
          ? "Filled from accepted project evidence. Review, add screenshots, and save when ready."
          : result.draft.is_public
            ? "Case study published."
            : "Private case-study draft saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Cannot save case study.",
      );
    } finally {
      setBusy(false);
    }
  }
  function content<K extends keyof CaseContent>(key: K, value: CaseContent[K]) {
    if (draft)
      setDraft({ ...draft, content: { ...draft.content, [key]: value } });
  }
  return (
    <section className="case-editor">
      <div className="case-editor-heading">
        <div>
          <p className="eyebrow">Project showcase</p>
          <h2>Build the case study</h2>
        </div>
        <button type="button" disabled={busy} onClick={() => void run("fill")}>
          Fill from Career Brain ✦
        </button>
      </div>
      <p>
        Pull in accepted project facts, then refine the page and add
        screenshots. This draft doesn’t change your career records.
      </p>
      {busy && <p role="status">Loading project evidence…</p>}
      {draft && (
        <>
          <div className="field-row">
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.selected}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, selected: e.target.checked })
                }
              />
              Show in selected projects
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.is_public}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, is_public: e.target.checked })
                }
              />
              Publish this case study when saved
            </label>
          </div>
          <div className="editor-form">
            <label>
              Project name
              <input
                maxLength={200}
                value={draft.content.title}
                onChange={(e) => content("title", e.target.value)}
              />
            </label>
            <label>
              Tagline
              <input
                maxLength={300}
                value={draft.content.tagline}
                onChange={(e) => content("tagline", e.target.value)}
              />
            </label>
            <label>
              Card description
              <textarea
                maxLength={1200}
                rows={3}
                value={draft.content.summary}
                onChange={(e) => content("summary", e.target.value)}
              />
            </label>
            <fieldset className="case-links-editor">
              <legend>Project links · live app, GitHub &amp; demos</legend>
              {draft.content.links.map((link, index) => (
                <div className="case-link-row" key={index}>
                  <label>
                    Label
                    <input
                      maxLength={100}
                      value={link.label}
                      onChange={(e) =>
                        content(
                          "links",
                          draft.content.links.map((value, i) =>
                            i === index
                              ? { ...value, label: e.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    URL
                    <input
                      maxLength={2000}
                      value={link.url}
                      onChange={(e) =>
                        content(
                          "links",
                          draft.content.links.map((value, i) =>
                            i === index
                              ? { ...value, url: e.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={link.is_public}
                      onChange={(e) =>
                        content(
                          "links",
                          draft.content.links.map((value, i) =>
                            i === index
                              ? { ...value, is_public: e.target.checked }
                              : value,
                          ),
                        )
                      }
                    />
                    Publish this link with the case study
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      content(
                        "links",
                        draft.content.links.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove link
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={draft.content.links.length >= 12}
                onClick={() =>
                  content("links", [
                    ...draft.content.links,
                    {
                      label: "",
                      url: "",
                      link_type: "OTHER",
                      display_order: draft.content.links.length,
                      is_public: false,
                    },
                  ])
                }
              >
                Add project link
              </button>
            </fieldset>
            <details className="case-editor-sections">
              <summary>Edit page sections</summary>
              {(["overview", "implementation"] as const).map((key) => (
                <label key={key}>
                  {key === "overview" ? "Overview" : "How it works · Markdown"}
                  <textarea
                    maxLength={key === "overview" ? 6000 : 18000}
                    rows={6}
                    value={draft.content[key]}
                    onChange={(e) => content(key, e.target.value)}
                  />
                </label>
              ))}
              {(["highlights", "outcomes", "limitations"] as const).map(
                (key) => (
                  <label key={key}>
                    {key === "highlights"
                      ? "Features & capabilities"
                      : key === "outcomes"
                        ? "Outcomes"
                        : "Scope & limitations"}{" "}
                    · one item per line
                    <textarea
                      rows={5}
                      value={draft.content[key].join("\n")}
                      onChange={(e) => content(key, e.target.value.split("\n"))}
                    />
                  </label>
                ),
              )}
            </details>
          </div>
          <div className="case-editor-actions">
            <button
              type="button"
              disabled={busy || !draft.content.title.trim()}
              onClick={() => void run("save")}
            >
              {draft.is_public
                ? "Save & publish case study"
                : "Save private draft"}
            </button>
            <a
              className="text-link"
              href={`/admin/projects/${project.id}/preview`}
            >
              Preview saved page ↗
            </a>
          </div>
          <details className="case-draft-preview">
            <summary>Preview this draft</summary>
            <ProjectDisplay
              project={project}
              content={draft.content}
              media={media}
              skills={skills}
              outcomes={draft.content.outcomes}
            />
          </details>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
