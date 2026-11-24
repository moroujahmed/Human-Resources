"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffHubRole } from "@staffhub/shared";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { useStaffSession } from "../../src/components/SessionProvider";

interface OnboardingTask {
  id: string;
  title: string;
  assignedRole: StaffHubRole;
  isCompleted: boolean;
  completedAt: string | null;
}

interface Checklist {
  id: string;
  status: string;
  employee: { id: string; employeeCode: string; legalName: string; jobTitle: string };
  tasks: OnboardingTask[];
}

export default function OnboardingPage() {
  const { session } = useStaffSession();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTask, setBusyTask] = useState("");
  const [error, setError] = useState("");
  const role = session?.user?.role ?? "EMPLOYEE";

  const load = useCallback(async () => {
    if (!session) return;
    setError("");
    try {
      setChecklists(await api<Checklist[]>("/recruitment/onboarding", session));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding checklists.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  async function updateTask(task: OnboardingTask, isCompleted: boolean) {
    if (!session) return;
    setBusyTask(task.id);
    setError("");
    try {
      await api(`/recruitment/onboarding/tasks/${task.id}`, session, {
        method: "PATCH",
        body: JSON.stringify({ isCompleted }),
      });
      await load();
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update the onboarding task.");
    } finally {
      setBusyTask("");
    }
  }

  return <AppShell role={role} title="Onboarding">
    <ModulePage eyebrow="New starter experience" title="Onboarding checklists" description="Complete your role-owned tasks. New employees become active when every checklist item is complete.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {loading ? <p>Loading onboarding checklists…</p> : checklists.length === 0 ? <div className="empty-state">There are no onboarding tasks for your account.</div> : <div className="status-grid">
        {checklists.map((checklist) => {
          const completed = checklist.tasks.filter((task) => task.isCompleted).length;
          return <section className="panel" key={checklist.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><p className="eyebrow">{checklist.employee.employeeCode} · {checklist.employee.jobTitle}</p><h2>{checklist.employee.legalName}</h2></div>
              <span className={`role-chip${checklist.status === "COMPLETED" ? " status-success" : ""}`}>{checklist.status.replaceAll("_", " ")}</span>
            </div>
            <p>{completed} of {checklist.tasks.length} tasks complete</p>
            <ul style={{ display: "grid", gap: 12, paddingLeft: 20 }}>
              {checklist.tasks.map((task) => <li key={task.id}>
                <strong>{task.title}</strong> <small>· {task.assignedRole.replaceAll("_", " ")}</small>
                <div>{task.isCompleted ? <span className="status-success">Completed</span> : <span>Pending</span>}
                  {task.assignedRole === role ? <button className="button" type="button" disabled={busyTask === task.id} style={{ marginLeft: 10 }} onClick={() => void updateTask(task, !task.isCompleted)}>{task.isCompleted ? "Reopen" : "Mark complete"}</button> : null}
                </div>
              </li>)}
            </ul>
          </section>;
        })}
      </div>}
    </ModulePage>
  </AppShell>;
}
