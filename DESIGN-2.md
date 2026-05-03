# Design System Specification: The Culinary Architect

## 1. Overview & Creative North Star
**The Creative North Star: "The Clinical Artisan"**

In the high-stakes environment of F&B Enterprise Resource Planning, precision is non-negotiable, but beauty is the differentiator. This design system moves away from the "industrial warehouse" look of traditional ERPs toward a "Clinical Artisan" aesthetic. It treats data with the same respect a Michelin-star chef treats an ingredient: with clarity, space, and intentionality.

The system breaks the traditional "box-in-a-box" template by utilizing **intentional asymmetry** and **tonal depth**. We avoid rigid grids in favor of an editorial layout where white space acts as a functional separator, ensuring that high-density data feels breathable and manageable.

---

## 2. Colors

Our palette is anchored by a sophisticated teal, supported by neutral surfaces that mimic the texture of heavy-stock paper. The primary goal is to eliminate visual noise.

### 2.1 Complete Color Token Reference

These are the authoritative hex values for every token in the system. All component and prose references in this document use these values.

#### Primary & Brand
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#00525b` | Brand authority, primary actions |
| `primary_container` | `#1f6b75` | Hero highlights, CTA gradients |
| `on_primary` | `#ffffff` | Text/icons on primary surfaces |
| `on_primary_container` | `#a4e9f4` | Text/icons on primary container |
| `primary_fixed` | `#a9eef9` | Fixed primary for cross-theme |
| `primary_fixed_dim` | `#8dd1dd` | Dimmed fixed primary |
| `on_primary_fixed` | `#001f24` | Text on fixed primary |
| `on_primary_fixed_variant` | `#004f57` | Variant text on fixed primary |
| `surface_tint` | `#1a6872` | Teal tint for highlights, trend badges, progress bars |

#### Secondary
| Token | Hex | Usage |
|---|---|---|
| `secondary` | `#4a6267` | Secondary UI elements |
| `secondary_container` | `#cae4e9` | Secondary section backgrounds |
| `on_secondary` | `#ffffff` | Text on secondary |
| `on_secondary_container` | `#4e676b` | Text on secondary container |

#### Tertiary
| Token | Hex | Usage |
|---|---|---|
| `tertiary` | `#6f3d19` | Warning accents, approval card borders |
| `tertiary_container` | `#8b542e` | Tertiary container backgrounds |
| `on_tertiary` | `#ffffff` | Text on tertiary |
| `on_tertiary_container` | `#ffd5bc` | Text on tertiary container |
| `tertiary_fixed` | `#ffdbc7` | Fixed tertiary backgrounds |
| `tertiary_fixed_dim` | `#ffb789` | Dimmed tertiary fixed |

#### Semantic Status
| Token | Hex | Usage |
|---|---|---|
| `error` | `#ba1a1a` | Critical alerts, destructive actions |
| `error_container` | `#ffdad6` | Error badge backgrounds |
| `on_error` | `#ffffff` | Text/icons on error |
| `on_error_container` | `#93000a` | Text on error container |
| `success` | `#2E7D32` | Positive indicators (food cost under target, growth) |
| `on_success` | `#ffffff` | Text on success surfaces |
| `warning` | `#F9A825` | Cautionary states (expiry 48h band, price spike alerts) |
| `on_warning` | `#191c1d` | Text on warning surfaces |

**Note:** `success` and `warning` are application-level semantic tokens not part of the M3 named palette. They must be added to tailwind.config.ts manually.

#### Surface Hierarchy
| Token | Hex | Layer | Usage |
|---|---|---|---|
| `surface` | `#f8f9fa` | Base canvas | Application background |
| `surface_bright` | `#f8f9fa` | Base canvas (alias) | Same as surface |
| `surface_dim` | `#d9dadb` | Dimmed base | Disabled states |
| `surface_container_lowest` | `#ffffff` | Floating cards | **Metric cards, interactive cards** — creates "soft lift" on grey background |
| `surface_container_low` | `#f3f4f5` | Sections | Large groupings, alert section backgrounds, mobile top bar |
| `surface_container` | `#edeeef` | Active elements | Category pills, sub-detail backgrounds |
| `surface_container_high` | `#e7e8e9` | Hover / pressed | Hover states, progress bar tracks |
| `surface_container_highest` | `#e1e3e4` | Wells / inputs | Input field fills, nested wells for secondary data |
| `surface_variant` | `#e1e3e4` | Row striping | Alternate row backgrounds in tables |
| `background` | `#f8f9fa` | Page background | Alias for surface |

#### Text & Outline
| Token | Hex | Usage |
|---|---|---|
| `on_surface` | `#191c1d` | Primary text (never use pure #000000) |
| `on_surface_variant` | `#3f484a` | Secondary text, labels, ₹ symbol on metric cards |
| `on_background` | `#191c1d` | Text on background (alias for on_surface) |
| `outline` | `#6f797a` | Structural outlines when needed |
| `outline_variant` | `#bfc8ca` | Ghost borders at 15-20% opacity |

#### Inverse (Dark overlays)
| Token | Hex | Usage |
|---|---|---|
| `inverse_surface` | `#2e3132` | Dark overlays, tooltips |
| `inverse_on_surface` | `#f0f1f2` | Text on dark overlays |
| `inverse_primary` | `#8dd1dd` | Primary accent on dark surfaces |

### 2.2 Sidebar Chrome — Dark Teal Frame

The application sidebar uses the deep end of the teal scale as a **dark chrome frame** around the light content area. This creates a "cockpit" aesthetic — the sidebar grounds the interface while the content area stays breathable and editorial.

#### Sidebar Tokens
| Token | Hex | Derived From | Usage |
|---|---|---|---|
| `sidebar` | `#001f24` | `on_primary_fixed` | Sidebar background |
| `sidebar_hover` | `#003940` | Midpoint toward `on_primary_fixed_variant` | Nav item hover state |
| `sidebar_active` | `#00525b` | `primary` | Active nav item background |
| `on_sidebar` | `rgba(255, 255, 255, 0.7)` | `on_primary` at 70% | Default text and icons |
| `on_sidebar_active` | `#8dd1dd` | `primary_fixed_dim` / `inverse_primary` | Active item text and accent |
| `on_sidebar_muted` | `rgba(255, 255, 255, 0.4)` | `on_primary` at 40% | Chevrons, version text, dividers |

#### Sidebar Design Rules
* **No borders** between sidebar and content area — the dark-to-light boundary IS the separation.
* **Active state:** `sidebar_active` background + `on_sidebar_active` text + 3px left accent pill in `on_sidebar_active`.
* **Hover state:** `sidebar_hover` background, no other visual change.
* **Group headers:** `text-label-m` (12px, weight 500, uppercase, tracking 0.05em) in `on_sidebar`.
* **Sub-items:** `text-body-m` (14px, weight 400) in `on_sidebar`. Active sub-item uses `on_sidebar_active`.
* **Icons:** 20px (Button size), `on_sidebar` default, `on_sidebar_active` when active.
* **Shadow:** No shadow on the fixed desktop sidebar. On mobile overlay, apply `shadow-ambient` since it floats over content.
* **Scrollbar:** 4px width, thumb at `on_sidebar_muted`, track transparent.

### 2.3 The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts.
* *Example:* The dark `sidebar` (`#001f24`) frame sits directly adjacent to the `surface` (`#f8f9fa`) content area. The dramatic tonal shift IS the boundary — no border needed.

### 2.4 Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Lighter = more prominent:
* **Chrome Layer:** `sidebar` (`#001f24`) — The dark teal navigation frame. See §2.2 for full token set.
* **Base Layer:** `surface` (`#f8f9fa`) — The canvas for the main content area.
* **Section Layer:** `surface_container_low` (`#f3f4f5`) — Large logical groupings, alert section backgrounds.
* **Action Layer (Cards):** `surface_container_lowest` (`#ffffff`) — **Most important interactive elements (Metric Cards).** White cards on grey background create the "soft lift."
* **Well Layer:** `surface_container_highest` (`#e1e3e4`) — Nested secondary data wells inside cards or sections.

### 2.5 The "Glass & Gradient" Rule
For floating elements (modals, dropdowns) and hero sections:
* **Glassmorphism:** Use `surface` at 80% opacity with a `20px` backdrop-blur.
* **Signature CTA Gradient:** Linear gradient from `primary` (`#00525b`) to `primary_container` (`#1f6b75`) at 135°.

---

## 3. Typography

We use **Inter** as the sole typeface, relying on extreme scale and weight contrast to create an editorial feel. The hierarchy makes Indian Rupee (₹) values the "Hero" of the screen.

| Level | Size | Weight | Letter-Spacing | Usage |
|---|---|---|---|---|
| Display L | 3.5rem | 700 | -0.02em | Hero single-value metrics |
| Display M | 2.75rem | 700 | -0.02em | Primary revenue or inventory totals |
| Display S | 2.25rem | 700 | -0.02em | Secondary hero values |
| Headline L | 2rem | 700 | -0.02em | Primary page titles |
| Headline M | 1.75rem | 700 | -0.02em | Section headers |
| Headline S | 1.5rem | 600 | -0.02em | Sub-section titles |
| Title L | 1.375rem | 600 | 0 | High-level metric labels |
| Title M | 1.125rem | 600 | 0 | Data group headers |
| Title S | 1rem | 600 | 0 | Card titles |
| Body L | 1rem | 400 | 0 | Long-form text |
| Body M | 0.875rem | 400 | 0 | Table data, descriptions (line-height: 1.6) |
| Body S | 0.75rem | 400 | 0 | Compact data |
| Label M | 0.75rem | 500 | 0.05em | Metadata, ALL-CAPS captions |
| Label S | 0.6875rem | 500 | 0.05em | Timestamps, secondary IDs, ALL-CAPS |

**₹ Symbol Rule:** The currency symbol should be 60% the size of the numerical value, colored in `on_surface_variant` (`#3f484a`) to keep focus on the number.

---

## 4. Elevation & Depth: Tonal Layering

Depth is achieved through color shifts, not heavy shadows.

* **The Layering Principle:** Place a `surface_container_lowest` (`#ffffff`) card on a `surface_container_low` (`#f3f4f5`) section. The hex change creates a "soft lift."
* **Ambient Shadows:** For floating elements only. Use a teal-tinted shadow: `box-shadow: 0 4px 24px rgba(0, 79, 87, 0.04)`. Shadow color is `on_primary_fixed_variant` (`#004f57`) — never black.
* **The "Ghost Border" Fallback:** If a border is needed for accessibility, use `outline_variant` (`#bfc8ca`) at 15-20% opacity. Never use 100% opaque borders.

---

## 5. Components

### Metric Summary Cards
* **Background:** `surface_container_lowest` (`#ffffff`). No borders.
* **Corner Radius:** `xl` (0.75rem).
* **Shadow:** `0 4px 24px rgba(0, 79, 87, 0.04)` — teal-tinted ambient.
* **₹ Symbol:** 60% of value font size, `on_surface_variant` (`#3f484a`).

### Severity-Coded Alert Rows
Use the "Margin-Accent" pattern — a 4px vertical pill on the far left, not full-row coloring:
* **Critical:** 4px pill of `error` (`#ba1a1a`).
* **Warning:** 4px pill of `tertiary` (`#6f3d19`).
* **Info:** 4px pill of `primary` (`#00525b`).
* **Row Background:** `surface_container_lowest` (`#ffffff`) inside a `surface_container_low` section.

### Buttons
* **Primary:** Gradient fill (`primary` → `primary_container`), `xl` (12px) roundedness, `20px` icon.
* **Secondary:** Ghost style — no background, `on_surface_variant` text, transitions to `surface_container_low` on hover.
* **Tertiary:** Transparent, underline on hover only.

### Input Fields
* **Style:** Tonal-fill with `surface_container_highest` (`#e1e3e4`) background, no border. On focus, bottom edge transforms into a 2px `primary` (`#00525b`) line.
* **Forbid** the four-sided box look.

### Lists
* **Forbid** divider lines. Use 16px vertical white space to separate items.

### Lucide React Icons
* **Inline (metadata):** 16px, 0.6 opacity.
* **Button:** 20px, full opacity.
* **Card / Hero:** 24px, `primary` (`#00525b`) teal.

**Note:** Stitch generates Material Symbols. During Phase 4 implementation, Claude Code converts these to Lucide React equivalents.

---

## 6. Layout & Spacing

Built on a **4px base grid** for mathematical harmony.

### Spacing Scale
4, 8, 12, 16, 24, 32, 48, 64 (px)

### Responsive Breakpoints
| Breakpoint | Width | Layout | Margins |
|---|---|---|---|
| Mobile | 320px+ | Single column | 16px |
| Tablet | 768px+ | 12-column grid | 32px |
| Desktop | 1280px+ | Max-width 1440px, asymmetric layout | Wide left gutters |

---

## 7. Do's and Don'ts

### Do:
* **Embrace the Rupee:** Give ₹ symbols breathing room. They represent the business's health.
* **Use Asymmetric White Space:** More padding on top than bottom (e.g., 32px top, 24px bottom) for a weighted professional look.
* **Use `display-lg` typography** for single impactful data points.
* **Use 48px or 64px gaps** between major page sections.
* **Apply `xl` (12px) rounding** to large containers and `md` (6px) to small interactive elements.
* **Nest surfaces:** Place `surface_container_highest` elements inside `surface_container_low` to create wells for secondary data.

### Don't:
* **No Box-Shadow Overload:** Only floating or active elements get shadows.
* **No Grid Lines:** No horizontal or vertical lines in data tables. Use `surface_variant` row striping or vertical whitespace.
* **No Pure Black:** Never use `#000000`. Use `on_surface` (`#191c1d`) for all "black" text.
* **No 1px Solid Borders:** Use tonal shifts or ghost borders at 15-20% opacity.
* **No hardcoded hex values in component files.** All visual values must reference design tokens from this file or the Tailwind config generated from it.
