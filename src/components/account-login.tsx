"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ForgotPasswordButton } from "./password-recovery";
import { adminReturnPath } from "@/lib/auth-navigation";
export function AccountLogin({
  google,
  github,
  next,
}: {
  google: boolean;
  github: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.replace(data.owner ? adminReturnPath(next) : "/account");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ai-panel owner-login" onSubmit={login}>
      <h1>Welcome back.</h1>
      <p>
        Sign in to continue where you left off. Owner sessions renew
        automatically on this browser for up to 30 days between visits.
      </p>
      <label htmlFor="account-email">Email</label>
      <input
        id="account-email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <label htmlFor="account-password">Password</label>
      <input
        id="account-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <ForgotPasswordButton />
      {google && (
        <a
          href={
            "/api/auth/oauth?provider=google&next=" +
            encodeURIComponent(adminReturnPath(next))
          }
        >
          Continue with Google
        </a>
      )}
      {github && (
        <a
          href={
            "/api/auth/oauth?provider=github&next=" +
            encodeURIComponent(adminReturnPath(next))
          }
        >
          Continue with GitHub
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
