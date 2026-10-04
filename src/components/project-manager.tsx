"use client";
import { useState } from "react";
import Image from "next/image";
import { projectImageLimit } from "@/lib/portfolio/model";
import type {
  Project,
  ProjectInput,
  ProjectMedia,
} from "@/lib/portfolio/model";
import type { Canonical } from "@/lib/ingestion/model";
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
export function ProjectManager({
  initialProjects,
  initialMedia,
  records,
}: {
  initialProjects: Project[];
  initialMedia: ProjectMedia[];
  records: Canonical[];
}) {
  const [projects, setProjects] = useState(initialProjects),
    [media, setMedia] = useState(initialMedia),
    [form, setForm] = useState<ProjectInput>(blank),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [alt, setAlt] = useState("");
  function change<K extends keyof ProjectInput>(
    key: K,
    value: ProjectInput[K],
  ) {
    setForm({ ...form, [key]: value });
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
      if (p) select(p);
      return d.indexing;
    });
  }
  function select(p: Project) {
    const { updated_at, ...value } = p;
    setForm({ ...value, baseline_version: updated_at });
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
      return "Media saved.";
    });
  }
  return (
    <div className="manager-grid">
      <aside className="surface">
        <button onClick={() => setForm({ ...blank })}>New project</button>
        <div className="stack">
          {projects.map((p) => (
            <button
              className="choice-button"
              key={p.id}
              onClick={() => select(p)}
            >
              {p.title}
              <small>
                {p.archived ? "Archived" : p.is_public ? "Public" : "Private"}
                {p.featured ? " · Featured" : ""}
              </small>
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await fetch("/api/admin/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reindex" }),
              });
              if (!r.ok) throw new Error("Indexing failed. Retry later.");
              return "Index refreshed.";
            })
          }
        >
          Retry indexing
        </button>
      </aside>
      <section className="surface">
        <h2>{form.id ? "Edit project" : "Create a project"}</h2>
        <p>
          Markdown supports paragraphs, headings and lists. Publication is your
          approval of the project’s facts and images.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="editor-form"
        >
          {(["title", "slug", "subtitle", "organization"] as const).map((k) => (
            <label key={k}>
              {k.replaceAll("_", " ")}
              <input
                required={k === "title" || k === "slug"}
                maxLength={k === "subtitle" ? 300 : k === "slug" ? 100 : 200}
                value={form[k] || ""}
                onChange={(e) =>
                  change(
                    k,
                    e.target.value || (k === "organization" ? null : ""),
                  )
                }
              />
            </label>
          ))}
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
                {k.replace("_", " ")}
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
                    <option key={s}>{s}</option>
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
                {k === "is_public" ? "Published" : k}
              </label>
            ))}
          </div>
          {(["skill", "achievement"] as const).map((kind) => (
            <fieldset key={kind}>
              <legend>Canonical {kind}s</legend>
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
                <p>Create these records in Career Master first.</p>
              )}
            </fieldset>
          ))}
          <fieldset>
            <legend>Project links</legend>
            {form.links.map((l, i) => (
              <div className="link-editor" key={i}>
                <label>
                  Label
                  <input
                    value={l.label}
                    maxLength={100}
                    required
                    onChange={(e) =>
                      change(
                        "links",
                        form.links.map((r, j) =>
                          j === i ? { ...r, label: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  URL
                  <input
                    value={l.url}
                    required
                    maxLength={2000}
                    onChange={(e) =>
                      change(
                        "links",
                        form.links.map((r, j) =>
                          j === i ? { ...r, url: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={l.link_type}
                    onChange={(e) =>
                      change(
                        "links",
                        form.links.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                link_type: e.target.value as typeof l.link_type,
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    {[
                      "LIVE",
                      "GITHUB",
                      "DEMO",
                      "TRIAL",
                      "CASE_STUDY",
                      "DOCUMENTATION",
                      "OTHER",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={l.display_order}
                    onChange={(e) =>
                      change(
                        "links",
                        form.links.map((r, j) =>
                          j === i
                            ? { ...r, display_order: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={l.is_public}
                    onChange={(e) =>
                      change(
                        "links",
                        form.links.map((r, j) =>
                          j === i ? { ...r, is_public: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                  Public
                </label>
                <button
                  type="button"
                  onClick={() =>
                    change(
                      "links",
                      form.links.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={form.links.length >= 12}
              onClick={() =>
                change("links", [
                  ...form.links,
                  {
                    label: "",
                    url: "",
                    link_type: "OTHER",
                    display_order: form.links.length,
                    is_public: false,
                  },
                ])
              }
            >
              Add link
            </button>
            <p>
              Lower display-order values appear first. Use HTTPS or supported
              internal portfolio routes.
            </p>
          </fieldset>
          <button disabled={busy} type="submit">
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
        <p role="status">{message}</p>
        {form.id && (
          <section>
            <h2>Project images</h2>
            <p>
              PNG, JPEG, WebP or GIF; up to 4 MB. Saved changes on a published
              project appear publicly.
            </p>
            <label>
              Alt text for upload
              <input
                maxLength={300}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy || !alt.trim()}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void run(async () => {
                  if (file.size > projectImageLimit)
                    throw new Error("Image limit is 4 MB.");
                  const r = await fetch(
                    `/api/admin/project-media?project=${form.id}&alt=${encodeURIComponent(alt)}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": file.type },
                      body: file,
                    },
                  );
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  await refresh();
                  return "Image uploaded. Choose its cover/gallery settings below.";
                });
                e.target.value = "";
              }}
            />
            {media
              .filter((m) => m.project_id === form.id)
              .map((m) => (
                <MediaEditor
                  key={m.id}
                  media={m}
                  busy={busy}
                  save={updateMedia}
                />
              ))}
          </section>
        )}
      </section>
    </div>
  );
}
function MediaEditor({
  media,
  busy,
  save,
}: {
  media: ProjectMedia;
  busy: boolean;
  save: (m: ProjectMedia, remove?: boolean) => Promise<void>;
}) {
  const [m, setM] = useState(media);
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
      <button disabled={busy} onClick={() => save(m)}>
        Save image
      </button>
      <button disabled={busy} onClick={() => save(m, true)}>
        Delete image
      </button>
    </div>
  );
}
