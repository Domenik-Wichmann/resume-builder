"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="wrap prose">
      <h1>Portfolio temporarily unavailable.</h1>
      <p>The published career data or service configuration needs attention.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
