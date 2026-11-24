"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, restoreSession, subscribeSession, type StaffSession } from "../lib/session";

interface SessionContextValue {
  session: StaffSession | null;
  ready: boolean;
}

const SessionContext = createContext<SessionContextValue>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StaffSession | null>(() => getSession());
  const [ready, setReady] = useState(false);

  useEffect(() => subscribeSession(() => setSession(getSession())), []);

  useEffect(() => {
    const publicRoute = pathname === "/" || pathname === "/login" || pathname === "/careers" || pathname === "/forgot-password" || pathname === "/reset-password";
    if (publicRoute) {
      setReady(true);
      return;
    }
    const active = getSession();
    if (active) {
      setReady(true);
      return;
    }

    let mounted = true;
    setReady(false);
    void restoreSession().then((restored) => {
      if (!mounted) return;
      setSession(restored);
      setReady(true);
      if (!restored) router.replace("/login");
    });
    return () => { mounted = false; };
  }, [pathname, router]);

  useEffect(() => {
    if (ready && !session && !["/", "/login", "/careers", "/forgot-password", "/reset-password"].includes(pathname)) {
      router.replace("/login");
    }
  }, [pathname, ready, router, session]);

  const value = useMemo(() => ({ session, ready }), [session, ready]);
  if (!ready) {
    return <main className="login-page" aria-live="polite"><p>Restoring your secure session…</p></main>;
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useStaffSession(): SessionContextValue {
  return useContext(SessionContext);
}
