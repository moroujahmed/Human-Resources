---
name: StaffHub Sovereign Editorial Design System
description: A rare, architectural HRMS design system pairing Warm Limestone surfaces, Smoked Obsidian navigation, Deep Nile Petrol primary actions, and Terracotta Copper accents—tailored for Uganda (UGX & Africa/Kampala).
version: 2.0.0
---

# StaffHub — DESIGN.md

## 1. Visual Theme & Signature Identity
StaffHub rejects generic SaaS blue/purple templates in favor of an **Architectural Editorial Enterprise** aesthetic. Think Swiss-grid financial clarity blended with warm mineral tones and East African earth sophistication.

- **Atmosphere:** Grounded, calm, ultra-legible, and high-trust. Warm mineral stone surfaces eliminate eye strain during long HR and Payroll sessions, while crisp 1px borders and deep jewel-toned accents establish unmistakable authority.
- **Visual Hierarchy:** Strong contrast between the dark Smoked Obsidian navigation rail (`#161513`), the warm limestone workspace (`#F5F3EE`), and pure ivory data surfaces (`#FFFFFF`).
- **Localization First:** Every monetary figure displays in `UGX` with comma grouping (e.g., `UGX 4,250,000`). Every timestamp displays in `EAT` (`Africa/Kampala`, `UTC+3`).

---

## 2. Unique Color Palette & Semantic Tokens

```yaml
colors:
  brand:
    nilePetrol: "#0B4F4E"         # Primary CTA buttons, key interactive links, primary progress bars
    nilePetrolHover: "#073A39"    # Hover/active state for primary buttons
    nilePetrolSoft: "#E6F0EF"     # Soft jewel tint for selected filters, info callouts
    terracottaCopper: "#B85028"   # Signature highlight accent, active onboarding/pipeline accents, key metrics
    terracottaSoft: "#FBF0EC"     # Subtle warm tint for highlight callouts
    warmBrass: "#D49B42"          # Active sidebar indicator bar, crown/approval focus accents
  surfaces:
    canvas: "#F5F3EE"             # Warm Mineral Limestone — main page background
    card: "#FFFFFF"               # Crisp Ivory White — cards, tables, modals, drawers
    subtle: "#ECE8DF"             # Pale Travertine — table headers, read-only input backgrounds
    sidebar: "#161513"            # Smoked Obsidian — left navigation rail
    sidebarHover: "#24221F"       # Hover state for obsidian nav items
  borders:
    default: "#E2DDD3"            # Warm Stone Border — 1px card & row dividers
    strong: "#C9C2B6"             # Darker Stone — form input borders & active outlines
  text:
    primary: "#181715"            # Warm Charcoal Ink — titles, primary values, body text
    secondary: "#57534E"          # Warm Stone 600 — labels, secondary metadata
    muted: "#736E67"              # Muted Umber — helper text, placeholders (WCAG AA compliant)
    onSidebar: "#E8E2D7"          # Warm Bone — readable navigation text on #161513
    onBrand: "#FFFFFF"            # Pure White — text on Nile Petrol & Terracotta buttons
  semantic:
    successText: "#14532D"        # Approved, Checked In, Active, Cleared
    successBg: "#E6F4EA"
    successBorder: "#B7DFC5"
    warningText: "#854D0E"        # Pending Approval, Late Grace Period, Expiring
    warningBg: "#FEF5E1"
    warningBorder: "#F5DA9A"
    dangerText: "#881B1B"         # Rejected, Absent, Locked, Offboarding Blocker, Deactivated
    dangerBg: "#FCEAEA"
    dangerBorder: "#F3BDBD"
    infoText: "#0B4F4E"           # Draft, Shortlisted, Scheduled
    infoBg: "#E6F0EF"
    infoBorder: "#B8D6D5"