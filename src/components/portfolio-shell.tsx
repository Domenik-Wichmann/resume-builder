import Link from "next/link";
export function PortfolioHeader() {
  return (
    <header className="site-header wrap">
      <Link className="wordmark" href="/">
        Domenik Wichmann
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/projects">Selected projects</Link>
        <Link href="/explore">Explore</Link>
        <Link href="/answers">Quick Answers</Link>
        <Link href="/workspace">Saved chats</Link>
        <Link href="/resume">Résumé ↗</Link>
      </nav>
    </header>
  );
}
