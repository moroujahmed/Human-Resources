"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface AttendanceRecord {
  id: string;
  workDate: string;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
  isManualCorrection: boolean;
}

interface AttendanceCorrection {
  id: string;
  employeeId: string;
  workDate: string;
  requestedCheckInAt: string;
  requestedCheckOutAt?: string | null;
  reason: string;
  status: string;
  decisionReason?: string | null;
}

interface TodayAttendance {
  nowEat: string;
  workDate: string;
  allowedButtonState: string;
  attendanceRecord: AttendanceRecord | null;
  workSchedule: { name: string; shiftStartTime: string; shiftEndTime: string; gracePeriodMinutes: number };
}

interface PeriodLock { year: number; month: number; lockedAt: string }

const canManageLocks: StaffHubRole[] = ["SYSTEM_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"];
const canReviewCorrections: StaffHubRole[] = ["LINE_MANAGER", "HR_MANAGER"];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-UG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function formatShiftTime(value: string): string {
  const time = new Date(value);
  return `${String(time.getUTCHours()).padStart(2, "0")}:${String(time.getUTCMinutes()).padStart(2, "0")}`;
}

function timeInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid date and time.");
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (checkDate.getUTCFullYear() !== year || checkDate.getUTCMonth() !== month - 1 || checkDate.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error("Enter a valid date and time.");
  }
  // Uganda observes UTC+03:00 year-round; the form is explicitly Kampala time.
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute)).toISOString();
}

export default function AttendancePage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [workDate, setWorkDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [lockYear, setLockYear] = useState(new Date().getFullYear());
  const [lockMonth, setLockMonth] = useState(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    if (!session) {
      setError("Please sign in to view attendance.");
      setLoading(false);
      return;
    }
    try {
      const calls: Promise<unknown>[] = [
        api<TodayAttendance>("/attendance/today", session),
        api<AttendanceRecord[]>("/attendance/records", session),
        api<AttendanceCorrection[]>("/attendance/corrections", session),
      ];
      if (canManageLocks.includes(role)) calls.push(api<PeriodLock[]>("/attendance/period-locks", session));
      const [nextToday, nextRecords, nextCorrections, nextLocks] = await Promise.all(calls) as [
        TodayAttendance, AttendanceRecord[], AttendanceCorrection[], PeriodLock[] | undefined,
      ];
      setToday(nextToday);
      setRecords(nextRecords);
      setCorrections(nextCorrections);
      setLocks(nextLocks ?? []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [role, session]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function performAttendanceAction(action: "check-in" | "check-out") {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<AttendanceRecord>(`/attendance/${action}`, session, {
        method: "POST",
        ...(action === "check-in" ? { headers: { "Idempotency-Key": crypto.randomUUID() } } : {}),
      });
      setMessage(action === "check-in" ? "Check-in recorded using server time." : "Check-out recorded using server time.");
      await loadData();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update attendance");
    } finally {
      setBusy(false);
    }
  }

  async function submitCorrection(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<AttendanceCorrection>("/attendance/corrections", session, {
        method: "POST",
        body: JSON.stringify({
          workDate,
          requestedCheckInAt: timeInputToIso(checkIn),
          ...(checkOut ? { requestedCheckOutAt: timeInputToIso(checkOut) } : {}),
          reason,
        }),
      });
      setMessage("Correction request submitted.");
      setReason("");
      setCheckIn("");
      setCheckOut("");
      await loadData();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit correction");
    } finally {
      setBusy(false);
    }
  }

  async function decideCorrection(correctionId: string, approve: boolean) {
    if (!session) return;
    const decisionReason = decisionReasons[correctionId]?.trim();
    if (!approve && (decisionReason?.length ?? 0) < 10) {
      setError("Enter at least 10 characters explaining the rejection.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<AttendanceCorrection>(`/attendance/corrections/${correctionId}/${approve ? "approve" : "reject"}`, session, {
        method: "POST",
        ...(!approve ? { body: JSON.stringify({ reason: decisionReason }) } : {}),
      });
      setMessage(approve ? "Correction approved." : "Correction rejected.");
      await loadData();
    } catch (decisionError: unknown) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to process correction");
    } finally {
      setBusy(false);
    }
  }

  async function lockPeriod(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<PeriodLock>("/attendance/period-locks", session, {
        method: "POST",
        body: JSON.stringify({ year: lockYear, month: lockMonth }),
      });
      setMessage("Attendance period locked.");
      await loadData();
    } catch (lockError: unknown) {
      setError(lockError instanceof Error ? lockError.message : "Unable to lock attendance period");
    } finally {
      setBusy(false);
    }
  }

  const attendanceAction = today?.allowedButtonState === "CAN_CHECK_IN"
    ? "check-in"
    : today?.allowedButtonState === "CAN_CHECK_OUT" ? "check-out" : null;
  const pendingCorrections = corrections.filter((item) => item.status === "PENDING");

  return (
    <AppShell role={role} title="Attendance">
      <ModulePage
        eyebrow="Daily record"
        title="Attendance"
        description="Record working time, review your history, and request or approve corrections."
        actions={attendanceAction
          ? <button className="button button-primary" type="button" disabled={busy || loading} onClick={() => void performAttendanceAction(attendanceAction)}>{attendanceAction === "check-in" ? "Check in" : "Check out"}</button>
          : undefined}
      >
        {error ? <p className="status-danger" role="alert">{error}</p> : null}
        {message ? <p className="status-success" role="status">{message}</p> : null}
        {loading ? <p>Loading attendance…</p> : null}
        {today ? <div className="status-grid">
          <section className="panel"><span className="eyebrow">Today</span><h3>{today.allowedButtonState.replaceAll("_", " ")}</h3><p>{today.workDate}</p></section>
          <section className="panel"><span className="eyebrow">Shift</span><h3>{today.workSchedule.name}</h3><p>{formatShiftTime(today.workSchedule.shiftStartTime)}–{formatShiftTime(today.workSchedule.shiftEndTime)} EAT</p></section>
          <section className="panel"><span className="eyebrow">Grace period</span><h3>{today.workSchedule.gracePeriodMinutes} minutes</h3><p>Africa/Kampala</p></section>
          <section className="panel"><span className="eyebrow">Recorded time</span><h3>{formatTime(today.attendanceRecord?.checkInAt)} – {formatTime(today.attendanceRecord?.checkOutAt)}</h3><p>{today.attendanceRecord?.workedMinutes ?? "—"} minutes worked</p></section>
        </div> : null}

        {canReviewCorrections.includes(role) ? <section className="panel" style={{ marginTop: 16 }}>
          <h3>Correction requests awaiting review <span className="role-chip">{pendingCorrections.length}</span></h3>
          {pendingCorrections.length === 0 ? <p>No pending correction requests.</p> : <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Employee</th><th>Work date</th><th>Requested time</th><th>Reason</th><th>Decision</th></tr></thead>
            <tbody>{pendingCorrections.map((item) => <tr key={item.id}>
              <td>{item.employeeId}</td><td>{formatDate(item.workDate)}</td><td>{formatTime(item.requestedCheckInAt)} – {formatTime(item.requestedCheckOutAt)}</td><td>{item.reason}</td>
              <td><div style={{ display: "grid", gap: 8, minWidth: 180 }}>
                <button className="button button-primary" disabled={busy} type="button" onClick={() => void decideCorrection(item.id, true)}>Approve</button>
                <input aria-label={`Rejection reason for correction ${item.id}`} value={decisionReasons[item.id] ?? ""} onChange={(event) => setDecisionReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Reason required (10+ chars)" />
                <button className="button" disabled={busy} type="button" onClick={() => void decideCorrection(item.id, false)}>Reject</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
        </section> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 16, marginTop: 16 }}>
          <section className="panel">
            <h3>Attendance history</h3>
            {records.length === 0 ? <p>No attendance records are available.</p> : <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Date</th><th>Status</th><th>Check in</th><th>Check out</th><th>Worked</th></tr></thead>
              <tbody>{records.map((record) => <tr key={record.id}>
                <td>{formatDate(record.workDate)}</td><td>{record.status.replaceAll("_", " ")}{record.isManualCorrection ? " · corrected" : ""}</td><td>{formatTime(record.checkInAt)}</td><td>{formatTime(record.checkOutAt)}</td><td>{record.workedMinutes ?? "—"} min</td>
              </tr>)}</tbody>
            </table></div>}
          </section>
          <section className="panel">
            <h3>Request a correction</h3>
            <form onSubmit={submitCorrection} style={{ display: "grid", gap: 10 }}>
              <label>Work date<input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required /></label>
              <label>Requested check-in<input type="datetime-local" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required /></label>
              <label>Requested check-out (optional)<input type="datetime-local" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></label>
              <label>Reason<textarea rows={3} minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
              <button className="button" type="submit" disabled={busy}>Submit correction</button>
            </form>
            <h3 style={{ marginTop: 20 }}>Correction history</h3>
            {corrections.length === 0 ? <p>No correction requests yet.</p> : corrections.map((item) => <p key={item.id}><strong>{formatDate(item.workDate)}</strong> · {item.status.replaceAll("_", " ")}<br /><small>{item.decisionReason ?? item.reason}</small></p>)}
          </section>
        </div>

        {canManageLocks.includes(role) ? <section className="panel" style={{ marginTop: 16 }}>
          <h3>Payroll attendance periods</h3>
          <form onSubmit={lockPeriod} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10 }}>
            <label>Year<input type="number" min="2000" max="2100" value={lockYear} onChange={(event) => setLockYear(Number(event.target.value))} required /></label>
            <label>Month<select value={lockMonth} onChange={(event) => setLockMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((month) => <option value={month} key={month}>{new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2026, month - 1, 1))}</option>)}</select></label>
            <button className="button" type="submit" disabled={busy}>Lock completed period</button>
          </form>
          {locks.length > 0 ? <div className="table-wrap" style={{ marginTop: 12 }}><table className="data-table"><thead><tr><th>Period</th><th>Locked at</th></tr></thead><tbody>{locks.map((lock) => <tr key={`${lock.year}-${lock.month}`}><td>{lock.year}-{String(lock.month).padStart(2, "0")}</td><td>{formatDate(lock.lockedAt)}</td></tr>)}</tbody></table></div> : <p>No periods locked.</p>}
        </section> : null}
      </ModulePage>
    </AppShell>
  );
}
