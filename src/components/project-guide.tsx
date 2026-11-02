import { portfolioEmail } from "@/lib/portfolio/contact";
import Image from "next/image";
import Link from "next/link";
import type { ProjectGuide as Guide } from "@/lib/portfolio/project-guides";
import styles from "./project-guide.module.css";
import { SonawayInteractiveStudy } from "./sonaway-interactive-study";

export function ProjectGuide({ guide }: { guide: Guide }) {
  return (
    <div className={styles.page}>
      <article className={styles.guide} data-project={guide.key}>
        <div className={styles.topline}>
          <Link href="/">← Domenik Wichmann</Link>
          <Link href="/projects">All projects ↗</Link>
        </div>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{guide.category}</p>
            <h1>{guide.name}</h1>
            <h2>{guide.headline}</h2>
            <p className={styles.summary}>{guide.summary}</p>
            <div className={styles.actions}>
              <a href="#project-screenshots">Explore the screens ↓</a>
              {guide.demo && (
                <a
                  href={guide.demo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {guide.demo.label} ↗
                </a>
              )}
            </div>
            <p className={styles.status}>{guide.status}</p>
          </div>
          <figure className={styles.heroImage}>
            <a
              href={guide.screens[0].src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open full preview of ${guide.name}`}
            >
              <Image
                src={guide.screens[0].src}
                alt={guide.screens[0].title}
                width={1200}
                height={800}
                unoptimized
              />
            </a>
            <figcaption>{guide.screens[0].kind}</figcaption>
          </figure>
        </header>
        <nav className={styles.jump} aria-label="Project sections">
          <a href="#project-overview">My contribution</a>
          <a href="#project-workflow">Workflow design</a>
          <a href="#project-features">Skills demonstrated</a>
          {guide.key === "sonaway" && (
            <>
              <a href="#sonaway-knowledge-model">Knowledge model</a>
              <a href="#sonaway-live-demos">Try the demos</a>
            </>
          )}
          <a href="#project-screenshots">Screens & previews</a>
          <a href="#project-engineering">My approach</a>
        </nav>
        <section className={styles.problem} id="project-overview">
          <p className={styles.eyebrow}>The starting point</p>
          <h2>The problem I set out to solve.</h2>
          <p>{guide.problem}</p>
          <div className={styles.contribution}>
            <h3>My contribution</h3>
            <p>{guide.contribution}</p>
          </div>
        </section>
        <section className={styles.workflow} id="project-workflow">
          <p className={styles.eyebrow}>From requirements to behavior</p>
          <h2>The workflow I designed around.</h2>
          <ol>
            {guide.steps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.number}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.section} id="project-features">
          <p className={styles.eyebrow}>What this work demonstrates</p>
          <h2>The skills behind the project.</h2>
          <div className={styles.features}>
            {guide.features.map((feature, index) => (
              <div key={feature.title}>
                <span className={styles.featureIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </section>
        {guide.key === "sonaway" && <SonawayInteractiveStudy />}
        <section className={styles.section} id="project-screenshots">
          <p className={styles.eyebrow}>See the work</p>
          <h2>See the decisions in the interface.</h2>
          <p className={styles.galleryIntro}>
            These views connect the workflow and design decisions to the
            resulting experience. Open any image at full size; captions identify
            actual screens and illustrative interfaces.
          </p>
          <div className={styles.gallery}>
            {guide.screens.map((screen, index) => (
              <figure key={screen.src}>
                <div className={styles.screenHeading}>
                  <span>
                    {String(index + 1).padStart(2, "0")} / {screen.kind}
                  </span>
                  <span aria-hidden="true">↗</span>
                </div>
                <a
                  href={screen.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open full image: ${screen.title}`}
                >
                  <Image
                    src={screen.src}
                    alt={screen.title}
                    width={1200}
                    height={800}
                    unoptimized
                    loading="lazy"
                  />
                </a>
                <figcaption>
                  <h3>{screen.title}</h3>
                  <p>{screen.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section
          className={`${styles.section} ${styles.engineering}`}
          id="project-engineering"
        >
          <div>
            <p className={styles.eyebrow}>Architecture & implementation</p>
            <h2>How I approached the build.</h2>
            <p>{guide.engineering}</p>
          </div>
          <aside>
            <h3>Implementation tools</h3>
            <ul>
              {guide.stack.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </aside>
        </section>
        <section className={styles.scope}>
          <p className={styles.eyebrow}>Current scope</p>
          <h2>Where the project stands.</h2>
          <p>{guide.limits}</p>
        </section>
        <footer className={styles.footer}>
          <div>
            <p className={styles.eyebrow}>The person behind the work</p>
            <h2>Explore how I approach problems.</h2>
            <p className={styles.contact}>
              Email me:{" "}
              <a href={`mailto:${portfolioEmail}`}>{portfolioEmail}</a>
            </p>
          </div>
          <Link href="/projects">Explore more projects ↗</Link>
          <Link href="/#ask">Explore my experience →</Link>
        </footer>
      </article>
    </div>
  );
}
