"use client";
import { useState, type FormEvent } from "react";
import type { BrainRecord } from "@/lib/career-brain/repository";
import type { ClaimEdit, RecordEdit } from "@/lib/career-brain/record-view";
const attributes = [
  "action",
  "tool",
  "metric",
  "ownership",
  "scope",
  "credential",
  "language",
  "depth",
  "context",
  "denial",
  "correction",
] as const;
const ownership = [
  "PERSONAL",
  "TEAM",
  "EXPOSURE",
  "NEGATED",
  "UNCERTAIN",
] as const;
const reviewStates = [
  "CONFIRMED",
  "PENDING_REVIEW",
  "DISPUTED",
  "SUPERSEDED",
  "REMOVED",
] as const;
const label = (text: string) => text.toLowerCase().replaceAll("_", " ");
export function CareerRecordEditor({
  row,
  records,
  busy,
  onSave,
  onCancel,
}: {
  row: BrainRecord;
  records: BrainRecord[];
  busy: boolean;
  onSave: (edit: RecordEdit) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    organization: row.organization || "",
    start_date: row.start_date || "",
    end_date: row.end_date || "",
  });
  const [aliases, setAliases] = useState(row.aliases.join("\n"));
  const [skills, setSkills] = useState(row.skill_keys);
  const [achievements, setAchievements] = useState(row.achievement_keys);
  const [category, setCategory] = useState(row.category_key || "");
  const [claims, setClaims] = useState<ClaimEdit[]>(
    row.claims.map((c, index) => ({
      index,
      attribute: c.attribute,
      value: c.value,
      attribution: c.attribution,
      availability: c.availability,
      conflict: c.conflict || "",
    })),
  );
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [descriptionAttribution, setDescriptionAttribution] = useState<
    ClaimEdit["attribution"]
  >(
    row.kind === "skill"
      ? "EXPOSURE"
      : row.claims.some(
            (c) => c.attribution === "TEAM" && c.availability === "CONFIRMED",
          )
        ? "TEAM"
        : "PERSONAL",
  );
  const [skillQuery, setSkillQuery] = useState("");
  function changeField(name: keyof typeof fields, value: string) {
    setFields((old) => ({ ...old, [name]: value }));
  }
  function changeClaim(index: number, patch: Partial<ClaimEdit>) {
    setClaims((old) =>
      old.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }
  function toggle(keys: string[], key: string, checked: boolean) {
    return checked
      ? [...new Set([...keys, key])]
      : keys.filter((k) => k !== key);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    await onSave({
      ...fields,
      organization: fields.organization || null,
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      skill_keys: skills,
      achievement_keys: achievements,
      category_key: category || null,
      aliases: aliases
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      claims,
      note,
      confirmed: true,
      description_attribution: descriptionAttribution,
    });
  }
  const hasDates = !["profile", "skill", "category"].includes(row.kind);
  return (
    <form className="record-editor" onSubmit={submit}>
      <p className="record-save-note">
        Changes save to this same record and stay private until you publish.
        Your correction is retained as source evidence.
      </p>
      <fieldset disabled={busy}>
        <legend>Record details</legend>
        <label htmlFor="edit-record-title">Name / title</label>
        <input
          id="edit-record-title"
          required
          maxLength={200}
          value={fields.title}
          onChange={(e) => changeField("title", e.target.value)}
        />
        {!["skill", "category"].includes(row.kind) && (
          <>
            <label htmlFor="edit-record-subtitle">Subtitle</label>
            <input
              id="edit-record-subtitle"
              maxLength={300}
              value={fields.subtitle}
              onChange={(e) => changeField("subtitle", e.target.value)}
            />
          </>
        )}
        <label htmlFor="edit-record-summary">Description</label>
        <textarea
          id="edit-record-summary"
          rows={5}
          maxLength={4000}
          value={fields.summary}
          onChange={(e) => changeField("summary", e.target.value)}
        />
        {fields.summary !== row.summary && (
          <>
            <label htmlFor="description-ownership">
              Attribution for your revised description
            </label>
            <select
              id="description-ownership"
              value={descriptionAttribution}
              onChange={(e) =>
                setDescriptionAttribution(
                  e.target.value as ClaimEdit["attribution"],
                )
              }
            >
              {ownership.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
            <p className="muted">
              The revised description becomes your source statement. Check
              existing facts below for any conflicting or outdated assertions.
            </p>
          </>
        )}
        {hasDates && (
          <>
            <label htmlFor="edit-organization">Organization</label>
            <input
              id="edit-organization"
              maxLength={200}
              value={fields.organization}
              onChange={(e) => changeField("organization", e.target.value)}
            />
            <div className="record-form-columns">
              <div>
                <label htmlFor="edit-start">Start date</label>
                <input
                  id="edit-start"
                  type="date"
                  value={fields.start_date}
                  onChange={(e) => changeField("start_date", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="edit-end">End date</label>
                <input
                  id="edit-end"
                  type="date"
                  min={fields.start_date || undefined}
                  value={fields.end_date}
                  onChange={(e) => changeField("end_date", e.target.value)}
                />
              </div>
            </div>
            <p className="muted">
              Leave dates blank when the exact day is unknown.
            </p>
          </>
        )}
        <label htmlFor="edit-aliases">
          Other names <small>one per line</small>
        </label>
        <textarea
          id="edit-aliases"
          rows={2}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Connections</legend>
        {["experience", "project", "achievement"].includes(row.kind) && (
          <>
            <label htmlFor="connected-skill-search">
              Skills <small>{skills.length} / 30 selected</small>
            </label>
            <input
              id="connected-skill-search"
              type="search"
              placeholder="Find a skill…"
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
            />
            <div className="record-link-picker">
              {records
                .filter(
                  (r) =>
                    r.kind === "skill" &&
                    (!r.archived || skills.includes(r.key)) &&
                    r.title.toLowerCase().includes(skillQuery.toLowerCase()),
                )
                .map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={skills.includes(r.key)}
                      disabled={
                        !skills.includes(r.key) &&
                        (skills.length >= 30 || r.archived)
                      }
                      onChange={(e) =>
                        setSkills(toggle(skills, r.key, e.target.checked))
                      }
                    />
                    {r.title}
                    {r.archived && <small>in Trash</small>}
                  </label>
                ))}
            </div>
          </>
        )}
        {["experience", "project"].includes(row.kind) && (
          <>
            <p className="record-field-label">Achievements</p>
            <div className="record-link-picker">
              {records
                .filter(
                  (r) =>
                    r.kind === "achievement" &&
                    (!r.archived || achievements.includes(r.key)),
                )
                .map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={achievements.includes(r.key)}
                      disabled={
                        !achievements.includes(r.key) &&
                        (achievements.length >= 30 || r.archived)
                      }
                      onChange={(e) =>
                        setAchievements(
                          toggle(achievements, r.key, e.target.checked),
                        )
                      }
                    />
                    {r.title}
                  </label>
                ))}
            </div>
          </>
        )}
        {row.kind === "skill" && (
          <>
            <label htmlFor="edit-category">Skill category</label>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">No category</option>
              {records
                .filter(
                  (r) =>
                    r.kind === "category" &&
                    (!r.archived || r.key === category),
                )
                .map((r) => (
                  <option key={r.id} value={r.key} disabled={r.archived}>
                    {r.title}
                    {r.archived ? " (in Trash)" : ""}
                  </option>
                ))}
            </select>
          </>
        )}
        {[
          "profile",
          "education",
          "certification",
          "language",
          "category",
        ].includes(row.kind) && (
          <p className="muted">
            Connections to this record appear in its details. Edit the connected
            record to change a relationship.
          </p>
        )}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Facts & ownership</legend>
        <p className="muted">
          Recruiter answers and résumés use confirmed facts. Keep team results,
          exposure, plans and uncertainties accurate. Previous evidence is
          retained when you correct or remove a fact.
        </p>
        {claims.map((claim, index) => (
          <details
            className="record-claim-edit"
            key={index}
            open={claim.index === null || undefined}
          >
            <summary>
              <span>{claim.value || "New fact"}</span>
              <small>{label(claim.availability)}</small>
            </summary>
            <div>
              <label htmlFor={`fact-value-${index}`}>Fact</label>
              <textarea
                id={`fact-value-${index}`}
                rows={3}
                required
                maxLength={500}
                value={claim.value}
                onChange={(e) => changeClaim(index, { value: e.target.value })}
              />
              <div className="record-form-columns">
                <div>
                  <label htmlFor={`fact-type-${index}`}>Type</label>
                  <select
                    id={`fact-type-${index}`}
                    value={claim.attribute}
                    onChange={(e) =>
                      changeClaim(index, {
                        attribute: e.target.value as ClaimEdit["attribute"],
                      })
                    }
                  >
                    {attributes.map((v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`fact-owner-${index}`}>
                    Ownership / qualification
                  </label>
                  <select
                    id={`fact-owner-${index}`}
                    value={claim.attribution}
                    onChange={(e) =>
                      changeClaim(index, {
                        attribution: e.target.value as ClaimEdit["attribution"],
                        ...(e.target.value === "UNCERTAIN"
                          ? { availability: "PENDING_REVIEW" as const }
                          : {}),
                      })
                    }
                  >
                    {ownership.map((v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label htmlFor={`fact-status-${index}`}>Review status</label>
              <select
                id={`fact-status-${index}`}
                value={claim.availability}
                onChange={(e) =>
                  changeClaim(index, {
                    availability: e.target.value as ClaimEdit["availability"],
                  })
                }
              >
                {reviewStates.map((v) => (
                  <option
                    key={v}
                    value={v}
                    disabled={
                      v === "CONFIRMED" && claim.attribution === "UNCERTAIN"
                    }
                  >
                    {label(v)}
                  </option>
                ))}
              </select>
              <label htmlFor={`fact-conflict-${index}`}>
                Uncertainty or conflict
              </label>
              <textarea
                id={`fact-conflict-${index}`}
                rows={2}
                maxLength={500}
                value={claim.conflict}
                onChange={(e) =>
                  changeClaim(index, { conflict: e.target.value })
                }
              />
              <button
                className="record-button secondary"
                type="button"
                onClick={() =>
                  claim.index === null
                    ? setClaims((old) => old.filter((_, i) => i !== index))
                    : changeClaim(index, { availability: "REMOVED" })
                }
              >
                Remove fact
              </button>
            </div>
          </details>
        ))}
        <button
          type="button"
          className="record-button secondary"
          disabled={claims.length >= 100}
          onClick={() =>
            setClaims((old) => [
              ...old,
              {
                index: null,
                attribute: "action",
                value: "",
                attribution: "PERSONAL",
                availability: "CONFIRMED",
                conflict: "",
              },
            ])
          }
        >
          + Add a fact
        </button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Save your correction</legend>
        <label htmlFor="edit-note">What changed?</label>
        <textarea
          id="edit-note"
          rows={2}
          minLength={10}
          maxLength={500}
          required
          placeholder="Describe your correction or the new information."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="record-check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm these changes and have reviewed their facts and ownership.
        </label>
      </fieldset>
      <div className="record-editor-actions">
        <button className="record-button" disabled={busy || !confirmed}>
          {busy ? "Saving…" : "Save changes privately"}
        </button>
        <button
          className="record-button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
