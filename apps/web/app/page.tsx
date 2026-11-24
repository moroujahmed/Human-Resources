import Link from "next/link";
import { BrandMark } from "../src/components/AppShell";

export default function HomePage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow">StaffHub Uganda</p>
        <h1>Human resources operations</h1>
        <p>Secure access for employee, management, recruitment, payroll, asset, and administration workflows.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Link className="button button-primary" href="/login">Sign in</Link>
          <Link className="button" href="/careers">Open vacancies</Link>
        </div>
      </section>
    </main>
  );
}
