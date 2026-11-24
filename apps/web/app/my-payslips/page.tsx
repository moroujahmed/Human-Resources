"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface Payslip {
  id: string;
  payslipNumber: string;
  generationStatus: string;
  publishedAt: string | null;
  payrollItem: {
    grossPayUgx: string;
    nssfEmployeeUgx: string;
    payeUgx: string;
    lstUgx: string;
    loanDeductionUgx: string;
    otherDeductionsUgx: string;
    netPayUgx: string;
    payrollRun: { year: number; month: number; status: string };
  };
}

function formatUgx(amount: string): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(Number(amount));
}

export default function MyPayslipsPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayslips = useCallback(async () => {
    if (!session) {
      setError("Please sign in to view your payslips.");
      setLoading(false);
      return;
    }
    try {
      setPayslips(await api<Payslip[]>("/payroll/my-payslips", session));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payslips");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadPayslips(); }, [loadPayslips]);

  return <AppShell role={role} title="My Payslips">
    <ModulePage eyebrow="Financial" title="Published payslips" description="Your payslips are visible only after payroll publication.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {loading ? <p>Loading payslips…</p> : payslips.length === 0 ? <div className="empty-state">No payslips are available for this account.</div> : <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Pay period</th><th>Payslip number</th><th>Status</th><th>Published</th><th>Gross pay</th><th>Net pay</th></tr></thead>
        <tbody>{payslips.map((slip) => {
          const published = slip.generationStatus === "PUBLISHED" && Boolean(slip.publishedAt);
          const period = new Intl.DateTimeFormat("en-UG", { month: "long", year: "numeric", timeZone: "Africa/Kampala" }).format(new Date(Date.UTC(slip.payrollItem.payrollRun.year, slip.payrollItem.payrollRun.month - 1, 1)));
          return <tr key={slip.id}>
            <td>{period}</td><td>{slip.payslipNumber}</td><td>{published ? "Published" : "Processing"}</td>
            <td>{slip.publishedAt ? new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(slip.publishedAt)) : "—"}</td>
            <td>{published ? formatUgx(slip.payrollItem.grossPayUgx) : "—"}</td><td>{published ? formatUgx(slip.payrollItem.netPayUgx) : "—"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
      <p className="status-warning" style={{ marginTop: 16 }}>Payroll figures are shown only from a published record. Contact HR or Payroll if a published payslip appears incorrect.</p>
    </ModulePage>
  </AppShell>;
}
