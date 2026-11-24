import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";

export default function PayrollPage() {
  return (
    <AppShell role="PAYROLL_OFFICER" title="Payroll">
      <ModulePage eyebrow="Monthly run" title="October 2026" description="Prepare, approve, lock, publish, and export payroll." actions={<button className="button button-primary">Prepare payroll</button>}>
        <div className="status-grid">
          <StatusCard label="Total gross" value="UGX —" />
          <StatusCard label="NSSF pool" value="UGX —" />
          <StatusCard label="PAYE & LST" value="UGX —" />
          <StatusCard label="Total net" value="UGX —" tone="success" />
        </div>
        <div className="panel" style={{ marginTop: 16 }}><h3>Workflow</h3><p>Draft → Pending approval → Approved → Locked & published</p></div>
      </ModulePage>
    </AppShell>
  );
}
