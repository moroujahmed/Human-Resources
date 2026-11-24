"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface MyAssetAssignment {
  id: string;
  status: string;
  issuedAt: string;
  acknowledgedAt: string | null;
  returnedAt: string | null;
  asset: { assetTag: string; name: string; category: string; serialNumber: string | null };
}

export default function MyAssetsPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const [assignments, setAssignments] = useState<MyAssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAssignments = useCallback(async () => {
    if (!session) { setError("Please sign in to view your assigned assets."); setLoading(false); return; }
    try { setAssignments(await api<MyAssetAssignment[]>("/assets/my-assets", session)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load assigned assets"); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  async function acknowledge(assignmentId: string) {
    if (!session) return;
    setBusyId(assignmentId); setError(""); setMessage("");
    try {
      await api<MyAssetAssignment>(`/assets/assignments/${assignmentId}/acknowledge`, session, { method: "POST" });
      setMessage("Receipt acknowledged."); await loadAssignments();
    } catch (ackError: unknown) { setError(ackError instanceof Error ? ackError.message : "Unable to acknowledge this asset"); }
    finally { setBusyId(""); }
  }

  return <AppShell role={role} title="My Assets">
    <ModulePage eyebrow="Custody" title="Assets assigned to me" description="Review equipment assigned to you and acknowledge receipt when it arrives.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {loading ? <p>Loading your assets…</p> : assignments.length === 0 ? <div className="empty-state">No assets have been assigned to you.</div> : <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Asset</th><th>Serial</th><th>Issued</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {assignments.map((assignment) => <tr key={assignment.id}>
            <td>{assignment.asset.name}<br /><small>{assignment.asset.assetTag} · {assignment.asset.category}</small></td>
            <td>{assignment.asset.serialNumber ?? "—"}</td>
            <td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(assignment.issuedAt))}</td>
            <td>{assignment.status.replaceAll("_", " ")}</td>
            <td>{assignment.status === "PENDING_ACKNOWLEDGEMENT" ? <button className="button button-primary" type="button" disabled={busyId === assignment.id} onClick={() => void acknowledge(assignment.id)}>{busyId === assignment.id ? "Saving…" : "Acknowledge receipt"}</button> : "—"}</td>
          </tr>)}
        </tbody>
      </table></div>}
    </ModulePage>
  </AppShell>;
}
