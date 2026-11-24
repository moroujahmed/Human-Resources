"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "../../src/components/AppShell";
import { TurnstileWidget } from "../../src/components/TurnstileWidget";
import { API_BASE } from "../../src/lib/api-base";

interface Vacancy {
  id: string;
  vacancyCode: string;
  title: string;
  location: string;
  description: string;
  requirements: string;
  closingAt: string;
  requisition?: { department?: { name: string } };
}

export default function CareersPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [expectedGrossUgx, setExpectedGrossUgx] = useState("");
  const [earliestStartDate, setEarliestStartDate] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [applicationCode, setApplicationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadVacancies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/careers/vacancies`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Unable to load open opportunities.");
      setVacancies(await response.json() as Vacancy[]);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load open opportunities.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadVacancies(); }, [loadVacancies]);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !cv) { setError("Choose a CV to continue."); return; }
    if (cv.size > 5 * 1024 * 1024) { setError("Your CV must be 5 MB or smaller."); return; }
    setBusy(true); setError(""); setApplicationCode("");
    try {
      const form = new FormData();
      form.set("fullName", fullName);
      form.set("email", email);
      form.set("phone", phone);
      if (expectedGrossUgx) form.set("expectedGrossUgx", expectedGrossUgx);
      if (earliestStartDate) form.set("earliestStartDate", earliestStartDate);
      form.set("coverNote", coverNote);
      form.set("cv", cv);
      form.set("turnstileToken", turnstileToken);
      const response = await fetch(`${API_BASE}/api/v1/careers/vacancies/${selected.id}/apply`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({})) as { applicationCode?: string; message?: string };
      if (!response.ok) throw new Error(body.message ?? "Unable to submit your application.");
      setApplicationCode(body.applicationCode ?? "Submitted");
      setSelected(null); setFullName(""); setEmail(""); setPhone(""); setExpectedGrossUgx(""); setEarliestStartDate(""); setCoverNote(""); setCv(null);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your application.");
    } finally { setBusy(false); setTurnstileToken(""); setTurnstileKey((key) => key + 1); }
  }

  return <main className="careers-page">
    <header className="careers-header"><Link className="sidebar-brand" href="/"><BrandMark /><strong>StaffHub Careers</strong></Link><Link className="button" href="/login">Staff sign in</Link></header>
    <section className="careers-intro"><p className="eyebrow">Careers at StaffHub Uganda</p><h1>Do meaningful work with us.</h1><p>Explore current opportunities and apply securely without creating an account.</p></section>
    <section className="careers-list" aria-labelledby="vacancies-heading"><h2 id="vacancies-heading">Open opportunities</h2>
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {applicationCode ? <section className="panel status-success" role="status"><h3>Application received</h3><p>Keep this reference for your records: <strong>{applicationCode}</strong></p></section> : null}
      {loading ? <p>Loading opportunities…</p> : vacancies.length === 0 ? <div className="empty-state">There are no open roles at the moment. Please check back later.</div> : vacancies.map((vacancy) => <article className="panel vacancy-card" key={vacancy.id}>
        <div><p className="eyebrow">{vacancy.requisition?.department?.name ?? "StaffHub"}</p><h3>{vacancy.title}</h3><p>{vacancy.location} · Closes {new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(vacancy.closingAt))}</p><p>{vacancy.description}</p><details><summary>Requirements</summary><p>{vacancy.requirements}</p></details></div>
        <button className="button button-primary" type="button" onClick={() => { setSelected(vacancy); setError(""); }}>Apply</button>
      </article>)}
    </section>
    {selected ? <section className="apply-panel" aria-labelledby="apply-heading">
      <div className="panel"><h2 id="apply-heading">Apply: {selected.title}</h2><button className="button" type="button" onClick={() => setSelected(null)}>Close</button>
        <form onSubmit={apply} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={150} autoComplete="name" required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} autoComplete="email" required /></label>
          <label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} autoComplete="tel" required /></label>
          <label>Expected gross monthly salary (UGX, optional)<input type="number" min="0" step="1" value={expectedGrossUgx} onChange={(event) => setExpectedGrossUgx(event.target.value)} /></label>
          <label>Earliest start date (optional)<input type="date" value={earliestStartDate} onChange={(event) => setEarliestStartDate(event.target.value)} /></label>
          <label>Cover note<textarea rows={5} minLength={10} maxLength={5000} value={coverNote} onChange={(event) => setCoverNote(event.target.value)} required /></label>
          <label>CV (PDF or DOCX, max 5 MB)<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setCv(event.target.files?.[0] ?? null)} required /></label>
          <p>Your CV is stored privately. StaffHub will use your details to assess this application.</p>
          <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />
          <button className="button button-primary" type="submit" disabled={busy || !turnstileToken}>{busy ? "Submitting…" : "Submit application"}</button>
        </form>
      </div>
    </section> : null}
  </main>;
}
