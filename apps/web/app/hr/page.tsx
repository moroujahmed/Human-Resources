"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";
import { useStaffSession } from "../../src/components/SessionProvider";
import { api } from "../../src/lib/api";

interface Employee { id: string; employeeCode: string; legalName: string; status: string }
interface LeaveRequest { id: string; status: string; startDate: string; endDate: string; employee: { legalName: string }; leaveType: { name: string } }
interface ExitCase { id: string; status: string; employee: { legalName: string; employeeCode: string } }
interface Checklist { id: string; status: string; employee: { legalName: string; employeeCode: string } }

export default function HrPage() {
  const { session } = useStaffSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [exitCases, setExitCases] = useState<ExitCase[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setError("");
    const results = await Promise.allSettled([
      api<Employee[]>("/employees", session),
      api<LeaveRequest[]>("/leave/requests?pendingMyApproval=true", session),
      api<ExitCase[]>("/offboarding/cases", session),
      api<Checklist[]>("/recruitment/onboarding", session),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Some HR data could not be loaded.");
    if (results[0].status === "fulfilled") setEmployees(results[0].value);
    if (results[1].status === "fulfilled") setLeaveRequests(results[1].value);
    if (results[2].status === "fulfilled") setExitCases(results[2].value);
    if (results[3].status === "fulfilled") setChecklists(results[3].value);
    setLoading(false);
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
  const openExits = exitCases.filter((exitCase) => exitCase.status !== "CLEARED").length;
  const onboarding = checklists.filter((checklist) => checklist.status !== "COMPLETED").length;

  return <AppShell role="HR_MANAGER" title="HR Overview">
    <ModulePage eyebrow="People operations" title="Human resources" description="Current staff, pending decisions, onboarding, and exits from the live HR records.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {loading ? <p>Loading HR overview…</p> : <>
        <div className="status-grid">
          <StatusCard label="Active employees" value={String(activeEmployees)} />
          <StatusCard label="Pending leave approvals" value={String(leaveRequests.length)} tone={leaveRequests.length ? "warning" : "success"} />
          <StatusCard label="Open exits" value={String(openExits)} tone={openExits ? "danger" : "neutral"} />
          <StatusCard label="Onboarding in progress" value={String(onboarding)} tone={onboarding ? "warning" : "success"} />
        </div>
        <div className="status-grid" style={{ marginTop: 16 }}>
          <section className="panel"><h2>Leave approvals</h2>
            {leaveRequests.length === 0 ? <p>No leave requests are awaiting HR review.</p> : <ul>{leaveRequests.slice(0, 5).map((request) => <li key={request.id}>{request.employee.legalName} · {request.leaveType.name} · {request.status.replaceAll("_", " ")}</li>)}</ul>}
            <Link href="/leave">Review leave requests</Link>
          </section>
          <section className="panel"><h2>Onboarding</h2>
            {checklists.filter((item) => item.status !== "COMPLETED").slice(0, 5).map((item) => <p key={item.id}>{item.employee.employeeCode} · {item.employee.legalName}</p>)}
            {onboarding === 0 ? <p>No hires are onboarding.</p> : null}
            <Link href="/onboarding">Open onboarding tasks</Link>
          </section>
          <section className="panel"><h2>Offboarding</h2>
            {exitCases.filter((item) => item.status !== "CLEARED").slice(0, 5).map((item) => <p key={item.id}>{item.employee.employeeCode} · {item.employee.legalName}</p>)}
            {openExits === 0 ? <p>No open exit cases.</p> : null}
            <Link href="/hr/offboarding">Manage exit cases</Link>
          </section>
          <section className="panel"><h2>Employee directory</h2><p>{activeEmployees} current employees are visible to HR.</p><Link href="/hr/employees">Open employee directory</Link></section>
        </div>
      </>}
    </ModulePage>
  </AppShell>;
}
