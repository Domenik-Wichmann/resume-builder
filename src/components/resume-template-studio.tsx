"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  defaultDesign,
  type OwnerAsset,
  type ResumeTemplate,
  type ResumeDesign,
} from "@/lib/resume-design/model";
import type { ResumeIR } from "@/lib/resume-ir";
import { ResumeRenderer } from "./resume-renderer";
import { AssetUpload } from "./asset-upload";
const fresh = (): ResumeTemplate => ({
  id: crypto.randomUUID(),
  name: "New resume design",
  version: 0,
  spec: defaultDesign,
  notes: "",
  reference_id: null,
  limitations: [],
  is_default: false,
});
export function ResumeTemplateStudio({
  initialTemplates,
  initialAssets,
  preview,
}: {
  initialTemplates: ResumeTemplate[];
  initialAssets: OwnerAsset[];
  preview: ResumeIR;
}) {
  const [templates, setTemplates] = useState(initialTemplates),
    [assets, setAssets] = useState(initialAssets);
  const [draft, setDraft] = useState<ResumeTemplate>(
    () => initialTemplates[0] || fresh(),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);
  async function refresh() {
    const response = await fetch("/api/admin/templates", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setAssets(result.assets);
    setTemplates(result.templates);
    return result;
  }
  async function action(action: "generate" | "save") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save"
            ? { action, template: draft }
            : {
                action,
                notes:
                  draft.notes ||
                  "Interpret the reference layout using the closest supported design.",
                reference_id: draft.reference_id,
                current: draft.spec,
              },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "generate") {
        setDraft({
          ...result.draft,
          id: draft.id,
          version: draft.version,
          name: draft.name,
          is_default: draft.is_default,
        });
        setMessage(
          "AI design draft ready. Review the preview and any limitations, then save it.",
        );
      } else {
        setAssets(result.assets);
        setTemplates(result.templates);
        setDraft(
          result.templates.find((t: ResumeTemplate) => t.id === draft.id),
        );
        setMessage(
          draft.is_default
            ? "Saved as the design for future resume views and PDF printing."
            : "Saved to your private template library.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design action failed.");
    } finally {
      setBusy(false);
    }
  }
  function change<K extends keyof ResumeDesign>(
    key: K,
    value: ResumeDesign[K],
  ) {
    setDraft({ ...draft, spec: { ...draft.spec, [key]: value } });
  }
  const selects = [
    ["page", "Paper", ["A4", "LETTER"]],
    ["layout", "Layout", ["CLASSIC", "SIDEBAR"]],
    ["font", "Font family", ["SANS", "SERIF", "MONO"]],
    ["spacing", "Spacing", ["COMPACT", "COMFORTABLE", "AIRY"]],
    ["headings", "Section headings", ["RULE", "PLAIN", "UPPERCASE"]],
    ["header", "Header alignment", ["LEFT", "CENTER"]],
    ["photo", "Portrait on resume", ["NONE", "CIRCLE", "SQUARE"]],
  ] as const;
  const reference = assets.find((a) => a.id === draft.reference_id);
  return (
    <div className={`template-studio ${previewOnly ? "preview-only" : ""}`}>
      <div className="studio-controls">
        <section className="studio-section">
          <h2>Your template library</h2>
          <div className="studio-library">
            {templates.map((t) => (
              <button
                key={t.id}
                disabled={busy}
                className={`record-button ${draft.id === t.id ? "" : "secondary"}`}
                onClick={() => {
                  setDraft(t);
                  setError("");
                  setMessage("");
                }}
              >
                {t.name}
                {t.is_default ? " / Active" : ""} <small>v{t.version}</small>
              </button>
            ))}
          </div>
          <button
            className="record-text-button"
            disabled={busy}
            onClick={() => {
              setDraft(fresh());
              setMessage("");
              setError("");
            }}
          >
            + New design
          </button>
        </section>
        <fieldset disabled={busy} className="studio-section">
          <legend>Design from a reference or an idea</legend>
          <label>
            Design name
            <input
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <AssetUpload
            kind="REFERENCE"
            onUploaded={(id) => {
              void refresh()
                .then(() =>
                  setDraft((previous) => ({ ...previous, reference_id: id })),
                )
                .catch((e) => setError(e.message));
            }}
          />
          <label>
            Reference file
            <select
              value={draft.reference_id || ""}
              onChange={(e) =>
                setDraft({ ...draft, reference_id: e.target.value || null })
              }
            >
              <option value="">No reference / design from notes</option>
              {assets
                .filter((a) => a.kind === "REFERENCE")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          {reference && (
            <details>
              <summary>View uploaded reference</summary>
              {reference.mime_type === "application/pdf" ? (
                <a
                  href={`/assets/${reference.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open reference PDF
                </a>
              ) : (
                <Image
                  className="studio-reference"
                  src={`/assets/${reference.id}`}
                  width={500}
                  height={650}
                  unoptimized
                  alt="Uploaded resume layout reference"
                />
              )}
            </details>
          )}
          {reference && (
            <button
              className="record-text-button"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Delete this unused reference? Saved design revisions retain their original files.",
                  )
                )
                  return;
                try {
                  const response = await fetch("/api/admin/assets", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: reference.id }),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  await refresh();
                  setDraft((previous) => ({ ...previous, reference_id: null }));
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Cannot delete reference.",
                  );
                }
              }}
            >
              Delete unused reference
            </button>
          )}
          <label>
            Describe the design or changes you want
            <textarea
              rows={5}
              maxLength={3000}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="A clean one-column resume, dark blue headings, compact spacing, no photo..."
            />
          </label>
          <p className="muted">
            AI receives your notes and selected reference through OpenRouter to
            draft the layout. A reference supplies design only. Save the
            reviewed design once; later resumes use it without another AI layout
            call.
          </p>
          <button
            className="record-button"
            onClick={() => void action("generate")}
          >
            {busy ? "Working..." : "Draft design with AI"}
          </button>
        </fieldset>
        <fieldset disabled={busy} className="studio-section">
          <legend>Adjust the reusable design</legend>
          <div className="studio-field-grid">
            {selects.map(([key, label, choices]) => (
              <label key={key}>
                {label}
                <select
                  value={draft.spec[key]}
                  onChange={(e) =>
                    change(key, e.target.value as ResumeDesign[typeof key])
                  }
                >
                  {choices.map((value) => (
                    <option key={value} value={value}>
                      {value.toLowerCase().replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Accent color
              <input
                type="color"
                value={draft.spec.accent}
                onChange={(e) => change("accent", e.target.value)}
              />
            </label>
            <label>
              Text color
              <input
                type="color"
                value={draft.spec.text}
                onChange={(e) => change("text", e.target.value)}
              />
            </label>
            <label>
              Page margin (mm)
              <input
                type="number"
                min={10}
                max={30}
                step={1}
                value={draft.spec.margin_mm}
                onChange={(e) =>
                  change(
                    "margin_mm",
                    Math.min(
                      30,
                      Math.max(10, Math.round(Number(e.target.value))),
                    ),
                  )
                }
              />
            </label>
            <label>
              Text size (pt)
              <input
                type="number"
                min={9}
                max={13}
                step={1}
                value={draft.spec.font_pt}
                onChange={(e) =>
                  change(
                    "font_pt",
                    Math.min(
                      13,
                      Math.max(9, Math.round(Number(e.target.value))),
                    ),
                  )
                }
              />
            </label>
          </div>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(e) =>
                setDraft({ ...draft, is_default: e.target.checked })
              }
            />
            Use this design for generated resumes
          </label>
          <div className="record-editor-actions">
            <button
              className="record-button"
              disabled={!draft.name.trim()}
              onClick={() => void action("save")}
            >
              Save design
            </button>
            <button
              className="record-button secondary"
              onClick={() => setPreviewOnly(true)}
            >
              Full preview
            </button>
          </div>
        </fieldset>
        {draft.limitations.length > 0 && (
          <aside className="studio-section">
            <h3>Design interpretation notes</h3>
            <ul>
              {draft.limitations.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </aside>
        )}
        {message && (
          <p className="record-notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="record-notice error" role="alert">
            {error}
          </p>
        )}
      </div>
      <section className="studio-preview">
        <div className="studio-preview-toolbar">
          <h2>Live layout preview</h2>
          {previewOnly && (
            <button
              className="record-button secondary"
              onClick={() => setPreviewOnly(false)}
            >
              Back to design
            </button>
          )}
          <button
            className="record-button secondary"
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
          <Link href="/admin/presentation">
            Manage personal details & photos
          </Link>
        </div>
        <p className="muted studio-preview-disclosure">
          This preview uses clearly labeled fictional content to show layout. It
          does not edit or publish your career.
        </p>
        <ResumeRenderer ir={preview} design={draft.spec} />
      </section>
    </div>
  );
}
