import styles from "./sonaway-interactive-study.module.css";

const planes = [
  [
    "Operational meaning",
    "The people, equipment, actions, states and procedures the source describes.",
  ],
  [
    "Evidence & interpretation",
    "The source passage, the interpretation it supports, and anything still uncertain.",
  ],
  [
    "Comparison & change",
    "Whether new information changes an existing meaning, scope, condition or version.",
  ],
  [
    "Authority & publication",
    "Who can accept the proposed change and which version becomes governing knowledge.",
  ],
];
const details = [
  [
    "Responsible role",
    "Closing manager",
    "Keep responsibility attached to a role; a person doing a task once does not establish permanent ownership.",
  ],
  [
    "Action frame",
    "Inspect the hot tub",
    "Keep the action and its participants together as one meaningful situation.",
  ],
  [
    "Context & condition",
    "Wellness area · before reopening",
    "Attach the condition to the action it qualifies, so it does not become a rule for every nearby task.",
  ],
  [
    "Source evidence",
    "The supporting procedure passage",
    "Preserve the connection between an interpretation and the text that supports it.",
  ],
];

export function SonawayInteractiveStudy() {
  return (
    <div className={styles.study}>
      <section
        className={styles.section}
        id="sonaway-knowledge-model"
        aria-labelledby="ontology-heading"
      >
        <p className={styles.eyebrow}>
          Knowledge engineering / my design choices
        </p>
        <h2 id="ontology-heading">Why I chose a compositional ontology.</h2>
        <p className={styles.lead}>
          I needed a model that could explain a procedure, keep its conditions
          in place and show what a proposed change affects. That shaped both the
          ontology and the review lifecycle: the useful unit is connected
          meaning with evidence, not simply a paragraph retrieved from a
          document.
        </p>
        <div className={styles.definitions}>
          <div>
            <h3>A taxonomy gives the vocabulary.</h3>
            <p>
              It groups things into recognizable families: a person, business
              role, place, equipment item or information object. Those
              distinctions make it possible to refer to the same kinds of things
              consistently.
            </p>
          </div>
          <div>
            <h3>An ontology gives the relationships.</h3>
            <p>
              It describes how those things participate in actions, processes,
              states and rules: who acts, what is affected, which conditions
              apply and where the evidence comes from. The relationship carries
              meaning as well as the thing it connects.
            </p>
          </div>
        </div>
        <div className={styles.planes}>
          {planes.map(([title, text], index) => (
            <div key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <p className={styles.note}>
          These four planes are an architecture principle. The runtime is being
          developed in stages; the demonstrations below illustrate selected
          behaviors without claiming the whole architecture is production-ready.
        </p>
      </section>

      <section
        className={styles.section}
        aria-labelledby="decomposition-heading"
      >
        <p className={styles.eyebrow}>
          Decomposition / keeping the meaning intact
        </p>
        <h2 id="decomposition-heading">
          Break the instruction down without breaking its context.
        </h2>
        <blockquote>
          <span>Fictional procedure excerpt</span>“Before the wellness area
          reopens, the closing manager must inspect the hot tub.”
        </blockquote>
        <div className={styles.example}>
          <div className={styles.frame}>
            <span>Action in context</span>
            <strong>Inspect the hot tub</strong>
            <p>
              Responsibility, applicability and evidence stay connected to the
              action.
            </p>
          </div>
          <div className={styles.bindings}>
            {details.map(([label, value, reason]) => (
              <div key={label}>
                <span>{label}</span>
                <h3>{value}</h3>
                <p>{reason}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.definitions}>
          <div>
            <h3>Small enough to compare.</h3>
            <p>
              An atomic assertion is a claim small enough to support with
              evidence and compare independently. Changing the responsible role
              should be distinguishable from changing the task, location or
              condition. The surrounding frame keeps those claims connected.
            </p>
          </div>
          <div>
            <h3>Structured enough to reuse.</h3>
            <p>
              A step can invoke another procedure with its own steps. A closing
              routine can call a reusable access-control procedure without
              copying its entire contents. This preserves shared meaning while
              allowing deeper decomposition where it is useful.
            </p>
          </div>
        </div>
        <p className={styles.takeaway}>
          This is the design skill I want the project to demonstrate: choosing
          boundaries that preserve meaning, expose uncertainty and support
          precise changes. The graph is a way to inspect that structure;
          evidence and versioned records remain underneath it.
        </p>
      </section>

      <section
        className={styles.section}
        id="sonaway-live-demos"
        aria-labelledby="demo-heading"
      >
        <p className={styles.eyebrow}>
          Try the interaction / adapted from my Sonaway website
        </p>
        <h2 id="demo-heading">See those decisions in motion.</h2>
        <p className={styles.lead}>
          These are working, scripted examples from the hospitality site. They
          use fictional records and run locally in the browser. They demonstrate
          the interaction and policy logic; they do not make AI requests or
          publish operational changes.
        </p>
        <div className={styles.demoIntro}>
          <div>
            <span>01 / Guided intake</span>
            <h3>Turn a vague request into a scoped change.</h3>
          </div>
          <p>
            Choose a property, venue and change. Watch the map follow related
            records as the conversation narrows the scope. The review separates
            the current arrangement, the proposed change and the person
            responsible for approving it.
          </p>
        </div>
        <div className={styles.instructions}>
          <strong>Try this:</strong> choose Alpine Lodges, select a dining room,
          and follow the update through to review. Edit an earlier reply to see
          the dependent details reset.
        </div>
        <iframe
          className={styles.intake}
          src="/demos/sonaway/intake.html"
          title="Sonaway guided-update conversation and animated knowledge discovery"
          loading="lazy"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
        <p className={styles.demoLesson}>
          <strong>What this demonstrates:</strong> conversational workflow
          design, dependency-aware intake, visible scope and a distinct review
          step. The animated search is scripted, not a trace of model reasoning.
        </p>

        <div className={styles.demoIntro}>
          <div>
            <span>02 / Contextual projections</span>
            <h3>Trace where a policy change goes.</h3>
          </div>
          <p>
            Edit a checkout time and follow the inheriting properties. Then
            explore seasons, events and audience views. Each view answers a
            different context from a shared foundation while preserving
            applicable exceptions.
          </p>
        </div>
        <div className={styles.instructions}>
          <strong>Try this:</strong> change the group checkout time, add a local
          lodge exception, then switch to “Seasons & events” or “For each
          person.” Look for the source behind the resulting answer.
        </div>
        <iframe
          className={styles.projections}
          src="/demos/sonaway/projections.html"
          title="Sonaway policy propagation, seasonal exceptions and role-specific guidance"
          loading="lazy"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
        <p className={styles.demoLesson}>
          <strong>What this demonstrates:</strong> inheritance and exception
          modeling, effective-date reasoning and audience-specific presentation.
          The audience example illustrates configured views; production access
          still requires server-side authorization.
        </p>
      </section>
    </div>
  );
}
