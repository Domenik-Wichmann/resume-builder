"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { careerSchema, type CareerRecord } from "@/lib/career/model";
import { SafeMarkdown } from "./safe-markdown";

const catalogSchema = z.object({
  career: careerSchema.omit({ profile: true, skills: true }),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});
const categories = [
  ["skill_records", "Skills", "Tools and capabilities connected to work"],
  ["experiences", "Experience", "Roles and professional background"],
  ["projects", "Projects", "Work built and delivered"],
  ["achievements", "Achievements", "Supported outcomes and contributions"],
  ["education", "Education", "Learning and academic background"],
  ["certifications", "Certifications", "Published credentials"],
  ["languages", "Languages", "Languages and proficiency"],
] as const;
type Category = (typeof categories)[number][0];
export type StudioPanel = "chat" | "explorer" | "projects" | "answers";

export function RecruiterExplorer({
  panel,
}: {
  panel: Exclude<StudioPanel, "chat">;
}) {
  const [data, setData] = useState<z.infer<typeof catalogSchema> | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
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
  const records = active
    ? (data.career[active] || []).filter((record) =>
        [record.title, record.summary, ...record.skills]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : [];
  const connections = selected
    ? categories
        .flatMap(([key]) => data.career[key] || [])
        .filter(
          (record) =>
            record.id !== selected.id &&
            (selected.skills.includes(record.title) ||
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
              ? categories.find(([key]) => key === active)?.[1]
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
                setQuery("");
              }}
            >
              ← All categories
            </button>
          )}
          <label className="catalog-search">
            <span className="sr-only">Search records</span>
            <input
              placeholder="Filter by name, skill or keyword…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="catalog-grid">{records.map(recordCard)}</div>
          {!records.length && <p>No relevant evidence is currently stored.</p>}
        </>
      ) : (
        <div className="catalog-grid">
          {categories.map(([key, label, description]) => (
            <button
              className="catalog-card category-card"
              key={key}
              onClick={() => {
                setCategory(key);
                setQuery("");
              }}
            >
              <h3>{label}</h3>
              <p>{description}</p>
              <span>{data.career[key]?.length || 0} published records ↗</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
