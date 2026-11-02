import { portfolioEmail } from "@/lib/portfolio/contact";
import Link from "next/link";
export function PortfolioHeader({ homeOnly = false }: { homeOnly?: boolean }) {
  if (homeOnly)
    return (
      <header className="project-home-header wrap">
        <Link className="button" href="/">
          ← Back to main page
        </Link>
        <a className="portfolio-email-link" href={`mailto:${portfolioEmail}`}>
          {portfolioEmail}
        </a>
      </header>
    );
  return (
    <header className="site-header wrap">
      <Link className="wordmark" href="/">
        Domenik Wichmann
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/projects">Projects</Link>
        <Link href="/explore">Explore</Link>
        <Link href="/answers">Quick Answers</Link>
        <Link href="/workspace">Saved chats</Link>
        <Link href="/resume">Résumé ↗</Link>
        <a href={`mailto:${portfolioEmail}`}>{portfolioEmail}</a>
      </nav>
    </header>
  );
}
