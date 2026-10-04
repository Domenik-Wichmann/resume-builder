import Link from "next/link";
export default function Privacy() {
  return (
    <main id="main" className="wrap prose">
      <Link href="/">← Portfolio</Link>
      <h1>Privacy & data</h1>
      <p>
        Ordinary portfolio visits do not create an analytics session. An
        application-specific short link can set an HttpOnly, same-site cookie
        lasting 24 hours and record a landing event tied to that application.
      </p>
      <p>
        Events contain a random session identifier, event type, timestamp, and
        link reference. The application does not store IP addresses, recruiter
        identity, browser fingerprints, or keystrokes. Questions and topic
        signals are saved privately when you use a live workspace, and the owner
        can review them. Do Not Track and Global Privacy Control disable
        tracking.
      </p>
      <p>
        Up to two workspaces are saved for an opaque browser identifier in an
        HttpOnly cookie. Live workspaces store job descriptions, questions,
        answers, evidence references, and résumé projections. You can delete
        them from the workspace list. Demo workspaces are stored only in this
        browser’s local storage. Workspaces expire after 90 days of inactivity
        when cleanup runs; the owner can also invoke cleanup. Functional
        US/Bulgaria presentation preferences do not request GPS or retain
        location history.
      </p>
      <p>
        Questions and job descriptions in live mode are sent to Cohere for
        retrieval and OpenRouter for answer generation. These services have
        their own data policies. Avoid submitting confidential or personal
        information. Demo mode uses local fixtures and makes no AI provider
        calls.
      </p>
      <p>
        Tracking events are retained for up to 90 days; cleanup runs when new
        events are written and can be invoked by the owner. Hosting providers
        may separately retain operational logs. A visit indicates use of a link,
        not the identity of its visitor.
      </p>
    </main>
  );
}
