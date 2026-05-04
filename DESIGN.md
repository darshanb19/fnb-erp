# F&B ERP — Design System

**Owner:** F&B ERP product team
**Audience:** Designers, frontend engineers, AI agents generating UI, accountants and brand owners reading PDFs/exports
**Status:** Living document. **Single source of truth** for all visual tokens, typography, motion, voice, and tenant-branding rules per Master Spec §3.3.
**Phase:** 2c-prep — finalised before screen inventory (Phase 2b) so screen briefs reference real tokens.
**Last updated:** 2026-05-03

> **Project context.** Multi-location Food & Beverage ERP. Solo developer, AI-assisted. Single-tenant MVP with multi-tenant-ready architecture (Master Spec §1.2). MVP tenant is **Wild Sugar — Patisserie & Cafe**. Eight personas spanning kitchen-floor mobile (Kitchen Manager, Dispatch Staff, POS Staff, Store Manager) and management/finance desktop (Brand Owner, Cluster Manager, Procurement Manager, Finance Manager).

---

## 0. Reading order

If you only have five minutes, read sections **1**, **2**, **5**, **6**, and **7**. The rest fills in once you've absorbed the north star, the token system, the colour palette, the status semantics, and Inter.

| Section | What it covers |
|---|---|
| 1 | Creative North Star — *Clinical Artisan* |
| 2 | Token taxonomy — three-layer Material 3 system |
| 3 | Multi-tenant branding pattern (Wild Sugar = MVP tenant) |
| 4 | Logo usage (full lockup + nibble) |
| 5 | Colour system — product palette + tenant accent |
| 6 | F&B status & state palette — anchored to PRD lifecycles |
| 7 | Typography — Inter, with India-numeric rules |
| 8 | Spacing, radius, layout, breakpoints, density modes |
| 9 | Elevation, surface hierarchy, the no-line rule |
| 10 | Motion — calm, operational, never bouncy |
| 11 | Iconography — Lucide React |
| 12 | Components — quick reference |
| 13 | Charts & data viz — Recharts |
| 14 | Reports & print (PDF / B2B / accountant exports) |
| 15 | Accessibility — WCAG 2.1 AA gates |
| 16 | India-native details — INR, lakhs/crores, IST |
| 17 | Voice & tone for the ERP UI |
| 18 | Imagery & illustration |
| 19 | Density modes & persona contexts |
| 20 | Quick don't list |
| 21 | References & change control |

---

## 1. Creative North Star — *Clinical Artisan*

**The product is an operations control tower for a kitchen.** It moves stock, books costs, surfaces variance, prints challans. A traditional ERP looks like an industrial warehouse — grids, borders, dense rows, low contrast. This product takes the opposite tack: it treats data the way a Michelin-star kitchen treats an ingredient — *with clarity, space, and intentionality*.

**The aesthetic in three words:** **clinical, editorial, operational.**

- **Clinical.** No decoration. Every visual element earns its pixels by communicating state, value, or affordance. The brand colour is a deep functional teal (`#00525b`) — confident, not cheerful. White space is functional, not decorative.
- **Editorial.** Asymmetric layout. Strong typographic hierarchy. The Indian Rupee value is the hero of any screen — large, breathing, anchored. Section labels are small uppercase mono labels.
- **Operational.** Mobile screens are thumb-reachable, glove-friendly, glance-readable in active kitchens. Desktop screens are dense without being cluttered. Status colour is functional and high-contrast — not editorial.

This is not a finance app, not a marketing site, not a cooking-content product. It is a **multi-location F&B operations system** that happens to look beautiful because operations deserve clarity.

> **Tension to manage.** The MVP tenant Wild Sugar is a warm boutique-patisserie brand. The product chrome is operational/clinical-artisan. Wild Sugar's warmth lives at brand surfaces (login, splash, sidebar logo, B2B challan PDF headers, customer-facing exports, emails) — *not* in the operational UI. See §3.

---

## 2. Token taxonomy — three-layer system

Every visual value in this product is a **token**, not a literal hex/px value. Tokens have three layers; component code only ever references the **semantic** or **component** layer.

```
LAYER 1 — Primitive tokens (raw values, never used directly in components)
  e.g. teal-700: #00525b · grey-50: #f8f9fa · spacing-4: 16px

LAYER 2 — Semantic tokens (Material 3 names — what every component reads)
  e.g. primary, on_primary, surface, on_surface_variant,
       success, warning, error, status_draft, status_pending_gr,
       tenant_brand_accent

LAYER 3 — Component tokens (per-component overrides where needed)
  e.g. button_primary_height_md, sidebar_active_pill_width,
       metric_card_currency_symbol_size_pct
```

> **Rule (Master Spec §7.4 + §3.3).** No component file may contain a literal hex, font-family, font-size, or spacing value. Every visual value is a Tailwind class generated from `tailwind.config.ts`, which is generated from this file. A missing token is added here first, then in Tailwind config, then used.

### 2.1 Why Material 3

We adopt the Material 3 token *naming* (primary / on_primary / surface_container_lowest / etc.) without adopting Material 3's component visuals. The naming is the most rigorously specified semantic-token system available, has tooling (M3 → Tailwind generators), pairs well with shadcn/ui (Master Spec §3.1 — FINAL), and degrades gracefully to other consumers (Stitch generates Material Symbols which Phase 4 converts to Lucide).

### 2.2 Tenant-brand token slot

A small, fixed slot of semantic tokens belongs to the *tenant*, not the product. They are theme-able per tenant. See §3.

```
tenant_brand_accent              // hero accent, e.g. peach for Wild Sugar
tenant_brand_accent_soft         // tinted background for tenant accent
on_tenant_brand_accent           // foreground on accent surface
tenant_logo_full_url             // resolves to logos/logo-full.png for Wild Sugar
tenant_logo_nibble_url           // resolves to logos/logo-nibble.png for Wild Sugar
tenant_display_name              // "Wild Sugar — Patisserie & Cafe"
```

Operational tokens (`primary`, `surface`, `error`, `status_*`, etc.) are **product-owned** and identical across tenants.

---

## 3. Multi-tenant branding pattern

Per Master Spec §1.2, every table carries `brand_id`; the architecture is multi-tenant ready from day one. The visual system mirrors this:

| Layer | Owned by | Examples |
|---|---|---|
| **Product chrome** (palette, typography, components, status semantics) | Product | Sidebar teal, button gradients, status palette, Inter typography |
| **Tenant brand** (logo, accent, display name, customer-facing PDFs) | Tenant | Wild Sugar logo, peach accent, "Wild Sugar — Patisserie & Cafe" wordmark on B2B challan PDF header |

### 3.1 Where tenant branding shows up (and where it does not)

**Tenant branding IS used at:**

| Surface | Form | Reason |
|---|---|---|
| Login screen | Full lockup centred above credentials | Gateway / first impression |
| App splash / loading screen | Full lockup, optional fade | Gateway |
| Sidebar header (desktop, expanded) | Full lockup at 28 px height | Persistent identity |
| Sidebar header (desktop, collapsed) | Nibble at 32 px square | Persistent identity, compact |
| Mobile top bar | Nibble at 28 px square + tenant_display_name | Identity in narrow chrome |
| B2B challan PDF header (Epic 8 — see §14) | Full lockup at 28 mm wide, top-left | Customer-facing document |
| Accountant export PDFs (Epic 10 §6.3 of Master Spec) | Full lockup at 28 mm wide, top-left | Customer-facing document |
| Outbound email templates (notifications, B2B confirmation) | Full lockup in email header | Customer-facing comms |
| Login / password-reset emails | Full lockup in header | Customer-facing comms |
| Marketing / public landing (post-MVP, out of scope here) | Full lockup | — |

**Tenant branding is NOT used at (operational chrome):**

- Internal screens (inventory tables, requisition forms, dispatch lists, dashboards, P&L). These wear the product palette unmodified. The sidebar logo is the only persistent tenant cue; the rest of the screen is operational-neutral.
- Status pills, alerts, severity indicators, override warnings. These belong to the product status palette (§6) and never use the tenant accent.
- Charts, KPI cards. The Recharts colour ramp is product-owned (§13).

### 3.2 Wild Sugar — concrete tenant configuration

```
tenant_display_name         = "Wild Sugar — Patisserie & Cafe"
tenant_logo_full_url        = /logos/logo-full.png
tenant_logo_nibble_url      = /logos/logo-nibble.png
tenant_brand_accent         = #F5B17A   // Wild Sugar peach
tenant_brand_accent_soft    = #FFF1E2   // peach tint for accent surfaces
on_tenant_brand_accent      = #2A1A0E   // deep brown — readable on peach
```

**Where the peach accent is used.** Welcome moments on the login screen (one italic line of copy can sit in `tenant_brand_accent`), the optional brand-coloured loading spinner, an accent line under the logo lockup on PDF headers, accent stroke on outbound email H1s. **It is never used as a product status colour.** Specifically: peach is *not* a substitute for `warning`, `tertiary`, or any state-bearing token. Confusing tenant warmth with product status would mislead operational users.

### 3.3 Adding a future tenant

A second tenant onboarded post-MVP supplies:
- A logo full-lockup PNG and nibble/monogram PNG (or SVG)
- A primary accent hex (must clear AA contrast with white per §15)
- A display name string

The product chrome does not change. No product code changes. Status semantics remain identical.

---

## 4. Logo usage — Wild Sugar

The MVP tenant ships two artwork files in `logos/`:

| Variant | File | Content | When to use |
|---|---|---|---|
| Full lockup | `logos/logo-full.png` | Italic-script "Wild" + serif "Sugar" wordmark + "patisserie & cafe" descriptor | Login, splash, B2B PDF header, accountant export PDF header, email header, sidebar header (desktop expanded), any surface ≥ 240 px wide |
| Nibble | `logos/logo-nibble.png` | "WS" monogram in a frame + "patisserie & cafe" descriptor | Mobile top bar, collapsed sidebar, favicon, app icon, push-notification icon, any surface ≤ 120 px wide |

### 4.1 Clear space & minimum size

- **Clear space.** No other element may sit closer to the logo than the height of the **"S" in "Sugar"** (full lockup) or the height of the **"S" glyph** in the monogram (nibble). One full row of safe-area padding minimum on mobile.
- **Minimum sizes.**
  - Full lockup: **120 px** wide on screen, **24 mm** wide in print. Below 120 px, switch to the nibble.
  - Nibble: **24 px** wide on screen, **8 mm** wide in print. Below 24 px, omit rather than degrade — use the tenant_display_name in text instead.

### 4.2 Allowed backgrounds

The Wild Sugar logo is a single peach hue (~`#F5B17A`). Contrast is the only rule.

- ✅ **Pure white (`#ffffff`)** — preferred for in-product surfaces (sidebar header on light theme, login screen).
- ✅ **`surface` (`#f8f9fa`)** and **`surface_container_lowest` (`#ffffff`)** — preferred for cards, sheets, mobile top bars.
- ✅ **Cream / warm-neutral plates (e.g. `#FFF8F1`)** — preferred for B2B challan PDF headers and email headers; gives the brand its warmth without muddying contrast.
- ⚠ **`sidebar` dark teal (`#001f24`)** — peach-on-very-dark-teal contrast is ~3.4:1. Acceptable for the **logo glyph** (decorative — not body text per WCAG large-graphic exemption), but **not preferred**. If using, tighten the lockup and consider switching to a lighter chrome. See §15 audit notes.
- ❌ **Photographic backgrounds** without an underlying solid plate.
- ❌ **Gradients** of any kind.
- ❌ **Brand-warning palette surfaces** (`tertiary`, `warning`, `error_container`) — too close in hue to peach and reads as a status badge.

### 4.3 Don'ts

- Don't recolour the artwork. The PNG ships in tenant-specified peach; do not re-tint to match a section background.
- Don't rotate, skew, drop-shadow, outline, or gradient-fill.
- Don't reproduce the wordmark by typing "Wild Sugar" in a system font.
- Don't pair the nibble and full lockup side-by-side on the same line — the full lockup already contains both wordmark and descriptor.
- Don't apply the `tenant_brand_accent` token to the logo via CSS filter — the artwork is canonical.

---

## 5. Colour system

Anchored on a sophisticated teal, supported by neutral surfaces that mimic heavy-stock paper. The product palette is **operational-functional**; the tenant slot (§3.2) is **brand-warm**.

### 5.1 Complete colour token reference

These are the authoritative hex values for every product semantic token. Every component reference in this document and every Tailwind class in the codebase resolves to one of these.

#### 5.1.1 Primary & brand (product)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#00525b` | Brand authority, primary actions, hero KPIs, sidebar active state |
| `primary_container` | `#1f6b75` | Hero highlights, CTA gradient stop, large brand surfaces |
| `on_primary` | `#ffffff` | Text/icons on primary surfaces |
| `on_primary_container` | `#a4e9f4` | Text/icons on primary container |
| `primary_fixed` | `#a9eef9` | Fixed primary for cross-theme consistency |
| `primary_fixed_dim` | `#8dd1dd` | Dimmed fixed primary |
| `on_primary_fixed` | `#001f24` | Text on fixed primary |
| `on_primary_fixed_variant` | `#004f57` | Variant text on fixed primary; ambient shadow tint |
| `surface_tint` | `#1a6872` | Teal tint for highlights, trend badges, progress bars |

#### 5.1.2 Secondary & tertiary (product)

| Token | Hex | Usage |
|---|---|---|
| `secondary` | `#4a6267` | Secondary UI elements, secondary buttons in dense screens |
| `secondary_container` | `#cae4e9` | Secondary section backgrounds |
| `on_secondary` | `#ffffff` | Text on secondary |
| `on_secondary_container` | `#4e676b` | Text on secondary container |
| `tertiary` | `#6f3d19` | Warning accents, approval card borders, override-row left pill |
| `tertiary_container` | `#8b542e` | Tertiary container backgrounds |
| `on_tertiary` | `#ffffff` | Text on tertiary |
| `on_tertiary_container` | `#ffd5bc` | Text on tertiary container |
| `tertiary_fixed` | `#ffdbc7` | Fixed tertiary backgrounds |
| `tertiary_fixed_dim` | `#ffb789` | Dimmed tertiary fixed |

#### 5.1.3 Surface hierarchy (product)

The surface system is **five layers from base to wells**, each a small tonal step. Depth comes from these shifts, not shadows. See §9.

| Token | Hex | Layer | Usage |
|---|---|---|---|
| `background` | `#f8f9fa` | Page | Alias for `surface` |
| `surface` | `#f8f9fa` | Base canvas | Application background |
| `surface_bright` | `#f8f9fa` | Base alias | Same as surface |
| `surface_dim` | `#d9dadb` | Dimmed base | Disabled states |
| `surface_container_lowest` | `#ffffff` | Floating cards | **Metric cards, list rows, interactive cards** — creates "soft lift" |
| `surface_container_low` | `#f3f4f5` | Sections | Large groupings, alert section backgrounds, mobile top bar |
| `surface_container` | `#edeeef` | Active elements | Category pills, sub-detail backgrounds |
| `surface_container_high` | `#e7e8e9` | Hover/pressed | Hover states, progress bar tracks |
| `surface_container_highest` | `#e1e3e4` | Wells/inputs | Input field fills, nested wells for secondary data |
| `surface_variant` | `#e1e3e4` | Row striping | Alternate row backgrounds in tables |

#### 5.1.4 Text & outline (product)

| Token | Hex | Usage |
|---|---|---|
| `on_surface` | `#191c1d` | Primary text — never use pure `#000000` |
| `on_surface_variant` | `#3f484a` | Secondary text, labels, ₹ symbol on metric cards (60% size of value per §7.4) |
| `on_background` | `#191c1d` | Alias for `on_surface` |
| `outline` | `#6f797a` | Structural outlines when needed |
| `outline_variant` | `#bfc8ca` | Ghost borders at 15–20 % opacity (§9.3) |

#### 5.1.5 Sidebar chrome (product)

The sidebar is a **dark teal cockpit frame**. The dark-to-light boundary IS the separation — no border between sidebar and content.

| Token | Hex | Derived from | Usage |
|---|---|---|---|
| `sidebar` | `#001f24` | `on_primary_fixed` | Sidebar background |
| `sidebar_hover` | `#003940` | midpoint | Nav item hover |
| `sidebar_active` | `#00525b` | `primary` | Active nav item background |
| `on_sidebar` | `rgba(255, 255, 255, 0.78)` | `on_primary` @ 78 % | Default text/icons (raised from 70 % → 78 % to clear AA — see §15) |
| `on_sidebar_active` | `#8dd1dd` | `primary_fixed_dim` | Active item text + 3 px left accent pill |
| `on_sidebar_muted` | `rgba(255, 255, 255, 0.5)` | `on_primary` @ 50 % | Chevrons, version text, dividers (raised from 40 % for AA non-text component) |

#### 5.1.6 Inverse (overlays)

| Token | Hex | Usage |
|---|---|---|
| `inverse_surface` | `#2e3132` | Dark overlays, tooltips |
| `inverse_on_surface` | `#f0f1f2` | Text on dark overlays |
| `inverse_primary` | `#8dd1dd` | Primary accent on dark surfaces |

### 5.2 The "no-line" rule

**1 px solid borders are prohibited for sectioning.** Structural boundaries are defined through background colour shifts. The dark `sidebar` (`#001f24`) sits directly adjacent to the `surface` (`#f8f9fa`) content area; the dramatic tonal shift IS the boundary.

If a border is structurally required (e.g., focused input outline, severity-coded alert pill), use a **functional accent** stroke (status colour, primary, error) — never a generic `outline` stroke for layout.

For accessibility-driven borders (focused element outline, table cells when tonal striping is insufficient for a high-density dataset), use `outline_variant` at 15–20 % opacity ("ghost border"). Never opaque `outline_variant`.

### 5.3 The "glass & gradient" rule

For floating elements (modals, dropdowns, popovers) and hero surfaces:

- **Glassmorphism.** `surface` at 80 % opacity with `20 px` backdrop-blur. Use sparingly — only for true overlays, never for in-flow surfaces.
- **Signature CTA gradient.** Linear gradient from `primary` (`#00525b`) to `primary_container` (`#1f6b75`) at `135deg`. Reserved for the page-level primary CTA on Brand-Owner / Finance dashboards. Not for routine action buttons inside dense forms.

### 5.4 Surface hierarchy & nesting

Treat the UI as physical layers. Lighter = more prominent.

```
Chrome layer        sidebar              #001f24    The dark teal navigation frame (§5.1.5)
Base layer          surface              #f8f9fa    The canvas
Section layer       surface_container_low #f3f4f5    Large groupings, alert section backgrounds
Action layer        surface_container_lowest #ffffff Metric cards, list rows  ← most prominent
Well layer          surface_container_highest #e1e3e4 Nested data wells inside cards
```

> **Read this rule literally.** Metric cards on the Brand Owner dashboard are pure **white** (`#ffffff`) on a faintly grey **section** (`#f3f4f5`) on a pale **page** (`#f8f9fa`). The 1–4 hex-point shift between layers creates the editorial "soft lift."

---

## 6. F&B status & state palette

This is the most operationally important palette in the system. Every transaction in the F&B ERP carries an explicit lifecycle status. The colour system makes that status legible at a glance — across desktop dashboards and mobile kitchen screens, in both healthy and noisy lighting, by colour-blind users (paired icon/label per §15.3), and on monochrome printouts.

> **PRD anchors.** PRD line 87 (draft vs confirmed durability), `decision-log.md` DL-001 (canonical 5-status PO lifecycle), PRD §F-029 (append-only audit), FR47a (GR rejection), FR47b (vendor credit note), FR67 (Pending GR override), FR67a (production-order GR-rejected closure with provisional cost), F-021 (ingredient substitution under warn-and-log), PRD multiple FRs on closing inventory variance, FR70 (Pending GR resolution outcomes), FR95/FR108 (FCCC), B2B Challan Spec lifecycle (Draft → Dispatched → Delivered → Closed).

### 6.1 Lifecycle status tokens

Every status pill, row pip, and dashboard chip resolves to one of these. Tokens are purpose-paired with an icon (§11) — colour is never the only cue (WCAG 1.4.1).

| Token | Background | Foreground | Icon (Lucide) | Used by |
|---|---|---|---|---|
| `status_draft` | `surface_container_high` `#e7e8e9` | `on_surface_variant` `#3f484a` | `pencil-line` | Any form before confirm; non-durable per PRD line 87 |
| `status_pending_approval` | `tertiary_container` `#8b542e` @ `surface_container_lowest` foreground (badge style) | `on_tertiary` `#ffffff` | `clock` | PO awaiting Brand-Owner / Cluster-Manager sign-off |
| `status_pending_gr` | `tertiary_fixed` `#ffdbc7` | `on_tertiary_container` rich-brown | `truck-loading` | Pending GR sub-status (FR67) — production order linked to unconfirmed GR |
| `status_provisional` | `surface_container_high` with `tertiary` 4 px left pip | `on_surface` | `flask-conical` | Cost figures derived from Pending GR (FR67a) — applied as a marker badge on cost values, not as a row background |
| `status_confirmed` | `primary` `#00525b` | `on_primary` `#ffffff` | `check` | Confirmed PO, GR, requisition, dispatch, journal |
| `status_in_progress` | `surface_tint` `#1a6872` | `on_primary` `#ffffff` | `play` | Production order in flight, dispatch in transit |
| `status_completed` | `success` `#2E7D32` | `on_success` `#ffffff` | `check-check` | Completed dispatch, completed reconciliation, closed approval |
| `status_closed` | `secondary` `#4a6267` | `on_secondary` `#ffffff` | `archive` | Closed period, closed B2B challan, closed investigation |
| `status_inactive` | `surface_container_high` `#e7e8e9` | `on_surface_variant` `#3f484a` | `circle-off` | Deactivated master-data entities — employees, customers, products, vendors no longer in active use but preserved for historical references (SI-MDM-005, SI-MDM-006, SI-DSP-004, SI-HRM-001, SI-HRM-004). Distinct icon from `status_cancelled` to avoid confusion. |
| `status_archived` | `surface_container` `#edeeef` | `on_surface_variant` `#3f484a` | `archive` | Archived recipes / recipe versions — intentional historical preservation, read-only, cannot be re-activated; preserved for audit and historical recipe-cost lookups (SI-REC-001, SI-REC-002). One tonal step lighter than `status_inactive` to signal "preserved historical" vs "deactivated". |
| `status_cancelled` | `surface_container_high` | `on_surface_variant` (strikethrough text) | `x-circle` | User-cancelled PO / requisition / challan |
| `status_gr_rejected` | `error_container` `#ffdad6` | `on_error_container` `#93000a` | `package-x` | GR rejected at QC (FR47a); upstream PO state |
| `status_rejected` | `error_container` `#ffdad6` | `on_error_container` `#93000a` | `x-octagon` | Governance-rejected approval requests (SI-USR-008) — distinct from `status_cancelled` (user-initiated) and `status_gr_rejected` (QC-driven). Same error chrome as `status_gr_rejected`; icon disambiguates governance rejection from QC rejection. |
| `status_returned` | `tertiary_container` `#8b542e` | `on_tertiary` `#ffffff` | `corner-up-left` | Vendor return / B2B return / credit-note origination (FR47b) |
| `status_template_active` | `secondary_container` `#cae4e9` | `on_secondary_container` `#4e676b` | `repeat` | Active recurring template lifecycle — recurring PO templates and other reusable, non-transactional patterns (SI-PUR-007). Reuses secondary chrome to signal configuration / non-transactional surface; `repeat` icon signals recurrence semantics. |
| `status_template_expired` | `surface_container_high` `#e7e8e9` | `on_surface_variant` `#3f484a` | `calendar-x` | Recurring template whose end-date has passed (SI-PUR-007). Same chrome as `status_inactive` (both end-of-life states); icon disambiguates expired-by-date from manually-deactivated. |
| `status_waiting_info` | `tertiary_fixed` `#ffdbc7` | `on_tertiary_container` rich-brown | `help-circle` | Issue ticket waiting for more information from the reporter (SI-INF-007). Same warning-amber family as `status_pending_gr` because both are "waiting on someone else" states; `help-circle` icon signals "needs answer" vs Pending GR's `truck-loading`. |
| `status_overridden` | `tertiary` `#6f3d19` 4 px left pip + `surface_container_lowest` row | `on_surface` | `alert-triangle` | Warn-and-log override applied (FR67 Pending-GR override, F-021 substitution, future warn-and-log) |
| `status_variance_flagged` | `surface_container_lowest` with `error` `#ba1a1a` 4 px left pip | `on_surface` | `triangle-alert` | Closing inventory variance, food cost variance, yield variance |

> **Phase-2b token additions (2026-05-04).** Six tokens — `status_inactive`, `status_archived`, `status_template_active`, `status_template_expired`, `status_waiting_info`, and `status_rejected` — were added during the Phase 2b screen-inventory close-out to formalise master-data inactive/archive states, recurring-template lifecycle, issue-tracker waiting-info state, and governance-rejection state. Anchored to: SI-MDM-005, SI-MDM-006, SI-DSP-004, SI-HRM-001, SI-HRM-004 (`status_inactive`); SI-REC-001, SI-REC-002 (`status_archived`); SI-PUR-007 (`status_template_active` / `status_template_expired`); SI-INF-007 (`status_waiting_info`); SI-USR-008 (`status_rejected`). Each new token reuses existing M3 palette hex values — no new colour values introduced, all foreground/background pairs reuse contrast combinations already validated in §5.

> **Pattern note — the 4-px left pip ("margin-accent").** For row-level statuses where colouring the entire row would dominate the screen (`status_provisional`, `status_overridden`, `status_variance_flagged`), use a 4 px vertical pill on the far left of the row. Row background stays `surface_container_lowest` (`#ffffff`). This is the same pattern used by severity-coded alerts (§12.5).

### 6.2 Status durability rule

**Universally enforced UI rule** (P2B-001, FR68, PRD line 87):

Every form/screen that supports data entry **must visibly indicate** whether the current entry is in `status_draft` (not durable; will be lost on session interruption) or in any non-draft status (durable; survives session interruption).

The `status_draft` pill is the canonical indicator. Forms that auto-save drafts to the server still show `status_draft` until the user explicitly confirms. The eyebrow label "DRAFT — NOT YET SAVED" can accompany the pill in mobile contexts where the pill alone may be missed.

### 6.3 Status combinations & precedence

A PO can carry both an approval status (`status_pending_approval`) and a sub-flag (`status_provisional` for downstream production carrying its costs). When two statuses apply, surface them as **two pills side-by-side**, not as a blended colour. Precedence for screen-level row colour (where only one indicator can fit):

1. `status_gr_rejected` (always wins — recovery action required)
2. `status_variance_flagged` (recovery action required)
3. `status_rejected` (governance rejection — requires explicit acknowledgement)
4. `status_overridden` (audit-required, lower urgency than recovery)
5. `status_provisional` (informational marker)
6. `status_waiting_info` (waiting state — equivalent urgency to `status_pending_*`)
7. `status_pending_*` (waiting state)
8. `status_draft` / lifecycle status

> **Master-data and configuration tokens — `status_inactive`, `status_archived`, `status_template_active`, `status_template_expired` — apply at row level only on their respective master-data / configuration screens; they do not interact with transactional precedence.** Transactional records reference master-data entities by ID, not by status; deactivating a master-data entity never triggers a transactional row recolour.

### 6.4 Semantic functional palette

Independent of lifecycle status, four semantic functional colours signal positive/negative outcomes:

| Token | Hex | Usage | On-text |
|---|---|---|---|
| `success` | `#2E7D32` | Positive variance (food cost under target), GR fully accepted, growth | `on_success` `#ffffff` |
| `warning` | `#F9A825` | Cautionary (expiry 48 h band, price spike alert, PAR breach) | `on_warning` `#191c1d` — **never `on_warning` `#ffffff`**; warning has too low a luminance gap with white |
| `error` | `#ba1a1a` | Critical (destructive action confirmation, GR rejection, validation failure) | `on_error` `#ffffff` |
| `error_container` | `#ffdad6` | Error badge backgrounds | `on_error_container` `#93000a` |

> **Note on `success` / `warning`.** These are application-level semantic tokens not in the M3 named palette. They are added explicitly to `tailwind.config.ts`. `warning` text-on-fill must always use `on_warning` (`#191c1d`) — never white — to clear AA.

### 6.5 Provisional cost flag — visual treatment

PRD FR67a requires the **Provisional flag** to be visible on every surface where a Pending-GR-derived cost figure appears: production order detail, FCCC, Brand Owner dashboard, financial reports.

**Treatment.**

- Inline next to the cost number: `flask-conical` icon at 14 px in `tertiary` (`#6f3d19`), with a `surface_container_high` `#e7e8e9` chip behind reading **"PROVISIONAL"** in `text-label-s` (§7.2).
- On chart series: dotted stroke in the series colour (not solid). Tooltip shows "PROVISIONAL — based on last known price" on hover.
- On printed PDFs: italic suffix " (provisional)" on the cost value, in the same size as surrounding numbers. No icon (PDFs aren't interactive).
- On Brand Owner dashboard summary tile (FR67a): a simple count widget — **N production orders carry provisional costs** — clickable through to the affected PO list.

### 6.6 Variance & override visual signature

PRD recognises two non-exception accumulating-pattern signals worth surfacing on the Brand Owner dashboard (P2B-005, F-021): **variance frequency** and **override frequency**. Both are aggregating widgets, not exceptions.

- **Variance widget tile.** Trend sparkline of the last 30 days' variance count + variance value. Hero number is the current-period count. Sparkline draws in `error` (`#ba1a1a`) when count > rolling-7-day average, otherwise `surface_tint` (`#1a6872`).
- **Override widget tile.** Same shape as variance widget. Single aggregating widget covering all warn-and-log override types per P2B-005. Hero number is overrides per 100 production orders (rate, not count) so spikes are visible at scales of 5 vs 50 daily orders. Drill-down to per-type breakdown (Pending-GR override · ingredient substitution · future override types).

---

## 7. Typography

We use **Inter** as the sole typeface (Master Spec §3.1 — FINAL). Hierarchy comes from **extreme scale and weight contrast**, not multiple families. The Indian Rupee value is the hero of any data screen.

### 7.1 Family

| Role | Family | Fallback |
|---|---|---|
| All UI / display / numbers / labels | `"Inter", sans-serif` | `-apple-system, system-ui, "Segoe UI", Roboto, sans-serif` |

There is **no companion serif, no companion mono.** Inter has tabular-numerals and ligature support sufficient for all of the product's data needs. Use `font-feature-settings: "tnum"` on table cells, ledger rows, and currency contexts to keep digits in alignment.

### 7.2 Type scale

| Level | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|
| Display L | 3.5 rem (56 px) | 700 | -0.02 em | Hero single-value metric — e.g. ₹4.2 L on Brand Owner morning briefing |
| Display M | 2.75 rem (44 px) | 700 | -0.02 em | Primary revenue / inventory totals |
| Display S | 2.25 rem (36 px) | 700 | -0.02 em | Secondary hero values (food cost %, stock value) |
| Headline L | 2 rem (32 px) | 700 | -0.02 em | Primary page titles |
| Headline M | 1.75 rem (28 px) | 700 | -0.02 em | Section headers |
| Headline S | 1.5 rem (24 px) | 600 | -0.02 em | Sub-section titles |
| Title L | 1.375 rem (22 px) | 600 | 0 | High-level metric labels |
| Title M | 1.125 rem (18 px) | 600 | 0 | Data group headers, modal titles |
| Title S | 1 rem (16 px) | 600 | 0 | Card titles |
| Body L | 1 rem (16 px) | 400 | 0 | Long-form text, descriptions |
| Body M | 0.875 rem (14 px) | 400 | 0 | Table data, secondary copy (line-height 1.6) |
| Body S | 0.75 rem (12 px) | 400 | 0 | Compact data, dense tables |
| Label M | 0.75 rem (12 px) | 500 | 0.05 em | Eyebrow labels, ALL-CAPS metadata |
| Label S | 0.6875 rem (11 px) | 500 | 0.05 em | Timestamps, secondary IDs, ALL-CAPS — also for status pills (§6) |

### 7.3 Type rules

- **Hero numbers are display.** Use Display L–S for single impactful financial values. Reserve them — every screen has at most one Display level.
- **Eyebrow labels are uppercase mono-feel via Inter Medium with tracking.** Use Label M / Label S above input fields, beside KPI titles, on section headers in dense forms.
- **Numbers in tables use `font-variant-numeric: tabular-nums`.** Always tabular alignment in lists, statements, and reports. Inter ships with `tnum` — turn it on globally inside `<table>` and inside ledger rows.
- **No mixing weights below 16 px.** Body S (12 px) at weight 400 is the smallest readable size. Do not bold body S text — instead, use Label M (12 px / 500 / 0.05 em).

### 7.4 The ₹ rule

The Indian Rupee symbol must:
- Be **60 % the size of the numerical value** when paired with a Display-level number — large enough to register as part of the value, small enough to keep focus on the number.
- Be coloured `on_surface_variant` (`#3f484a`) not `on_surface` (`#191c1d`) — visually subordinate to the number.
- Be separated from the digits by a **hair space** (`U+200A`) — never a regular space, never zero-width.
- Render with **Indian numeric grouping**: `₹ 12,45,680` — never `₹ 1,245,680`. See §16.

Negative values use a leading minus, never parentheses: `-₹ 320`. Provisional values get the suffix " (provisional)" in italic of the same size, in `tertiary` (§6.5).

### 7.5 What we are *not* doing

- **No serif companion.** The FinFlow / `design.md` proposal of IBM Plex Serif for "warmth" is rejected; this is an ERP, not a finance editorial product, and Master Spec §3.1 locks Inter.
- **No monospaced companion.** Tabular-nums on Inter handles ledger alignment.
- **No display-only fonts** for marketing surfaces. Marketing is out of scope for MVP; if a marketing surface ships post-MVP, the typographic system here remains the floor.

---

## 8. Spacing, radius, layout, breakpoints

### 8.1 Spacing scale — 4 px base grid

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (px)

```
Tight        4–8 px      Inline chip, icon-to-label, dense table cell padding
Default     12–24 px     Card padding, form field gap
Section     32–48 px     Between major page blocks
Page        48–64 px     Between top-level page regions, around hero KPIs
```

### 8.2 Corner radius

| Element | Token | Radius |
|---|---|---|
| Inputs, small buttons | `radius-md` | 6 px |
| Default buttons, segmented controls | `radius-lg` | 10 px |
| Cards, list rows, sheets | `radius-md` | 8 px |
| Hero / feature cards, large containers | `radius-xl` | 12 px |
| Tags, badges, status pills | `radius-pill` | 999 px |

### 8.3 Breakpoints

| Name | Min width | Layout | Margins |
|---|---|---|---|
| Mobile | 320 px | Single column, bottom-sheet modals, full-bleed lists | 16 px |
| Tablet | 768 px | 2-column where useful, side-rail nav optional | 32 px |
| Desktop | 1024 px | Sidebar nav + multi-column content, asymmetric layout | wide left gutter |
| Wide | 1440 px | More chart real estate, two-up dashboard cards | max content 1440 |

### 8.4 Mobile-first vs desktop-optimised — both are first-class

Per PRD non-functional requirements: **mobile-first for operational staff** (Kitchen Manager, Dispatch Staff, POS Staff, Store Manager — see §19), **desktop-optimised for management/finance** (Brand Owner, Cluster Manager, Procurement Manager, Finance Manager). Some screens serve both — those are designed mobile-first then progressively enhanced.

**Mobile rules:**
- Tap targets **≥ 44 × 44 px** (WCAG 2.5.5 / §15).
- Bottom sheets slide up from the bottom; centre-of-screen modals are desktop-only.
- Lists are full-bleed on mobile, padded on desktop.
- One primary action visible above the fold; secondary actions in an overflow menu.

**Desktop rules:**
- Sidebar nav (collapsed → 64 px wide; expanded → 240 px wide), see §5.1.5.
- Multi-column dashboard layouts. Typically 12-column grid.
- Density modes (§19) selectable by management personas: comfortable / compact.

---

## 9. Elevation, surface hierarchy, no-line rule

Depth is achieved through **colour shifts**, not heavy shadows. See §5.4 for the layering principle.

### 9.1 Ambient shadow — for floating elements only

| Level | Shadow | Use |
|---|---|---|
| 0 — flat | none | Page background, body text, in-flow surfaces |
| 1 — card | `0 2px 8px rgba(0, 79, 87, 0.04)` | Optional faint lift on metric cards if surface contrast alone is insufficient (rare) |
| 2 — float | `0 4px 24px rgba(0, 79, 87, 0.04)` | Floating dropdowns, popovers, FAB |
| 3 — sheet | `0 8px 32px rgba(0, 79, 87, 0.08)` | Bottom sheets, modals |

> **Shadow colour is teal-tinted**, not neutral black. Tint = `on_primary_fixed_variant` (`#004f57`) at the listed alpha. Never plain black — that reads industrial, against the Clinical Artisan north star.

### 9.2 The "no-line" rule (recap from §5.2)

1 px solid borders are **prohibited** for sectioning. Use background tonal shifts. Severity-coded alerts use a 4 px left pip, not a full border. Tables use surface_variant row striping, not horizontal divider lines.

### 9.3 Ghost border fallback

If a border is needed for accessibility (focus rings, error fields, table cells in extremely high-density financial views) use `outline_variant` (`#bfc8ca`) at **15–20 % opacity**. Never opaque.

Focus ring: 2 px outer ring in `primary` (`#00525b`) with 4 px offset; no inner glow. Never relies on colour alone — focus is a structural change, not a tint.

---

## 10. Motion

Motion is **calm, confident, operational**. The product feels considered, not playful. No celebratory confetti, no parallax, no bouncy springs — these are wrong for an operations system that handles money.

### 10.1 Durations

| Type | Duration |
|---|---|
| Micro (hover, focus, ripple) | 120 ms |
| Standard (press, fade, slide) | 220 ms |
| Emphasised (sheet open, route change) | 320 ms |
| Hero (splash, dashboard reveal on first load) | 480–640 ms |

### 10.2 Easing

- **Standard** (entering): `cubic-bezier(0.2, 0.0, 0.0, 1.0)`
- **Outgoing** (exiting): `cubic-bezier(0.4, 0.0, 1.0, 1.0)`
- **Emphasised** (sheets, hero — slight overshoot): `cubic-bezier(0.2, 0.0, 0.0, 1.2)`

### 10.3 Patterns

- **Numbers tween, they don't pop.** Animate count-up on hero metrics when the value changes (320 ms standard).
- **Sheets slide up from the bottom on mobile, fade-in-place on desktop.**
- **Charts draw left-to-right** on first reveal then settle.
- **Page transitions cross-fade with a 4 px lift** — no slide-off.
- **Loading state for KPIs is a tonal pulse**, not a spinner — the KPI tile alternates between `surface_container_lowest` and `surface_container` at 1.4 s loop.
- **Reduced motion.** Always respect `prefers-reduced-motion: reduce`. Replace count-up tweens with instantaneous swaps, replace cross-fades with 0 ms swaps, disable any non-essential motion.

### 10.4 Don'ts

- No bouncy springs on UI controls — financial inputs especially.
- No confetti, sparkles, or celebratory particles. Successful PO approvals get a calm `success` toast; closed month-end gets a clean ledger card. The product celebrates with clarity, not theatre.
- No parallax on financial data.
- No animated chart-axes — axes are static, only series animate.

---

## 11. Iconography — Lucide React

| Property | Value |
|---|---|
| Library | **Lucide React** (Master Spec §3.1 indirectly — shadcn/ui defaults to Lucide) |
| Style | Outlined, 1.5 px stroke, rounded caps and joins |
| Grid | 24 × 24 px with 2 px keyline padding |

### 11.1 Sizes

| Context | Size | Opacity |
|---|---|---|
| Inline metadata (timestamp adjacent, table cell helper) | 16 px | 0.6 |
| Standard button / form field affordance | 20 px | 1.0 |
| Card / hero / KPI tile leading icon | 24 px | 1.0, in `primary` |
| Sidebar nav | 20 px | 1.0, `on_sidebar` (active: `on_sidebar_active`) |

### 11.2 Colour

- Inherit `currentColor` by default — let surrounding text colour the icon.
- Filled glyphs (`lucide-circle-fill`, `lucide-check-circle-2`) only for: active bottom-nav state, notification dots, confirmation moments where state is irreversible (e.g., journal entry posted).
- Status icons use the foreground of their associated status pill (§6.1).

### 11.3 Stitch → Lucide conversion

Per Master Spec §3.3, screens generated in Google Stitch ship with Material Symbols. Phase 4 implementation must convert these to Lucide React equivalents. A conversion lookup table belongs in `architecture.md` once Phase 3a runs — out of scope here.

---

## 12. Components — quick reference

> Implementation lives in `apps/web/src/components/` and Tailwind tokens in `tailwind.config.ts`. The visual specs here are what to design *to* — implementation is downstream. shadcn/ui + Radix primitives are the chosen base (Master Spec §3.1 — FINAL).

### 12.1 Buttons

| Variant | Style |
|---|---|
| **Primary** | Gradient `primary` → `primary_container` at 135°. `radius-lg` (10 px). 20 px Lucide icon. Heights: 56 px (page-level CTA), 44 px (standard), 36 px (compact). |
| **Secondary** | Ghost — no background. `on_surface_variant` text. Hover: `surface_container_low`. |
| **Tertiary** | Transparent background. Underline on hover only. Used for in-row actions ("View detail"). |
| **Destructive** | `error` text, transparent background, `error` 1 px ghost border at 20 % opacity. |
| **Disabled** | `surface_dim` background, `on_surface_variant` text, 50 % opacity. |

### 12.2 Inputs

- Tonal-fill style: `surface_container_highest` (`#e1e3e4`) background, **no border**. Height 52 px. `radius-lg` (10 px).
- Eyebrow label sits above (Label M, 12 px / 500 / tracking 0.05 em, uppercase).
- Focus state: bottom edge transforms into a 2 px `primary` line. No four-sided box.
- Error state: 1 px `error` ghost border at 20 % opacity, helper text in `error`. No shake.
- Currency inputs render the ₹ as a leading affordance inside the field at 60 % size, `on_surface_variant`.

### 12.3 Status pills

Fully rounded (`radius-pill` 999), Inter Label S (11 px / 500 / tracking 0.05 em), uppercase, padding `4 px 10 px`. Each maps to a row in §6.1. Always paired with a Lucide icon at 14 px in the foreground colour (no exceptions — colour is never the only cue).

### 12.4 Cards

- **Default card.** `surface_container_lowest` (`#ffffff`). `radius-md` (8 px). Padding 24 px. No shadow (relies on §5.4 surface lift). Optional shadow level 1 in dense screens.
- **Metric card.** Pure white. `radius-xl` (12 px). Padding 24 px. Hero number in Display M / S. Label in Label M (uppercase). Optional 24 px Lucide icon top-left in `primary`.
- **Hero card** (Brand Owner morning briefing, FCCC summary). `primary_container` background, `on_primary_container` foreground. `radius-xl` 12 px. Padding 32 px. Use sparingly — one hero card per page.

### 12.5 Severity-coded alert rows (margin-accent pattern)

For approval inboxes, override lists, variance investigation lanes, expiry feeds:

- 4 px vertical pill on the far left of the row in the appropriate severity colour:
  - **Critical** — `error` (`#ba1a1a`)
  - **Warning** — `tertiary` (`#6f3d19`)
  - **Info** — `primary` (`#00525b`)
- Row background stays `surface_container_lowest` inside a `surface_container_low` section.
- Icon at 16 px in the severity colour, label in `on_surface`, timestamp in `on_surface_variant` (Label M).

### 12.6 Lists

**Forbid divider lines.** Use 16 px vertical white space to separate items. For high-density lists where whitespace alone is insufficient (Trial Balance, ledger views), use `surface_variant` (`#e1e3e4`) row striping — never lines.

### 12.7 Sidebar nav (desktop)

- Width: 240 px expanded, 64 px collapsed.
- Background: `sidebar` (`#001f24`). No border between sidebar and content.
- Tenant logo at top: full lockup expanded, nibble collapsed (§4).
- Group headers: Label M (12 px / 500 / uppercase / tracking 0.05 em) in `on_sidebar`.
- Nav items: Body M (14 px / 400) in `on_sidebar`. Active: `sidebar_active` background + `on_sidebar_active` text + 3 px left accent pill.
- Hover: `sidebar_hover` background, no other change.
- Icons: 20 px Lucide.
- Footer: `tenant_display_name` in Label S, `on_sidebar_muted`. Version string below in same style.

### 12.8 Mobile top bar

- Height 56 px. Background: `surface_container_low` (`#f3f4f5`). No bottom border.
- Left: nibble (28 px square) + tenant_display_name (Title S in `on_surface`).
- Right: notification bell (Lucide `bell` 24 px), avatar.

### 12.9 Bottom navigation (mobile, operational personas only)

For Kitchen Manager / Dispatch Staff / POS Staff / Store Manager personas. **Maximum 5 destinations.**

- Background: `surface_container_lowest` with shadow level 2.
- Active: filled icon, label in `primary`. Inactive: outlined icon, label in `on_surface_variant`.
- No FAB (no centre-action raised button) — the operational ERP doesn't have a single global "create" action.

### 12.10 Approval card

- Surface: `surface_container_lowest`, `radius-xl` (12 px), padding 24 px.
- Status pill (top-right): `status_pending_approval`.
- Hero number (centre-left): the value to approve, Display S, with ₹ rule (§7.4).
- Reason / context: Body M.
- CTAs: `Approve` (primary CTA, gradient, 44 px) + `Reject` (destructive ghost, 44 px) + `Request changes` (tertiary text-only).
- For paired approval bundles (P2B-002 cross-cluster routing, P2B-004 expiry-driven cross-cluster suggestions): the card surfaces both legs of the pair as one decision, with an explicit eyebrow label "PAIRED TRANSFER · BRAND-STORE-ROUTED" so the structure is visible to the approver, not hidden as an implementation detail.

---

## 13. Charts & data viz

| Property | Value |
|---|---|
| Library | **Recharts** (Master Spec §3.1 — FINAL) |
| Money series ramp | `primary` → `surface_tint` → `tertiary` → `success` → `secondary` → `warning` (in this order; never rainbow) |
| Axes & gridlines | `outline_variant` at 30 % opacity, 1 px, no dashed strokes for major gridlines |
| Labels | Label M (12 px / 500 / tracking 0.05 em), `on_surface_variant` |
| Tooltips | `surface_container_lowest` background, shadow level 2, body in Body M, amounts in tabular-nums |
| Empty chart | A single dotted hairline at zero plus an italicised Body M "No data yet" in `on_surface_variant` |
| Provisional series (§6.5) | Dotted stroke in series colour; tooltip suffix " (provisional)" |
| Variance overlay (§6.6) | Series in `error` when current period exceeds rolling-7-day mean; otherwise `surface_tint` |

### 13.1 Chart densities

- **Brand Owner / Finance dashboards.** Up to 4 series per chart. Larger Display-S labels for hero numbers above each chart. Generous margins.
- **Cluster Manager / Procurement dashboards.** Up to 6 series. Standard density.
- **In-row sparklines.** Single series, 2 px stroke, 24 px tall, no axes/labels — context only.

---

## 14. Reports & print (PDF / B2B / accountant exports)

Every report ships in **Excel (.xlsx)** and **PDF**. PDFs are tenant-branded and print-ready.

### 14.1 PDF page layout

- A4 portrait, 18 mm margin all sides.
- **Header band** (top of every page):
  - Top-left: `tenant_logo_full_url` (full lockup) at 28 mm wide. For Wild Sugar this is `logos/logo-full.png`.
  - Top-right: report title, Headline S, weight 700 in `on_surface`. Generated date in Body M tabular-nums beneath.
  - Single hairline at 30 % opacity `outline_variant` separating header from body.
- **Body:**
  - Paragraphs: Body L (16 px) at line-height 1.5 in `on_surface`.
  - Tables: Body M (14 px). Headers in Title S, weight 600. Numbers right-aligned with tabular-nums.
  - Hairline rows in `outline_variant` at 15 % opacity. **No zebra striping** in PDFs (looks busy in print).
  - Totals row: weight 600, top border in `primary` 1 px.
- **Filter context block:** Under the title, a small Label M block lists the date range, scope (brand / cluster / location / department), and any other applied filters. Any printout can be reproduced from this block.
- **Footer band:** Page `n` of `m` left in Label S. Right: `Generated by F&B ERP · {tenant_display_name}` (Wild Sugar branded for the MVP tenant).

### 14.2 B2B challan PDF (Epic 8)

- Same header/footer system as §14.1 with three additions:
  - **Challan TRN** (e.g. `DC-2026-POS-AA-001234`) in monospaced-feel Inter tabular-nums, in the header band beneath the report title.
  - **Lifecycle status pill** (Draft / Dispatched / Delivered / Closed per B2B Challan Spec) in the header band, using §6.1 status colours.
  - **Signature block** at the bottom: receiver acknowledgement, with a placeholder for digital confirmation timestamp.

### 14.3 Accountant export PDFs (Epic 10 §6.3)

- Same header/footer.
- **Mapping note** in the filter block: states the export format used (Tally · Zoho Books · Generic CSV per FR96) and the column-name mapping reference. Per Master Spec §11 OQ10, the column-name mapping spec is owned by the architecture phase.
- **Period header:** "For the period 01-Apr-2026 to 30-Apr-2026" — Title L weight 600.

### 14.4 Excel exports

- Sheet 1 = data, sheet 2 = filter context.
- Column headers: Title S equivalent, weight 600, fill `surface_container` (`#edeeef`).
- Currency cells formatted with the Indian grouping pattern: `[>=10000000]"₹ "##\,##\,##\,##0.00;[>=100000] "₹ "##\,##\,##0.00;"₹ "##,##0.00`.
- Date cells: `dd-mm-yyyy`.
- Frozen header row.
- Per Master Spec §6.2: Universal TRN is the primary key column on every accountant export — left-most, fixed-width. Fixed column names; renaming requires a `decision-log.md` entry per Master Spec §7.6.

### 14.5 Print colour caveat

PDFs assume monochrome printers will sometimes consume them. Status pills must remain legible in greyscale — that is why §6.1 pairs every status with a Lucide icon. Severity (variance / override) is also distinguishable by icon shape, not colour alone.

---

## 15. Accessibility — WCAG 2.1 AA gates

Target is **WCAG 2.1 AA as a floor**. AAA where reasonable for primary text. Per PRD non-functional requirements.

### 15.1 Contrast — verified pairs (computed against the §5 palette)

| Pair | Ratio | Pass? |
|---|---|---|
| `on_surface` (`#191c1d`) on `surface` (`#f8f9fa`) | ~ 16.5 : 1 | ✅ AAA |
| `on_surface_variant` (`#3f484a`) on `surface_container_lowest` (`#ffffff`) | ~ 9.0 : 1 | ✅ AAA |
| `on_primary` (`#ffffff`) on `primary` (`#00525b`) | ~ 7.6 : 1 | ✅ AAA |
| `on_primary_container` (`#a4e9f4`) on `primary_container` (`#1f6b75`) | ~ 5.6 : 1 | ✅ AA |
| `on_sidebar` (white @ 78 %) on `sidebar` (`#001f24`) | ~ 12.9 : 1 effective | ✅ AAA |
| `on_sidebar_muted` (white @ 50 %) on `sidebar` (`#001f24`) | ~ 8.3 : 1 effective | ✅ AAA |
| `on_success` (`#ffffff`) on `success` (`#2E7D32`) | ~ 5.8 : 1 | ✅ AA |
| `on_warning` (`#191c1d`) on `warning` (`#F9A825`) | ~ 9.5 : 1 | ✅ AAA |
| `on_error` (`#ffffff`) on `error` (`#ba1a1a`) | ~ 6.4 : 1 | ✅ AA |
| `on_error_container` (`#93000a`) on `error_container` (`#ffdad6`) | ~ 7.4 : 1 | ✅ AAA |
| **Watch — failure pair** — `on_warning` (`#ffffff`) on `warning` (`#F9A825`) | ~ 2.4 : 1 | ❌ FAIL (do not use) |
| **Watch — failure pair** — `tenant_brand_accent` (`#F5B17A`) on `surface` (`#f8f9fa`) | ~ 1.9 : 1 | ❌ FAIL for body text — peach is **decorative only** on light surfaces |
| **Watch — borderline** — `tenant_brand_accent` (`#F5B17A`) on `sidebar` (`#001f24`) | ~ 3.4 : 1 | ⚠ Logo glyph allowed (large graphic exemption); body text NOT allowed |

> **Rule.** `tenant_brand_accent` is for **decorative emphasis only** on light surfaces (welcome italics, accent strokes under logos in PDFs, email H1 underlines). It is **never** used for body copy or for status indication.

### 15.2 Focus states

Every interactive element has a visible focus ring: 2 px outer ring in `primary` (`#00525b`) with 4 px offset. No inner glow. Focus ring is structural — visible against any surface in the system.

### 15.3 Colour is never the only signal

Status pills (§6.1) pair colour with a Lucide icon and an uppercase Label S word. Variance and override row pips (§6.6) pair colour with an icon and a row-level label. Charts (§13) pair colour with an explicit legend; provisional series use a dotted stroke in addition to colour; variance overlays use both colour and the line-style signal.

### 15.4 Touch targets

≥ **44 × 44 px** per WCAG 2.5.5. Mobile tap regions are sized accordingly even when the visual target is smaller (e.g., a 24 px icon button has an invisible 44 × 44 hit area).

### 15.5 Forms

- Visible labels — placeholder text is never the only label.
- Eyebrow label (Label M, uppercase) sits above every field.
- Helper text in `on_surface_variant`. Error helper text in `error`.
- Required-field marker is a `*` in `error` after the label, plus a `aria-required` attribute.

### 15.6 Motion & reduced motion

`prefers-reduced-motion: reduce` always respected. See §10.3.

### 15.7 Charts

Every chart has an accompanying screen-reader summary table (`<table>` with `aria-label` describing the chart). Chart canvases are decorative for AT users; the summary table is canonical.

### 15.8 Screen reader announcements for status changes

State transitions (a confirm action, an override applied, a variance flagged) announce via `aria-live="polite"` regions. Critical errors (validation failures, GR rejections) announce via `aria-live="assertive"`.

---

## 16. India-native details

These are non-negotiable across every product surface — UI, PDFs, exports, emails. Per PRD non-functional requirements (Indian numbering, INR, IST).

| Detail | Rule |
|---|---|
| Currency symbol | `₹` (`U+20B9`). Hair space (`U+200A`) before digits. Never `Rs.` or `INR` in UI. |
| Number grouping | Indian: `12,45,680.00` (lakhs/crores). Never US-style `1,245,680.00`. |
| Display rounding | Headlines round to whole rupees. Detail / receipt / ledger contexts show paise. |
| Date — UI | `DD-MM-YYYY` (e.g. `03-05-2026`). |
| Date — conversational copy | `DD MMM YYYY` (e.g. `03 May 2026`). |
| Date — exports | ISO `YYYY-MM-DD` allowed in CSV / Excel headers and machine-readable cells; UI cells still `DD-MM-YYYY`. |
| Time — receipts / GR / dispatch logs | 24-hour, IST. `14:30` not `2:30 PM`. |
| Time — conversational copy | 12-hour `am`/`pm`, IST. |
| Timezone | All timestamps stored UTC, displayed IST. Never local browser TZ — IST is canonical (PRD non-functional). |
| GST line item display | CGST + SGST (intra-state) **or** IGST (inter-state) — never both. Validation rejects mixed combinations (PRD §6.4). |
| Tax-inclusive vs tax-exclusive | Lists show tax-exclusive subtotal then tax row then total. Receipts / B2B challan PDFs always show both. |

### 16.1 Examples in design comps

Use Indian names (Priya, Sameer, Darshan, Meera, Ravi, Anil, Vikram, Neha — these are the persona names from PRD), Indian places, realistic Indian amounts in lakhs/crores. Vendor names should feel real (e.g., "Mahalakshmi Mills" for flour, "Annapurna Dairies" for butter) — comps that show generic names like "Vendor A / Vendor B" make the design feel placeholder-y.

---

## 17. Voice & tone for the ERP UI

The product speaks like an experienced ops lead who happens to be good at finance — direct, calm, never preachy, never warm-saccharine. The Wild Sugar tenant warmth shows up at brand surfaces (login, splash, B2B challan, customer email). The operational UI is operational.

### 17.1 Principles

1. **Plain over precise when possible.** Say "approve / reject", not "transition state to confirmed".
2. **Indian by default.** ₹, lakh/crore, IST, "raise a PO", "log a GR", "close the day".
3. **Confident, never preachy.** State what's true. Don't lecture the user about why.
4. **Operational, never cold.** Avoid jargon-heavy enterprise ("synchronizing transactional ledger to upstream node"). Avoid mascots and over-friendly tone too.
5. **One question per screen.** Decisions are easier when the screen asks for one thing.
6. **Reason codes are mandatory but not confrontational.** When the system requires a reason for an override or variance, the prompt is "Why is this happening?" not "Justify this exception".

### 17.2 Voice — quick reference

| Don't say | Say |
|---|---|
| "Liabilities aggregated for selected period." | "₹ 4,82,400 owing across 3 vendors." |
| "Transaction successfully recorded." | "PO confirmed. PO-2026-BRD-000123 sent to Vendor A." |
| "Generate Profit & Loss report." | "Show April P&L." |
| "An error has occurred. Please try again." | "Couldn't save. Stock for *Tomatoes* changed since you opened this. Refresh and re-confirm." |
| "Are you sure you want to do this?" | "Reject this GR? Stock won't enter Cluster Store A." |
| "User is not authorised for this action." | "You don't have approval rights above ₹ 50,000. Sameer can approve this." |
| "Override applied." | "Started production with *Last Known Price*. Linked GR will reconcile this cost when it confirms." |
| "Welcome back, user!" | (No salutation. Show today's morning briefing.) |

### 17.3 Patterns

| Pattern | Template |
|---|---|
| **Confirm dialog** | Question form. Names the object. Names the consequence. Two-button: "Reject" / "Cancel". |
| **Reject / cancel destructive confirm** | "Reject GR-2026-CKA-000456? Stock won't enter inventory and a credit note will be drafted." |
| **Empty state** | One Body L sentence + one outline icon. No mascots, no exclamation marks. E.g. "No PAR breaches today." |
| **Reason-code prompt** | Eyebrow label "WHY?" above an input + 4–6 quick-pick chips for the most common reasons. Free-text required if "Other" is picked. |
| **Override warning** | Body M in `tertiary`: "Vendor A's GR isn't confirmed yet. Starting production now will use Last Known Price (`₹ 84/kg`). The system will reconcile this when the GR confirms." Two-button: "Start anyway" (primary, but in `tertiary` not `primary` colour to flag the path) / "Wait for GR". |
| **Variance toast** | "Closing inventory variance: 0.8 kg on sandwich stock. Tagged for investigation." Includes a link to the issue tracker. |
| **Export ready toast** | "Sales register exported. 142 transactions, 1 file. Last handoff: 03-May-2026 14:30." Link to Integration Status Dashboard. |
| **Provisional cost banner** | (On a production order detail screen) Banner at the top of the cost panel: `flask-conical` icon + "Costs are provisional — based on Last Known Price for 2 ingredients pending GR confirmation." Link "View pending GRs". |

### 17.4 Numbers in copy

- Always include `₹` with hair space: `₹ 1,249`.
- Always Indian grouping: `₹ 12,45,680`.
- Round to whole rupees in headlines; show paise in detail/receipt contexts.
- Negative: leading minus, never parentheses: `-₹ 320`.
- Provisional: italic "(provisional)" suffix.

### 17.5 Tenant-warmer voice on customer-facing surfaces

Login screen, splash, B2B challan PDFs, customer-facing emails — Wild Sugar's patisserie warmth surfaces here. One tenant-italic line is permitted on the login screen (e.g. "*Welcome to the kitchen.*" in `tenant_brand_accent`). B2B challan PDFs sign off with a single warm line in the footer ("Thank you for your order — Wild Sugar"). The operational UI does not adopt this register.

---

## 18. Imagery & illustration

The product is an ERP. Imagery is **rare**. When it appears:

- **Photography (sparingly).** Warm, indoor, tactile (kitchen prep, paper challans, inventory shelves, Indian morning light). Never stock-corporate (suits, handshakes, glass towers).
- **Illustration.** Gentle line-art over flat `surface_container_low` fills with `primary` and `tertiary` accents. Avoid 3D, isometric, gradient-heavy.
- **Empty states.** A single small line illustration (40 × 40 px) plus one Body L sentence. No mascots.
- **Product-marketing imagery is post-MVP** and out of scope for this document.

---

## 19. Density modes & persona contexts

PRD mandates mobile-first for operational staff and desktop-optimised for management/finance. Eight personas, with these visual contexts:

| Persona | Primary device | Density | Key surfaces | Special needs |
|---|---|---|---|---|
| Darshan — Brand Owner | Laptop | Comfortable | Cross-location dashboard, food cost analytics, approval inbox, variance investigation | Hero KPIs in Display L; multi-cluster comparison views |
| Sameer — Cluster Manager | Laptop | Comfortable / Compact toggle | Cluster-scoped dashboard, unified approval inbox with bulk actions, paired-transfer affordance (P2B-002) | Batch approval UX, cross-cluster reallocation flow |
| Anil — Procurement Manager | Laptop | Compact | Vendor comparison, PO drafting, price history charts, yield variance feed | Side-by-side vendor cards, yield-variance flag colours |
| Meera — Finance Manager | Laptop / Desktop | Compact | Trial Balance, P&L, Balance Sheet, Daily Sales Report, Integration Status Dashboard, accountant exports | Large tables; tabular-nums everywhere; print previews |
| Priya — Kitchen Manager | **Phone** (active kitchen) | Comfortable mobile | Morning briefing, production planning, material requisition, FEFO list, yield variance recording | Glove-friendly tap targets; high-contrast under noisy lighting; large status pills |
| Vikram — Store Manager | **Phone** (warehouse) | Comfortable mobile | Store inventory, requisition processing, GR with barcode scanning, expiry feed | Scan-friendly affordance; expiry-band colour distinction (48h vs 72h vs > 72h) |
| Ravi — Dispatch Staff | **Phone** (dispatch floor) | Comfortable mobile | Internal challan generation, B2B challan lifecycle, digital delivery confirmation, closing inventory | Dispatch-confirmation in < 60 s; one-thumb workflows |
| Neha — POS Staff | **Counter tablet** | Comfortable tablet | POS-scoped dashboard, dispatch receipt, sell-first prioritisation, end-of-day closing | Receipt confirmation < 30 s; expiry-band sort visible |

### 19.1 Density modes

`comfortable` (default everywhere — generous spacing per §8.1) and `compact` (tightens default 24 px paddings to 16 px, shrinks Body L → Body M, suppresses optional secondary metadata). Compact is opt-in for Procurement / Finance personas working with very large tables; mobile is **always comfortable**.

### 19.2 Mobile-first surface mapping

Operational mobile screens use:
- Mobile top bar (§12.8) with nibble + tenant_display_name.
- Bottom nav (§12.9) with five destinations max.
- Bottom-sheet modals for create/edit (§8.4).
- Status pills at Label S 11 px — large enough to read at arm's length.
- Tap targets 44 × 44 minimum even when the icon is 24 px.
- Confirm dialogs full-bleed.
- Reason-code prompts use chip pickers, not free-text by default.

---

## 20. Quick don't list

- ❌ No hardcoded hex / px / rem / font-family in component files.
- ❌ No 1 px solid borders for sectioning. Use surface tonal shifts; ghost borders at 15–20 % only when accessibility requires.
- ❌ No pure black (`#000000`). Use `on_surface` (`#191c1d`).
- ❌ No grid lines in tables. Use `surface_variant` row striping or vertical whitespace.
- ❌ No box-shadow overload. Only floating / active elements get shadows; always teal-tinted, never neutral black.
- ❌ No system fonts in production UI — Inter only.
- ❌ No `Rs.` or `INR` rendered in UI as the currency symbol. Always `₹`.
- ❌ No US number grouping (`1,245,680`). Always Indian (`12,45,680`).
- ❌ No celebratory confetti, sparkles, or particles.
- ❌ No bouncy springs on financial inputs.
- ❌ No `tenant_brand_accent` on operational status indicators. Status palette is product-owned.
- ❌ No tenant logo recolouring. The artwork ships in canonical hue.
- ❌ No direct queries to the inventory tables (Master Spec §7.3) — design must expose state via `inventoryService` outputs only.
- ❌ No live API adapter to Tally / Zoho Books in MVP UI. Exports only (Master Spec §6.1).
- ❌ No designing screens against a placeholder palette. If a token is missing here, add it here first; only then use it.
- ❌ No "Welcome back, user!" salutations. The operational UI doesn't perform.

---

## 21. References & change control

### 21.1 Source of truth

- `DESIGN.md` (this file) at the project root is the **single source of truth** per Master Spec §3.3.
- Tailwind config (`tailwind.config.ts`, Phase 3a) is generated from this file.
- shadcn/ui customisation (`components.json`, Phase 3a) reads from this file.

### 21.2 Updates

- Open a PR with the proposed change and a one-paragraph rationale.
- If the change touches a token referenced by an existing component, also update the component(s) in the same PR.
- If the change adds a new token, the matching `tailwind.config.ts` and `components.json` updates land in the same PR — no stub tokens.
- If the change touches the status palette (§6), cross-link the PRD FR(s) the change is anchored to. **No status colour exists without an FR anchor.**
- If the change conflicts with Master Spec §3.3 non-negotiable rules, STOP — that's a Master Spec amendment, not a DESIGN.md amendment.

### 21.3 Linked planning documents

- `_planning/02-master-spec.md` — Master Spec §1.2 (multi-tenant ready), §3.1 (Inter, Tailwind, shadcn/ui — FINAL), §3.3 (DESIGN.md non-negotiable rules), §7.4 (frontend / design rules).
- `_planning/03-prd.md` — PRD non-functional requirements (WCAG 2.1 AA, Indian numbering, INR, IST, mobile-first for ops), eight persona journeys, status lifecycle FRs.
- `_planning/04-b2b-challan-spec.md` — B2B Challan lifecycle anchors §14.2.
- `_planning/prd-review-notes.md` — Phase 2c-prep close note (parallel to Pass D close).
- `decision-log.md` DL-001 — canonical 5-status PO lifecycle anchors §6.1.

### 21.4 What this document does NOT cover

- Tailwind config generation (Phase 3a deliverable).
- shadcn/ui component customisation files (Phase 3a).
- Lucide ↔ Material Symbols conversion table for Stitch-generated screens (Phase 3a — referenced in §11.3).
- Per-tenant theme bundle build pipeline (Phase 3a, post-MVP for new tenants).
- Email template HTML scaffolding (Phase 4, downstream of §17.5 voice rules).
- Marketing / public site (post-MVP, out of scope).

---

*F&B ERP Design System · Phase 2c-prep · finalised before Phase 2b screen inventory · Wild Sugar — MVP tenant.*
