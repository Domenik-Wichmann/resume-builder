import { useState } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";

export function PortfolioSchemaArt({ story }: { story: PortfolioStory }) {
  const [selected, setSelected] = useState(0);
  const entity = story.schemaEntities[selected];
  return (
    <div className="case-panel schema-art">
      <div className="artifact-label">
        Records → claims → exact supporting evidence
      </div>
      <div className="schema-account">
        <small>Career account / published records</small>
        <strong>{story.profile.name}</strong>
      </div>
      <div className="schema-network">
        <svg
          viewBox="0 0 600 260"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="schema-ownership"
            d="M300 0 C300 25 100 15 100 55 M300 0 L300 55 M300 0 C300 25 500 15 500 55 M300 0 C600 20 590 240 300 210"
          />
          {story.schemaEntities[3].linked && (
            <path className="schema-relation" d="M100 100 L100 200" />
          )}
          {story.schemaEntities[2].linked && (
            <path
              className="schema-relation"
              d="M100 100 C100 155 500 155 500 100"
            />
          )}
        </svg>
        {story.schemaEntities.map((node, index) => (
          <button
            type="button"
            key={node.kind}
            className={`schema-node schema-node-${index}`}
            disabled={node.title === "No published record"}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <small>{node.kind}</small>
            <strong>{node.title}</strong>
            {node.linked && <span>Linked to this project</span>}
          </button>
        ))}
        <div className="schema-chain-node">
          <small>Evidence model</small>
          <strong>Claim → Evidence span → Source</strong>
        </div>
      </div>
      <div className="schema-legend">
        <span>Dashed / same account</span>
        <span>Solid / recorded relationship</span>
      </div>
      <div
        className="schema-detail"
        aria-live="polite"
        role="region"
        aria-label="Selected career record and supporting evidence"
        tabIndex={0}
      >
        <small>
          {entity.kind} / {entity.title}
        </small>
        <strong>
          {entity.quote ? "Canonical claim" : "Published example summary"}
        </strong>
        <p>{entity.claim}</p>
        <small>
          {entity.quote
            ? "Supported by exact source excerpts"
            : "Source evidence"}
        </small>
        <blockquote>
          {entity.quote ||
            "No source excerpt is available for this demonstration."}
        </blockquote>
      </div>
      <div className="case-annotation">
        PostgreSQL / Supabase · recorded relationships · claim-level provenance
        · stable identity
      </div>
    </div>
  );
}
