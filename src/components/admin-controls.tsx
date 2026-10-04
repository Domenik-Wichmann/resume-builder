"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function OwnerLogin() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ai-panel owner-login" onSubmit={login}>
      <h2>Owner sign in</h2>
      <p className="muted">
        Use the owner account created in Supabase Auth. Public administrator
        signup is unavailable.
      </p>
      <label htmlFor="owner-email">Email</label>
      <input
        id="owner-email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <label htmlFor="owner-password">Password</label>
      <input
        id="owner-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function OwnerLogout() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const response = await fetch("/api/admin/login", { method: "DELETE" });
        if (response.ok) router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
export function TrackingLinkForm() {
  const [url, setURL] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"),
          company: form.get("company"),
          role: form.get("role"),
          market: form.get("market"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setURL(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ai-panel" onSubmit={create}>
      <h3>Create tracking link</h3>
      <label htmlFor="label">Private label</label>
      <input name="label" id="label" maxLength={100} required />
      <label htmlFor="company">Company</label>
      <input name="company" id="company" maxLength={100} />
      <label htmlFor="role">Role</label>
      <input name="role" id="role" maxLength={100} />
      <label htmlFor="link-market">Market</label>
      <select id="link-market" name="market">
        <option>US</option>
        <option>BG</option>
      </select>
      <button disabled={busy}>{busy ? "Creating…" : "Generate link"}</button>
      {url && (
        <p className="result">
          <a href={url}>{url}</a>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
