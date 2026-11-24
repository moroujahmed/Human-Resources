"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "../../src/components/AppShell";
import { API_BASE } from "../../src/lib/api-base";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "Password reset failed." }));
        throw new Error(body.message ?? "Password reset failed.");
      }
      setComplete(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card">
    <BrandMark /><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1>
    {complete ? <><p className="status-success" role="status">Your password was updated. You can now sign in.</p><Link className="button button-primary" href="/login">Go to sign in</Link></> : !token ? <>
      <p role="alert" className="status-danger">This reset link is missing or invalid. Request a new link to continue.</p><Link href="/forgot-password">Request a reset link</Link>
    </> : <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={1024} required /></label>
      <small>Use at least 10 characters with uppercase, lowercase, number, and symbol.</small>
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>}
  </section></main>;
}
