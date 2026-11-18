---
name: Savannah Editorial HRMS
colors:
  surface: '#fdf8f4'
  surface-dim: '#ded9d5'
  surface-bright: '#fdf8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3ef'
  surface-container: '#f2ede9'
  surface-container-high: '#ece7e3'
  surface-container-highest: '#e6e2de'
  on-surface: '#1d1b19'
  on-surface-variant: '#404848'
  inverse-surface: '#32302e'
  inverse-on-surface: '#f5f0ec'
  outline: '#707978'
  outline-variant: '#bfc8c7'
  surface-tint: '#2c6766'
  primary: '#003736'
  on-primary: '#ffffff'
  primary-container: '#0b4f4e'
  on-primary-container: '#85bfbd'
  inverse-primary: '#96d1cf'
  secondary: '#815500'
  on-secondary: '#ffffff'
  secondary-container: '#ffc164'
  on-secondary-container: '#764e00'
  tertiary: '#5b1a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#812801'
  on-tertiary-container: '#ff9b77'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b2edeb'
  primary-fixed-dim: '#96d1cf'
  on-primary-fixed: '#00201f'
  on-primary-fixed-variant: '#0b4f4e'
  secondary-fixed: '#ffddb2'
  secondary-fixed-dim: '#f9bb5f'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#624000'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#380c00'
  on-tertiary-fixed-variant: '#812901'
  background: '#fdf8f4'
  on-background: '#1d1b19'
  surface-variant: '#e6e2de'
typography:
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
  display-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an authoritative, restrained, and editorial aesthetic specifically engineered for leading Ugandan enterprises, institutions, and growing organizations. It departs entirely from ephemeral tech gimmicks—eschewing neon blurs, artificial glow effects, juvenile gamification, literalist biometric iconography, and intrusive tracking maps.

Instead, the atmosphere mirrors a high-end corporate ledger or archival publication: deliberate, deeply rooted, and impeccably structured. The visual tone evokes trust, institutional permanence, administrative precision, and architectural balance. Interactions are crisp, decisive, and tactile without being skeuomorphic. The system balances high-density personnel records, statutory reporting (e.g., NSSF, PAYE, URA compliance), and daily administrative workflows with refined typographic craft and grounded earthbound minerals.

## Colors

The palette draws from geological permanence, dry architectural minerals, and distinguished Nile tones:

- **Canvas & Backgrounds:** The base viewport background rests on Warm Mineral Limestone (`#F5F3EE`), providing an anti-glare, organic reading surface. Elevated functional containers use Crisp Ivory (`#FFFFFF`). Subdued zones, table header rows, and secondary rule containers use Pale Travertine (`#ECE8DF`).
- **Primary Action (Nile Petrol):** Deep Nile Petrol (`#0B4F4E`) serves as the primary action and authoritative anchor. Hover states shift downward into dense forest reed territory (`#083E3D`). Active and focus states preserve high-contrast visibility.
- **Accents & Navigation:** Smoked Obsidian (`#161513`) forms the primary dark navigation column, providing architectural grounding. Navigation active indicators, bookmark flags, and key highlight badges employ Warm Brass (`#D49B42`). Terracotta Copper (`#B85028`) serves as a directional highlight for high-priority items, alert states, and late flags.
- **Structural Outlines:** All borders and component dividers are fixed 1px Warm Stone (`#E2DDD3`). Shadows are entirely absent or strictly ambient matte; visual boundaries rely on this warm, precise hairline.
- **Domain Status Semantics:**
  - *Present / Confirmed / Compliant:* Soft Olive Green (Background: `#EDF3EB`, Text & Border: `#2E5932`).
  - *Grace Period / Pending Action:* Warm Ochre (Background: `#FBF3E4`, Text & Border: `#8A6014`).
  - *Late / Absent / Action Required:* Terracotta Muted (Background: `#F9EBE6`, Text & Border: `#A43916`).

## Typography

The typographic hierarchy enforces a disciplined balance between editorial character and dense data presentation:

- **Display & Headings (Bricolage Grotesque):** Expresses institutional confidence with a modern, humanistic cadence. Headlines use tight letter-spacing (`-0.02em`) to maintain an authoritative editorial presence on high-level administrative overviews and structural section titles.
- **Body & UI Controls (Inter):** Applied across all primary prose, form controls, table cell text, and functional interaction labels. Inter offers neutral legibility and consistent vertical metrics under high informational density.
- **Data, Currency & Identifiers (JetBrains Mono):** Reserved strictly for numerical data, tabular reporting, employee IDs (e.g., `EMP-0842-UG`), Africa/Kampala timestamps (`EAT +03:00`), and monetary figures formatted in Ugandan Shillings (`UGX`). Must always render with `font-feature-settings: "tnum" 1` to guarantee vertical column alignment across ledgers and payroll sheets.

## Layout & Spacing

The layout model is a structured, asymmetrical 12-column fixed-fluid hybrid grid anchored by a persistent navigation rail:

- **Navigation Frame:** Desktop environments implement a fixed 260px Smoked Obsidian (`#161513`) sidebar, leaving the remaining viewport to dynamic administrative canvas with max-bounds capped at 1600px for table readability.
- **Grid Mechanics:**
  - *Desktop (>1024px):* 12 columns with 24px gutters and 32px canvas margins. Content panels adhere to integer column spans (e.g., 8-column primary table, 4-column statutory breakdown).
  - *Tablet (768px - 1023px):* 8 columns with 20px gutters and 24px margins. The sidebar collapses to a 72px icon-and-label state.
  - *Mobile (<768px):* 4 columns with 16px gutters and 16px margins. Primary tables transform into editorial roster cards; the navigation converts to a bottom docked utility bar.
- **Rhythm & Metrics:** Internal spacing adheres to a strict 4px/8px modular scale. Form fields and table cells prioritize horizontal comfort without vertical bloat, maximizing the visible employee records above the viewport fold.

## Elevation & Depth

This design system rejects synthetic floating layers, multi-layer drop shadows, and high-intensity ambient glows. Depth is achieved via architectural surface layering and deliberate hairline rules:

- **Surface Tiers:**
  - *Tier 0 (Foundation):* Warm Mineral Limestone (`#F5F3EE`) canvas.
  - *Tier 1 (Panels & Table Body):* Crisp Ivory (`#FFFFFF`) interior surface with a crisp 1px Warm Stone (`#E2DDD3`) border.
  - *Tier 2 (Sticky Headers & Grouping Strips):* Pale Travertine (`#ECE8DF`) with subtle bottom delineation.
  - *Tier 3 (Active Rail / Dark Context):* Smoked Obsidian (`#161513`).
- **Low-Contrast Hairlines:** Elevation and spatial separation are maintained by crisp `1px solid #E2DDD3` borders rather than blur radii.
- **Ambient Focus:** When overlay dialogs or flyout sheets are required, a flat matte scrim of `#161513` at 40% opacity is used, accompanied by a single crisp perimeter border and an understated ambient grounding shadow (`0 8px 24px rgba(22, 21, 19, 0.08)`).

## Shapes

The shape system adopts a soft architectural radius (`roundedness: 1`). The aesthetic relies on structure rather than spherical curves:

- **Containers & Data Surfaces:** Cards, modular panels, table containers, and modal dialogs use `0.25rem` (4px) or `0.5rem` (8px) corners to prevent edge clipping while maintaining crisp geometry.
- **Form Controls:** Text inputs, dropdown select triggers, and action buttons strictly utilize `0.25rem` (4px).
- **Status Pills:** Badges and operational chips use an exception rule of `0.25rem` rounded corners with intentional 1px inset borders to maintain the look of printed ledger stamps rather than playful rounded pills.

## Components

### Buttons
- **Primary Action:** Solid Deep Nile Petrol (`#0B4F4E`) surface, Crisp Ivory text, 4px border radius. Hover: `#083E3D`. Focus: 2px offset ring in Nile Petrol.
- **Secondary Action:** Pale Travertine (`#ECE8DF`) surface with a 1px Warm Stone (`#E2DDD3`) border, text in Smoked Obsidian (`#161513`). Hover: surface shifts to Warm Mineral Limestone (`#F5F3EE`).
- **Destructive/Urgent:** Ivory background with 1px Terracotta Copper (`#B85028`) border and text. Hover: Terracotta Copper fill with Ivory text.

### Navigation Rail (Sidebar)
- Dark Smoked Obsidian (`#161513`) base. Active state includes a crisp 3px left border indicator rendered in Warm Brass (`#D49B42`), paired with a slight background tint (`#22201D`). Typography is Inter 14px medium.

### Data Tables & Ledgers
- **Header Row:** Surface is Pale Travertine (`#ECE8DF`), typography is 12px JetBrains Mono uppercase, letter-spacing `0.05em`, color `#5E594F`. Hairline border bottom: 1px `#E2DDD3`.
- **Row Anatomy:** Alternate rows use Crisp Ivory (`#FFFFFF`) and Warm Mineral Limestone (`#FDFCF9`). Height is calibrated to 44px for balanced density.
- **Monetary & Timing Columns:** Text aligns right using JetBrains Mono with tabular figures. Currency prefixes appear as `UGX ` in muted stone tone.

### Status Indicators & Pills
- **Styling:** Structured rectangular tags (4px radius) featuring a 1px border. Never utilize glowing dots or pulsing indicators.
- **On-Time / Active:** `#EDF3EB` background, `#2E5932` border and typography.
- **Grace / Pending Authorization:** `#FBF3E4` background, `#8A6014` border and typography.
- **Late / Absence / Escalation:** `#F9EBE6` background, `#A43916` border and typography.

### Input Fields & Controls
- Background: Crisp Ivory (`#FFFFFF`). Border: 1px Warm Stone (`#E2DDD3`). Focus: 1px Deep Nile Petrol (`#0B4F4E`) with no glowing drop shadow.
- Helper text and field labels use Inter 12px medium in deep slate stone `#4A463F`.

### Checkboxes & Radio Controls
- Base: 16px square (or circle for radio) with 1px border `#C4BEB3`.
- Selected state: Deep Nile Petrol fill (`#0B4F4E`) housing a sharp Ivory checkmark. Radios feature an inner Ivory disc.

### Statutory & Compliance Cards
- Custom modules for URA TIN validation, NSSF contribution tracking, and statutory PAYE calculations. Surface: Crisp Ivory with a distinguished 2px top accent line in Warm Brass (`#D49B42`). Numerical totals rendered in JetBrains Mono 20px bold.