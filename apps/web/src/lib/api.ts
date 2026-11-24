import { API_BASE } from "./api-base";
import { clearSession, getSession, refreshSession, type StaffSession } from "./session";

export { API_BASE };

export interface ApiSession {
  accessToken: string;
  csrfToken: string;
}

function makeHeaders(session: ApiSession, init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (session.csrfToken) headers.set("X-CSRF-Token", session.csrfToken);
  return headers;
}

async function request(path: string, session: ApiSession, init: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: makeHeaders(session, init),
    credentials: "include",
  });
}

export async function api<T>(
  path: string,
  session: ApiSession,
  init: RequestInit = {},
): Promise<T> {
  let response = await request(path, session, init);
  if (response.status === 401 && !("tempToken" in session)) {
    const active = getSession() ?? session as StaffSession;
    const refreshed = await refreshSession(active);
    if (refreshed) response = await request(path, refreshed, init);
    else clearSession();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error((body as { message?: string }).message ?? "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
