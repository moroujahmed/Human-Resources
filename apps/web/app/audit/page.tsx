"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface AuditEntry {
  id: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  checksumSha256: string;
  createdAt: string;
  actor: { email: string; role: string } | null;
}

export default function AuditPage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEntries = useCallback(async (filters?: { from?: string; to?: string; action?: string }) => {
    if (!session) { setError("Please sign in to view audit events."); setLoading(false); return; }
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    if (filters?.action?.trim()) query.set("action", filters.action.trim());
    try { setEntries(await api<AuditEntry[]>(`/audit/logs${query.size ? `?${query.toString()}` : ""}`, session)); }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "Unable to load audit events"); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    void loadEntries({ from, to, action });
  }

  return <AppShell role={role} title="Immutable Audit Trail">
    <ModulePage eyebrow="Governance" title="Audit log" description="Read-only, role-scoped workflow and security events. The API returns at most 100 events per query.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      <section className="panel">
        <form onSubmit={applyFilters} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10 }}>
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} min={from || undefined} /></label>
          <label>Action contains<input value={action} onChange={(event) => setAction(event.target.value)} maxLength={80} placeholder="e.g. LEAVE_APPROVED" /></label>
          <button className="button button-primary" type="submit" disabled={loading}>Apply filters</button>
          <button className="button" type="button" disabled={loading} onClick={() => { setFrom(""); setTo(""); setAction(""); void loadEntries(); }}>Clear</button>
        </form>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h3>Events <span className="role-chip">{entries.length}</span></h3>
        {loading ? <p>Loading audit events…</p> : entries.length === 0 ? <p>No events match these filters.</p> : <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Timestamp (EAT)</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Checksum</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id}>
            <td>{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(entry.createdAt))}</td>
            <td>{entry.actor?.email ?? "System"}</td><td>{entry.actor?.role ?? entry.actorRole}</td>
            <td>{entry.action}</td><td>{entry.entityType}{entry.entityId ? <><br /><small>{entry.entityId}</small></> : null}</td>
            <td><code title={entry.checksumSha256}>{entry.checksumSha256.slice(0, 16)}…</code></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </ModulePage>
  </AppShell>;
}
