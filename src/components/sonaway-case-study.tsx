import styles from "./sonaway-case-study.module.css";

// Research: ghost-shadow at bae23329d7353583880d489d78c22d1dca94830f.
// Sources: app/ghost_shadow/README.md, SONAWAY_SEMANTIC_ARCHITECTURE_V1.md,
// reconciliation contracts/service, and the Canonical semantic document model.
// Preliminary / v0 / refinement are explanatory lifecycle labels, not API stages.
export const sonawayIntroduction = {
  title: "Sonaway",
  tagline:
    "Turning operational knowledge into a model you can inspect and improve.",
  summary:
    "Sonaway is a project for making sense of how an organization works. It turns scattered explanations and source material into connected, evidence-backed knowledge, with a review process for deciding what becomes accepted information.",
};

const relationships = [
  { type: "Role", name: "Receiving team", link: "performed by" },
  { type: "Record", name: "Purchase order", link: "checked against" },
  { type: "Condition", name: "Before stock is accepted", link: "must happen" },
  {
    type: "Exception",
    name: "Damaged goods need review",
    link: "if damage is found",
  },
];

const phases = [
  {
    number: "01",
    name: "Preliminary",
    subtitle: "Capture what the source actually says",
    text: "Start with an explanation of the work. Identify actions, people, objects and gaps, while keeping each interpretation connected to its source. An unclear responsibility stays an open question.",
    result: "Source evidence + an initial interpretation",
  },
  {
    number: "02",
    name: "v0",
    subtitle: "Build the first reviewable model",
    text: "Connect those details into processes, roles, conditions and relationships. Check the structure and evidence, then prepare a workspace that can be compared with existing knowledge and reviewed.",
    result: "A connected model, ready for review",
  },
  {
    number: "03",
    name: "Refinement",
    subtitle: "Improve the parts that need work",
    text: "Use clarifications and new evidence to resolve gaps or propose changes. Review the affected relationships, preserve unrelated information, and keep earlier versions so the change can be traced.",
    result: "Focused changes + a visible history",
  },
];

export function SonawayCaseStudy() {
  return (
    <div className={styles.story}>
      <section className={styles.section} aria-labelledby="sonaway-purpose">
        <p className="eyebrow">The problem</p>
        <h2 id="sonaway-purpose">
          Useful knowledge gets lost between the documents.
        </h2>
        <div className={styles.split}>
          <p>
            A procedure explains the steps. A conversation explains the
            exception. Another document names the person responsible.
            Understanding the work means connecting all three, and knowing which
            version to trust.
          </p>
          <p>
            Sonaway brings those connections into the model itself. The aim is
            to make operational knowledge easier to question, inspect and
            maintain, while keeping the evidence behind it within reach.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sonaway-ontology">
        <p className="eyebrow">The ontology</p>
        <h2 id="sonaway-ontology">A shared language for how work happens.</h2>
        <p className={styles.intro}>
          An ontology defines the kinds of things the system can describe and
          how they relate. Sonaway uses entities, actions, processes, roles and
          conditions to represent a situation together with its context. A link
          carries meaning: who performs an action, what it uses, or when a rule
          applies.
        </p>

        <figure className={styles.diagram}>
          <figcaption className={styles.caption}>
            <span className={styles.dot} aria-hidden="true" />
            Illustrative example: receiving a delivery
            <span>Fictional workflow</span>
          </figcaption>
          <div className={styles.graph}>
            <div className={styles.hub}>
              <span>Action within a process</span>
              <strong>Inspect the delivery</strong>
              <p>Part of receiving a shipment</p>
            </div>
            <ul className={styles.branches}>
              {relationships.map((item) => (
                <li key={item.type}>
                  <span className={styles.connection}>{item.link}</span>
                  <div className={styles.node}>
                    <span>{item.type}</span>
                    <strong>{item.name}</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.evidence}>
            <span>Supported by source evidence</span>
            <p>
              Each claim can point back to the passage that supports it. Missing
              details remain unresolved instead of being filled in by the model.
            </p>
          </div>
        </figure>

        <div className={styles.reasons}>
          <div>
            <span className={styles.index}>01 / Context</span>
            <h3>Keep the details that change the meaning.</h3>
            <p>
              “Inspect a delivery” is only part of the instruction. The role,
              timing and exception belong with the action. This structure keeps
              those details attached to the right thing.
            </p>
          </div>
          <div>
            <span className={styles.index}>02 / Reuse</span>
            <h3>Connect a process without copying it.</h3>
            <p>
              One step can refer to another process with its own steps. That
              makes shared procedures reusable and lets a reviewer follow the
              relationships affected by a proposed change.
            </p>
          </div>
          <div>
            <span className={styles.index}>03 / Trust</span>
            <h3>Separate an observation from a rule.</h3>
            <p>
              Someone doing a task once does not establish permanent
              responsibility. Source evidence, AI interpretation and an approved
              rule remain distinct, so one cannot silently become another.
            </p>
          </div>
        </div>
        <p className={styles.takeaway}>
          This is why a structured ontology fits the problem: the system needs
          to preserve relationships and compare specific changes, as well as
          find relevant information. The graph is a view of that meaning; the
          source evidence and versioned records remain underneath it.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sonaway-pipeline">
        <p className="eyebrow">From capture to a useful model</p>
        <h2 id="sonaway-pipeline">Preliminary. v0. Refinement.</h2>
        <p className={styles.intro}>
          Start with what is known, make it reviewable, then improve it with
          evidence. Here, v0 means the first reviewable model of the work.
        </p>
        <ol className={styles.pipeline}>
          {phases.map((phase) => (
            <li key={phase.name}>
              <span className={styles.phaseNumber}>{phase.number}</span>
              <h3>{phase.name}</h3>
              <strong>{phase.subtitle}</strong>
              <p>{phase.text}</p>
              <span className={styles.result}>{phase.result}</span>
            </li>
          ))}
        </ol>
        <div className={styles.runtime}>
          <h3>Inside the initial ingest</h3>
          <p>
            The current pipeline works through five stages: Orient, Decompose,
            Interrogate, Deepen and Normalize. These progressively interpret and
            structure the source into a saved workspace. Quality checks can
            request targeted repairs while protecting unrelated information.
          </p>
        </div>
        <div className={styles.governance}>
          <span className={styles.index}>A separate approval step</span>
          <h3>A draft does not become accepted knowledge by itself.</h3>
          <ol aria-label="Publication flow">
            <li>Compare with existing knowledge</li>
            <li>Resolve questions</li>
            <li>Authorize the specific change</li>
            <li>Publish a new version</li>
          </ol>
          <p>
            AI proposes the interpretation. Code checks the evidence,
            permissions and exact version being changed before an authorized
            update can be committed. Earlier versions remain available.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sonaway-use">
        <p className="eyebrow">What this makes possible</p>
        <h2 id="sonaway-use">
          Ask about the work. Inspect the answer. Trace the change.
        </h2>
        <div className={styles.split}>
          <p>
            The model gives retrieval and RAG a structured foundation: relevant
            knowledge can be connected to its conditions, supporting evidence
            and accepted version. It also gives reviewers something concrete to
            inspect when a procedure changes.
          </p>
          <p>
            I defined the operational problem, product behavior and architecture
            decisions, and used experiments and failure reports to guide
            iteration. AI contributed substantially to implementation. The
            design challenge is deciding where interpretation helps and where
            explicit rules and review are needed.
          </p>
        </div>
        <div className={styles.status}>
          <strong>Current project stage</strong>
          <p>
            Sonaway is under development. The repository includes ingest,
            semantic comparison, review and versioned publication components.
            The normal ingest route stops at a workspace ready for
            reconciliation; it does not publish automatically. The progressive
            ingest route is not yet production-ready, and public guest serving
            is not enabled.
          </p>
        </div>
      </section>
    </div>
  );
}
