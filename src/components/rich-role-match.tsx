import type { Match } from "@/lib/ai/contracts";
import { answerDisplay } from "@/lib/answer-display";
import { RichCareerAnswer } from "./rich-career-answer";
import { SafeMarkdown } from "./safe-markdown";
import { ProjectEvidence } from "./project-evidence";
import styles from "./rich-career-answer.module.css";

export function RichRoleMatch({ match }: { match: Match }) {
  const summary = answerDisplay(match.overall_summary);
  const points = [...new Set(match.strong_matches.map(answerDisplay))].filter(
    (item) => item && item !== summary,
  );
  return (
    <div className={styles.match}>
      <p className="eyebrow">Role fit / evidence-led comparison</p>
      <h3>Where the experience connects</h3>
      <RichCareerAnswer text={summary} actions={false} />
      {(points.length > 0 || match.gaps.length > 0) && (
        <div className={styles.matchGrid}>
          {points.length > 0 && (
            <section className={styles.matchPanel}>
              <h4>Supported matches</h4>
              <ul>
                {points.map((item, i) => (
                  <li key={i}>
                    <SafeMarkdown text={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {match.gaps.length > 0 && (
            <section className={`${styles.matchPanel} ${styles.gaps}`}>
              <h4>Needs further evidence</h4>
              <ul>
                {match.gaps.map((item, i) => (
                  <li key={i}>
                    <SafeMarkdown text={answerDisplay(item)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      {match.skills.length > 0 && (
        <ul className={styles.tags} aria-label="Relevant documented skills">
          {match.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      )}
      {match.suggested_resume_emphasis.length > 0 && (
        <details>
          <summary>Suggested résumé emphasis</summary>
          <ul>
            {match.suggested_resume_emphasis.map((item, i) => (
              <li key={i}>
                <SafeMarkdown text={answerDisplay(item)} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <ProjectEvidence
        rich
        ids={match.supporting_experience}
        query="Relevant projects for this role"
      />
    </div>
  );
}
