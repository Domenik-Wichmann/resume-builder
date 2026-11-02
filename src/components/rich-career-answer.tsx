"use client";
import { useState } from "react";
import { SafeMarkdown } from "./safe-markdown";
import { richAnswerBlocks, plainRichAnswer } from "@/lib/portfolio/rich-answer";
import styles from "./rich-career-answer.module.css";

export function RichCareerAnswer({
  text,
  actions = true,
}: {
  text: string;
  actions?: boolean;
}) {
  const [copied, setCopied] = useState("");
  const blocks = richAnswerBlocks(text);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainRichAnswer(text));
      setCopied("Copied");
    } catch {
      setCopied("Select the answer text to copy it.");
    }
  };
  return (
    <div className={styles.answer}>
      <div className={styles.blocks}>
        {blocks.map((block, i) => {
          if (block.type === "flow")
            return (
              <section
                key={i}
                className={styles.visual}
                aria-label={block.flow.title}
              >
                <div className={styles.kicker}>Workflow / visual summary</div>
                <h3>{block.flow.title}</h3>
                <ol className={styles.flow}>
                  {block.flow.steps.map((step, n) => (
                    <li key={n}>
                      <span className={styles.stepNumber} aria-hidden="true">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h4>{step.title}</h4>
                        <p>{step.detail}</p>
                      </div>
                      {n < block.flow.steps.length - 1 && (
                        <span className={styles.connector} aria-hidden="true">
                          ↓
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          if (block.type === "table")
            return (
              <div
                key={i}
                className={styles.tableWrap}
                role="region"
                aria-label="Answer comparison"
                tabIndex={0}
              >
                <table>
                  <caption>At a glance</caption>
                  <thead>
                    <tr>
                      {block.headings.map((cell, n) => (
                        <th scope="col" key={n}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, n) => (
                      <tr key={n}>
                        {row.map((cell, m) =>
                          m === 0 ? (
                            <th scope="row" key={m}>
                              <SafeMarkdown text={cell} />
                            </th>
                          ) : (
                            <td key={m}>
                              <SafeMarkdown text={cell} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          if (block.type === "section")
            return (
              <section className={styles.section} key={i}>
                <SafeMarkdown text={`## ${block.title}\n\n${block.text}`} />
              </section>
            );
          if (block.type === "code")
            return (
              <pre className={styles.code} key={i}>
                <code>{block.text}</code>
              </pre>
            );
          if (block.type === "unavailable")
            return (
              <p className={styles.notice} key={i}>
                This visual could not be displayed. The written answer and
                available project evidence remain below.
              </p>
            );
          return (
            <div className={styles.intro} key={i}>
              <SafeMarkdown text={block.text} />
            </div>
          );
        })}
      </div>
      {actions && (
        <div className={styles.actions}>
          <button type="button" onClick={() => void copy()}>
            Copy answer
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("portfolio-question", {
                  detail:
                    "Can you explain the implementation behind that example?",
                }),
              )
            }
          >
            Explore the implementation ↗
          </button>
          <span role="status">{copied}</span>
        </div>
      )}
    </div>
  );
}
