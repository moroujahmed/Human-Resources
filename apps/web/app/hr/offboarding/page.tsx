"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../../src/components/AppShell";
import { ModulePage } from "../../../src/components/ModulePage";
import { api } from "../../../src/lib/api";
import { getSession } from "../../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface Employee { id: string; employeeCode: string; legalName: string; jobTitle: string; department: { name: string } }
interface Clearance { id: string; trackType: string; assignedRole: string; status: string; notes?: string | null }
interface OffboardingCase {
  id: string;
  employeeId: string;
  exitType: string;
  noticeDate: string;
  lastWorkingDay: string;
  exitReason: string;
  status: string;
  deactivatedAt: string | null;
  employee: { id: string; employeeCode: string; legalName: string; managerId?: string | null };
  clearanceItems?: Clearance[];
}

const exitTypes = ["RESIGNATION", "CONTRACT_EXPIRY", "TERMINATION", "RETIREMENT"];
const trackLabels: Record<string, string> = { ASSET_RETURN: "Asset return", OPERATIONAL_HANDOVER: "Operational handover", FINANCE_LOANS: "Finance and loans", HR_EXIT: "HR exit" };

export default function OffboardingPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "HR_MANAGER";
  const [cases, setCases] = useState<OffboardingCase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [exitType, setExitType] = useState(exitTypes[0]);
  const [noticeDate, setNoticeDate] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!session) { setError("Please sign in to access offboarding."); setLoading(false); return; }
    try {
      const caseRequest = api<OffboardingCase[]>("/offboarding/cases", session);
      if (role === "HR_MANAGER" || role === "SYSTEM_ADMIN") {
        const [nextCases, nextEmployees] = await Promise.all([caseRequest, api<Employee[]>("/employees", session)]);
        setCases(nextCases); setEmployees(nextEmployees); setEmployeeId((current) => current || nextEmployees[0]?.id || "");
      } else setCases(await caseRequest);
    } catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load offboarding cases"); }
    finally { setLoading(false); }
  }, [role, session]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function createCase(event: React.FormEvent) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<OffboardingCase>("/offboarding/cases", session, { method: "POST", body: JSON.stringify({ employeeId, exitType, noticeDate, lastWorkingDay, exitReason }) });
      setMessage("Exit case opened and clearance tracks assigned."); setNoticeDate(""); setLastWorkingDay(""); setExitReason(""); await loadData();
    } catch (createError: unknown) { setError(createError instanceof Error ? createError.message : "Unable to start offboarding"); }
    finally { setBusy(false); }
  }

  async function signOff(caseId: string, trackType: string) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/offboarding/cases/${caseId}/clearances/${trackType}/sign-off`, session, { method: "POST", body: JSON.stringify({ notes: notes[`${caseId}:${trackType}`] ?? "" }) });
      setMessage(`${trackLabels[trackType] ?? trackType} clearance recorded.`); await loadData();
    } catch (signOffError: unknown) { setError(signOffError instanceof Error ? signOffError.message : "Unable to record clearance"); }
    finally { setBusy(false); }
  }

  async function finalize(caseId: string) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try { await api(`/offboarding/cases/${caseId}/finalize`, session, { method: "POST" }); setMessage("All clearance tracks are complete. Exit case finalized."); await loadData(); }
    catch (finalizeError: unknown) { setError(finalizeError instanceof Error ? finalizeError.message : "Unable to finalize case"); }
    finally { setBusy(false); }
  }

  async function deactivate(caseId: string) {
    if (!session || !window.confirm("Deactivate this employee account? This will revoke active sessions.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await api(`/offboarding/cases/${caseId}/deactivate`, session, { method: "POST" }); setMessage("Employee account deactivated and sessions revoked."); await loadData(); }
    catch (deactivateError: unknown) { setError(deactivateError instanceof Error ? deactivateError.message : "Unable to deactivate account"); }
    finally { setBusy(false); }
  }

  const canInitiate = role === "HR_MANAGER" || role === "SYSTEM_ADMIN";
  return <AppShell role={role} title="Offboarding">
    <ModulePage eyebrow="Exit lifecycle" title="Clearance and exits" description="Track asset, handover, finance, and HR clearance with role-owned sign-offs.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {canInitiate ? <section className="panel"><h3>Initiate an exit</h3>
        {employees.length === 0 ? <p>No employee records are available.</p> : <form onSubmit={createCase} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          <label>Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.legalName} · {employee.employeeCode}</option>)}</select></label>
          <label>Exit type<select value={exitType} onChange={(event) => setExitType(event.target.value)}>{exitTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
          <label>Notice date<input type="date" value={noticeDate} onChange={(event) => setNoticeDate(event.target.value)} required /></label>
          <label>Last working day<input type="date" min={noticeDate || undefined} value={lastWorkingDay} onChange={(event) => setLastWorkingDay(event.target.value)} required /></label>
          <label style={{ gridColumn: "1 / -1" }}>Exit reason<textarea rows={3} minLength={5} maxLength={2000} value={exitReason} onChange={(event) => setExitReason(event.target.value)} required /></label>
          <button className="button button-primary" type="submit" disabled={busy}>Open exit case</button>
        </form>}
      </section> : null}
      <section className="panel" style={{ marginTop: 16 }}><h3>Exit cases <span className="role-chip">{cases.length}</span></h3>
        {loading ? <p>Loading cases…</p> : cases.length === 0 ? <p>No offboarding cases are available.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Exit type</th><th>Last working day</th><th>Case status</th><th>Clearances</th><th>Actions</th></tr></thead><tbody>
          {cases.map((caseItem) => <tr key={caseItem.id}>
            <td>{caseItem.employee.legalName}<br /><small>{caseItem.employee.employeeCode}</small></td><td>{caseItem.exitType.replaceAll("_", " ")}</td><td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(caseItem.lastWorkingDay))}</td><td>{caseItem.status.replaceAll("_", " ")}</td>
            <td><div style={{ display: "grid", gap: 6 }}>{caseItem.clearanceItems?.map((item) => <div key={item.trackType}><strong>{trackLabels[item.trackType] ?? item.trackType}</strong>: {item.status}{item.status !== "CLEARED" && item.assignedRole === role ? <><input aria-label={`Notes for ${trackLabels[item.trackType]}`} placeholder="Clearance note (optional)" value={notes[`${caseItem.id}:${item.trackType}`] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [`${caseItem.id}:${item.trackType}`]: event.target.value }))} /><button className="button" type="button" disabled={busy} onClick={() => void signOff(caseItem.id, item.trackType)}>Sign off</button></> : null}</div>) ?? "Role-restricted clearance details"}</div></td>
            <td><div style={{ display: "grid", gap: 8 }}>{canInitiate && caseItem.status !== "CLEARED" ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void finalize(caseItem.id)}>Finalize</button> : null}{canInitiate && !caseItem.deactivatedAt ? <button className="button" type="button" disabled={busy} onClick={() => void deactivate(caseItem.id)}>Deactivate account</button> : caseItem.deactivatedAt ? "Account deactivated" : null}</div></td>
          </tr>)}
        </tbody></table></div>}
      </section>
      <p className="status-warning" style={{ marginTop: 16 }}>Account deactivation is permitted only after the last working day in Kampala time. Clearance finalization is separate and requires all four tracks.</p>
    </ModulePage>
  </AppShell>;
}
