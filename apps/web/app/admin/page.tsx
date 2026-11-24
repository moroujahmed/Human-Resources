"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

type InternalRole = Exclude<StaffHubRole, never>;
interface AdminUser {
  id: string;
  email: string;
  role: InternalRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employee: { employeeCode: string; legalName: string } | null;
}
interface WorkSchedule { id: string; name: string; shiftStartTime: string; shiftEndTime: string; gracePeriodMinutes: number; workingDaysBitmap: number[]; isDefault: boolean }
interface PublicHoliday { id: string; holidayDate: string; name: string }
interface CreatedUser { email: string; temporaryPassword?: string }

const roles: InternalRole[] = ["SYSTEM_ADMIN", "HR_MANAGER", "RECRUITER", "LINE_MANAGER", "PAYROLL_OFFICER", "ASSET_OFFICER", "EMPLOYEE"];

function formatTime(value: string): string {
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export default function AdminPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<InternalRole>("EMPLOYEE");
  const [scheduleName, setScheduleName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("08:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [oneTimePassword, setOneTimePassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!session) {
      setError("Please sign in with a system administrator account.");
      setLoading(false);
      return;
    }
    try {
      const [nextUsers, nextSchedules, nextHolidays] = await Promise.all([
        api<AdminUser[]>("/admin/users", session),
        api<WorkSchedule[]>("/admin/schedules", session),
        api<PublicHoliday[]>("/admin/holidays", session),
      ]);
      setUsers(nextUsers);
      setSchedules(nextSchedules);
      setHolidays(nextHolidays);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load administration data");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError(""); setMessage(""); setOneTimePassword("");
    try {
      const created = await api<CreatedUser>("/admin/users", session, {
        method: "POST", body: JSON.stringify({ email, role: newRole }),
      });
      setEmail("");
      setMessage(`Created account for ${created.email}.`);
      setOneTimePassword(created.temporaryPassword ?? "");
      await loadData();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Unable to create account");
    } finally { setBusy(false); }
  }

  async function updateRole(userId: string, nextRole: InternalRole) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<AdminUser>(`/admin/users/${userId}/role`, session, { method: "PATCH", body: JSON.stringify({ role: nextRole }) });
      setMessage("User role updated. Their active sessions were revoked.");
      await loadData();
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user role");
    } finally { setBusy(false); }
  }

  async function createSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<WorkSchedule>("/admin/schedules", session, {
        method: "POST",
        body: JSON.stringify({ name: scheduleName, shiftStartTime, shiftEndTime, gracePeriodMinutes, workingDaysBitmap: [1, 2, 3, 4, 5] }),
      });
      setScheduleName(""); setMessage("Work schedule created."); await loadData();
    } catch (scheduleError: unknown) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Unable to create schedule");
    } finally { setBusy(false); }
  }

  async function createHoliday(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<PublicHoliday>("/admin/holidays", session, { method: "POST", body: JSON.stringify({ holidayDate, name: holidayName }) });
      setHolidayDate(""); setHolidayName(""); setMessage("Public holiday saved."); await loadData();
    } catch (holidayError: unknown) {
      setError(holidayError instanceof Error ? holidayError.message : "Unable to save holiday");
    } finally { setBusy(false); }
  }

  return <AppShell role={role} title="Administration">
    <ModulePage eyebrow="Governance" title="System administration" description="Manage user access, work schedules, and public holidays. Payroll policy approval is handled separately and must cite current official sources.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {oneTimePassword ? <section className="panel status-warning" role="status"><h3>One-time temporary password</h3><p>Share this with the account holder through an approved secure channel. It is shown only once and must be changed at first sign-in.</p><code>{oneTimePassword}</code><button className="button" type="button" onClick={() => setOneTimePassword("")}>Hide password</button></section> : null}
      {loading ? <p>Loading administration data…</p> : <>
        <section className="panel">
          <h3>User accounts <span className="role-chip">{users.length}</span></h3>
          <form onSubmit={createUser} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10, marginBottom: 16 }}>
            <label>Email<input type="email" autoComplete="off" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Role<select value={newRole} onChange={(event) => setNewRole(event.target.value as InternalRole)}>{roles.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <button className="button button-primary" type="submit" disabled={busy}>Create account</button>
          </form>
          {users.length === 0 ? <p>No accounts found.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Account</th><th>Created</th><th>Change role</th></tr></thead><tbody>
            {users.map((account) => <tr key={account.id}>
              <td>{account.employee?.legalName ?? "Unlinked account"}<br /><small>{account.employee?.employeeCode ?? "—"}</small></td>
              <td>{account.email}</td><td>{account.role.replaceAll("_", " ")}</td>
              <td>{account.isActive ? "Active" : "Deactivated"}{account.mustChangePassword ? " · must change password" : ""}</td>
              <td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(account.createdAt))}</td>
              <td><select aria-label={`Role for ${account.email}`} value={account.role} disabled={busy || account.id === session?.user?.id} onChange={(event) => void updateRole(account.id, event.target.value as InternalRole)}>{roles.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></td>
            </tr>)}
          </tbody></table></div>}
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginTop: 16 }}>
          <section className="panel"><h3>Work schedules</h3>
            <form onSubmit={createSchedule} style={{ display: "grid", gap: 10 }}>
              <label>Schedule name<input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} maxLength={100} required /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label>Start<input type="time" value={shiftStartTime} onChange={(event) => setShiftStartTime(event.target.value)} required /></label><label>End<input type="time" value={shiftEndTime} onChange={(event) => setShiftEndTime(event.target.value)} required /></label></div>
              <label>Grace period (minutes)<input type="number" min="0" max="180" value={gracePeriodMinutes} onChange={(event) => setGracePeriodMinutes(Number(event.target.value))} /></label>
              <button className="button" type="submit" disabled={busy}>Add weekday schedule</button>
            </form>
            {schedules.length === 0 ? <p>No schedules configured.</p> : schedules.map((schedule) => <p key={schedule.id}><strong>{schedule.name}</strong> · {formatTime(schedule.shiftStartTime)}–{formatTime(schedule.shiftEndTime)} EAT · {schedule.gracePeriodMinutes} min grace{schedule.isDefault ? " · default" : ""}</p>)}
          </section>
          <section className="panel"><h3>Public holidays</h3>
            <form onSubmit={createHoliday} style={{ display: "grid", gap: 10 }}><label>Date<input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} required /></label><label>Holiday name<input value={holidayName} onChange={(event) => setHolidayName(event.target.value)} maxLength={150} required /></label><button className="button" type="submit" disabled={busy}>Save holiday</button></form>
            {holidays.length === 0 ? <p>No holidays configured.</p> : <div className="table-wrap" style={{ marginTop: 12 }}><table className="data-table"><thead><tr><th>Date</th><th>Name</th></tr></thead><tbody>{holidays.map((holiday) => <tr key={holiday.id}><td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(holiday.holidayDate))}</td><td>{holiday.name}</td></tr>)}</tbody></table></div>}
          </section>
        </div>
        <p className="status-warning" style={{ marginTop: 16 }}>Account provisioning sends a temporary password only in this response. Communicate it out-of-band and confirm the first sign-in requires a password change.</p>
      </>}
    </ModulePage>
  </AppShell>;
}
