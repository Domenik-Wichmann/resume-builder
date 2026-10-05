import Link from "next/link";
export default function Privacy() {
  return (
    <main id="main" className="wrap prose">
      <Link href="/">← Portfolio</Link>
      <h1>Privacy & data</h1>
      <p>
        Public projects, the explorer and reviewed Quick Answers need no AI
        provider call. Optional explorer selections save coarse interest events
        only in an existing workspace; Do Not Track and Global Privacy Control
        suppress these events.
      </p>
      <p>
        Necessary first-party security cookies support visitor quotas and human
        verification separately from optional landing analytics. A valid
        tracking link may skip the initial challenge but never the quotas. When
        configured, Cloudflare Turnstile verifies a challenge token without this
        application sending or retaining your IP address. Without Turnstile
        keys, visitor limits and the global spending fuse remain active.
      </p>
      <p>
        AI operations are limited per opaque visitor: normally one at a time, at
        least five seconds apart, 25 per UTC day and 50 in seven rolling days.
        Resetting browser cookies creates a new identifier; the global fuse
        still limits spending. Provider accounting stores model names, usage
        quantities and costs when available, with no prompts or answers in the
        accounting records. Recent quota reservations are pruned after seven
        days when the visitor next uses AI.
      </p>
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
        US/Bulgaria contact presentation uses a verified tracking link or coarse
        country signal. Visitors cannot select it. This does not request GPS or
        retain location history.
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
