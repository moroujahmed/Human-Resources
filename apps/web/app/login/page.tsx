"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "../../src/components/AppShell";
import { API_BASE } from "../../src/lib/api";
import { setSession, setTempSession } from "../../src/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "Sign-in failed");
        return;
      }
      if (body.passwordChangeRequired) {
        setTempSession(body.tempToken);
        router.push("/change-password");
        return;
      }
      setSession({ accessToken: body.accessToken, csrfToken: body.csrfToken, user: body.user });
      const landing: Record<string, string> = {
        EMPLOYEE: "/home",
        LINE_MANAGER: "/manager",
        HR_MANAGER: "/hr",
        RECRUITER: "/recruitment",
        PAYROLL_OFFICER: "/payroll",
        ASSET_OFFICER: "/assets",
        SYSTEM_ADMIN: "/admin",
      };
      router.push(landing[body.user.role] ?? "/home");
    } catch {
      setError("Unable to reach StaffHub. Check your connection and try again.");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow">Secure staff access</p>
        <h1>Sign in to StaffHub</h1>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <p className="status-danger" role="alert">{error}</p> : null}
          <button className="button button-primary" type="submit">Sign in</button>
        </form>
        <p style={{ marginTop: 16 }}><Link href="/forgot-password">Forgot your password?</Link></p>
      </section>
    </main>
  );
}
