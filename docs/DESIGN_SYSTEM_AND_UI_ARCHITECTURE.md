# 06 — StaffHub Design System & React/Next.js UI Architecture

## 1. Visual Identity: "Savannah Editorial" Design Tokens

StaffHub uses an architectural, glare-free, mineral-and-ledger aesthetic engineered for long HR, Payroll, and operational sessions across desktop, tablet, and mobile browsers.

### 1.1 Color Tokens (`apps/web/tailwind.config.ts`)
| Token Name | Hex Value | Semantic UI Role |
| :--- | :--- | :--- |
| `canvas` | `#F5F3EE` | Warm Mineral Limestone — primary application viewport background |
| `surface` | `#FFFFFF` | Crisp Ivory White — cards, tables, modals, slide-over drawers, inputs |
| `surface-low` | `#FAF8F4` | Soft Parchment — subtle summary strips and secondary sub-cards |
| `surface-header` | `#ECE8DF` | Pale Travertine — sticky table headers (`thead`) and grouped dividers |
| `rail` | `#161513` | Smoked Obsidian — fixed desktop left navigation sidebar |
| `rail-hover` | `#22201D` | Active/hover navigation background inside Smoked Obsidian rail |
| `border-default` | `#E2DDD3` | Warm Stone Hairline — crisp `1px` borders on cards, tables, top bar |
| `border-strong` | `#C9C2B6` | Input borders and high-definition structural dividers |
| `brand-primary` | `#0B4F4E` | Deep Nile Petrol — primary action buttons, key links, progress fills |
| `brand-primary-hover` | `#083E3D` | Hover/pressed state for primary buttons |
| `brand-primary-soft` | `#E6F0EF` | Soft jewel tint for active filter chips and info callouts |
| `brand-copper` | `#B85028` | Terracotta Copper — high-priority conversions, urgency cues |
| `brand-brass` | `#D49B42` | Warm Brass — `3px` active sidebar indicator, approval badges |
| `ink-primary` | `#181715` | Warm Charcoal Ink — page titles, table values, primary body text |
| `ink-secondary` | `#57534E` | Warm Stone 600 — field labels, secondary metadata |
| `ink-muted` | `#736E67` | Muted Umber — helper text, placeholders (WCAG AA compliant on `#FFFFFF`) |
| `ink-on-rail` | `#E8E2D7` | Warm Bone — navigation labels inside `#161513` sidebar |
| `status-success` | Text `#2E5932` / Bg `#EDF3EB` / Border `#B7DFC5` | Approved, On-Time, Active, Cleared, Disbursed |
| `status-warning` | Text `#8A6014` / Bg `#FBF3E4` / Border `#E6CA8A` | Pending Approval, Grace Window, Pending Acknowledgement |
| `status-danger` | Text `#A43916` / Bg `#F9EBE6` / Border `#E8B8A8` | Rejected, Absent, Late, Locked, Offboarding Blocker, Exited |

### 1.2 Typography Tokens (`next/font/google`)
- **Display & Headings:** `Bricolage Grotesque` (`600`, `700`, tight tracking `-0.02em`)
- **UI, Forms & Body:** `Inter` (`400`, `500`, `600`)
- **Numbers, Currency, IDs & Clocks:** `JetBrains Mono` (`500`, `600`, `700`) with `font-variant-numeric: tabular-nums` enforced on **every** `UGX` figure, deduction column, leave count, employee code, and `EAT` timestamp.

### 1.3 Shape, Borders & Elevation Rules
- Prefer crisp **`1px solid #E2DDD3` borders** over heavy drop shadows.
- Border radii: `4px` (`rounded`) on inputs, buttons, and rectangular ledger-stamp status badges; `8px` (`rounded-lg`) on cards and table wrappers; `12px` (`rounded-xl`) on modals and slide-over drawers.
- **Single Primary CTA Rule:** Maximum **one** filled `#0B4F4E` (or `#B85028` for Candidate Conversion) button per toolbar, card, or modal. Secondary actions use Ivory `#FFFFFF` with `#C9C2B6` borders.
- **Zero Wrapping Bugs:** All buttons and status pills MUST carry `whitespace-nowrap` so labels never break awkwardly onto two lines.

---

## 2. React / Next.js Component Architecture (`apps/web/src/components/`)

Treat the Stitch HTML exports in `/design-reference/` strictly as visual blueprints—NEVER copy-paste repeated sidebars or headers across pages. Build these **10 reusable core components**:

### 2.1 Layout & Navigation Components
1. **`<AppShell>` (`layout/AppShell.tsx`):**
   - Renders **one unified shell** for all authenticated routes:
     - **Desktop (`>= 1024px`):** Fixed `256px` Smoked Obsidian (`#161513`) `<Sidebar>` + sticky `64px` **Light Ivory (`#FFFFFF` / `#F5F3EE`)** `<TopBar>` (never dark top bars).
     - **Tablet (`768px – 1023px`):** Collapsible slide-out sidebar drawer.
     - **Mobile (`< 768px`):** Clean mobile header + docked bottom navigation tab bar (`Home`, `Attendance`, `Leave`, `Payslips`, `Menu`) with minimum `44x44px` touch targets.
   - **Inline SVG Brand Mark:** Renders a crisp inline SVG `S` monogram badge—zero external `<img>` URLs that can break offline.
2. **`<Sidebar>` (`layout/Sidebar.tsx`):**
   - Driven exclusively by a centralized **`ROLE_NAVIGATION_MAP`** in `apps/web/src/config/navigation.ts` keyed to `user.role`:
     - **`EMPLOYEE`:** Home, Attendance, Leave, My Payslips, My Assets, My Profile.
     - **`LINE_MANAGER`:** Team Operations, Leave & Correction Approvals, Staff Requisitions, Performance Reviews, *(plus `My Self-Service` section)*. **Zero Organization Settings.**
     - **`RECRUITER`:** Vacancies & Pipeline, Candidate Pool, Interviews, Offers & Approvals, Onboarding Queues *(plus `My Self-Service`)*.
     - **`HR_MANAGER`:** HR Overview, Employee Directory, Pending Approvals, Recruitment & Onboarding, Leave & Attendance, Offboarding & Exits, Reports *(plus `My Self-Service`)*.
     - **`PAYROLL_OFFICER`:** Payroll Runs, Adjustments, Statutory & Tax Schedules, Staff Loans, Employee Pay Profiles *(plus `My Self-Service`)*.
     - **`ASSET_OFFICER`:** Asset Registry, Issue & Returns, Damaged / Lost Log, Exit Asset Clearances *(plus `My Self-Service`)*. **Zero URA/NSSF payroll widgets.**
     - **`SYSTEM_ADMIN`:** User Accounts & Roles, Schedules & Holidays, Tax Policy Rules, Immutable Audit Trail *(plus `My Self-Service` if linked to an employee)*.
   - Active route automatically displays the `3px` Warm Brass (`#D49B42`) left indicator bar via Next.js `usePathname()`.
3. **`<TopBar>` (`layout/TopBar.tsx`):**
   - Left: Dynamic route breadcrumb.
   - Right: Live `<KampalaClock />` pill (`Kampala • HH:mm EAT`), `"Pending My Action"` notification bell popover with unread count, and User Persona Badge (`Full Name • Role`).
4. **`<PublicHeader>` (`layout/PublicHeader.tsx`):**
   - Used only on `/careers` and `/verify/*`. Clean Ivory bar with `S` monogram, `"Open Vacancies"`, `Kampala • EAT (UTC+3)` pill, and `"Staff Sign In"` button—**no logged-in user avatar**.

### 2.2 Reusable UI & Domain Primitives
5. **`<DataTable>` (`ui/DataTable.tsx`):**
   - Built on `@tanstack/react-table` with Pale Travertine (`#ECE8DF`) headers, `48px` rows, zero zebra clutter, search/filter toolbar, and **visible horizontal scrollbars** whenever columns exceed narrow viewports (do NOT apply `::-webkit-scrollbar{display:none}` globally!).
6. **`<OverlayDrawer>` (`ui/OverlayDrawer.tsx`):**
   - Replaces cramped side-by-side split panels (`xl:col-span-4`) with a smooth right-anchored **overlay slide-over drawer** (`max-w-[540px]`, subtle `#161513/40` matte scrim, `Esc` to close). Prevents tables from ever clipping columns on desktop screens.
7. **`<MandatoryReasonModal>` (`domain/MandatoryReasonModal.tsx`):**
   - Shared confirmation modal used by Reject Requisition, Reject Offer, Reject Leave, Request/Reject Attendance Correction, Reject Sensitive Profile Change, Create/Reject Authorised Payroll Adjustment, and Report Asset Damage/Loss.
   - Confirm CTA stays **disabled** until trimmed reason length `>= 10` characters (configurable minimum), clearly labeled `"Required for Immutable Audit Trail"`.
8. **`<CurrencyUGX>` & `<MaskedField>` (`domain/MaskedField.tsx`):**
   - `<CurrencyUGX value={amount} align="right" />` renders right-aligned `JetBrains Mono` tabular `UGX 3,239,250`.
   - `<MaskedField maskedValue="UGX •••••••" onReveal={...} />` defaults to masked for Salary, Bank Account (`••••8492`), and NIN; calls backend `?reveal=true` only when permitted (`HR_MANAGER`, `PAYROLL_OFFICER`, `SELF`).
9. **`<KampalaClock>` (`domain/KampalaClock.tsx`):**
   - Uses `Luxon` locked strictly to `Africa/Kampala` regardless of the user's laptop/phone OS timezone setting.
10. **`<ServerWakeupBanner>` (`ui/ServerWakeupBanner.tsx`):**
    - Detects slow initial API ping (`> 3 seconds`) on Render's `$0` free tier and displays a calm notice: *"Connecting to StaffHub server (waking from idle, ~30s)..."* so presenters never mistake cold-start wake-up for a crash.

---

## 3. Mandatory Stitch-to-React Defect Fix Checklist

When converting the exported Stitch screens in `/design-reference/` into Next.js components, Antigravity MUST verify every item below:

| # | Stitch Screen Affected | Defect Found in Stitch Output | Permanent Fix in Next.js Implementation |
| :-: | :--- | :--- | :--- |
| **1** | `employee_self_service_home_desktop` | Contains forbidden `"biometric override"` and `"biometric & subnet gateway"` text | Purge all `"biometric"` and `"GPS"` wording; replace with `"Web Browser Check-In • Africa/Kampala (EAT)"` |
| **2** | `employee_self_service_home_desktop` & `_mobile` | `"Show Net Pay"` reveals `UGX 4,850,000` (which is Gross, not Net) | Wire directly to real calculated latest Net Pay (`UGX 3,239,250` for Oct 2026 / `UGX 3,264,250` for Nov 2026 under FY 2026/27 PAYE rules) |
| **3** | `ess_desktop`, `ess_mobile`, `line_manager` | External `<img>` logo URL failed to load (`StaffHub Logo` alt text) | Replace all `<img>` brand logos with shared inline SVG `S` monogram inside `<AppShell>` |
| **4** | `public_careers_portal` | Duplicate email alert says `"Submitting again will update your existing docket"`, footer says `© 2025`, and header shows a user avatar | Change alert to strictly **block** duplicate email submissions (`409`), disable Submit button, remove user avatar next to `Staff Sign In`, update copyright to `© 2026` |
| **5** | `hr_employee_profile_offboarding_clearance` | Wrong sidebar/header (`Talent & Recruitment` / `HR Recruiter`), unmasked bank account numbers (`9030018492019`), clipped tabs (`Docum...`) | Render inside `<AppShell>` with `HR_MANAGER` role config, wrap bank/NIN in `<MaskedField />`, shorten tab names so all 6 fit cleanly |
| **6** | `line_manager_team_dashboard` | Sidebar includes `Organization Settings` and omits `Staff Requisitions`; `Actions` column clipped slightly | Update `LINE_MANAGER` nav config to include `Staff Requisitions` and exclude `Organization Settings`; widen table container padding |
| **7** | `company_asset_registry` & `system_admin_audit_trail` | Dark `#161513` top header drift, `"Office of the Registrar"` persona, URA/NSSF payroll widget inside Asset sidebar, clipped table columns, button text wrapping | Standardize light Ivory `<TopBar>`, enforce role-specific `<Sidebar>` items, use `<OverlayDrawer>` instead of permanent side splits, restore scrollbars on wide tables, add `whitespace-nowrap` on buttons/badges |
| **8** | `recruitment_pipeline` & `audit_trail` | Active sidebar navigation link missing the `3px` Warm Brass (`#D49B42`) left border | Enforce automatic active-route matching inside `<Sidebar>` via Next.js `usePathname()` |
