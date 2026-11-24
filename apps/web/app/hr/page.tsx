import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { StatusCard } from "../../src/components/StatusCard";

export default function HrPage() {
  return (
    <AppShell role="HR_MANAGER" title="HR Overview">
      <ModulePage eyebrow="People operations" title="Human resources" description="Employee records, leave, recruitment, onboarding, and offboarding.">
        <div className="status-grid">
          <StatusCard label="Employees" value="13" />
          <StatusCard label="Pending leave" value="1" tone="warning" />
          <StatusCard label="Open exits" value="1" tone="danger" />
          <StatusCard label="New hires" value="1" tone="success" />
        </div>
      </ModulePage>
    </AppShell>
  );
}
