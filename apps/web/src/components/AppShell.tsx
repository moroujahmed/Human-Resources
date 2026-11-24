"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { StaffHubRole } from "@staffhub/shared";
import { ROLE_NAVIGATION } from "../config/navigation";
import { useStaffSession } from "./SessionProvider";
import { clearSession } from "../lib/session";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-label="StaffHub">
      <svg viewBox="0 0 40 40" role="img" aria-label="S">
        <rect width="40" height="40" rx="8" fill="#D49B42" />
        <path d="M27 12.5c-2.2-1.8-4.8-2.7-7.8-2.7-5 0-8.2 2.4-8.2 6.2 0 3.5 2.7 5.1 7.5 6.2 3.7.9 5.1 1.7 5.1 3.4 0 1.9-1.7 3-4.6 3-3.2 0-6-1.2-8.2-3.4l-2.1 3.3c2.7 2.5 6.2 3.8 10.3 3.8 5.5 0 9.1-2.7 9.1-7 0-3.8-2.7-5.6-7.8-6.8-3.5-.8-4.8-1.5-4.8-2.8 0-1.5 1.5-2.4 4-2.4 2.4 0 4.5.8 6.4 2.2z" fill="#161513" />
      </svg>
    </span>
  );
}

export function AppShell({
  role,
  title,
  children,
}: {
  role: StaffHubRole;
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useStaffSession();
  const [navOpen, setNavOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const activeRole = session?.user?.role ?? role;
  const items = ROLE_NAVIGATION[activeRole];

  async function signOut() {
    try {
      if (!session) throw new Error("Your session is unavailable. Refresh the page and try again.");
      await api<{ ok: boolean }>("/auth/logout", session, { method: "POST" });
      clearSession();
      router.replace("/login");
    } catch {
      setSignOutError("Sign out could not reach the server. Please try again.");
    }
  }
  return (
    <div className="app-shell">
      {navOpen ? <button aria-label="Close navigation menu" className="nav-backdrop" type="button" onClick={() => setNavOpen(false)} /> : null}
      <aside className={`sidebar${navOpen ? " sidebar-open" : ""}`}>
        <Link className="sidebar-brand" href="/home"><BrandMark /><strong>StaffHub</strong></Link>
        <nav id="staffhub-navigation" aria-label="Primary navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "nav-active" : ""}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div className="topbar-title"><button className="menu-button" type="button" aria-expanded={navOpen} aria-controls="staffhub-navigation" onClick={() => setNavOpen((open) => !open)}>Menu</button><div><span className="breadcrumb">StaffHub</span><h1>{title}</h1></div></div>
          <div className="topbar-meta"><span>Kampala · EAT</span><span className="role-chip">{activeRole}</span><button className="button" type="button" onClick={() => void signOut()}>Sign out</button></div>
        </header>
        <section className="app-content">{signOutError ? <p className="status-danger" role="alert">{signOutError}</p> : null}{children}</section>
      </main>
    </div>
  );
}
