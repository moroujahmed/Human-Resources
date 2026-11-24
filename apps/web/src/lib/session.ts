import { API_BASE } from "./api-base";

export interface StaffSession {
  accessToken: string;
  csrfToken: string;
  tempToken?: string;
  user?: {
    id: string;
    email: string;
    role:
      | "SYSTEM_ADMIN"
      | "HR_MANAGER"
      | "RECRUITER"
      | "LINE_MANAGER"
      | "PAYROLL_OFFICER"
      | "ASSET_OFFICER"
      | "EMPLOYEE";
    employeeId?: string | null;
  };
}

const SESSION_EVENT = "staffhub-session-change";
let session: StaffSession | null = null;
let restorePromise: Promise<StaffSession | null> | null = null;
let refreshPromise: Promise<StaffSession | null> | null = null;

function notifySessionChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeSession(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}

export function setSession(next: StaffSession): void {
  session = next;
  notifySessionChange();
}

export function setTempSession(tempToken: string): void {
  session = { accessToken: tempToken, csrfToken: "", tempToken };
  notifySessionChange();
}

export function getSession(): StaffSession | null {
  return session;
}

export function clearSession(): void {
  session = null;
  notifySessionChange();
}

async function refreshWithCookie(csrfToken: string): Promise<StaffSession | null> {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    credentials: "include",
    body: "{}",
  });
  if (!response.ok) return null;
  const body = await response.json() as { accessToken: string; csrfToken: string };
  return { accessToken: body.accessToken, csrfToken: body.csrfToken };
}

export async function refreshSession(current: StaffSession | null = session): Promise<StaffSession | null> {
  if (!current || current.tempToken) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const next = await refreshWithCookie(current.csrfToken);
      if (!next) {
        clearSession();
        return null;
      }
      const profileResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${next.accessToken}` },
        credentials: "include",
      });
      if (!profileResponse.ok) {
        clearSession();
        return null;
      }
      const profile = await profileResponse.json() as { user: StaffSession["user"] };
      const restored = { ...next, user: profile.user };
      setSession(restored);
      return restored;
    } catch {
      clearSession();
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function restoreSession(): Promise<StaffSession | null> {
  if (session) return Promise.resolve(session);
  if (restorePromise) return restorePromise;
  restorePromise = (async () => {
    try {
      const csrfResponse = await fetch(`${API_BASE}/api/v1/auth/csrf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      });
      if (!csrfResponse.ok) return null;
      const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
      const next = await refreshWithCookie(csrfToken);
      if (!next) return null;
      const profileResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${next.accessToken}` },
        credentials: "include",
      });
      if (!profileResponse.ok) return null;
      const profile = await profileResponse.json() as { user: StaffSession["user"] };
      const restored = { ...next, user: profile.user };
      setSession(restored);
      return restored;
    } catch {
      return null;
    }
  })().finally(() => {
    restorePromise = null;
  });
  return restorePromise;
}
