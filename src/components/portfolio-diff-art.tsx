import { useState } from "react";
import type { PortfolioStory } from "@/lib/portfolio/story";

export function PortfolioDiffArt({ story }: { story: PortfolioStory }) {
  const [replay, setReplay] = useState(0);
  const current = story.modelEvidence?.skills[0] || "Existing supported fact";
  const added =
    story.modelEvidence?.skills[1] || "Additional supporting passage";
  return (
    <div className="case-panel diff-art">
      <div className="artifact-label">
        Illustrative comparison / no saved changes
      </div>
      <div className="diff-comparison" key={replay}>
        <div className="diff-snapshot">
          <small>Existing knowledge / illustrative baseline</small>
          <strong>{story.modelEvidence?.title || "Career record"}</strong>
          <div className="diff-tree">
            <span>{current}</span>
            <span>Approved claim + evidence</span>
          </div>
        </div>
        <div className="diff-compare-arrow" aria-hidden="true">
          ⇄
        </div>
        <div className="diff-snapshot diff-incoming">
          <small>New input / illustrative proposal</small>
          <strong>Same project, more information</strong>
          <div className="diff-tree">
            <span>{current}</span>
            <span className="diff-added-node">{added}</span>
          </div>
        </div>
      </div>
      <div className="diff-identity">
        Match the existing record → compare facts → review the patch
      </div>
      <div className="diff-results" key={`results-${replay}`}>
        <div className="diff-result diff-unchanged">
          <small>UNCHANGED</small>
          <span>{current}</span>
        </div>
        <div className="diff-result diff-added">
          <small>ADDED</small>
          <span>{added}</span>
        </div>
        <div className="diff-result diff-updated">
          <small>UPDATED</small>
          <span>Revised source-backed description</span>
        </div>
        <div className="diff-result diff-review">
          <small>REVIEW</small>
          <span>Conflicting information needs a decision</span>
        </div>
        <div className="diff-result diff-archive">
          <small>ARCHIVE PROPOSED</small>
          <span>Omitted from a complete master; owner review required</span>
        </div>
      </div>
      <div className="diff-review-boundary">
        <strong>Reviewed patch → existing career database</strong>
        <span>No automatic deletion or publication</span>
        <button type="button" onClick={() => setReplay(replay + 1)}>
          Replay comparison <span aria-hidden="true">↓</span>
        </button>
      </div>
      <div className="case-annotation">
        Identity reconciliation · source-backed diffing · conflict state ·
        version-checked review
      </div>
    </div>
  );
}
