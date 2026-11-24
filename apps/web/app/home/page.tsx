"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface TodayRecord { allowedButtonState: string; attendanceRecord: { checkInAt: string | null } | null }
interface Balance { entitledDays: string; carriedOverDays: string; usedDays: string; pendingDays: string; leaveType: { name: string } }
interface Payslip { generationStatus: string; payrollItem: { payrollRun: { year: number; month: number } } }
interface AssetAssignment { status: string }
interface Notification { id: string; title: string; body: string; createdAt: string; isRead: boolean }

function kampalaYear(): number {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Africa/Kampala" }).format(new Date()));
}

export default function EmployeeHome() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const [attendance, setAttendance] = useState<TodayRecord | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [assets, setAssets] = useState<AssetAssignment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!session) { setError("Please sign in to view your dashboard."); setLoading(false); return; }
    const selfServices = session.user?.employeeId ? [
      api<TodayRecord>("/attendance/today", session),
      api<Balance[]>(`/leave/balances?year=${kampalaYear()}`, session),
      api<Payslip[]>("/payroll/my-payslips", session),
      api<AssetAssignment[]>("/assets/my-assets", session),
    ] : [];
    const results = await Promise.allSettled([
      ...selfServices,
      api<Notification[]>("/notifications/inbox", session),
    ]);
    let index = 0;
    if (selfServices.length) {
      const [todayResult, balanceResult, payslipResult, assetsResult] = results.slice(0, 4);
      if (todayResult.status === "fulfilled") setAttendance(todayResult.value as TodayRecord);
      if (balanceResult.status === "fulfilled") setBalances(balanceResult.value as Balance[]);
      if (payslipResult.status === "fulfilled") setPayslips(payslipResult.value as Payslip[]);
      if (assetsResult.status === "fulfilled") setAssets(assetsResult.value as AssetAssignment[]);
      index = 4;
    }
    const notificationResult = results[index];
    if (notificationResult?.status === "fulfilled") setNotifications(notificationResult.value as Notification[]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError("Some dashboard information could not be loaded. Open the related section to retry.");
    setLoading(false);
  }, [session]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const annualBalance = balances.reduce((total, balance) => total + Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays) - Number(balance.pendingDays), 0);
  const latestPayslip = payslips.find((slip) => slip.generationStatus === "PUBLISHED");
  const pendingActions = notifications.filter((notification) => !notification.isRead).length;

  return <AppShell role={role} title="My StaffHub">
    <ModulePage eyebrow="Self-service" title={`Welcome${session?.user?.email ? `, ${session.user.email}` : ""}`} description="Your attendance, time away, payroll documents, and assigned equipment.">
      {error ? <p className="status-warning" role="status">{error}</p> : null}
      {loading ? <p>Loading your dashboard…</p> : <>
        <div className="status-grid">
          <StatusCard label="Attendance today" value={attendance?.allowedButtonState.replaceAll("_", " ") ?? "Open attendance"} tone={attendance?.allowedButtonState === "CAN_CHECK_IN" || attendance?.allowedButtonState === "CAN_CHECK_OUT" ? "warning" : "neutral"} />
          <StatusCard label="Leave days remaining" value={balances.length ? String(annualBalance) : "No balance"} />
          <StatusCard label="Latest payslip" value={latestPayslip ? `${latestPayslip.payrollItem.payrollRun.year}-${String(latestPayslip.payrollItem.payrollRun.month).padStart(2, "0")}` : "Not published"} tone={latestPayslip ? "success" : "neutral"} />
          <StatusCard label="Pending actions" value={String(pendingActions)} tone={pendingActions ? "warning" : "success"} />
        </div>
        {!session?.user?.employeeId ? <section className="panel" style={{ marginTop: 16 }}><h3>Employee self-service is not linked</h3><p>Contact your system administrator to connect this account with an employee record.</p></section> : null}
        <section className="panel" style={{ marginTop: 16 }}>
          <h3>Quick access</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link className="button button-primary" href="/attendance">Attendance</Link>
            <Link className="button" href="/leave">Leave</Link>
            <Link className="button" href="/my-payslips">My payslips</Link>
            <Link className="button" href="/my-assets">My assets</Link>
            <Link className="button" href="/profile">Profile</Link>
          </div>
        </section>
        {notifications.length ? <section className="panel" style={{ marginTop: 16 }}><h3>Recent notifications</h3>{notifications.slice(0, 5).map((notification) => <p key={notification.id}><strong>{notification.title}</strong>{notification.isRead ? "" : " · New"}<br />{notification.body}<br /><small>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(notification.createdAt))}</small></p>)}</section> : null}
        {session?.user?.employeeId && assets.length ? <p>{assets.length} asset assignment{assets.length === 1 ? "" : "s"} on your record.</p> : null}
      </>}
    </ModulePage>
  </AppShell>;
}
