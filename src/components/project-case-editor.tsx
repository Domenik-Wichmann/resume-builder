"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  caseStudySchema,
  type CaseStudy,
  type CaseContent,
} from "@/lib/portfolio/case-study";
import { projectLinkUrl } from "@/lib/portfolio/edit-links";
import type { Project, ProjectMedia } from "@/lib/portfolio/model";
import { ProjectDisplay } from "./project-display";
import { ProjectLinksEditor } from "./project-links-editor";
const responseSchema = z.object({
  draft: caseStudySchema.optional(),
  error: z.string().optional(),
});
export function ProjectCaseEditor({
  project,
  media,
  skills,
  section = "content",
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  project: Project;
  media: ProjectMedia[];
  skills: string[];
  section?: "content" | "links" | "preview";
  onSaved?: (value: CaseStudy) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<CaseStudy | null>(null);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
          throw new Error(result.error || "Cannot load this project page.");
        if (!controller.signal.aborted) setDraft(result.draft);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Cannot load this project page.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [project.id]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(next: CaseStudy) {
    setDraft(next);
    setDirty(true);
    onDirtyChange?.(true);
    setMessage("");
    setError("");
  }
  function content<K extends keyof CaseContent>(key: K, value: CaseContent[K]) {
    if (draft) edit({ ...draft, content: { ...draft.content, [key]: value } });
  }
  async function run(action: "fill" | "save") {
    if (!draft) return;
    let outgoing = draft;
    if (action === "save") {
      const normalized = {
        ...draft,
        content: {
          ...draft.content,
          links: draft.content.links.map((link, index) => ({
            ...link,
            label: link.label.trim(),
            url: projectLinkUrl(link.url),
            display_order: index,
          })),
          highlights: draft.content.highlights
            .map((text) => text.trim())
            .filter(Boolean),
          outcomes: draft.content.outcomes
            .map((text) => text.trim())
            .filter(Boolean),
          limitations: draft.content.limitations
            .map((text) => text.trim())
            .filter(Boolean),
        },
      };
      const parsed = caseStudySchema.safeParse(normalized);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const index = issue.path[2];
        setError(
          issue.path.includes("links")
            ? `Check link ${typeof index === "number" ? index + 1 : "details"}: enter a button label and a valid HTTPS web address.`
            : `Check the page text: ${issue.message}`,
        );
        return;
      }
      outgoing = parsed.data;
    }
    setBusy(true);
    onBusyChange?.(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/project-case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save"
            ? { action, draft: outgoing }
            : { action, project_id: project.id },
        ),
      });
      const result = responseSchema.parse(await response.json());
      if (!response.ok || !result.draft)
        throw new Error(
          result.error || "Your changes were not saved. Try again.",
        );
      if (action === "fill") {
        const existing = draft.content.links;
        edit({
          ...result.draft,
          content: {
            ...result.draft.content,
            links: [
              ...existing,
              ...result.draft.content.links.filter(
                (link) => !existing.some((saved) => saved.url === link.url),
              ),
            ].slice(0, 12),
          },
        });
        setMessage(
          "Page text filled from stored evidence. Your links were kept. Review the draft before publishing.",
        );
      } else {
        setDraft(result.draft);
        setDirty(false);
        onDirtyChange?.(false);
        onSaved?.(result.draft);
        setMessage(
          result.draft.is_public
            ? "Project page and links published."
            : "Private case-study draft saved. Publish it when you are ready.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your changes were not saved. Try again.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section className="case-editor project-page-editor">
      {busy && !draft && <p role="status">Loading your project page…</p>}
      {draft && (
        <>
          <div className="project-save-bar">
            <div>
              <strong>
                {draft.is_public ? "Published page" : "Private draft"}
              </strong>
              <small>{dirty ? "Unsaved changes" : "Up to date"}</small>
            </div>
            <div className="project-save-actions">
              <a
                className="text-link"
                href={`/admin/projects/${project.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open saved preview ↗
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("save")}
              >
                {busy
                  ? "Saving…"
                  : draft.is_public
                    ? "Save & publish changes"
                    : "Save private draft"}
              </button>
            </div>
          </div>
          {message && (
            <p className="record-notice" role="status">
              {message}
            </p>
          )}
          <fieldset className="project-edit-fields" disabled={busy}>
            <div hidden={section !== "content"}>
              <div className="case-editor-heading">
                <div>
                  <h3>Project page</h3>
                  <p className="muted">
                    Write the story visitors see. Use stored evidence to fill
                    the text, then refine it.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void run("fill")}
                >
                  Fill from Career Brain ✦
                </button>
              </div>
              <div className="editor-form">
                <label>
                  Project name
                  <input
                    maxLength={200}
                    value={draft.content.title}
                    onChange={(event) => content("title", event.target.value)}
                  />
                </label>
                <label>
                  Tagline
                  <input
                    maxLength={300}
                    value={draft.content.tagline}
                    onChange={(event) => content("tagline", event.target.value)}
                  />
                </label>
                <label>
                  Card description
                  <textarea
                    rows={3}
                    maxLength={1200}
                    value={draft.content.summary}
                    onChange={(event) => content("summary", event.target.value)}
                  />
                </label>
                {(["overview", "implementation"] as const).map((key) => (
                  <label key={key}>
                    {key === "overview"
                      ? "Overview"
                      : "How it works · Markdown"}
                    <textarea
                      maxLength={key === "overview" ? 6000 : 18000}
                      rows={6}
                      value={draft.content[key]}
                      onChange={(event) => content(key, event.target.value)}
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
                        rows={4}
                        value={draft.content[key].join("\n")}
                        onChange={(event) =>
                          content(key, event.target.value.split("\n"))
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
            <div hidden={section !== "links"}>
              <ProjectLinksEditor
                links={draft.content.links}
                change={(value) => content("links", value)}
              />
            </div>
            <div hidden={section !== "preview"}>
              <p className="demo-banner">
                UNSAVED PREVIEW · review how the current page and links will
                appear
              </p>
              <ProjectDisplay
                project={project}
                content={draft.content}
                media={media}
                skills={skills}
                outcomes={draft.content.outcomes}
              />
            </div>
            <div className="project-publish-options">
              <h3>Publication</h3>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(event) =>
                    edit({ ...draft, selected: event.target.checked })
                  }
                />
                Show in selected projects
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.is_public}
                  onChange={(event) =>
                    edit({ ...draft, is_public: event.target.checked })
                  }
                />
                Publish this page and included links when I save
              </label>
              {!project.is_public && (
                <p className="muted">
                  The career project is private. Publish its record in Settings
                  before publishing this page.
                </p>
              )}
            </div>
          </fieldset>
        </>
      )}
      {error && (
        <p className="record-notice error" role="alert">
          {error} Your unsaved edits stay here.
        </p>
      )}
    </section>
  );
}
