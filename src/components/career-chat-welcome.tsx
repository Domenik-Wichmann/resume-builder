"use client";
import styles from "./rich-career-answer.module.css";
const starters = [
  {
    title: "Explore the projects",
    icon: "□",
    description: "See what he built and the decisions behind it.",
    question:
      "Which projects best demonstrate his system design and automation work?",
  },
  {
    title: "Follow the architecture",
    icon: "◇",
    description: "Trace how the pieces of a system fit together.",
    question:
      "How did he design Sonaway's knowledge model and change workflow?",
  },
  {
    title: "Connect the experience",
    icon: "↗",
    description: "Find concrete examples behind a skill or role.",
    question:
      "What are his strongest examples of automating operational workflows?",
  },
];
export function CareerChatWelcome() {
  return (
    <section
      className={styles.welcome}
      aria-label="Start exploring the experience"
    >
      <p className={styles.kicker}>A conversation with the work</p>
      <h2>Go beyond the résumé.</h2>
      <p>
        Explore the projects, ask how something was built, or paste a job
        description. Answers connect to the relevant project pages and available
        evidence.
      </p>
      <div className={styles.starters}>
        {starters.map((item) => (
          <button
            type="button"
            key={item.title}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("portfolio-question", {
                  detail: item.question,
                }),
              )
            }
          >
            <b aria-hidden="true">{item.icon}</b>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
      <p>
        Choose a starting point to draft a question, then send it when you’re
        ready.
      </p>
    </section>
  );
}
