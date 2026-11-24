"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface AssetAssignment { id: string; employeeId: string; status: string; issuedAt: string; returnedAt: string | null }
interface Asset { id: string; assetTag: string; serialNumber: string | null; name: string; category: string; condition: string; version: number; assignments: AssetAssignment[] }

export default function AssetsPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "ASSET_OFFICER";
  const canManage = role === "ASSET_OFFICER" || role === "SYSTEM_ADMIN";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tag, setTag] = useState("");
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [employeeIds, setEmployeeIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAssets = useCallback(async () => {
    if (!session || !canManage) { setError("An asset officer account is required to manage the asset register."); setLoading(false); return; }
    try { setAssets(await api<Asset[]>("/assets", session)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load assets"); }
    finally { setLoading(false); }
  }, [canManage, session]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  async function registerAsset(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<Asset>("/assets", session, { method: "POST", body: JSON.stringify({ assetTag: tag, serialNumber: serial || undefined, name, category, condition: "GOOD" }) });
      setTag(""); setSerial(""); setName(""); setCategory(""); setMessage("Asset registered."); await loadAssets();
    } catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "Unable to register asset"); }
    finally { setBusy(false); }
  }

  async function issue(assetId: string) {
    if (!session) return;
    const employeeId = employeeIds[assetId]?.trim();
    if (!employeeId) { setError("Enter the employee record ID before issuing an asset."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api<AssetAssignment>(`/assets/${assetId}/issue`, session, { method: "POST", body: JSON.stringify({ employeeId }) });
      setEmployeeIds((current) => ({ ...current, [assetId]: "" })); setMessage("Asset issued. The employee must acknowledge receipt."); await loadAssets();
    } catch (issueError: unknown) { setError(issueError instanceof Error ? issueError.message : "Unable to issue asset"); }
    finally { setBusy(false); }
  }

  async function returnAsset(assignmentId: string) {
    if (!session) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api<AssetAssignment>(`/assets/assignments/${assignmentId}/return`, session, { method: "POST", body: JSON.stringify({ returnCondition: "GOOD" }) });
      setMessage("Asset return recorded."); await loadAssets();
    } catch (returnError: unknown) { setError(returnError instanceof Error ? returnError.message : "Unable to record return"); }
    finally { setBusy(false); }
  }

  return <AppShell role={role} title="Assets">
    <ModulePage eyebrow="Custody" title="Asset registry" description="Register equipment, issue it to an employee, and record acknowledgements and returns.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {canManage ? <section className="panel">
        <h3>Register an asset</h3>
        <form onSubmit={registerAsset} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", alignItems: "end", gap: 10 }}>
          <label>Asset tag<input value={tag} onChange={(event) => setTag(event.target.value)} maxLength={80} required /></label>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required /></label>
          <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="Laptop, phone…" required /></label>
          <label>Serial number<input value={serial} onChange={(event) => setSerial(event.target.value)} maxLength={120} /></label>
          <button className="button button-primary" type="submit" disabled={busy}>Register asset</button>
        </form>
      </section> : null}
      {canManage ? <section className="panel" style={{ marginTop: 16 }}>
        <h3>Asset register <span className="role-chip">{assets.length}</span></h3>
        {loading ? <p>Loading assets…</p> : assets.length === 0 ? <p>No assets are registered.</p> : <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Tag</th><th>Asset</th><th>Condition</th><th>Custody</th><th>Actions</th></tr></thead><tbody>
            {assets.map((asset) => {
              const activeAssignment = asset.assignments.find((assignment) => !assignment.returnedAt && ["PENDING_ACKNOWLEDGEMENT", "ACKNOWLEDGED"].includes(assignment.status));
              return <tr key={asset.id}>
                <td>{asset.assetTag}<br /><small>{asset.serialNumber ?? "No serial"}</small></td><td>{asset.name}<br /><small>{asset.category}</small></td><td>{asset.condition}</td>
                <td>{activeAssignment ? <>{activeAssignment.employeeId}<br /><small>{activeAssignment.status.replaceAll("_", " ")}</small></> : "Available"}</td>
                <td>{activeAssignment ? <button className="button" type="button" disabled={busy} onClick={() => void returnAsset(activeAssignment.id)}>Record return</button> : <div style={{ display: "flex", gap: 8, minWidth: 240 }}><input aria-label={`Employee ID for ${asset.assetTag}`} placeholder="Employee record ID" value={employeeIds[asset.id] ?? ""} onChange={(event) => setEmployeeIds((current) => ({ ...current, [asset.id]: event.target.value }))} /><button className="button" type="button" disabled={busy} onClick={() => void issue(asset.id)}>Issue</button></div>}</td>
              </tr>;
            })}
          </tbody>
        </table></div>}
      </section> : <section className="panel"><p>You do not have access to the asset register.</p></section>}
    </ModulePage>
  </AppShell>;
}
