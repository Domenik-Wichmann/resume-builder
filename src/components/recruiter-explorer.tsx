"use client";
import { useEffect, useState } from "react";
import type { CareerRecord } from "@/lib/career/model";
import {
  catalogSchema,
  catalogCategories as categories,
  catalogGroups,
  catalogRecords,
  type Catalog,
  type CatalogCategory,
} from "@/lib/career/catalog";
import { SafeMarkdown } from "./safe-markdown";

export type StudioPanel = "chat" | "explorer" | "projects" | "answers";

export function RecruiterExplorer({
  panel,
}: {
  panel: Exclude<StudioPanel, "chat">;
}) {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CareerRecord | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/career-catalog", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Cannot load published career content.");
        setData(catalogSchema.parse(await response.json()));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Cannot load career content.",
          );
      });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading career content…</p>;
  const active = panel === "projects" ? "projects" : category;
  const allRecords = active ? catalogRecords(data, active) : [];
  const groups = active ? catalogGroups(data, active) : [];
  const groupedIds = new Set(groups.flatMap((group) => group.recordIds));
  const uncategorized = allRecords.filter(
    (record) => !groupedIds.has(record.id),
  );
  const hasSubcategories = active === "skill_records" || groups.length > 0;
  const group = groups.find((entry) => entry.id === subcategory);
  const label = categories.find(([key]) => key === active)?.[1] || "Records";
  const browsingGroups =
    hasSubcategories && subcategory === null && !query.trim();
  const records = allRecords.filter(
    (record) =>
      (subcategory === "uncategorized"
        ? !groupedIds.has(record.id)
        : group
          ? group.recordIds.includes(record.id)
          : true) &&
      [
        record.title,
        record.subtitle,
        record.summary,
        record.organization,
        ...record.skills,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  function selectSubcategory(id: string | null) {
    setSubcategory(id);
    setQuery("");
  }
  const connections = selected
    ? [
        ...new Map(
          categories
            .flatMap(([key]) => catalogRecords(data, key))
            .map((record) => [record.id, record]),
        ).values(),
      ].filter(
        (record) =>
          record.id !== selected.id &&
          (selected.related_ids?.includes(record.id) ||
            record.related_ids?.includes(selected.id) ||
            selected.skills.includes(record.title) ||
            record.skills.includes(selected.title) ||
            record.skills.some((skill) => selected.skills.includes(skill))),
      )
    : [];
  const recordCard = (record: CareerRecord) => (
    <button
      className="catalog-card"
      key={record.id}
      onClick={() => setSelected(record)}
    >
      <h3>{record.title}</h3>
      <p>{record.subtitle || record.summary}</p>
      <span>Explore details ↗</span>
    </button>
  );
  return (
    <div className="recruiter-explorer">
      <header className="catalog-heading">
        <p className="eyebrow">
          {panel === "answers"
            ? "Quick answers"
            : panel === "projects"
              ? "Projects"
              : "Career explorer"}
        </p>
        <h2>
          {selected
            ? selected.title
            : active
              ? group?.title ||
                (subcategory === "uncategorized"
                  ? `Uncategorized ${label.toLowerCase()}`
                  : label)
              : panel === "answers"
                ? "A few useful answers."
                : "Where would you like to explore?"}
        </h2>
      </header>
      {data.career.demo && (
        <p className="catalog-demo">Fictional demo career content.</p>
      )}
      {panel === "answers" ? (
        <div className="catalog-grid">
          {data.answers.length ? (
            data.answers.map((answer, index) => (
              <article className="catalog-card" key={index}>
                <h3>{answer.question}</h3>
                <SafeMarkdown text={answer.answer} />
              </article>
            ))
          ) : (
            <p>No reviewed answers are currently published.</p>
          )}
        </div>
      ) : selected ? (
        <>
          <button className="catalog-back" onClick={() => setSelected(null)}>
            ← Back to records
          </button>
          <article className="catalog-detail">
            <p>{selected.subtitle}</p>
            {selected.organization && <p>{selected.organization}</p>}
            {(selected.start_date || selected.end_date) && (
              <p>
                {[selected.start_date, selected.end_date]
                  .filter(Boolean)
                  .join(" – ")}
              </p>
            )}
            <SafeMarkdown text={selected.description || selected.summary} />
            {selected.outcomes?.length ? (
              <ul>
                {selected.outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            ) : null}
            {selected.skills.length > 0 && (
              <div className="catalog-tags">
                {selected.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            )}
          </article>
          {connections.length > 0 && (
            <>
              <h3>Connected work & skills</h3>
              <div className="catalog-grid">{connections.map(recordCard)}</div>
            </>
          )}
        </>
      ) : active ? (
        <>
          {panel === "explorer" && (
            <button
              className="catalog-back"
              onClick={() => {
                setCategory(null);
                setSubcategory(null);
                setQuery("");
              }}
            >
              ← All categories
            </button>
          )}
          {hasSubcategories && (
            <>
              {subcategory !== null && (
                <button
                  className="catalog-back"
                  onClick={() => selectSubcategory(null)}
                >
                  ← Browse {label.toLowerCase()} subcategories
                </button>
              )}
              <div
                className="catalog-subcategory-actions"
                role="group"
                aria-label={`${label} views`}
              >
                <button
                  aria-pressed={subcategory === "all"}
                  onClick={() => selectSubcategory("all")}
                >
                  Show all {label.toLowerCase()}{" "}
                  <span>({allRecords.length})</span>
                </button>
                <button
                  aria-pressed={subcategory === "uncategorized"}
                  onClick={() => selectSubcategory("uncategorized")}
                >
                  Uncategorized <span>({uncategorized.length})</span>
                </button>
              </div>
            </>
          )}
          <label className="catalog-search">
            <span className="sr-only">Search records</span>
            <input
              placeholder={
                browsingGroups
                  ? `Search all ${label.toLowerCase()}…`
                  : "Filter by name, skill or keyword…"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {browsingGroups ? (
            <>
              <p className="catalog-group-label">
                {active === "skill_records"
                  ? "Browse by skill category"
                  : active === "education"
                    ? "Browse by school or institution"
                    : active === "certifications"
                      ? "Browse by issuer"
                      : active === "experiences"
                        ? "Browse by employer"
                        : "Browse by organization"}
              </p>
              <div className="catalog-grid">
                {groups.map((entry) => (
                  <button
                    className="catalog-card category-card"
                    key={entry.id}
                    onClick={() => selectSubcategory(entry.id)}
                  >
                    <h3>{entry.title}</h3>
                    <span>
                      {entry.recordIds.length}{" "}
                      {entry.recordIds.length === 1 ? "record" : "records"} ↗
                    </span>
                  </button>
                ))}
              </div>
              {!groups.length && (
                <p>
                  No subcategories assigned yet. Choose Show all{" "}
                  {label.toLowerCase()} or Uncategorized to browse records.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="catalog-group-label" role="status">
                {records.length} {records.length === 1 ? "record" : "records"}
                {query.trim() ? " matching your search" : ""}
              </p>
              <div className="catalog-grid">{records.map(recordCard)}</div>
              {!records.length && (
                <p>
                  {query.trim()
                    ? "No records match your search."
                    : subcategory === "uncategorized"
                      ? "No uncategorized records."
                      : "No relevant evidence is currently stored."}
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="catalog-grid">
          {categories.map(([key, label, description]) => (
            <button
              className="catalog-card category-card"
              key={key}
              onClick={() => {
                setCategory(key);
                setSubcategory(null);
                setQuery("");
              }}
            >
              <h3>{label}</h3>
              <p>{description}</p>
              <span>
                {catalogRecords(data, key).length} published records ↗
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
