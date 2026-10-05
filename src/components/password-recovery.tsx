"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function ForgotPasswordButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.push("/auth/forgot-password")}>
      Forgot password?
    </button>
  );
}
export function PasswordRecoveryForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to request a reset link.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ai-panel" onSubmit={submit}>
      <h1>Reset your password</h1>
      <p>Enter the email you use to sign in. We’ll send you a reset link.</p>
      <label htmlFor="recovery-email">Email</label>
      <input
        id="recovery-email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={254}
        required
      />
      <button disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p>
        <Link href="/admin">Back to admin sign in</Link>
      </p>
    </form>
  );
}
export function NewPasswordForm({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    if (form.get("password") !== form.get("confirmation")) {
      setError("Your passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      formElement.reset();
      setDone(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update your password.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <section className="ai-panel">
        <h1>Password updated</h1>
        <p>You can now sign in with your new password.</p>
        <Link href="/admin">Sign in to admin</Link>
        <p>
          <Link href="/auth/login">Account sign in</Link>
        </p>
      </section>
    );
  if (!ready)
    return (
      <section className="ai-panel">
        <h1>Reset link unavailable</h1>
        <p>
          Your link has expired, has already been used, or was opened in another
          browser.
        </p>
        <Link href="/auth/forgot-password">Request a new reset link</Link>
      </section>
    );
  return (
    <form className="ai-panel" onSubmit={submit}>
      <h1>Choose a new password</h1>
      <p>Use at least 12 characters. A unique passphrase works well.</p>
      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        required
      />
      <label htmlFor="confirm-password">Confirm password</label>
      <input
        id="confirm-password"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        required
      />
      <button disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
