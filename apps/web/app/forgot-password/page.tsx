"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "../../src/components/AppShell";
import { API_BASE } from "../../src/lib/api-base";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "Unable to process your request." }));
        throw new Error(body.message ?? "Unable to process your request.");
      }
      setMessage("If an active account matches that email, a reset link will be sent.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to process your request.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card">
    <BrandMark /><p className="eyebrow">Account recovery</p><h1>Reset your password</h1>
    <p>Enter your work email. If it belongs to an active account, we’ll send a one-time reset link.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>Work email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required /></label>
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
    <p style={{ marginTop: 16 }}><Link href="/login">Return to sign in</Link></p>
  </section></main>;
}
