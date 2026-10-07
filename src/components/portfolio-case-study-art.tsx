import type { PortfolioStory } from "@/lib/portfolio/story";
import { PortfolioSchemaArt } from "./portfolio-schema-art";
import { PortfolioDiffArt } from "./portfolio-diff-art";
import { PortfolioUseArt } from "./portfolio-use-art";

function ProjectArt({ story }: { story: PortfolioStory }) {
  return (
    <div className="case-panel project-art">
      <div className="artifact-label">
        The website you are using / the project being shown
      </div>
      <div className="project-recursion">
        <svg
          viewBox="0 0 500 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M330 50 C500 50 490 220 330 240 M170 240 C10 240 10 50 170 50" />
        </svg>
        <div className="project-portfolio">
          <small>Portfolio / the interface</small>
          <strong>{story.profile.name}</strong>
          <span>My experience, projects and skills</span>
        </div>
        <div className="project-loop-labels">
          <span>Shows the project {"\u2191"}</span>
          <span>Powers the portfolio {"\u2193"}</span>
        </div>
        <div className="project-application">
          <small>Project / the application</small>
          <strong>Resume Builder</strong>
          <span>Career knowledge + evidence + application logic</span>
        </div>
      </div>
      <div className="project-capabilities">
        <span>Store career facts</span>
        <span>Answer recruiter questions</span>
        <span>Compose tailored résumés</span>
      </div>
      <p>The project powers the very portfolio that explains it.</p>
    </div>
  );
}
function ImportArt() {
  return (
    <div className="case-panel import-art">
      <div className="artifact-label">Start with your own words</div>
      <div className="import-human-inputs">
        <div className="import-writing">
          <div className="import-person">
            <span aria-hidden="true">D</span>
            <small>Tell it about your work</small>
          </div>
          <blockquote>
            I work with spreadsheets. I built a tool that checks each row
            against a set of rules, so I don&apos;t have to keep checking
            everything by hand.
            <span className="import-writing-cursor" aria-hidden="true" />
          </blockquote>
          <small>Example input / written in everyday language</small>
        </div>
        <div className="import-upload">
          <div className="import-document" aria-hidden="true">
            <span>MY CAREER NOTES</span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>Upload your docs</strong>
            <small>Text or Markdown notes</small>
          </div>
          <span className="import-upload-arrow" aria-hidden="true">
            {"\u2193"}
          </span>
        </div>
      </div>
      <div className="import-funnel" aria-hidden="true">
        <svg viewBox="0 0 500 44" preserveAspectRatio="none">
          <path d="M140 0 C140 25 250 18 250 40 M390 0 C390 25 250 18 250 40" />
        </svg>
        <span>{"\u2193"}</span>
      </div>
      <div className="import-organizer">
        <small>AI reads it and picks out the facts</small>
        <strong>Your story becomes connected information</strong>
      </div>
      <div className="import-proposed-facts">
        <div>
          <small>Project</small>
          <strong>Spreadsheet checking tool</strong>
        </div>
        <div>
          <small>Skill</small>
          <strong>Spreadsheet automation</strong>
        </div>
        <div>
          <small>Work</small>
          <strong>Checking data against rules</strong>
        </div>
      </div>
      <div className="import-owner-review">
        <span aria-hidden="true">{"\u2193"}</span>
        <strong>I check the facts before adding them.</strong>
      </div>
      <div className="case-annotation">
        Illustrative input and draft / OpenRouter extraction / Zod validation /
        owner review
      </div>
    </div>
  );
}
function FeedbackArt() {
  return (
    <div className="case-panel feedback-art">
      <div className="artifact-label">
        Interaction {"\u2192"} feedback / illustrative demo data
      </div>
      <div className="feedback-events">
        <span>Visit</span>
        <span>Question / topic</span>
        <span>Résumé preview</span>
        <span>Recorded outcome</span>
      </div>
      <div className="feedback-event-stream" aria-hidden="true">
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
      <div className="feedback-signal">
        <small>Illustrative feedback</small>
        <strong>Questions focus on the AI project</strong>
        <span>
          Review the career evidence and recorded application outcomes
        </span>
      </div>
      <div className="case-annotation">
        Application attribution / event analytics / private questions /
        aggregate signals
      </div>
    </div>
  );
}
const stackLayers = [
  {
    layer: "Frontend",
    names: "Next.js / React / TypeScript",
    purpose: "Owner tools and recruiter interface",
  },
  {
    layer: "Application",
    names: "API routes / Zod / career-review logic / Resume IR",
    purpose: "Validate requests, reconcile changes and compile supported facts",
  },
  {
    layer: "Data",
    names: "Supabase / PostgreSQL / RLS / pgvector",
    purpose:
      "Canonical records, exact evidence, tenant boundaries and vector search",
  },
  {
    layer: "AI",
    names: "OpenRouter / Luna Pro / Cohere embeddings",
    purpose:
      "Interpret text, find meaning and compose evidence-backed language",
  },
  {
    layer: "Infrastructure",
    names: "Vercel / GitHub / CI",
    purpose: "Deploy the application and run checks",
  },
];
function StackArt() {
  return (
    <div className="case-panel stack-art">
      <div className="artifact-label">
        One application / connected responsibilities
      </div>
      <div className="stack-layers">
        {stackLayers.map(({ layer, names, purpose }) => (
          <div className="stack-layer" key={layer}>
            <small>{layer}</small>
            <div>
              <strong>{names}</strong>
              <span>{purpose}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="stack-flow">
        Request {"\u2192"} validated logic {"\u2192"} verified evidence{" "}
        {"\u2192"} rendered output
      </div>
      <div className="stack-boundary">
        <span>PRIVATE / sources, review, applications</span>
        <strong>Explicit publication boundary</strong>
        <span>PUBLIC / approved career evidence</span>
      </div>
      <div className="case-annotation">
        Deterministic identity / permissions / evidence / review / publication /
        résumé admission
      </div>
    </div>
  );
}
export function CaseStudyArt({
  step,
  story,
}: {
  step: number;
  story: PortfolioStory;
}) {
  if (step === 1) return <ProjectArt story={story} />;
  if (step === 2) return <ImportArt />;
  if (step === 3) return <PortfolioSchemaArt story={story} />;
  if (step === 4) return <PortfolioDiffArt story={story} />;
  if (step === 5) return <PortfolioUseArt story={story} />;
  if (step === 6) return <FeedbackArt />;
  return <StackArt />;
}
