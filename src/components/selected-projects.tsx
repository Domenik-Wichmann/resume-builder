"use client";
import { useEffect, useState } from "react";
import { showcaseSchema, type ShowcaseCard } from "@/lib/portfolio/selection";
import { ProjectCards } from "./project-cards";

export function SelectedProjects() {
  const [projects, setProjects] = useState<ShowcaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/selected-projects", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Cannot load projects.");
        const result = showcaseSchema.parse(await response.json());
        if (!controller.signal.aborted) setProjects(result.projects);
      } catch {
        if (!controller.signal.aborted)
          setError("Cannot load projects. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  return (
    <div className="selected-projects-panel">
      <p className="eyebrow">Projects</p>
      <h2>Apps I’ve built</h2>
      <p className="showcase-intro">
        Explore the projects, how they work, and the ideas behind them.
      </p>
      {loading && <p role="status">Loading projects…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt(attempt + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        (projects.length ? (
          <ProjectCards projects={projects} />
        ) : (
          <p>No projects published yet.</p>
        ))}
    </div>
  );
}
