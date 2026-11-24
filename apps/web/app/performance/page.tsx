"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface Employee { id: string; legalName: string; employeeCode: string; jobTitle: string; status?: string }
interface Review {
  id: string;
  reviewPeriod: string;
  objectivesJson: unknown;
  selfAssessment?: string | null;
  managerFeedback?: string | null;
  rating?: string | number | null;
  status: string;
  employee: { legalName: string; employeeCode: string };
  reviewerManager: { legalName: string };
}

export default function PerformancePage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const canCreate = role === "LINE_MANAGER" || role === "HR_MANAGER";
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState("");
  const [objectives, setObjectives] = useState("");
  const [selfDrafts, setSelfDrafts] = useState<Record<string, string>>({});
  const [managerDrafts, setManagerDrafts] = useState<Record<string, { feedback: string; rating: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!session) { setError("Please sign in to view performance reviews."); setLoading(false); return; }
    try {
      const [rows, directory] = await Promise.all([
        api<Review[]>("/performance/reviews", session),
        canCreate ? api<Employee[]>("/employees", session) : Promise.resolve([]),
      ]);
      setReviews(rows); setEmployees(directory.filter((employee) => employee.status !== "EXITED"));
      setEmployeeId((current) => current || directory[0]?.id || "");
    } catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load performance reviews"); }
    finally { setLoading(false); }
  }, [canCreate, session]);

  useEffect(() => { void load(); }, [load]);

  async function createReview(event: React.FormEvent) {
    event.preventDefault(); if (!session) return;
    const goals = objectives.split("\n").map((goal) => goal.trim()).filter(Boolean);
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/performance/reviews", session, { method: "POST", body: JSON.stringify({ employeeId, reviewPeriod: period, objectives: goals }) });
      setMessage("Performance review cycle created."); setPeriod(""); setObjectives(""); await load();
    } catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "Unable to create review"); }
    finally { setBusy(false); }
  }

  async function submitSelfAssessment(reviewId: string) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/performance/reviews/${reviewId}/self-assessment`, session, { method: "PATCH", body: JSON.stringify({ selfAssessment: selfDrafts[reviewId] ?? "" }) });
      setMessage("Your self-assessment was submitted to your manager."); await load();
    } catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "Unable to submit self-assessment"); }
    finally { setBusy(false); }
  }

  async function submitManagerReview(reviewId: string) {
    if (!session) return;
    const draft = managerDrafts[reviewId]; if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/performance/reviews/${reviewId}/manager-review`, session, { method: "PATCH", body: JSON.stringify({ managerFeedback: draft.feedback, rating: Number(draft.rating) }) });
      setMessage("Manager review completed."); await load();
    } catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "Unable to complete manager review"); }
    finally { setBusy(false); }
  }

  return <AppShell role={role} title="Performance">
    <ModulePage eyebrow="Growth & development" title="Performance reviews" description="Set clear objectives, complete self-assessments, and record manager feedback with role-scoped access.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {loading ? <p>Loading performance reviews…</p> : <>
        {canCreate ? <section className="panel"><h2>Start a review cycle</h2>
          {employees.length === 0 ? <p>No active employees are available.</p> : <form onSubmit={(event) => void createReview(event)} style={{ display: "grid", gap: 12 }}>
            <label>Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.legalName} · {employee.employeeCode}</option>)}</select></label>
            <label>Review period<input placeholder="2026 Annual Review" value={period} onChange={(event) => setPeriod(event.target.value)} minLength={3} maxLength={60} required /></label>
            <label>Objectives (one per line)<textarea rows={5} value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder="Deliver agreed role outcomes\nComplete development objectives" required /></label>
            <button className="button button-primary" type="submit" disabled={busy || !employeeId}>Create review cycle</button>
          </form>}
        </section> : null}
        <section className="panel" style={{ marginTop: 16 }}><h2>Review cycles</h2>
          {reviews.length === 0 ? <p>No performance reviews are available to your role.</p> : <div style={{ display: "grid", gap: 12 }}>
            {reviews.map((review) => {
              const goals = Array.isArray(review.objectivesJson) ? review.objectivesJson.filter((item): item is string => typeof item === "string") : [];
              return <article className="panel" key={review.id} style={{ display: "grid", gap: 10 }}>
                <div><h3>{review.employee.legalName} · {review.reviewPeriod}</h3><p>{review.employee.employeeCode} · Manager: {review.reviewerManager.legalName} · <strong>{review.status.replaceAll("_", " ")}</strong></p></div>
                <div><strong>Objectives</strong><ul>{goals.map((goal, index) => <li key={`${index}-${goal}`}>{goal}</li>)}</ul></div>
                {review.status === "SELF_REVIEW_PENDING" && role === "EMPLOYEE" ? <div style={{ display: "grid", gap: 8 }}><label>Your self-assessment<textarea minLength={20} maxLength={10000} rows={5} value={selfDrafts[review.id] ?? ""} onChange={(event) => setSelfDrafts((current) => ({ ...current, [review.id]: event.target.value }))} required /></label><button className="button button-primary" type="button" disabled={busy} onClick={() => void submitSelfAssessment(review.id)}>Submit self-assessment</button></div> : null}
                {review.selfAssessment ? <div><strong>Self-assessment</strong><p>{review.selfAssessment}</p></div> : null}
                {review.status === "SELF_REVIEW_SUBMITTED" && role === "LINE_MANAGER" ? <div style={{ display: "grid", gap: 8 }}><label>Manager feedback<textarea minLength={20} maxLength={10000} rows={5} value={managerDrafts[review.id]?.feedback ?? ""} onChange={(event) => setManagerDrafts((current) => ({ ...current, [review.id]: { feedback: event.target.value, rating: current[review.id]?.rating ?? "" } }))} required /></label><label>Rating (1–5)<input type="number" min="1" max="5" step="0.1" value={managerDrafts[review.id]?.rating ?? ""} onChange={(event) => setManagerDrafts((current) => ({ ...current, [review.id]: { feedback: current[review.id]?.feedback ?? "", rating: event.target.value } }))} required /></label><button className="button button-primary" type="button" disabled={busy} onClick={() => void submitManagerReview(review.id)}>Complete manager review</button></div> : null}
                {review.managerFeedback ? <div><strong>Manager feedback · Rating {review.rating} / 5</strong><p>{review.managerFeedback}</p></div> : null}
              </article>;
            })}
          </div>}
        </section>
      </>}
    </ModulePage>
  </AppShell>;
}
