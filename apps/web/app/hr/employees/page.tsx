"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../../src/components/AppShell";
import { ModulePage } from "../../../src/components/ModulePage";
import { api } from "../../../src/lib/api";
import { getSession } from "../../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface EmployeeSummary {
  id: string;
  employeeCode: string;
  legalName: string;
  workEmail: string;
  jobTitle: string;
  status: string;
  department: { id: string; name: string; code: string };
}
interface Department { id: string; code: string; name: string }
interface EmployeeDetails extends Omit<EmployeeSummary, "department"> {
  employmentType: string;
  departmentId: string;
  managerId: string | null;
  hireDate: string;
  personalEmail?: string | null;
  phone?: string | null;
  baseSalaryUgx?: string;
  recurringAllowancesUgx?: string;
  taxResidency?: string;
}

export default function HrEmployeesPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "HR_MANAGER";
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    if (!session) { setError("Please sign in to view the employee directory."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
      const [nextEmployees, nextDepartments] = await Promise.all([
        api<EmployeeSummary[]>(`/employees${query}`, session),
        api<Department[]>("/admin/departments", session),
      ]);
      setEmployees(nextEmployees);
      setDepartments(nextDepartments);
    } catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load employees"); }
    finally { setLoading(false); }
  }, [departmentId, session]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => [employee.legalName, employee.employeeCode, employee.jobTitle, employee.workEmail].some((value) => value.toLowerCase().includes(term)));
  }, [employees, search]);

  async function openEmployee(employeeId: string) {
    if (!session) return;
    setError("");
    try { setSelected(await api<EmployeeDetails>(`/employees/${employeeId}`, session)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load employee profile"); }
  }

  return <AppShell role={role} title="Employee Directory">
    <ModulePage eyebrow="People" title="Employees" description="Browse role-scoped employee information. Sensitive details are excluded from the directory.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      <section className="panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, ID, job title, email" /></label>
          <label>Department<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <span className="role-chip">{filtered.length} employees</span>
        </div>
        {loading ? <p>Loading directory…</p> : filtered.length === 0 ? <div className="empty-state">No employees match this search.</div> : <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Employee</th><th>Job title</th><th>Department</th><th>Work email</th><th>Status</th><th></th></tr></thead><tbody>
            {filtered.map((employee) => <tr key={employee.id}>
              <td>{employee.legalName}<br /><small>{employee.employeeCode}</small></td><td>{employee.jobTitle}</td><td>{employee.department.name}</td><td>{employee.workEmail}</td><td>{employee.status.replaceAll("_", " ")}</td>
              <td><button className="button" type="button" onClick={() => void openEmployee(employee.id)}>View</button></td>
            </tr>)}
          </tbody>
        </table></div>}
      </section>
      {selected ? <section className="panel" style={{ marginTop: 16 }} aria-labelledby="employee-details-heading">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3 id="employee-details-heading">{selected.legalName}</h3><button className="button" type="button" onClick={() => setSelected(null)}>Close</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <p><strong>Employee number</strong><br />{selected.employeeCode}</p><p><strong>Job title</strong><br />{selected.jobTitle}</p><p><strong>Work email</strong><br />{selected.workEmail}</p><p><strong>Status</strong><br />{selected.status.replaceAll("_", " ")}</p>
          {selected.phone ? <p><strong>Phone</strong><br />{selected.phone}</p> : null}{selected.personalEmail ? <p><strong>Personal email</strong><br />{selected.personalEmail}</p> : null}
          {selected.baseSalaryUgx ? <p><strong>Base salary</strong><br />UGX {new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Number(selected.baseSalaryUgx))}</p> : null}
        </div>
      </section> : null}
    </ModulePage>
  </AppShell>;
}
