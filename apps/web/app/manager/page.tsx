"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";
import { useStaffSession } from "../../src/components/SessionProvider";
import { api } from "../../src/lib/api";

interface Employee { id: string; employeeCode: string; legalName: string; jobTitle: string; status: string }
interface LeaveRequest { id: string; status: string; employee: { legalName: string; employeeCode: string }; leaveType: { name: string }; startDate: string; endDate: string }
interface Requisition { id: string; requisitionCode: string; jobTitle: string; status: string; department: { name: string } }
interface Checklist { id: string; status: string; employee: { legalName: string; employeeCode: string }; tasks: Array<{ isCompleted: boolean }> }

export default function ManagerPage() {
  const { session } = useStaffSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setError("");
    const results = await Promise.allSettled([
      api<Employee[]>("/employees", session),
      api<LeaveRequest[]>("/leave/requests?pendingMyApproval=true", session),
      api<Requisition[]>("/recruitment/requisitions", session),
      api<Checklist[]>("/recruitment/onboarding", session),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Some team data could not be loaded.");
    if (results[0].status === "fulfilled") setEmployees(results[0].value);
    if (results[1].status === "fulfilled") setLeaveRequests(results[1].value);
    if (results[2].status === "fulfilled") setRequisitions(results[2].value);
    if (results[3].status === "fulfilled") setChecklists(results[3].value);
    setLoading(false);
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const pendingRequisitions = requisitions.filter((requisition) => requisition.status === "PENDING_HR").length;
  const activeOnboarding = checklists.filter((checklist) => checklist.status !== "COMPLETED").length;

  return <AppShell role="LINE_MANAGER" title="Team Operations">
    <ModulePage eyebrow="Line management" title="Direct report operations" description="Your team, pending leave decisions, requisitions, and onboarding tasks.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {loading ? <p>Loading team operations…</p> : <>
        <div className="status-grid">
          <StatusCard label="Direct reports" value={String(employees.length)} />
          <StatusCard label="Pending leave approvals" value={String(leaveRequests.length)} tone={leaveRequests.length ? "warning" : "success"} />
          <StatusCard label="Requisitions awaiting HR" value={String(pendingRequisitions)} />
          <StatusCard label="Onboarding in progress" value={String(activeOnboarding)} tone={activeOnboarding ? "warning" : "neutral"} />
        </div>
        <div className="status-grid" style={{ marginTop: 16 }}>
          <section className="panel"><h2>Leave requests needing your decision</h2>
            {leaveRequests.length === 0 ? <p>No leave requests are awaiting your review.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Action</th></tr></thead><tbody>
              {leaveRequests.slice(0, 10).map((request) => <tr key={request.id}><td>{request.employee.legalName}<br /><small>{request.employee.employeeCode}</small></td><td>{request.leaveType.name}</td><td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(request.startDate))} – {new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(request.endDate))}</td><td><Link href="/leave">Review</Link></td></tr>)}
            </tbody></table></div>}
          </section>
          <section className="panel"><h2>Team onboarding</h2>
            {checklists.filter((item) => item.status !== "COMPLETED").slice(0, 6).map((item) => <p key={item.id}>{item.employee.employeeCode} · {item.employee.legalName} · {item.tasks.filter((task) => task.isCompleted).length}/{item.tasks.length} tasks</p>)}
            {activeOnboarding === 0 ? <p>No team members are onboarding.</p> : null}<Link href="/onboarding">Open onboarding tasks</Link>
          </section>
          <section className="panel"><h2>Direct reports</h2>
            {employees.slice(0, 10).map((employee) => <p key={employee.id}>{employee.employeeCode} · {employee.legalName} · {employee.jobTitle} ({employee.status.replaceAll("_", " ")})</p>)}
            {employees.length === 0 ? <p>No direct reports are assigned to your account.</p> : null}
          </section>
          <section className="panel"><h2>Staff requisitions</h2>
            {requisitions.slice(0, 6).map((requisition) => <p key={requisition.id}>{requisition.requisitionCode} · {requisition.jobTitle} · {requisition.status.replaceAll("_", " ")}</p>)}
            {requisitions.length === 0 ? <p>You have no staff requisitions.</p> : null}<Link href="/recruitment">Open requisitions</Link>
          </section>
        </div>
      </>}
    </ModulePage>
  </AppShell>;
}
