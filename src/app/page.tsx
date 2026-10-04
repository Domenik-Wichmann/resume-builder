import Link from "next/link";
import { AIPanel } from "@/components/ai-panel";
import { getCareer } from "@/lib/career/repository";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { MarketSwitch } from "@/components/market-switch";
export const dynamic = "force-dynamic";
export default async function Home() {
  const career = await getCareer();
  const presentation = await getPresentation(await currentMarket());
  return (
    <>
      {career.demo && (
        <div className="demo-banner">
          DEMO PORTFOLIO{" "}
          <span>
            Fictional career data. Replace with approved owner evidence before
            sharing.
          </span>
        </div>
      )}
      <header className="site-header wrap">
        <Link className="wordmark" href="/">
          rb<span> / </span>career, connected.
        </Link>
        <nav aria-label="Main navigation">
          <a href="#work">Work</a>
          <a href="#skills">Skills</a>
          <a href="#ask">Ask me</a>
          <Link href="/workspace">Workspaces</Link>
          <Link href="/resume">Résumé ↗</Link>
        </nav>
      </header>
      <main id="main" className="wrap">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">
              <span className="status-dot" /> A structured view of the work
            </p>
            <h1 id="hero-title">
              {career.profile.name ? (
                <>
                  Useful systems.
                  <br />
                  <span>Thoughtful engineering.</span>
                </>
              ) : (
                "Career profile pending publication."
              )}
            </h1>
            <p className="hero-intro">{career.profile.introduction}</p>
            <div className="hero-actions">
              <a className="button" href="#work">
                Explore the work ↓
              </a>
              <a className="text-link" href="#ask">
                Start with a question ↗
              </a>
            </div>
          </div>
          <aside className="profile-card">
            <div
              className="portrait"
              aria-label="Professional photo placeholder"
            >
              <span>
                {career.profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <small>PHOTO PLACEHOLDER</small>
            </div>
            <div className="profile-caption">
              <h2>{career.profile.name || "Profile not published"}</h2>
              <p>{career.profile.title}</p>
              <p>
                {[
                  presentation.location,
                  presentation.contact_email,
                  presentation.phone,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <MarketSwitch market={presentation.market} />
            </div>
            <div className="card-note">
              <span>01 / PROFILE</span>
              <span>
                {career.demo
                  ? "DEMO DATA"
                  : career.profile.name
                    ? "PUBLISHED EVIDENCE"
                    : "AWAITING APPROVED PROFILE"}
              </span>
            </div>
          </aside>
        </section>
        <div className="principles">
          <span>Evidence over claims</span>
          <span>Systems that serve people</span>
          <span>Clarity at every layer</span>
        </div>
        <section id="work" className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / Selected work</p>
              <h2>The experience behind the skills.</h2>
            </div>
            <p>
              Structured records connect roles, projects, and the tools used to
              build them.
            </p>
          </div>
          <div className="work-grid">
            <div className="experience-column">
              <h3 className="eyebrow">Experience</h3>
              {career.experiences.map((record) => (
                <article className="experience" key={record.id}>
                  <span className="timeline-dot" />
                  <p className="muted">{record.subtitle}</p>
                  <h3>{record.title}</h3>
                  <p>{record.summary}</p>
                  <div className="tags">
                    {record.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="project-column">
              {career.projects.map((record, i) => (
                <article
                  className="project-card"
                  id={record.slug}
                  key={record.id}
                >
                  <div className="project-top">
                    <span className="eyebrow">PROJECT / 0{i + 1}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <h3>{record.title}</h3>
                  <p>{record.summary}</p>
                  <div className="tags">
                    {record.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="skills" className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / Connected capabilities</p>
              <h2>Skills with a source.</h2>
            </div>
            <p>
              Each connection points to a published role or project. No
              arbitrary proficiency percentages.
            </p>
          </div>
          <div className="skill-map">
            <div className="skill-center">
              Career
              <br />
              <strong>evidence</strong>
            </div>
            <div className="skill-nodes">
              {career.skills.map((skill) => {
                const sources = [
                  ...career.experiences,
                  ...career.projects,
                  ...career.achievements,
                ].filter((record) => record.skills.includes(skill));
                return (
                  <div className="skill-node" key={skill}>
                    <strong>{skill}</strong>
                    <span>
                      {sources.length} supporting{" "}
                      {sources.length === 1 ? "record" : "records"}
                    </span>
                    <small>
                      {sources.map((record) => record.title).join(" · ") ||
                        "Published skill; no linked record yet"}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section id="ask" className="section interaction">
          <div>
            <p className="eyebrow">03 / Ask about the work</p>
            <h2>
              A conversation,
              <br />
              grounded in evidence.
            </h2>
            <p>
              Ask about experience, technologies, or projects. When the records
              don’t support a claim, the answer will say so.
            </p>
            <div className="example-question">
              Try: “What automation systems have you built?”
            </div>
          </div>
          <AIPanel kind="ask" />
        </section>
        <section id="match" className="section interaction">
          <div>
            <p className="eyebrow">04 / Find the connection</p>
            <h2>
              Your role.
              <br />
              The relevant experience.
            </h2>
            <p>
              Compare a job description with the published evidence. See
              supported matches, gaps, and what deserves emphasis.
            </p>
            <p className="muted">
              Your input is processed for this request and isn’t stored in
              portfolio analytics.
            </p>
          </div>
          <AIPanel kind="match" />
        </section>
        <section className="resume-callout">
          <div>
            <p className="eyebrow">A clear, portable view</p>
            <h2>Take the résumé with you.</h2>
            <p>
              A clean HTML résumé, ready for your browser’s print or PDF dialog.
            </p>
          </div>
          <Link className="button" href="/resume">
            View résumé ↗
          </Link>
        </section>
      </main>
      <footer className="wrap footer">
        <span>
          Resume Builder /{" "}
          {career.demo ? "Demo foundation" : career.profile.name}
        </span>
        <Link href="/privacy">Privacy & data</Link>
        <span>Built around evidence.</span>
      </footer>
    </>
  );
}
