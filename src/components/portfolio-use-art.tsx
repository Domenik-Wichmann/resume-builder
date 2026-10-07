import { useState } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";

export function PortfolioUseArt({ story }: { story: PortfolioStory }) {
  const [output, setOutput] = useState<"answer" | "resume">("answer");
  const [selected, setSelected] = useState(0);
  const record = story.examples[selected];
  const evidence = story.evidence;
  return (
    <div className="case-panel use-art">
      <div className="use-knowledge">
        <small>One saved career database</small>
        <strong>Published records + supported claims + evidence</strong>
      </div>
      <div
        className="use-output-controls"
        role="group"
        aria-label="Illustrated uses of the same career knowledge"
      >
        <button
          type="button"
          aria-pressed={output === "answer"}
          onClick={() => setOutput("answer")}
        >
          Recruiter question
        </button>
        <button
          type="button"
          aria-pressed={output === "resume"}
          onClick={() => setOutput("resume")}
        >
          Role-specific résumé
        </button>
      </div>
      {output === "answer" ? (
        <div className="use-answer-view">
          <div className="case-question">“{story.retrievalQuestion}”</div>
          <div className="use-retrieval-label">
            Cohere embeddings + pgvector + recorded relationships{" "}
            <span aria-hidden="true">↓</span>
          </div>
          <div className="use-context-network">
            <span className="use-query-node">Question / meaning</span>
            <div className="use-context-records">
              {story.examples.map((row, index) => (
                <button
                  key={row.title}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <small>{row.kind}</small>
                  <strong>{row.title}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="use-context-detail">
            <span>
              Related skills:{" "}
              {record?.skills.join(" · ") || "No published match"}
            </span>
            {record?.achievements.length ? (
              <span>
                Recorded achievement: {record.achievements.join(" · ")}
              </span>
            ) : null}
            <span>Supported claims → exact evidence → evidence packet</span>
          </div>
          <div className="use-answer-preview">
            <small>Precomputed answer excerpt / published facts</small>
            <strong>
              {record?.title || "No relevant evidence is currently stored."}
            </strong>
            {record?.context && <small>{record.context}</small>}
            <p>
              {record?.claims[0] || "No relevant evidence is currently stored."}
            </p>
          </div>
          <div className="case-annotation">
            Relationship/context expansion → evidence packets → claim support
            checks → grounded Q&A
          </div>
        </div>
      ) : (
        <div className="use-resume-view">
          <div className="use-role-brief">
            <small>Illustrative job requirements</small>
            <strong>Data & AI application work</strong>
            <span>
              {evidence?.skills.join(" · ") || "No published skill match"}
            </span>
          </div>
          <div className="use-resume-pipeline">
            <div>
              <small>1 / Requirements</small>
              <strong>Analyze the role</strong>
            </div>
            <span aria-hidden="true">↓</span>
            <div>
              <small>2 / Retrieve evidence</small>
              <strong>
                {evidence?.title || "No relevant evidence is currently stored."}
              </strong>
            </div>
            <span aria-hidden="true">↓</span>
            <div>
              <small>3 / Supported claims</small>
              <strong>Check admission and whole-bullet support</strong>
            </div>
            <span aria-hidden="true">↓</span>
            <div>
              <small>4 / Resume IR</small>
              <strong>Compose typed résumé sections</strong>
            </div>
          </div>
          <div className="case-document">
            <small>5 / DETERMINISTIC RENDERING → PRINT / PDF</small>
            <strong>{story.profile.name}</strong>
            <span>{evidence?.title}</span>
            <p>
              {evidence?.source?.claims[0] ||
                evidence?.passage ||
                "No relevant evidence is currently stored."}
            </p>
          </div>
          <div className="case-annotation">
            The same career facts. Role-specific relevance. Application-rendered
            HTML.
          </div>
        </div>
      )}
    </div>
  );
}
