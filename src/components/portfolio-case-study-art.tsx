import { useState, type ReactNode } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";

function Flow({ children }: { children: ReactNode }) {
  return <div className="case-flow">{children}</div>;
}
function Stage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="case-step">
      <small>{label}</small>
      <div>{children}</div>
    </div>
  );
}
function SourceText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(
          /(PostgreSQL|Supabase|SQL|Next\.js|TypeScript|VBA|regex|pgvector|Cohere|OpenRouter)/gi,
        )
        .map((part, index) =>
          index % 2 ? <mark key={index}>{part}</mark> : part,
        )}
    </>
  );
}
function Arrow() {
  return (
    <span className="case-arrow" aria-hidden="true">
      ↓
    </span>
  );
}

export function CaseStudyArt({
  step,
  story,
}: {
  step: number;
  story: PortfolioStory;
}) {
  const [selected, setSelected] = useState(0);
  const [selectedResult, setSelectedResult] = useState(0);
  const result = story.examples[selectedResult];
  const evidence = step <= 2 ? story.modelEvidence : story.evidence;
  const passage =
    evidence?.source?.quote ||
    evidence?.passage ||
    "No relevant evidence is currently stored.";
  const claims = evidence?.source?.claims || [];
  const sourceLabel = evidence?.source
    ? "Exact published source excerpts"
    : "Published career summary";
  const question = story.retrievalQuestion;
  if (step === 1)
    return (
      <div className="case-panel case-input">
        <div className="artifact-label">
          01 / Owner input → proposed changes
        </div>
        <div className="case-input-tabs">
          <span>Text / Markdown</span>
          <span>Typed career interview</span>
        </div>
        <div className="case-source">
          <small>
            {sourceLabel} · {evidence?.title}
          </small>
          <blockquote>
            <SourceText text={passage} />
          </blockquote>
        </div>
        <Flow>
          <Stage label="Interpret">
            <strong>OpenRouter / Luna Pro</strong>
            <span>Extract entities, claims and source spans</span>
          </Stage>
          <Arrow />
          <Stage label="Validate">
            <strong>Typed output / Zod schemas</strong>
            <span>Check the proposed record shape</span>
          </Stage>
          <Arrow />
          <Stage label="Owner review">
            <strong>Compare → accept → publish separately</strong>
            <span>Proposals do not silently become public facts</span>
          </Stage>
        </Flow>
      </div>
    );
  if (step === 2)
    return (
      <div className="case-panel case-model">
        <div className="artifact-label">02 / Source → connected records</div>
        <div className="case-source">
          <small>{sourceLabel}</small>
          <blockquote>
            <SourceText text={passage} />
          </blockquote>
        </div>
        <div className="case-model-network">
          <svg
            viewBox="0 0 500 220"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M250 35 L250 95 M250 125 L110 180 M250 125 L390 180" />
          </svg>
          <span className="case-link-caption">source supports</span>
          <button
            className="case-entity case-root"
            aria-pressed={selected === 0}
            onClick={() => setSelected(0)}
          >
            <small>{evidence?.kind || "Record"}</small>
            <strong>{evidence?.title || "Awaiting published evidence"}</strong>
          </button>
          <div className="case-claim">
            <small>
              {claims.length
                ? "Approved claim"
                : "Published summary / illustrative decomposition"}
            </small>
            <span>
              {claims[0] ||
                evidence?.passage ||
                "No relevant evidence is currently stored."}
            </span>
          </div>
          {(evidence?.skills || []).map((skill, index) => (
            <button
              key={skill}
              className={`case-entity case-skill-${index}`}
              aria-pressed={selected === index + 1}
              onClick={() => setSelected(index + 1)}
            >
              <small>Linked skill</small>
              <strong>{skill}</strong>
            </button>
          ))}
        </div>
        <div className="case-inspection" aria-live="polite">
          <small>
            {selected === 0
              ? "Record evidence"
              : `Linked to ${evidence?.skills[selected - 1]}`}
          </small>
          <span>
            {selected === 0
              ? "The original passage stays attached to the claim."
              : "This association comes from the published career model; the passage shows what the work supports."}
          </span>
        </div>
        {evidence?.achievements.length ? (
          <div className="case-linked-achievement">
            <small>Linked achievement</small>
            {evidence.achievements.join(" / ")}
          </div>
        ) : null}
        <div className="case-annotation">
          PostgreSQL / Supabase · stable identity · reconciliation · provenance
        </div>
      </div>
    );
  if (step === 3)
    return (
      <div className="case-panel case-retrieval">
        <div className="artifact-label">03 / Question → evidence → answer</div>
        <div className="case-question">“{question}”</div>
        <Flow>
          <Stage label="Find candidates">
            <strong>Cohere embeddings + pgvector</strong>
            <span>Meaning search + structured record context</span>
          </Stage>
          <Arrow />
        </Flow>
        <div className="case-evidence-list">
          {story.examples.map((row) => (
            <button
              key={row.title}
              aria-pressed={selectedResult === story.examples.indexOf(row)}
              onClick={() => setSelectedResult(story.examples.indexOf(row))}
            >
              <small>
                {row.kind} / {row.skills.join(" \u00b7 ")}
              </small>
              <strong>{row.title}</strong>
            </button>
          ))}
        </div>
        <div className="case-source">
          <small>
            {result?.exact
              ? "Exact published source excerpts"
              : "Published career summary"}{" "}
            / {result?.title}
          </small>
          <blockquote>
            <SourceText
              text={
                result?.passage || "No relevant evidence is currently stored."
              }
            />
          </blockquote>
        </div>
        <div className="case-answer">
          <small>Evidence-backed answer preview / curated excerpt</small>
          <strong>
            {result?.title || "No relevant evidence is currently stored."}
          </strong>
          <span className="case-answer-excerpt">
            {result?.claims[0] || result?.passage}
          </span>
          <span>
            Publication + source freshness + claim support checked before
            generation.
          </span>
        </div>
        <div className="case-annotation">
          Evidence packets → claim support checks → grounded generation
        </div>
      </div>
    );
  if (step === 4)
    return (
      <div className="case-panel case-output">
        <div className="artifact-label">
          04 / Illustrative role → supported document
        </div>
        <div className="case-job">
          <small>Illustrative role requirements</small>
          <strong>Data & AI application work</strong>
          <span>
            {evidence?.skills.join(" · ") || "No published skill match"}
          </span>
        </div>
        <Flow>
          <Stage label="Requirements">
            <strong>Extract what the role needs</strong>
          </Stage>
          <Arrow />
          <Stage label="Evidence">
            <strong>
              {evidence?.title || "No relevant evidence is currently stored."}
            </strong>
            <span>Retrieve claims → check whole-bullet support</span>
          </Stage>
          <Arrow />
          <Stage label="Resume IR">
            <strong>Admitted facts → typed sections</strong>
            <span>Canonical facts + workspace relevance</span>
          </Stage>
          <Arrow />
        </Flow>
        <div className="case-document">
          <small>DETERMINISTIC RENDERING → PRINT / PDF</small>
          <strong>{story.profile.name}</strong>
          <span>{evidence?.title}</span>
          <p>
            {claims[0] ||
              evidence?.passage ||
              "No relevant evidence is currently stored."}
          </p>
        </div>
        <div className="case-annotation">
          Models propose text. The compiler controls admission and final HTML.
        </div>
      </div>
    );
  if (step === 5)
    return (
      <div className="case-panel case-architecture">
        <div className="artifact-label">
          05 / One application, explicit boundaries
        </div>
        <div className="case-app">
          <strong>Next.js / React / TypeScript</strong>
          <span>Owner tools ← API routes → recruiter interface</span>
          <small>Vercel deployment / GitHub Actions checks</small>
        </div>
        <div className="case-system-grid">
          <Stage label="Canonical truth">
            <strong>Supabase / PostgreSQL</strong>
            <span>Records, claims, relationships and exact evidence</span>
          </Stage>
          <Stage label="Find evidence">
            <strong>Cohere / pgvector</strong>
            <span>Embeddings select candidates, not career truth</span>
          </Stage>
          <Stage label="Interpret & compose">
            <strong>OpenRouter / Luna Pro</strong>
            <span>Structured extraction and evidence-backed text</span>
          </Stage>
          <Stage label="Enforce">
            <strong>Deterministic application code</strong>
            <span>Auth / RLS · review · publication · résumé compiler</span>
          </Stage>
        </div>
        <div className="case-boundary">
          <span>PRIVATE / owner sources, drafts, applications</span>
          <strong>Explicit publication boundary</strong>
          <span>PUBLIC / approved career evidence</span>
        </div>
        <div className="case-annotation">
          Zod contracts · transactional changes · tenant isolation · Vitest
          checks
        </div>
      </div>
    );
  return (
    <div className="case-panel case-feedback">
      <div className="artifact-label">
        06 / Interaction → signals · demo data
      </div>
      <div className="case-events">
        <span>Application link</span>
        <span>Visit / question</span>
        <span>Résumé interaction</span>
      </div>
      <div className="case-event-stream" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="demo-metrics">
        <div>
          <strong>48</strong>
          <span>Visits</span>
        </div>
        <div>
          <strong>12</strong>
          <span>Questions</span>
        </div>
        <div>
          <strong>8</strong>
          <span>Résumé previews</span>
        </div>
      </div>
      <div
        className="story-chart"
        role="img"
        aria-label="Illustrative visits over seven days: 3, 5, 4, 8, 6, 10, 12."
      >
        {[3, 5, 4, 8, 6, 10, 12].map((value, index) => (
          <div key={index}>
            <span
              style={{
                height: `${(value / 12) * 100}%`,
                animationDelay: `${index * 65}ms`,
              }}
            />
            <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
          </div>
        ))}
      </div>
      <div className="case-feedback-signal">
        <small>Illustrative signal</small>
        <strong>Recruiters ask how the project uses AI</strong>
        <span>Review evidence gaps and recorded application outcomes</span>
      </div>
      <div className="case-annotation">
        Application attribution · event analytics · privacy-aware feedback
      </div>
    </div>
  );
}
