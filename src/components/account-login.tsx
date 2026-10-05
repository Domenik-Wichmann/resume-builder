"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ForgotPasswordButton } from "./password-recovery";
export function AccountLogin({
  google,
  github,
}: {
  google: boolean;
  github: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
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
      router.push("/account");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ai-panel" onSubmit={login}>
      <h1>Account sign in</h1>
      <p>
        Use your existing Supabase email account. Public signup and trial
        credits are not enabled.
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
      <button disabled={busy}>Sign in</button>
      <ForgotPasswordButton />
      {google && (
        <a href="/api/auth/oauth?provider=google">Continue with Google</a>
      )}
      {github && (
        <a href="/api/auth/oauth?provider=github">Continue with GitHub</a>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
