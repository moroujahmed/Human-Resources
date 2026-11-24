"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "../../src/components/AppShell";
import { API_BASE } from "../../src/lib/api";
import { clearSession, getSession } from "../../src/lib/session";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const session = getSession();
    const response = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.tempToken ?? session?.accessToken ?? ""}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Password change failed" }));
      setError(body.message ?? "Password change failed");
      return;
    }
    clearSession();
    router.push("/login");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow">Security requirement</p>
        <h1>Change your password</h1>
        <form onSubmit={submit}>
          <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
          {error ? <p role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
