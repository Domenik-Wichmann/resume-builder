import Link from "next/link";
export function PortfolioHeader() {
  return (
    <header className="site-header wrap">
      <Link className="wordmark" href="/">
        rb<span> / </span>career, connected.
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/projects">Projects</Link>
        <Link href="/explore">Explore</Link>
        <Link href="/answers">Quick Answers</Link>
        <Link href="/workspace">Workspaces</Link>
        <Link href="/resume">Résumé ↗</Link>
      </nav>
    </header>
  );
}
