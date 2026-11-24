"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "../../src/components/AppShell";
import { API_BASE } from "../../src/lib/api-base";

export default function OfferResponsePage() {
  const [token, setToken] = useState("");
  const [decision, setDecision] = useState<"ACCEPTED" | "DECLINED">("ACCEPTED");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) { setError("This offer response link is missing or invalid. Contact the recruiting team for a new link."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/careers/offers/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, decision, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
        credentials: "omit",
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "This offer link is expired or has already been used.");
      setComplete(decision === "ACCEPTED" ? "Your acceptance has been recorded. The recruiting team will contact you about next steps." : "Your response has been recorded. Thank you for letting us know.");
      setToken("");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record your offer response.");
    } finally { setBusy(false); }
  }

  return <main className="careers-page">
    <header className="careers-header"><Link className="sidebar-brand" href="/"><BrandMark /><strong>StaffHub Careers</strong></Link><Link className="button" href="/careers">Careers</Link></header>
    <section className="careers-intro"><p className="eyebrow">Candidate response</p><h1>Respond to your offer</h1><p>Review the offer details in the email from StaffHub, then confirm your decision using this private link.</p></section>
    <section className="panel" style={{ maxWidth: 640, margin: "0 auto" }}>
      {complete ? <div role="status"><h2>Response recorded</h2><p>{complete}</p></div> : <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend><strong>Your decision</strong></legend>
          <label><input type="radio" name="offer-decision" value="ACCEPTED" checked={decision === "ACCEPTED"} onChange={() => setDecision("ACCEPTED")} /> Accept this offer</label>
          <label><input type="radio" name="offer-decision" value="DECLINED" checked={decision === "DECLINED"} onChange={() => setDecision("DECLINED")} /> Decline this offer</label>
        </fieldset>
        <label>Optional note<textarea rows={4} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {error ? <p className="status-danger" role="alert">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={busy || !token}>{busy ? "Recording…" : "Submit response"}</button>
        <p>The response link can be used once and expires with the offer. If it no longer works, contact your recruiter.</p>
      </form>}
    </section>
  </main>;
}
