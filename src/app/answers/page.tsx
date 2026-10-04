import { publicAnswers } from "@/lib/portfolio/answers-server";
import { PortfolioHeader } from "@/components/portfolio-shell";
export const dynamic = "force-dynamic";
export const metadata = { title: "Quick Answers · Resume Builder" };
export default async function Answers() {
  const cards = await publicAnswers();
  return (
    <>
      <PortfolioHeader />
      <main className="wrap portfolio-main">
        <p className="eyebrow">Reviewed answers, ready to read</p>
        <h1>Quick Answers.</h1>
        <p className="lead">
          Owner-reviewed answers grounded in published career evidence. No AI
          request is needed to read them.
        </p>
        {!cards.length ? (
          <div className="empty-state">
            <h2>No reviewed answers published yet.</h2>
            <p>Answers appear after review and explicit publication.</p>
          </div>
        ) : (
          <div className="answer-grid">
            {cards.map((c) => (
              <article className="surface" id={c.slug} key={c.id}>
                <h2>{c.question}</h2>
                <p style={{ whiteSpace: "pre-line" }}>{c.answer}</p>
                <small>
                  {c.sources.length} supporting career records · Review by{" "}
                  {new Date(c.expires_at).toLocaleDateString("en-US")}
                </small>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
