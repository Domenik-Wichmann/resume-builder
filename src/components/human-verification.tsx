"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
type Turnstile = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
export function HumanVerification() {
  const [state, setState] = useState<{
      required: boolean;
      siteKey?: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch("/api/visitor", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setState(d);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (
      !ready ||
      !state?.required ||
      !state.siteKey ||
      !container.current ||
      !turnstile
    )
      return;
    const id = turnstile.render(container.current, {
      sitekey: state.siteKey,
      action: "ai_access",
      callback: (token) => {
        fetch("/api/visitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
          .then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setState({ ...state, required: false });
            setMessage("Human verification complete.");
          })
          .catch((e) => setMessage(e.message));
      },
      "error-callback": () =>
        setMessage("Challenge unavailable. Please reload and try again."),
      "expired-callback": () =>
        setMessage("Challenge expired. Please complete it again."),
    });
    return () => turnstile.remove(id);
  }, [ready, state]);
  if (!state?.required) return message ? <p role="status">{message}</p> : null;
  return (
    <div className="verification">
      <p>
        Complete this check before your first AI operation. Browsing remains
        open.
      </p>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={container} />
      <p role="status">{message}</p>
    </div>
  );
}
