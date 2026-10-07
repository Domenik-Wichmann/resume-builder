import { useState } from "react";
import type { PublicQuestionExample } from "@/lib/portfolio/story";

export function PortfolioQuestionExamples({
  examples,
}: {
  examples: PublicQuestionExample[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!examples.length) return <p>No relevant evidence is currently stored.</p>;
  return (
    <div
      className="question-examples"
      role="region"
      aria-label="Example questions and published answers"
      tabIndex={0}
    >
      {examples.map((example) => {
        const open = expanded === example.topic;
        return (
          <article className="question-example" key={example.topic}>
            <button
              type="button"
              id={`example-question-${example.topic}`}
              aria-expanded={open}
              aria-controls={`example-answer-${example.topic}`}
              onClick={() => setExpanded(open ? null : example.topic)}
            >
              <span>{example.question}</span>
              <span aria-hidden="true">{open ? "↑" : "↓"}</span>
            </button>
            <div
              className="example-answer"
              id={`example-answer-${example.topic}`}
              role="region"
              aria-labelledby={`example-question-${example.topic}`}
              hidden={!open}
            >
              <p>{example.answer}</p>
              {example.items.map((item) => (
                <div
                  className="example-answer-item"
                  key={`${item.kind}-${item.title}`}
                >
                  <strong>{item.title}</strong>
                  <small>
                    {item.kind}
                    {item.context ? ` / ${item.context}` : ""}
                  </small>
                  {item.skills.length > 0 && (
                    <p className="example-skills">
                      Related skills: {item.skills.join(", ")}
                    </p>
                  )}
                  <ul>
                    {item.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <small className="published-answer-note">
                Based on published career evidence
              </small>
            </div>
          </article>
        );
      })}
    </div>
  );
}
