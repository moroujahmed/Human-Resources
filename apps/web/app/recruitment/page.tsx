"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface Department { id: string; name: string; code: string }
interface Requisition {
  id: string;
  requisitionCode: string;
  jobTitle: string;
  headcount: number;
  employmentType: string;
  status: string;
  targetStartDate: string;
  decisionReason?: string | null;
  department: Department;
}
interface Vacancy {
  id: string;
  vacancyCode: string;
  title: string;
  location: string;
  description: string;
  requirements: string;
  closingAt: string;
  status: string;
  requisition: { id: string; requisitionCode: string; status: string; department: Department };
}
interface Application {
  id: string;
  applicationCode: string;
  fullName: string;
  applicantEmail?: string;
  phone?: string;
  status: string;
  submittedAt: string;
  stageNotes?: string | null;
  interviews?: { id: string; scheduledAt: string; interviewMode: string; locationOrLink?: string; interviewerUserIds: string[]; outcome: string; reviews: { reviewerUserId: string; score: number | string; feedback: string; recommendation: string }[] }[];
  offer?: { id: string; status: string; offeredJobTitle: string; proposedStartDate: string } | null;
}
interface Interviewer { id: string; email: string; employee?: { legalName: string } | null }

const reqRoles: StaffHubRole[] = ["LINE_MANAGER", "HR_MANAGER", "SYSTEM_ADMIN"];
const recruiterRoles: StaffHubRole[] = ["RECRUITER", "HR_MANAGER"];
const hrRoles: StaffHubRole[] = ["HR_MANAGER", "SYSTEM_ADMIN"];

function localInputToEatIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid Kampala date and time.");
  const [, y, mo, d, h, mi] = match.map(Number) as unknown as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h - 3, mi)).toISOString();
}

export default function RecruitmentPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "HR_MANAGER";
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [justification, setJustification] = useState("");
  const [targetStartDate, setTargetStartDate] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [offerRejectionReasons, setOfferRejectionReasons] = useState<Record<string, string>>({});
  const [offerCandidateId, setOfferCandidateId] = useState("");
  const [offerBaseSalary, setOfferBaseSalary] = useState("");
  const [offerAllowances, setOfferAllowances] = useState("0");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerExpiresAt, setOfferExpiresAt] = useState("");
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [interviewCandidateId, setInterviewCandidateId] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewMode, setInterviewMode] = useState("VIDEO");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewPanel, setInterviewPanel] = useState<string[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { score: string; feedback: string; outcome: string }>>({});
  const [vacancyRequisitionId, setVacancyRequisitionId] = useState("");
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [location, setLocation] = useState("Kampala HQ");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [closingAt, setClosingAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!session) { setError("Please sign in to access recruitment."); setLoading(false); return; }
    try {
      const [reqs, jobs, depts] = await Promise.all([
        api<Requisition[]>("/recruitment/requisitions", session),
        api<Vacancy[]>("/recruitment/vacancies", session),
        api<Department[]>("/admin/departments", session),
      ]);
      if (recruiterRoles.includes(role)) setInterviewers(await api<Interviewer[]>("/recruitment/interviewers", session));
      setRequisitions(reqs); setVacancies(jobs);
      setDepartments(depts); setDepartmentId((current) => current || depts[0]?.id || "");
      setVacancyRequisitionId((current) => current || reqs.find((req) => req.status === "APPROVED")?.id || "");
    } catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load recruitment data"); }
    finally { setLoading(false); }
  }, [role, session]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function createRequisition(event: React.FormEvent) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<Requisition>("/recruitment/requisitions", session, { method: "POST", body: JSON.stringify({ departmentId, jobTitle, headcount, employmentType, justification, targetStartDate }) });
      setMessage("Staff requisition submitted for HR review."); setJobTitle(""); setJustification(""); setTargetStartDate(""); await loadData();
    } catch (submitError: unknown) { setError(submitError instanceof Error ? submitError.message : "Unable to submit requisition"); }
    finally { setBusy(false); }
  }

  async function decideRequisition(id: string, approve: boolean) {
    if (!session) return;
    const reason = rejectionReasons[id]?.trim();
    if (!approve && (reason?.length ?? 0) < 10) { setError("Enter at least 10 characters to explain the rejection."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/recruitment/requisitions/${id}/${approve ? "approve" : "reject"}`, session, { method: "POST", ...(!approve ? { body: JSON.stringify({ reason }) } : {}) });
      setMessage(approve ? "Requisition approved." : "Requisition rejected."); await loadData();
    } catch (decisionError: unknown) { setError(decisionError instanceof Error ? decisionError.message : "Unable to update requisition"); }
    finally { setBusy(false); }
  }

  async function createVacancy(event: React.FormEvent) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<Vacancy>("/recruitment/vacancies", session, { method: "POST", body: JSON.stringify({ requisitionId: vacancyRequisitionId, title: vacancyTitle, location, description, requirements, closingAt: localInputToEatIso(closingAt) }) });
      setMessage("Vacancy saved as a draft."); setVacancyTitle(""); setDescription(""); setRequirements(""); setClosingAt(""); await loadData();
    } catch (createError: unknown) { setError(createError instanceof Error ? createError.message : "Unable to create vacancy"); }
    finally { setBusy(false); }
  }

  async function publish(vacancyId: string) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try { await api(`/recruitment/vacancies/${vacancyId}/publish`, session, { method: "POST" }); setMessage("Vacancy published to the public careers page."); await loadData(); }
    catch (publishError: unknown) { setError(publishError instanceof Error ? publishError.message : "Unable to publish vacancy"); }
    finally { setBusy(false); }
  }

  async function openPipeline(vacancy: Vacancy) {
    if (!session) return;
    setSelectedVacancy(vacancy); setError("");
    try { setApplications(await api<Application[]>(`/recruitment/vacancies/${vacancy.id}/applications`, session)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load applications"); }
  }

  async function stageApplication(applicationId: string, status: "SHORTLISTED" | "INTERVIEWING" | "REJECTED") {
    if (!session) return;
    const stageNotes = rejectionReasons[applicationId];
    if (status === "REJECTED" && (stageNotes?.trim().length ?? 0) < 10) { setError("Enter at least 10 characters as the rejection reason."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/recruitment/applications/${applicationId}/stage`, session, { method: "PATCH", body: JSON.stringify({ status, ...(status === "REJECTED" ? { stageNotes } : {}) }) });
      setMessage(`Application moved to ${status.replaceAll("_", " ")}.`);
      if (selectedVacancy) setApplications(await api<Application[]>(`/recruitment/vacancies/${selectedVacancy.id}/applications`, session));
    } catch (stageError: unknown) { setError(stageError instanceof Error ? stageError.message : "Unable to update application"); }
    finally { setBusy(false); }
  }

  async function scheduleInterview(event: React.FormEvent, application: Application) {
    event.preventDefault();
    if (!session || !selectedVacancy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/recruitment/applications/${application.id}/interviews`, session, {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: localInputToEatIso(interviewAt), interviewMode, locationOrLink: interviewLocation,
          interviewerUserIds: interviewPanel,
        }),
      });
      setMessage("Interview scheduled and panelists assigned.");
      setInterviewCandidateId(""); setInterviewAt(""); setInterviewLocation(""); setInterviewPanel([]);
      setApplications(await api<Application[]>(`/recruitment/vacancies/${selectedVacancy.id}/applications`, session));
    } catch (scheduleError: unknown) { setError(scheduleError instanceof Error ? scheduleError.message : "Unable to schedule interview"); }
    finally { setBusy(false); }
  }

  async function submitInterviewReview(interviewId: string) {
    if (!session || !selectedVacancy) return;
    const draft = reviewDrafts[interviewId];
    if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/recruitment/interviews/${interviewId}`, session, {
        method: "PATCH", body: JSON.stringify({ score: Number(draft.score), feedback: draft.feedback, outcome: draft.outcome }),
      });
      setMessage("Interview panel review saved.");
      setApplications(await api<Application[]>(`/recruitment/vacancies/${selectedVacancy.id}/applications`, session));
    } catch (reviewError: unknown) { setError(reviewError instanceof Error ? reviewError.message : "Unable to save interview review"); }
    finally { setBusy(false); }
  }

  async function downloadCv(applicationId: string) {
    if (!session) return;
    setError("");
    try {
      const result = await api<{ signedUrl: string }>(`/recruitment/applications/${applicationId}/cv-url`, session);
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (downloadError: unknown) { setError(downloadError instanceof Error ? downloadError.message : "Unable to prepare CV download"); }
  }

  async function createOffer(event: React.FormEvent, application: Application) {
    event.preventDefault();
    if (!session || !selectedVacancy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/recruitment/applications/${application.id}/offers`, session, {
        method: "POST",
        body: JSON.stringify({
          offeredJobTitle: selectedVacancy.title,
          departmentId: selectedVacancy.requisition.department.id,
          offeredBaseSalaryUgx: Number(offerBaseSalary),
          offeredAllowancesUgx: Number(offerAllowances),
          proposedStartDate: offerStartDate,
          offerExpiresAt: localInputToEatIso(offerExpiresAt),
        }),
      });
      setMessage("Draft offer created. Submit it for HR approval when ready.");
      setOfferCandidateId(""); setOfferBaseSalary(""); setOfferAllowances("0"); setOfferStartDate(""); setOfferExpiresAt("");
      setApplications(await api<Application[]>(`/recruitment/vacancies/${selectedVacancy.id}/applications`, session));
    } catch (offerError: unknown) { setError(offerError instanceof Error ? offerError.message : "Unable to create offer"); }
    finally { setBusy(false); }
  }

  async function actOnOffer(offerId: string, action: "submit" | "approve" | "reject" | "send" | "record-decision" | "convert", body?: Record<string, unknown>) {
    if (!session || !selectedVacancy) return;
    const reason = offerRejectionReasons[offerId]?.trim();
    if (action === "reject" && (reason?.length ?? 0) < 10) { setError("Enter at least 10 characters to explain the rejection."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "convert") {
        const result = await api<{ employeeId: string; invitationSent?: boolean }>(`/recruitment/offers/${offerId}/convert`, session, {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        });
        setMessage(`Employee profile created (${result.employeeId}). ${result.invitationSent ? "Account setup email sent." : "Account setup email is pending; retry the conversion action after mail is configured."}`);
      } else {
        await api(`/recruitment/offers/${offerId}/${action}`, session, {
          method: "POST",
          ...(action === "reject" ? { body: JSON.stringify({ reason }) } : {}),
          ...(action === "record-decision" && body ? { body: JSON.stringify(body) } : {}),
        });
        setMessage(action === "send" ? "Offer emailed to the candidate." : action === "approve" ? "Offer approved." : action === "submit" ? "Offer submitted for HR approval." : action === "reject" ? "Offer rejected." : `Candidate ${String(body?.decision).toLowerCase()} response recorded.`);
      }
      setApplications(await api<Application[]>(`/recruitment/vacancies/${selectedVacancy.id}/applications`, session));
    } catch (actionError: unknown) { setError(actionError instanceof Error ? actionError.message : "Unable to update the offer"); }
    finally { setBusy(false); }
  }

  const canCreateRequisition = reqRoles.includes(role);
  const canManageVacancies = recruiterRoles.includes(role);
  const canApproveRequisition = hrRoles.includes(role);
  const approvedRequisitions = requisitions.filter((req) => req.status === "APPROVED");

  return <AppShell role={role} title="Recruitment">
    <ModulePage eyebrow="Lifecycle" title="Recruitment pipeline" description="Create and review staff requisitions, publish approved vacancies, and manage the applicant shortlist.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {loading ? <p>Loading recruitment data…</p> : <>
        {canCreateRequisition ? <section className="panel"><h3>Staff requisition</h3>
          {departments.length === 0 ? <p>Department list is unavailable for this role. Ask HR to create the request.</p> : <form onSubmit={createRequisition} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <label>Department<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label>Job title<input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} maxLength={150} required /></label>
            <label>Headcount<input type="number" min="1" max="100" value={headcount} onChange={(event) => setHeadcount(Number(event.target.value))} required /></label>
            <label>Employment type<select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option></select></label>
            <label>Target start date<input type="date" value={targetStartDate} onChange={(event) => setTargetStartDate(event.target.value)} required /></label>
            <label style={{ gridColumn: "1 / -1" }}>Justification<textarea rows={3} minLength={10} maxLength={3000} value={justification} onChange={(event) => setJustification(event.target.value)} required /></label>
            <button className="button button-primary" type="submit" disabled={busy}>Submit requisition</button>
          </form>}
        </section> : null}

        <section className="panel" style={{ marginTop: 16 }}><h3>Requisitions</h3>
          {requisitions.length === 0 ? <p>No requisitions available.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Role</th><th>Department</th><th>Headcount</th><th>Status</th>{canApproveRequisition ? <th>Decision</th> : null}</tr></thead><tbody>
            {requisitions.map((req) => <tr key={req.id}><td>{req.requisitionCode}</td><td>{req.jobTitle}</td><td>{req.department.name}</td><td>{req.headcount}</td><td>{req.status.replaceAll("_", " ")}</td>{canApproveRequisition ? <td>{req.status === "PENDING_HR" ? <div style={{ display: "grid", gap: 8 }}><button className="button button-primary" type="button" disabled={busy} onClick={() => void decideRequisition(req.id, true)}>Approve</button><input aria-label={`Rejection reason for ${req.requisitionCode}`} placeholder="Rejection reason (10+ chars)" value={rejectionReasons[req.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [req.id]: event.target.value }))} /><button className="button" type="button" disabled={busy} onClick={() => void decideRequisition(req.id, false)}>Reject</button></div> : req.decisionReason ?? "—"}</td> : null}</tr>)}
          </tbody></table></div>}
        </section>

        {canManageVacancies ? <section className="panel" style={{ marginTop: 16 }}><h3>Draft a vacancy</h3>
          {approvedRequisitions.length === 0 ? <p>An approved requisition is required before a vacancy can be created.</p> : <form onSubmit={createVacancy} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            <label>Approved requisition<select value={vacancyRequisitionId} onChange={(event) => setVacancyRequisitionId(event.target.value)}>{approvedRequisitions.map((req) => <option key={req.id} value={req.id}>{req.requisitionCode} · {req.jobTitle}</option>)}</select></label>
            <label>Vacancy title<input value={vacancyTitle} onChange={(event) => setVacancyTitle(event.target.value)} maxLength={150} required /></label>
            <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} required /></label>
            <label>Closing date/time (Kampala)<input type="datetime-local" value={closingAt} onChange={(event) => setClosingAt(event.target.value)} required /></label>
            <label style={{ gridColumn: "1 / -1" }}>Description<textarea rows={4} minLength={10} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} required /></label>
            <label style={{ gridColumn: "1 / -1" }}>Requirements<textarea rows={4} minLength={10} maxLength={10000} value={requirements} onChange={(event) => setRequirements(event.target.value)} required /></label>
            <button className="button button-primary" type="submit" disabled={busy}>Save draft</button>
          </form>}
        </section> : null}

        <section className="panel" style={{ marginTop: 16 }}><h3>Vacancies</h3>
          {vacancies.length === 0 ? <p>No vacancies are available.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Title</th><th>Department</th><th>Closes</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {vacancies.map((vacancy) => <tr key={vacancy.id}><td>{vacancy.vacancyCode}</td><td>{vacancy.title}</td><td>{vacancy.requisition.department.name}</td><td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(vacancy.closingAt))}</td><td>{vacancy.status}</td><td><div style={{ display: "flex", gap: 8 }}>{canManageVacancies && vacancy.status === "DRAFT" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void publish(vacancy.id)}>Publish</button> : null}<button className="button" type="button" onClick={() => void openPipeline(vacancy)}>Applications</button></div></td></tr>)}
          </tbody></table></div>}
        </section>

        {selectedVacancy ? <section className="panel" style={{ marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3>Applications · {selectedVacancy.title}</h3><button className="button" type="button" onClick={() => { setSelectedVacancy(null); setApplications([]); }}>Close</button></div>
          {applications.length === 0 ? <p>No applications are available to your role for this vacancy.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Candidate</th><th>Reference</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {applications.map((app) => <tr key={app.id}><td>{app.fullName}<br /><small>{app.applicantEmail ?? "Shortlisted candidate"}</small></td><td>{app.applicationCode}</td><td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(app.submittedAt))}</td><td>{app.status}</td><td><div style={{ display: "grid", gap: 8, minWidth: 190 }}>
              {recruiterRoles.includes(role) ? <button className="button" type="button" onClick={() => void downloadCv(app.id)}>Download CV</button> : null}
              {recruiterRoles.includes(role) && app.status === "APPLIED" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void stageApplication(app.id, "SHORTLISTED")}>Shortlist</button> : null}
              {recruiterRoles.includes(role) && app.status === "SHORTLISTED" ? <button className="button" type="button" disabled={busy} onClick={() => void stageApplication(app.id, "INTERVIEWING")}>Move to interview</button> : null}
              {app.interviews?.map((interview) => <div key={interview.id} className="panel" style={{ display: "grid", gap: 6 }}>
                <strong>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kampala" }).format(new Date(interview.scheduledAt))} · {interview.interviewMode.replaceAll("_", " ")} · {interview.outcome.replaceAll("_", " ")}</strong>
                {interview.locationOrLink ? interview.interviewMode === "VIDEO" ? <a href={interview.locationOrLink} target="_blank" rel="noreferrer">Join video interview</a> : <p>Location: {interview.locationOrLink}</p> : null}
                {interview.reviews.map((review) => <p key={review.reviewerUserId}>Panelist review: {review.score} / 5 · {review.recommendation.replaceAll("_", " ")} · {review.feedback}</p>)}
                {interview.interviewerUserIds.includes(session?.user?.id ?? "") && interview.outcome === "SCHEDULED" ? <form onSubmit={(event) => { event.preventDefault(); void submitInterviewReview(interview.id); }} style={{ display: "grid", gap: 6 }}>
                  <label>Panel score (1–5)<input type="number" min="1" max="5" step="0.5" value={reviewDrafts[interview.id]?.score ?? ""} onChange={(event) => setReviewDrafts((current) => ({ ...current, [interview.id]: { score: event.target.value, feedback: current[interview.id]?.feedback ?? "", outcome: current[interview.id]?.outcome ?? "COMPLETED" } }))} required /></label>
                  <label>Feedback<textarea minLength={10} maxLength={5000} value={reviewDrafts[interview.id]?.feedback ?? ""} onChange={(event) => setReviewDrafts((current) => ({ ...current, [interview.id]: { score: current[interview.id]?.score ?? "", feedback: event.target.value, outcome: current[interview.id]?.outcome ?? "COMPLETED" } }))} required /></label>
                  <label>Recommendation<select value={reviewDrafts[interview.id]?.outcome ?? "COMPLETED"} onChange={(event) => setReviewDrafts((current) => ({ ...current, [interview.id]: { score: current[interview.id]?.score ?? "", feedback: current[interview.id]?.feedback ?? "", outcome: event.target.value } }))}><option value="COMPLETED">Complete interview</option><option value="ADVANCE">Recommend advancing</option><option value="REJECT">Recommend rejection</option></select></label>
                  <button className="button" type="submit" disabled={busy}>Save panel review</button>
                </form> : null}
              </div>)}
              {recruiterRoles.includes(role) && ["SHORTLISTED", "INTERVIEWING"].includes(app.status) ? <button className="button" type="button" disabled={busy} onClick={() => { setInterviewCandidateId(interviewCandidateId === app.id ? "" : app.id); setError(""); }}>Schedule interview</button> : null}
              {interviewCandidateId === app.id ? <form onSubmit={(event) => void scheduleInterview(event, app)} style={{ display: "grid", gap: 6 }}>
                <label>Interview date/time (Kampala)<input type="datetime-local" value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} required /></label>
                <label>Format<select value={interviewMode} onChange={(event) => setInterviewMode(event.target.value)}><option value="VIDEO">Video</option><option value="IN_PERSON">In person</option><option value="PHONE">Phone</option></select></label>
                <label>Location or meeting link<input value={interviewLocation} onChange={(event) => setInterviewLocation(event.target.value)} maxLength={255} required /></label>
                <label>Panelists<select multiple value={interviewPanel} onChange={(event) => setInterviewPanel(Array.from(event.currentTarget.selectedOptions, (option) => option.value))} required>{interviewers.map((person) => <option key={person.id} value={person.id}>{person.employee?.legalName ?? person.email} · {person.email}</option>)}</select></label>
                <button className="button button-primary" type="submit" disabled={busy || interviewPanel.length === 0}>Save interview schedule</button>
              </form> : null}
              {recruiterRoles.includes(role) && ["APPLIED", "SHORTLISTED", "INTERVIEWING"].includes(app.status) ? <><input aria-label={`Rejection reason for ${app.applicationCode}`} placeholder="Rejection reason" value={rejectionReasons[app.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [app.id]: event.target.value }))} /><button className="button" type="button" disabled={busy} onClick={() => void stageApplication(app.id, "REJECTED")}>Reject application</button></> : null}
              {recruiterRoles.includes(role) && !app.offer && ["SHORTLISTED", "INTERVIEWING"].includes(app.status) ? <button className="button button-primary" type="button" disabled={busy} onClick={() => { setOfferCandidateId(offerCandidateId === app.id ? "" : app.id); setError(""); }}>Prepare offer</button> : null}
              {offerCandidateId === app.id ? <form onSubmit={(event) => void createOffer(event, app)} style={{ display: "grid", gap: 6 }}>
                <label>Base monthly salary (UGX)<input type="number" min="1" step="1" value={offerBaseSalary} onChange={(event) => setOfferBaseSalary(event.target.value)} required /></label>
                <label>Monthly allowances (UGX)<input type="number" min="0" step="1" value={offerAllowances} onChange={(event) => setOfferAllowances(event.target.value)} required /></label>
                <label>Proposed start date<input type="date" value={offerStartDate} onChange={(event) => setOfferStartDate(event.target.value)} required /></label>
                <label>Offer expiry (Kampala)<input type="datetime-local" value={offerExpiresAt} onChange={(event) => setOfferExpiresAt(event.target.value)} required /></label>
                <button className="button button-primary" type="submit" disabled={busy}>Save draft offer</button>
              </form> : null}
              {app.offer ? <div className="panel" style={{ display: "grid", gap: 6 }}><strong>{app.offer.offeredJobTitle} · {app.offer.status.replaceAll("_", " ")}</strong>
                {app.offer.status === "DRAFT" && recruiterRoles.includes(role) ? <button className="button" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "submit")}>Submit for HR approval</button> : null}
                {app.offer.status === "PENDING_APPROVAL" && hrRoles.includes(role) ? <><button className="button button-primary" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "approve")}>Approve offer</button><input aria-label={`Rejection reason for offer ${app.applicationCode}`} placeholder="Offer rejection reason" value={offerRejectionReasons[app.offer.id] ?? ""} onChange={(event) => setOfferRejectionReasons((current) => ({ ...current, [app.offer!.id]: event.target.value }))} /><button className="button" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "reject")}>Reject offer</button></> : null}
                {app.offer.status === "APPROVED" && recruiterRoles.includes(role) ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "send")}>Email offer to candidate</button> : null}
                {app.offer.status === "SENT" && recruiterRoles.includes(role) ? <><button className="button" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "record-decision", { decision: "ACCEPTED" })}>Record candidate acceptance</button><button className="button" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "record-decision", { decision: "DECLINED", notes: "Candidate declined through recruiter" })}>Record decline</button></> : null}
                {app.offer.status === "ACCEPTED" && hrRoles.includes(role) ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void actOnOffer(app.offer!.id, "convert")}>Convert to employee</button> : null}
              </div> : null}
            </div></td></tr>)}
          </tbody></table></div>}
        </section> : null}
      </>}
    </ModulePage>
  </AppShell>;
}
