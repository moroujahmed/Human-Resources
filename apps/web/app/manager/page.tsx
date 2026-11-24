import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";

export default function ManagerPage() {
  return (
    <AppShell role="LINE_MANAGER" title="Team Operations">
      <ModulePage eyebrow="Line management" title="Direct report operations" description="Attendance, leave approvals, requisitions, and performance.">
        <div className="status-grid">
          <StatusCard label="Present on duty" value="8" tone="success" />
          <StatusCard label="On leave" value="2" />
          <StatusCard label="Pending approvals" value="3" tone="warning" />
          <StatusCard label="30-day compliance" value="96%" tone="success" />
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table"><thead><tr><th>Employee</th><th>Status</th><th>Pending action</th><th>Action</th></tr></thead><tbody><tr><td>Rebecca Kisakye</td><td>Leave pending</td><td>Study leave</td><td><button className="button">Review</button></td></tr></tbody></table>
        </div>
      </ModulePage>
    </AppShell>
  );
}
