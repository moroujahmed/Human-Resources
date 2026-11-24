"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface LeaveType {
  id: string;
  code: string;
  name: string;
}

interface LeaveBalance {
  year: number;
  entitledDays: string;
  carriedOverDays: string;
  usedDays: string;
  pendingDays: string;
  leaveType: { code: string; name: string; isPaid: boolean };
}

interface LeaveRequest {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  workingDays: string;
  reason: string;
  decisionReason?: string | null;
  leaveType: { name: string };
  employee?: { legalName: string; employeeCode: string };
}

const approverRoles: StaffHubRole[] = ["LINE_MANAGER", "HR_MANAGER"];

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeZone: "Africa/Kampala",
  }).format(new Date(value));
}

export default function LeavePage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const canApprove = approverRoles.includes(role);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDayPeriod, setHalfDayPeriod] = useState("FULL");
  const [reason, setReason] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingOn, setActingOn] = useState("");

  const loadData = useCallback(async () => {
    if (!session) {
      setError("Please sign in to view leave information.");
      setLoading(false);
      return;
    }
    setError("");
    try {
      const requestsToLoad: Promise<unknown>[] = [
        api<LeaveType[]>("/leave/types", session),
        api<LeaveBalance[]>(`/leave/balances?year=${new Date().getFullYear()}`, session),
        api<LeaveRequest[]>("/leave/requests", session),
      ];
      if (canApprove) {
        requestsToLoad.push(api<LeaveRequest[]>("/leave/requests?pendingMyApproval=true", session));
      }
      const [nextTypes, nextBalances, nextRequests, nextPending] = await Promise.all(requestsToLoad) as [
        LeaveType[], LeaveBalance[], LeaveRequest[], LeaveRequest[] | undefined,
      ];
      setTypes(nextTypes);
      setBalances(nextBalances);
      setRequests(nextRequests);
      setPending(nextPending ?? []);
      setLeaveTypeId((current) => current || nextTypes[0]?.id || "");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load leave data");
    } finally {
      setLoading(false);
    }
  }, [canApprove, session]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return setError("Please sign in again.");
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api<LeaveRequest>("/leave/requests", session, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ leaveTypeId, startDate, endDate, halfDayPeriod, reason }),
      });
      setMessage("Your leave request was submitted.");
      setReason("");
      await loadData();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(requestId: string, decision: "approve" | "reject") {
    if (!session) return;
    const decisionReason = rejectionReasons[requestId]?.trim();
    if (decision === "reject" && !decisionReason) {
      setError("Enter a reason before rejecting a request.");
      return;
    }
    setActingOn(requestId);
    setError("");
    setMessage("");
    try {
      await api<LeaveRequest>(`/leave/requests/${requestId}/${decision}`, session, {
        method: "POST",
        ...(decision === "reject" ? { body: JSON.stringify({ reason: decisionReason }) } : {}),
      });
      setMessage(decision === "approve" ? "Request approved." : "Request rejected.");
      await loadData();
    } catch (decisionError: unknown) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to update this request");
    } finally {
      setActingOn("");
    }
  }

  return (
    <AppShell role={role} title="Leave">
      <ModulePage
        eyebrow="Time away"
        title={canApprove ? "Leave requests" : "Leave management"}
        description={canApprove
          ? "Review requests from your team and keep track of your own leave."
          : "Request leave, view your available balances, and track approvals."}
        actions={role === "EMPLOYEE" || Boolean(session?.user)
          ? <button className="button button-primary" type="submit" form="leave-request-form" disabled={submitting || !session}>{submitting ? "Submitting…" : "Submit request"}</button>
          : undefined}
      >
        {error ? <p className="status-danger" role="alert">{error}</p> : null}
        {message ? <p className="status-success" role="status">{message}</p> : null}
        {!session ? <section className="panel"><p>Sign in to access leave information.</p></section> : (
          <>
            {canApprove ? (
              <section className="panel" aria-labelledby="approval-heading">
                <h3 id="approval-heading">Pending your approval <span className="role-chip">{pending.length}</span></h3>
                {loading ? <p>Loading approval queue…</p> : pending.length === 0 ? <p>No requests are waiting for your review.</p> : (
                  <div className="table-wrap"><table className="data-table">
                    <thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th>Days</th><th>Reason</th><th>Decision</th></tr></thead>
                    <tbody>{pending.map((request) => (
                      <tr key={request.id}>
                        <td>{request.employee?.legalName ?? "Employee"}<br /><small>{request.employee?.employeeCode}</small></td>
                        <td>{request.leaveType.name}</td>
                        <td>{dateLabel(request.startDate)} – {dateLabel(request.endDate)}</td>
                        <td>{request.workingDays}</td>
                        <td>{request.reason}</td>
                        <td>
                          <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
                            <button className="button button-primary" type="button" disabled={actingOn === request.id} onClick={() => void decide(request.id, "approve")}>{actingOn === request.id ? "Saving…" : "Approve"}</button>
                            <input aria-label={`Rejection reason for ${request.employee?.legalName ?? "employee"}`} placeholder="Reason required to reject" value={rejectionReasons[request.id] ?? ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [request.id]: event.target.value }))} />
                            <button className="button" type="button" disabled={actingOn === request.id} onClick={() => void decide(request.id, "reject")}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </section>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(220px,1fr)", gap: 16, marginTop: 16 }}>
              <section className="panel">
                <h3>Request leave</h3>
                <form id="leave-request-form" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                  <label>Leave type
                    <select value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)} required disabled={types.length === 0}>
                      {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
                    <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate} required /></label>
                  </div>
                  <label>Day period
                    <select value={halfDayPeriod} onChange={(event) => setHalfDayPeriod(event.target.value)}>
                      <option value="FULL">Full day</option><option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option>
                    </select>
                  </label>
                  <label>Reason<textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for your request" required /></label>
                </form>
              </section>
              <aside className="panel">
                <h3>Balances</h3>
                {loading ? <p>Loading balances…</p> : balances.length === 0 ? <p>No balances available for this year.</p> : balances.map((balance) => {
                  const remaining = Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays) - Number(balance.pendingDays);
                  return <p key={`${balance.leaveType.code}-${balance.year}`}><strong>{remaining}</strong> {balance.leaveType.name} days remaining<br /><small>{Number(balance.pendingDays)} pending</small></p>;
                })}
              </aside>
            </div>

            <section className="panel" style={{ marginTop: 16 }}>
              <h3>{canApprove ? "Requests you can access" : "Recent requests"}</h3>
              {loading ? <p>Loading requests…</p> : requests.length === 0 ? <p>You have not submitted any leave requests.</p> : (
                <div className="table-wrap"><table className="data-table"><thead><tr><th>Leave</th><th>Dates</th><th>Days</th><th>Status</th><th>Note</th></tr></thead><tbody>
                  {requests.map((request) => <tr key={request.id}>
                    <td>{request.leaveType.name}</td><td>{dateLabel(request.startDate)} – {dateLabel(request.endDate)}</td><td>{request.workingDays}</td><td>{request.status.replaceAll("_", " ")}</td><td>{request.decisionReason || request.reason}</td>
                  </tr>)}
                </tbody></table></div>
              )}
            </section>
          </>
        )}
      </ModulePage>
    </AppShell>
  );
}
