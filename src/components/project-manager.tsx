"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { projectImageLimit } from "@/lib/portfolio/model";
import type {
  Project,
  ProjectInput,
  ProjectMedia,
} from "@/lib/portfolio/model";
import type { Canonical } from "@/lib/ingestion/model";
import { ProjectCaseEditor } from "./project-case-editor";
import { screenshotDescription } from "@/lib/portfolio/case-study";
import { showcaseTitle, selectedProjectNames } from "@/lib/portfolio/selection";
const blank: ProjectInput = {
  id: null,
  baseline_version: null,
  title: "",
  slug: "",
  subtitle: "",
  summary: "",
  description: "",
  organization: null,
  start_date: null,
  end_date: null,
  status: "OTHER",
  featured: false,
  is_public: false,
  archived: false,
  display_order: 0,
  skill_ids: [],
  achievement_ids: [],
  links: [],
};
const editorTabs = [
  "content",
  "links",
  "screenshots",
  "settings",
  "preview",
] as const;
type EditorTab = (typeof editorTabs)[number];
function projectInput(project?: Project): ProjectInput {
  if (!project) return { ...blank };
  const { updated_at, ...value } = project;
  return { ...value, baseline_version: updated_at };
}
function projectSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/, "");
}
export function ProjectManager({
  initialProjects,
  initialMedia,
  records,
  initialSelection = {},
}: {
  initialProjects: Project[];
  initialMedia: ProjectMedia[];
  records: Canonical[];
  initialSelection?: Record<string, boolean>;
}) {
  const [projects, setProjects] = useState(initialProjects),
    [media, setMedia] = useState(initialMedia),
    [form, setForm] = useState<ProjectInput>(() =>
      projectInput(initialProjects.find((project) => !project.archived)),
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [alt, setAlt] = useState("");
  const [selection, setSelection] = useState(initialSelection);
  const [tab, setTab] = useState<EditorTab>(
    initialProjects.some((project) => !project.archived)
      ? "content"
      : "settings",
  );
  const [search, setSearch] = useState("");
  const [caseDirty, setCaseDirty] = useState(false);
  const [caseBusy, setCaseBusy] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [mediaDirty, setMediaDirty] = useState<string[]>([]);
  const unsaved = caseDirty || settingsDirty || mediaDirty.length > 0;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  function change<K extends keyof ProjectInput>(
    key: K,
    value: ProjectInput[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "title" &&
      typeof value === "string" &&
      !previous.id &&
      (!previous.slug || previous.slug === projectSlug(previous.title))
        ? { slug: projectSlug(value) }
        : {}),
    }));
    setSettingsDirty(true);
  }
  async function refresh() {
    const r = await fetch("/api/admin/projects");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setProjects(data.projects);
    setMedia(data.media);
    return data.projects as Project[];
  }
  async function run(task: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await task());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (caseDirty) {
      setMessage(
        "Save your page edits in Content or Links before updating its career record.",
      );
      return;
    }
    await run(async () => {
      const r = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", project: form }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const rows = await refresh();
      const p = rows.find((p) => p.id === d.id);
      if (p) setForm(projectInput(p));
      setSettingsDirty(false);
      if (!form.id) setTab("content");
      return d.indexing;
    });
  }
  function select(p?: Project) {
    if (
      unsaved &&
      !window.confirm("Discard unsaved changes and switch projects?")
    )
      return;
    setForm(projectInput(p));
    setCaseDirty(false);
    setSettingsDirty(false);
    setMediaDirty([]);
    setMessage("");
    setAlt("");
    if (!p || p.archived) setTab("settings");
  }
  async function updateMedia(m: ProjectMedia, remove = false) {
    await run(async () => {
      const { project_id: _, ...fields } = m;
      void _;
      const r = await fetch("/api/admin/project-media", {
        method: remove ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remove ? { id: m.id } : fields),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh();
      setMediaDirty((previous) => previous.filter((id) => id !== m.id));
      return "Media saved.";
    });
  }
  return (
    <div className="manager-grid project-manager">
      <aside className="surface project-picker">
        <div className="project-picker-heading">
          <h2>Your projects</h2>
          <button
            type="button"
            disabled={busy || caseBusy}
            onClick={() => select()}
          >
            + New project
          </button>
        </div>
        <label>
          Find a project
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project names"
          />
        </label>
        <div className="stack">
          {projects
            .filter((project) =>
              showcaseTitle(project)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((project) => (
              <button
                type="button"
                className="choice-button"
                aria-pressed={form.id === project.id}
                disabled={busy || caseBusy}
                key={project.id}
                onClick={() => select(project)}
              >
                {showcaseTitle(project)}
                <small>
                  {project.archived
                    ? "Archived"
                    : project.is_public
                      ? "Published record"
                      : "Private record"}
                  {(selection[project.id] ??
                  (project.featured ||
                    Object.hasOwn(selectedProjectNames, project.id)))
                    ? " · Selected"
                    : ""}
                </small>
              </button>
            ))}
          {!projects.length && (
            <p className="muted">
              Create your first project to start building its page.
            </p>
          )}
          {projects.length > 0 &&
            !projects.some((project) =>
              showcaseTitle(project)
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <p className="muted">No projects match your search.</p>}
        </div>
      </aside>
      <section className="surface project-editor-surface">
        <div className="project-manager-heading">
          <div>
            <p className="eyebrow">Your project workspace</p>
            <h2>
              {form.id
                ? projects.find((project) => project.id === form.id)?.title
                : "New project"}
            </h2>
          </div>
          <span className="resume-badge">
            {unsaved ? "Unsaved changes" : "Ready to edit"}
          </span>
        </div>
        <div
          className="project-editor-tabs"
          role="tablist"
          aria-label="Project editing sections"
        >
          {editorTabs.map((item) => (
            <button
              type="button"
              role="tab"
              id={"project-tab-" + item}
              aria-selected={tab === item}
              aria-controls={"project-panel-" + item}
              tabIndex={tab === item ? 0 : -1}
              disabled={!form.id && item !== "settings"}
              key={item}
              onClick={() => setTab(item)}
              onKeyDown={(event) => {
                if (
                  !form.id ||
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const index = editorTabs.indexOf(item);
                const next =
                  event.key === "Home"
                    ? editorTabs[0]
                    : event.key === "End"
                      ? editorTabs[editorTabs.length - 1]
                      : editorTabs[
                          (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            editorTabs.length) %
                            editorTabs.length
                        ];
                setTab(next);
                document.getElementById("project-tab-" + next)?.focus();
              }}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div
          hidden={tab === "settings" || tab === "screenshots"}
          role="tabpanel"
          id={
            tab === "settings" || tab === "screenshots"
              ? undefined
              : "project-panel-" + tab
          }
          aria-labelledby={"project-tab-" + tab}
        >
          {form.id && projects.find((p) => p.id === form.id) && (
            <ProjectCaseEditor
              key={`${form.id}-${form.baseline_version}`}
              project={projects.find((p) => p.id === form.id)!}
              media={media.filter((m) => m.project_id === form.id)}
              section={
                tab === "links"
                  ? "links"
                  : tab === "preview"
                    ? "preview"
                    : "content"
              }
              onDirtyChange={setCaseDirty}
              onBusyChange={setCaseBusy}
              skills={records
                .filter((r) => form.skill_ids.includes(r.id))
                .map((r) => r.title)}
              onSaved={(value) =>
                setSelection((current) => ({
                  ...current,
                  [value.project_id]: value.selected,
                }))
              }
            />
          )}
        </div>
        <section
          className="project-record-editor"
          hidden={tab !== "settings"}
          role="tabpanel"
          id="project-panel-settings"
          aria-labelledby="project-tab-settings"
        >
          <h3>
            {form.id ? "Career record & visibility" : "Create your project"}
          </h3>
          <p className="muted">
            Content and Links edit your public project page. These settings
            manage its underlying career record, page address and linked skills.
          </p>
          <p>
            Markdown supports paragraphs, headings and lists. Publication is
            your approval of the project’s facts and images.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="editor-form"
          >
            {(["title", "slug", "subtitle", "organization"] as const).map(
              (k) => (
                <label key={k}>
                  {
                    {
                      title: "Project name",
                      slug: "Page URL name",
                      subtitle: "Tagline",
                      organization: "Organization",
                    }[k]
                  }
                  <input
                    required={k === "title" || k === "slug"}
                    maxLength={
                      k === "subtitle" ? 300 : k === "slug" ? 100 : 200
                    }
                    value={form[k] || ""}
                    onChange={(e) =>
                      change(
                        k,
                        e.target.value || (k === "organization" ? null : ""),
                      )
                    }
                  />
                </label>
              ),
            )}
            <label>
              Short summary
              <textarea
                maxLength={4000}
                rows={3}
                value={form.summary}
                onChange={(e) => change("summary", e.target.value)}
              />
            </label>
            <label>
              Long description
              <textarea
                maxLength={20000}
                rows={10}
                value={form.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </label>
            <div className="field-row">
              {(["start_date", "end_date"] as const).map((k) => (
                <label key={k}>
                  {k === "start_date" ? "Start date" : "End date"}
                  <input
                    type="date"
                    value={form[k] || ""}
                    onChange={(e) => change(k, e.target.value || null)}
                  />
                </label>
              ))}
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    change("status", e.target.value as ProjectInput["status"])
                  }
                >
                  {["PLANNED", "ACTIVE", "COMPLETED", "PAUSED", "OTHER"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Display order
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={form.display_order}
                  onChange={(e) =>
                    change("display_order", Number(e.target.value))
                  }
                />
              </label>
            </div>
            <div className="field-row">
              {(["is_public", "featured", "archived"] as const).map((k) => (
                <label className="check-label" key={k}>
                  <input
                    type="checkbox"
                    checked={form[k]}
                    onChange={(e) => change(k, e.target.checked)}
                  />
                  {k === "is_public"
                    ? "Publish career record (required for the public page)"
                    : k === "featured"
                      ? "Featured"
                      : "Archived"}
                </label>
              ))}
            </div>
            {(["skill", "achievement"] as const).map((kind) => (
              <fieldset key={kind}>
                <legend>Linked {kind}s</legend>
                {records
                  .filter((r) => r.kind === kind && !r.archived)
                  .map((r) => {
                    const key =
                      kind === "skill" ? "skill_ids" : "achievement_ids";
                    return (
                      <label className="check-label" key={r.id}>
                        <input
                          type="checkbox"
                          checked={form[key].includes(r.id)}
                          onChange={(e) =>
                            change(
                              key,
                              e.target.checked
                                ? [...form[key], r.id]
                                : form[key].filter((id) => id !== r.id),
                            )
                          }
                        />
                        {r.title}
                        {!r.published ? " (private)" : ""}
                      </label>
                    );
                  })}
                {!records.some((r) => r.kind === kind && !r.archived) && (
                  <p>
                    No {kind} records yet.{" "}
                    <Link className="text-link" href="/admin/explore">
                      Add them in Career records →
                    </Link>
                  </p>
                )}
              </fieldset>
            ))}

            <button disabled={busy || caseBusy} type="submit">
              Save project
            </button>
            {form.id && (
              <a
                className="text-link"
                href={`/admin/projects/${form.id}/preview`}
              >
                Preview saved project →
              </a>
            )}
          </form>
        </section>
        {message && (
          <p className="record-notice" role="status">
            {message}
          </p>
        )}
        <div
          hidden={tab !== "screenshots"}
          role="tabpanel"
          id="project-panel-screenshots"
          aria-labelledby="project-tab-screenshots"
        >
          {form.id && (
            <section>
              <h2>Screenshots &amp; gallery</h2>
              <p>
                Name each screenshot descriptively: “Sonaway graph review with
                approval controls.png”, for example. The filename fills its
                description, which you can edit before publishing. PNG, JPEG,
                WebP or GIF; up to 4 MB each.
              </p>
              <label>
                Optional description override
                <input
                  maxLength={300}
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                />
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > projectImageLimit)
                      throw new Error("Image limit is 4 MB.");
                    const description =
                      alt.trim() || screenshotDescription(file.name);
                    if (!description)
                      throw new Error(
                        "Give the screenshot a descriptive filename or enter a description.",
                      );
                    const r = await fetch(
                      `/api/admin/project-media?project=${form.id}`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": file.type,
                          "X-Screenshot-Description":
                            encodeURIComponent(description),
                          "X-Screenshot-Filename": encodeURIComponent(
                            file.name,
                          ),
                        },
                        body: file,
                      },
                    );
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    await refresh();
                    return "Screenshot uploaded privately. Review its caption, then enable Publish image and save.";
                  });
                  e.target.value = "";
                }}
              />
              {media
                .filter((m) => m.project_id === form.id)
                .map((m) => (
                  <MediaEditor
                    key={`${m.id}-${m.alt}-${m.caption}-${m.is_public}-${m.is_cover}`}
                    media={m}
                    busy={busy}
                    save={updateMedia}
                    onDirty={() =>
                      setMediaDirty((previous) =>
                        previous.includes(m.id)
                          ? previous
                          : [...previous, m.id],
                      )
                    }
                  />
                ))}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
function MediaEditor({
  media,
  busy,
  save,
  onDirty,
}: {
  media: ProjectMedia;
  busy: boolean;
  save: (m: ProjectMedia, remove?: boolean) => Promise<void>;
  onDirty?: () => void;
}) {
  const [m, setValue] = useState(media);
  function setM(next: ProjectMedia) {
    setValue(next);
    onDirty?.();
  }
  return (
    <div className="media-editor">
      <Image
        unoptimized
        src={`/media/${m.id}`}
        alt={m.alt}
        width={160}
        height={110}
        style={{ objectFit: "contain" }}
      />
      <label>
        Alt text
        <input
          value={m.alt}
          maxLength={300}
          onChange={(e) => setM({ ...m, alt: e.target.value })}
        />
      </label>
      {m.source_filename && (
        <p className="muted">Original filename: {m.source_filename}</p>
      )}
      <label>
        Caption
        <input
          value={m.caption}
          maxLength={500}
          onChange={(e) => setM({ ...m, caption: e.target.value })}
        />
      </label>
      <label>
        Order
        <input
          type="number"
          min={0}
          max={10000}
          value={m.display_order}
          onChange={(e) =>
            setM({ ...m, display_order: Number(e.target.value) })
          }
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={m.is_cover}
          onChange={(e) => setM({ ...m, is_cover: e.target.checked })}
        />
        Cover image
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={m.is_public === true}
          onChange={(e) => setM({ ...m, is_public: e.target.checked })}
        />
        Publish image · show on the project page and in relevant chat answers
      </label>
      <button disabled={busy} onClick={() => save(m)}>
        Save image
      </button>
      <button disabled={busy} onClick={() => save(m, true)}>
        Delete image
      </button>
    </div>
  );
}
