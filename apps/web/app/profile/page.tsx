"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../src/components/AppShell";
import { ModulePage } from "../../src/components/ModulePage";
import { api } from "../../src/lib/api";
import { getSession } from "../../src/lib/session";
import type { StaffHubRole } from "@staffhub/shared";

interface EmployeeProfile {
  id: string;
  employeeCode: string;
  legalName: string;
  workEmail: string;
  personalEmail: string | null;
  phone: string | null;
  jobTitle: string;
  employmentType: string;
  status: string;
  hireDate: string;
  department: { name: string; code: string };
  manager: { legalName: string; employeeCode: string } | null;
  workSchedule: { name: string; shiftStartTime: string; shiftEndTime: string };
}

export default function ProfilePage() {
  const session = getSession();
  const role: StaffHubRole = session?.user?.role ?? "EMPLOYEE";
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    if (!session) {
      setError("Please sign in to view your profile.");
      setLoading(false);
      return;
    }
    try {
      const result = await api<EmployeeProfile>("/employees/self", session);
      setProfile(result);
      setPhone(result.phone ?? "");
      setPersonalEmail(result.personalEmail ?? "");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your profile");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function saveContact(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api<Pick<EmployeeProfile, "phone" | "personalEmail">>("/employees/self/contact", session, {
        method: "PATCH",
        body: JSON.stringify({
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(personalEmail.trim() ? { personalEmail: personalEmail.trim() } : {}),
        }),
      });
      setPhone(updated.phone ?? "");
      setPersonalEmail(updated.personalEmail ?? "");
      setMessage("Your contact details have been updated.");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update your contact details");
    } finally {
      setSaving(false);
    }
  }

  return <AppShell role={role} title="My Profile">
    <ModulePage eyebrow="Personal data" title="Profile" description="Review your employment information and keep your contact details current.">
      {error ? <p className="status-danger" role="alert">{error}</p> : null}
      {message ? <p className="status-success" role="status">{message}</p> : null}
      {loading ? <p>Loading your profile…</p> : profile ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <section className="panel"><span className="eyebrow">Employment</span><h3>{profile.legalName}</h3>
          <p><strong>Employee number</strong><br />{profile.employeeCode}</p>
          <p><strong>Role</strong><br />{profile.jobTitle}</p>
          <p><strong>Department</strong><br />{profile.department.name}</p>
          <p><strong>Work email</strong><br />{profile.workEmail}</p>
          <p><strong>Manager</strong><br />{profile.manager?.legalName ?? "Not assigned"}</p>
          <p><strong>Employment status</strong><br />{profile.status.replaceAll("_", " ")}</p>
          <p><strong>Hire date</strong><br />{new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(profile.hireDate))}</p>
          <p><strong>Work schedule</strong><br />{profile.workSchedule.name}</p>
        </section>
        <section className="panel"><span className="eyebrow">Self-service</span><h3>Contact information</h3>
          <form onSubmit={saveContact} style={{ display: "grid", gap: 12 }}>
            <label>Personal email<input type="email" autoComplete="email" maxLength={255} value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} /></label>
            <label>Phone<input type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <small>At least one valid contact field is required when saving. Empty fields are left unchanged.</small>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save contact details"}</button>
          </form>
        </section>
      </div> : !error ? <p>No employee record is linked to this account.</p> : null}
    </ModulePage>
  </AppShell>;
}
