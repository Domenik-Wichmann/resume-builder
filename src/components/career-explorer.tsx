"use client";
import { useState } from "react";
import Link from "next/link";
import type { deriveExplorer } from "@/lib/portfolio/explorer";
import { rememberWorkspace, sendExploreSignal } from "./explore-signal";
export function CareerExplorer({
  data,
}: {
  data: ReturnType<typeof deriveExplorer>;
}) {
  const [selected, setSelected] = useState(data.skills[0]?.id || ""),
    [workspaces, setWorkspaces] = useState<{ id: string; title: string }[]>([]),
    [workspace, setWorkspace] = useState(""),
    [notice, setNotice] = useState("");
  const skill = data.skills.find((s) => s.id === selected);
  if (!data.skills.length)
    return (
      <div className="empty-state">
        <h2>No skills published yet.</h2>
        <p>
          This explorer grows from approved skills and their career evidence.
        </p>
      </div>
    );
  async function connect() {
    const r = await fetch("/api/workspaces");
    const d = await r.json();
    if (r.ok) {
      setWorkspaces(d.workspaces || []);
      if (!d.workspaces?.length)
        setNotice(
          "Create a workspace to save interests and ask follow-up questions.",
        );
    } else setNotice("Workspaces are temporarily unavailable.");
  }
  return (
    <>
      <div className="surface explorer-connection">
        <button onClick={connect}>Connect an existing workspace</button>
        {workspaces.length > 0 && (
          <label>
            Save interests in
            <select
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                if (e.target.value) rememberWorkspace(e.target.value);
              }}
            >
              <option value="">Choose workspace</option>
              {workspaces.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="muted">
          Optional: selections become coarse interest signals for your
          workspace. No new workspace is created.
        </p>
        <p role="status">{notice}</p>
      </div>
      <div className="explorer-layout">
        <div className="skill-map" aria-label="Career skill navigation">
          {[
            ...data.categories,
            {
              id: "",
              title: "Skills without a published category",
              summary: "",
            },
          ].map((c) => {
            const skills = data.skills.filter(
              (s) => (s.category_id || "") === c.id,
            );
            if (!skills.length) return null;
            return (
              <section key={c.id} className="category-cluster">
                <button
                  className="category-node"
                  onClick={() => {
                    setNotice(c.summary || c.title);
                    if (c.id)
                      void sendExploreSignal(
                        "category",
                        c.id,
                        workspace || undefined,
                      );
                  }}
                >
                  {c.title}
                </button>
                <div className="skill-bubbles">
                  {skills.map((s) => (
                    <button
                      key={s.id}
                      className={`skill-node ${s.id === selected ? "selected" : ""}`}
                      aria-pressed={s.id === selected}
                      onClick={() => {
                        setSelected(s.id);
                        void sendExploreSignal(
                          "skill",
                          s.id,
                          workspace || undefined,
                        );
                      }}
                    >
                      {s.name}
                      <small>{s.evidence_count} supporting records</small>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        {skill && (
          <aside className="surface skill-detail">
            <p className="eyebrow">Evidence explorer</p>
            <h2>{skill.name}</h2>
            <p>{skill.description || "No description published."}</p>
            <p>{skill.evidence_count} supporting career records</p>
            {[
              ["Experience", skill.experiences],
              ["Projects", skill.projects],
              ["Achievements", skill.achievements],
            ].map(([label, rows]) => {
              const records = rows as typeof skill.projects;
              return (
                records.length > 0 && (
                  <section key={label as string}>
                    <h3>{label as string}</h3>
                    {records.map((r) => (
                      <div className="evidence-item" key={r.id}>
                        {label === "Projects" ? (
                          <Link
                            className="text-link"
                            href={`/projects/${r.slug}`}
                          >
                            {r.title} ↗
                          </Link>
                        ) : (
                          <strong>{r.title}</strong>
                        )}
                        <p>{r.summary}</p>
                      </div>
                    ))}
                  </section>
                )
              );
            })}
            {skill.related.length > 0 && (
              <section>
                <h3>Used alongside</h3>
                <div className="chips">
                  {skill.related.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </section>
            )}
            <Link
              className="button"
              href={`${workspace ? `/workspace/${workspace}` : "/workspace"}?question=${encodeURIComponent(`What evidence supports ${skill.name}?`)}`}
            >
              Ask about this →
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}
