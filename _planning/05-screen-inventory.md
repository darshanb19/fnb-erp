---
inputDocuments:
  - _planning/02-master-spec.md
  - _planning/03-prd.md
  - _planning/04-b2b-challan-spec.md
  - _planning/_internal/phase-2b-digest.md
  - docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md
documentCounts:
  epics: 12
  screensEstimated: '94–125 (firm count after per-epic build)'
  ccPatterns: 21
  serviceOnlyFRs: 15
classification:
  phase: '2b — Screen Inventory'
  status: 'Phase 2b deliverable — in build'
  deliverable: '_planning/05-screen-inventory.md'
---

# Screen Inventory — F&B ERP

**Author:** Darshan
**Date:** 2026-05-04
**Status:** Phase 2b deliverable — in build

This document is the bridge between the locked PRD (`_planning/03-prd.md`) and design system (`DESIGN.md`) on one side, and the visual mockup phase (Phase 2c) and architecture phase (Phase 3a) on the other. Every UI-bearing requirement and every user-journey moment must trace to at least one screen ID defined here. Screen IDs take the form `SI-{EPIC}-###` using the three-letter epic codes in §2.

---

## 1 Preamble

### 1.1 Purpose

Produce a single, navigable screen inventory document that serves as the bridge between the locked PRD (`_planning/03-prd.md`) plus the locked design system (`DESIGN.md`) on one side, and the visual mockup phase (Phase 2c) plus the architecture phase (Phase 3a) on the other. Every UI-bearing requirement and every user-journey moment must trace to at least one screen ID.

### 1.2 Scope

**In scope:**

- Naming and cataloguing every distinct UI screen (route-level destination or heavyweight modal/drawer meeting the §7 granularity rule in the shape spec).
- Assigning each screen a stable `SI-{EPIC}-###` identifier, never reused or renumbered after publication.
- Capturing per-screen metadata: primary device, roles/scope, purpose, data displayed, user actions, cross-cutting patterns (`CC-*`), DESIGN.md tokens, source FRs, source journeys, and related screens.
- Cross-cutting pattern catalogue (`CC-*` IDs) defined once, referenced by screens.
- Service-layer-only FRs: catalogued in §5 with no screen ID, cross-referenced in Appendix C.
- Appendices: Role × Screen matrix (A), Journey × Screen traceability (B), FR × Screen traceability (C), Parking-lot honour (D).

**Out of scope:**

- **No visual mockups.** Visual layout, component composition, and pixel-level styling belong to Phase 2c (after the design tooling is selected per Master Spec §3.3).
- **No route maps or framework-specific decisions.** URL paths, React Router structure, state-management shape — all Phase 3a.
- **No per-screen interaction prototypes.** State diagrams beyond the canonical PO 5-status lifecycle (DL-001) and the B2B challan lifecycle (`04-b2b-challan-spec.md` §3) belong to Phase 3a / 3b.
- **No new product decisions.** If a product ambiguity surfaces during the build, log it as a Phase-2b ambiguity in `_planning/prd-review-notes.md`; do not silently re-open closed FRs.
- **No new design tokens.** If a screen needs a token DESIGN.md doesn't provide, surface as a Phase-2c gap in `prd-review-notes.md` — do not edit DESIGN.md from this session.

### 1.3 Validation rules

Before this document is closed, three checks must pass. Results live at the top of Appendix D (§10) and are duplicated in the PR description.

**Check 1 — Journey traversal**

Walk all 8 user journeys (Brand Owner / Cluster Manager / Kitchen Manager / Finance Manager / Dispatch Staff / Procurement Manager / Store Manager / POS Staff). Every journey moment from the synthesis digest must map to at least one `SI-*` ID. Missing journey moments = missing screens.

Output format (illustrative — actual moment counts and screen IDs populated during the build):

```
Journey × Screen — 8 / 8 journeys fully mapped
  • Brand Owner       — N/N moments mapped (SI-…, SI-…, …)
  • Cluster Manager   — N/N moments mapped (…)
  • Kitchen Manager   — N/N moments mapped (…)
  • Finance Manager   — N/N moments mapped (…)
  • Dispatch Staff    — N/N moments mapped (…)
  • Procurement Mgr   — N/N moments mapped (…)
  • Store Manager     — N/N moments mapped (…)
  • POS Staff         — N/N moments mapped (…)
```

**Check 2 — FR traversal**

Walk every FR in the PRD (FR1 through FR119, plus FR15a/b/c, FR47a/b, FR67a). Every FR with a UI surface must have at least one `SI-*` ID. Service-layer-only FRs are listed in §5 and flagged "no screen — see §5" in Appendix C.

Output format (illustrative):

```
FR × Screen — 119 base FRs + 6 sub-FRs (FR15a/b/c, FR47a/b, FR67a) = 125 reviewed
  • UI-bearing FRs:           NN / NN mapped to ≥1 SI-* ID
  • Service-layer-only FRs:   NN / NN listed in §5
  • Total:                    125 / 125 reviewed
```

**Check 3 — Parking-lot honour**

Walk the 7 Phase-2b parking-lot items (P2B-001 through P2B-005 plus the 2 implicit Pass-C items). Each must be honoured by at least one `SI-*` screen and/or `CC-*` pattern. Appendix D (§10) is the full table.

Output format (illustrative — actual screen IDs assigned during the build):

```
Parking-lot honour — 7 / 7 items honoured
  • P2B-001 Draft/confirmed pill         → CC-DRAFT-PILL applied to NN screens
  • P2B-002 Paired transfer bundle       → CC-PAIRED-TRANSFER-BUNDLE; SI-INV-…, SI-INV-…
  • P2B-003 Permission-override mgmt UI  → CC-PERMISSION-OVERRIDE-MGMT; SI-USR-…, SI-USR-…
  • P2B-004 Expiry-dashboard split       → CC-PAIRED-TRANSFER-BUNDLE; SI-INV-…, SI-INV-…
  • P2B-005 Override-frequency widget    → CC-OVERRIDE-WIDGET; SI-RPT-…
  • Implicit FCCC two-surface            → CC-FCCC-DUAL-SURFACE; SI-RPT-…, SI-RPT-…
  • Implicit Pending-GR drill-down       → CC-PENDING-GR-DRILL; SI-RPT-…, SI-PRO-…
```

The harness must complete with all three checks at "fully mapped" before the inventory is considered closed. Any item left unmapped is either a missing screen (add it) or a missing journey/FR (raise as an open question on `prd-review-notes.md`).

---

## 2 Epic abbreviation key

Used inside every screen ID as `SI-{EPIC}-###`. Three-letter codes, zero-padded three-digit sequence within the epic, never reused across epics, never re-numbered after publication.

| # | Epic | Code |
|---|---|---|
| 1 | Master Data Management | `MDM` |
| 2 | User Management & Security | `USR` |
| 3 | Shared Infrastructure | `INF` |
| 4 | Inventory Management | `INV` |
| 5 | Procurement | `PUR` |
| 6 | Recipe Management | `REC` |
| 7 | Production Planning | `PRO` |
| 8 | Dispatch & Distribution | `DSP` |
| 9 | POS Integration | `POS` |
| 10 | Accounting & Financial | `ACC` |
| 11 | HRMS | `HRM` |
| 12 | Analytics & Reporting | `RPT` |

> **Why `PUR` for Procurement, not `PRO`:** the natural three-letter abbreviation for Production (Epic 7) is `PRO`. Using `PRO` for Procurement instead would have forced `PRD` for Production, which collides with the `PRD` (Product Requirements Document) shorthand used throughout the planning artefacts. `PUR` (purchasing) is the cleanest disambiguation.

Examples:

```
SI-INV-014   Goods Receipt entry
SI-PUR-007   Vendor price comparison
SI-PRO-004   Production Order detail
SI-DSP-006   B2B challan GST closure
SI-ACC-009   Trial Balance view
SI-RPT-002   Brand-Owner cross-location dashboard
```

---

## 3 Cross-cutting pattern catalogue

> **Status:** v1, additive growth allowed — new CC-* patterns may be added during per-epic builds; existing IDs must NOT be renamed.

Cross-cutting UI patterns are defined once at the top of the inventory document and referenced by ID inside every screen entry that uses them. Each pattern has a stable `CC-*` identifier.

The initial catalogue (will grow as the per-epic build surfaces additional patterns; growth must be additive — existing pattern IDs do not change):

| ID | Name | Source |
|---|---|---|
| `CC-DRAFT-PILL` | Draft / non-draft status pill on every data-entry screen; `status_draft` token; mobile companion eyebrow `"DRAFT — NOT YET SAVED"` | P2B-001, FR68, FR117 |
| `CC-OVERRIDE-WIDGET` | Single aggregating override-frequency widget — hero rate (per 100 POs) + 30-day sparkline + per-type filters; `error` colour when above rolling-7-day avg, otherwise `surface_tint` | P2B-005, FR70, FR61, FR65 |
| `CC-PAIRED-TRANSFER-BUNDLE` | Single bundled approval object for paired Brand-Store-routed transfers; visible bundle structure, not hidden as implementation detail | P2B-002, P2B-004, FR29, FR32, Master Spec §2.2 |
| `CC-PERMISSION-OVERRIDE-MGMT` | Brand-Owner permission-override workflow: effective permissions view + grant/revoke flow + expiring-soon dashboard widget + audit-trail link | P2B-003, FR15a, FR15b, FR15c |
| `CC-FCCC-DUAL-SURFACE` | FCCC two-surface pattern: financial framing (FR95) and operational analytics framing (FR108) sharing underlying queries and drill-down state without duplicating | implicit Pass-C item, FR95, FR108 |
| `CC-PENDING-GR-DRILL` | Pending-GR resolution outcomes drill-through: from override-frequency dashboard pane into rejected GR + linked PO + reclassification journal | implicit Pass-C item, FR47a, FR67a, FR70 |
| `CC-PREFILL` | Forms pre-fill from most recent equivalent entry; user can override | FR113 |
| `CC-IMPLAUSIBILITY-WARN` | Warn-and-log on physically implausible quantities (GR >150% of PO; output > theoretical max from raw materials; closing > opening + receipts − dispatches); mandatory reason code | FR114 |
| `CC-DUPLICATE-WARN` | Warn-and-log on likely duplicate entries; conflicting record reference shown | FR115 |
| `CC-DATA-QUALITY-ALERT` | Cross-module inconsistency surfacing on dashboards (deactivated material in published recipe, deactivated vendor with open POs, etc.) | FR116 |
| `CC-REVERSE-CANCEL` | Reverse/cancel pre-confirmed transactions only; post-confirmed correction path is always a compensating document with own TRN | FR117 |
| `CC-VOICE-INPUT` | Voice input on quantity fields during goods receipt and production output recording | FR112 |
| `CC-AUDIT-LINK` | Per-record link to append-only audit timeline | FR20, FR21 |
| `CC-APPROVAL-INBOX-CARD` | Universal approval inbox card: threshold routing indicator, action buttons, bulk-approve checkbox, scope filter | FR16, FR17 |
| `CC-ISSUE-TICKET-LINK` | Per-screen affordance to raise a new issue ticket against the current entity, or jump to existing ticket(s) | FR22 |
| `CC-DASHBOARD-TILE` | Standard dashboard tile (KPI value + secondary text + optional sparkline + drill-down ≤2 clicks) | FR104, FR105, FR109 |
| `CC-EXPORT-TRIGGER` | Standard export trigger (CSV / Excel / PDF per FR107; Tally + Zoho Books + Generic CSV per FR96 where applicable) | FR96, FR107 |
| `CC-TRN-DISPLAY` | TRN visible + copy-to-clipboard on every financially significant transaction | FR87 |
| `CC-PROVISIONAL-FLAG` | "PROVISIONAL" badge on every UI surface that displays a Pending-GR-derived cost; replaced by actuals on FR67 retrospective adjustment | FR66, FR67 |
| `CC-GST-FIELD-VALIDATION` | Place-of-supply / CGST-SGST-IGST consistency validation on save; reject invalid combinations | FR118 |
| `CC-UNREGISTERED-CUSTOMER-WARN` | Warning + mandatory reason code when raising a GST invoice for an Unregistered/Consumer customer | FR119 |

---

## 4 Roles & scope conventions

### Role identifiers

**Brand Owner** — Cross-location strategic oversight: reviews brand-wide financials, food cost %, override frequency metrics, and approves high-value purchase orders above threshold. Grants and revokes permission overrides.

**Cluster Manager** — Coordinates production, inventory, and distribution across a cluster of locations: processes approval inboxes, investigates variance drill-downs, and initiates cross-cluster transfer bundles.

**Kitchen Manager** — Plans and executes daily production at a central kitchen: creates production orders against real-time stock, overrides Pending-GR situations with reason codes, records actual output vs expected yield.

**Finance Manager** — Closes the financial period: reviews Trial Balance, initiates B2B challan GST workflows (IRN paste, Stage 2 journal trigger), generates financial statements, and monitors integration export status.

**Dispatch Staff** — Runs the physical dispatch workflow: confirms dispatch quantities against production output, generates internal and B2B challans, records digital delivery confirmations, and performs daily closing inventory on the dispatch department.

**Procurement Manager** — Owns vendor and purchasing operations: creates purchase orders with PAR-based suggestions, compares vendor prices, routes POs through approval, and monitors goods receipt yield variances and vendor price trends.

**Store Manager** — Controls raw material custody: processes material requisitions from departments, handles goods receipt against transfer challans (including barcode scanning), applies yield factors, and maintains real-time stock accuracy for downstream planning.

**POS Staff** — Operates the POS location end-of-day workflow: confirms dispatch receipts, tags expiry-band items for sell-first prioritisation, monitors sales auto-import, raises issue tickets on discount anomalies, and runs the daily closing inventory count on mobile.

### Scope filters

| Scope filter | Definition |
|---|---|
| `brand` | The entire brand/tenant — all clusters, all locations, all departments. Queries carry `brand_id` only as the limiting filter. |
| `cluster` | One cluster and its child locations/departments. Queries carry `brand_id` + `cluster_id`. |
| `location` | One location (Central Kitchen, POS outlet, or Store) and its departments. Queries carry `brand_id` + `cluster_id` + `location_id`. |
| `department` | One department within a location. Queries carry all four FK columns: `brand_id` + `cluster_id` + `location_id` + `department_id`. |

Typical scope per role: Brand Owner operates at `brand` scope; Cluster Manager at `cluster` scope; Kitchen Manager, Store Manager, Dispatch Staff, and POS Staff operate at `location` or `department` scope; Finance Manager operates at `brand` scope for reporting and at `location` scope for challan workflows; Procurement Manager operates at `brand` or `cluster` scope depending on vendor scope assignment.

---

## 5 Service-layer-only FRs

> These FRs have **no UI screen**. They are service-layer enforcement contracts. Appendix C (FR × Screen) marks each as "no screen — see §5".

The inventory document devotes a short section to FRs that are pure service-layer enforcement and have no first-class UI surface. The format is a flat table:

| FR ID | One-line summary | Enforced in (service / mechanism) |
|---|---|---|
| FR8 | Material enablement enforcement | `inventoryService.checkEnablement(itemId, departmentId)` called before every stock movement |
| FR12 | RBAC enforcement | Express.js auth middleware; role claims verified on every protected route |
| FR13 | Material enablement as access control | Service layer rejects requisitions/movements for non-enabled materials before any DB write |
| FR28 | Three-product-type directional flow | `inventoryService` validates product type vs movement direction; violation blocked at service layer |
| FR31 | FEFO ordering inside `inventoryService.deductStock()` | Stock deduction sorted by expiry date ascending inside the deduction service method |
| FR52 | Recipe cost cascade | `recipeCostService.cascade(itemId)` triggered automatically on yield factor update |
| FR67 | Retrospective cost adjustment journal | `journalService.retrospectiveAdjust()` fires on Pending-GR resolution; replaces provisional with actuals |
| FR68 | Stock deduction at PO `In Progress` transition (DL-001) | PO status-change event triggers `inventoryService.deductStock()` in the state machine |
| FR80 | Cumulative credit-note ≤ source value validation | `creditNoteService.validateCumulativeLimit(sourceChallanId)` before credit note creation |
| FR84 | POS sales import via REST API | Scheduled ingestion job or webhook endpoint; no UI for the import itself |
| FR85 | Recipe-driven inventory deduction calculation | `inventoryService.deductByRecipe(saleLineItems)` called post-import per sale transaction |
| FR87 | TRN generation engine | `trnService.generate(transactionType, entityId)` — display is `CC-TRN-DISPLAY`; generation is backend-only |
| FR89 | Auto-journal mapping rules | `journalService.autoMap(transactionId)` applies configured chart-of-accounts mapping on every TRN-generating event |
| FR90 | Internal ledger maintenance | Ledger rows written by `journalService` on every auto-journal; no direct UI for ledger row creation |
| FR92 | Two-stage B2B journal model | Stage 1 on dispatch confirmation; Stage 2 on IRN paste — both triggered automatically via challan status transitions |

---

## 6 Per-epic screens

### Epic 1 — Master Data Management (MDM)

Master Data Management establishes the foundational data structure of the F&B ERP: the organisational hierarchy (brand, clusters, locations, departments), master catalogs (products, vendors, categories), and material enablement matrices that control which raw materials flow to which departments. Every operational transaction upstream depends on these setup screens being accurate and complete; MDM surfaces are admin/setup surfaces used by Brand Owners, Procurement Managers, and Store Managers, not by production floor staff. UOM definitions and multi-level conversion factors are managed inline within the Product Master form rather than as a separate screen, since UOM fields don't fire journals or approvals independently.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-MDM-001 | Organisational Hierarchy View & Edit | desktop-primary | Brand Owner (brand) |
| SI-MDM-002 | Department Register | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location) |
| SI-MDM-003 | Product Master CRUD | desktop-primary | Brand Owner (brand), Procurement Manager (brand/cluster) |
| SI-MDM-004 | Material Enablement Matrix | responsive-equal | Store Manager (location/department), Brand Owner (brand) |
| SI-MDM-005 | Vendor Master CRUD | desktop-primary | Procurement Manager (brand/cluster), Brand Owner (brand) |
| SI-MDM-006 | Category & Sub-Category Management | responsive-equal | Brand Owner (brand) |
| SI-MDM-007 | Company Registration & Fiscal Year Setup | desktop-primary | Brand Owner (brand) |

---

#### SI-MDM-001 — Organisational Hierarchy View & Edit

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Maintain the brand's organisational hierarchy from brand down to department using a visual tree or nested-list editor.

**Data displayed:**
- Brand name and ID
- Clusters (one per row/node): cluster name, location count, active status
- Locations per cluster (nested/collapsible): location name, location type (Central Kitchen, POS Outlet, Brand Store), active status, department count
- Departments per location (nested/collapsible): department name, department type (Production/Non-Production for kitchens; Dispatch for dispatch; Store for Brand/Cluster stores), active status

**User actions:**
- Expand/collapse clusters and locations to navigate the tree
- Create new cluster → dialog with cluster name, contact location, active flag
- Edit cluster details (name, address, contact person, phone)
- Deactivate cluster (soft-delete)
- Create new location under cluster → dialog with location name, type selector, address
- Edit location details
- Deactivate location
- Create new department under location → dialog with department name, type selector (Production / Dispatch / Non-Production), active flag
- Edit department details
- Deactivate department
- Bulk-enable/disable departments for material enablement

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (on individual create/edit dialogs before dialog-level confirm)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, primary, outline_variant

**Source FRs:**
FR1 (organisation hierarchy CRUD), FR2 (department type classification visible in tree)

**Source journey(s):**
Brand Owner — initial brand & cluster setup (one-time + occasional restructuring; admin/setup surface)

**Related screens:**
drill-down: SI-MDM-004 (material enablement matrix per location), sibling: SI-MDM-002 (department register detail view)

**Notes:**
Design approach: Tree view (desktop) with collapsible nodes; each node carries status pill (active/inactive). Edit affordances are in-place or modal pop-ups per affordance size. Deep nesting may require horizontal scroll on smaller desktop; consider sticky breadcrumb at top showing current branch. Soft-delete (deactivation) prevents deletion of locations/departments with active stock or linked operational records.

---

#### SI-MDM-002 — Department Register

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location/department)

**Purpose:**
Provide a searchable register of all departments across the brand, filterable to cluster or location scope, with type classification and bulk action support.

**Data displayed:**
- Department name, code (system-generated or user-assigned), type (Production / Dispatch / Non-Production subcategories)
- Parent location name and cluster
- Active status, creation date, last modified date
- Row action menu: edit, deactivate, view material enablement

**User actions:**
- Filter by cluster, location, type
- Search by name or code
- Create new department (routes to hierarchy editor SI-MDM-001 for context, or inline dialog)
- Edit department name, type, or address
- Deactivate department
- View material enablement for department → drill-down to SI-MDM-004

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (for any inline editing)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (active pill), surface_container_high (inactive pill), outline_variant

**Source FRs:**
FR1 (department part of hierarchy), FR2 (department type classification visible on row)

**Source journey(s):**
Brand Owner / Cluster Manager — department onboarding & type classification (admin/setup surface; no operational journey moment)

**Related screens:**
parent: SI-MDM-001 (hierarchy view), sibling: SI-MDM-004 (material enablement), drill-down: SI-MDM-004

**Notes:**
Desktop variant: multi-column sortable table with type filtering. Mobile variant: card list with type badge, collapse expand for metadata. Department type values (Production / Dispatch / Non-Production) come from FR2 enumeration; non-Production includes Store, Canteen, etc. per location configuration.

---

#### SI-MDM-003 — Product Master CRUD

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Maintain product records across their full lifecycle — type, UOM, yield factor, shelf life, and category — as the canonical master-data source for procurement, recipes, and inventory.

**Data displayed:**
- Product name, SKU (system-generated or user-assigned), product type (raw / semi-product / final)
- Default UOM (e.g. kg, L, pieces); UOM conversion factors (kg ↔ g, L ↔ ml, pieces ↔ dozen, etc.) inline or in collapsible section
- Standard yield factor (0–1 decimal, e.g. 0.85 for tomatoes), shelf-life days, category/sub-category assignment (multi-select)
- Active status, creation date, last modified date
- Row action menu: edit, deactivate, view recipes using this product (if semi or final), view vendor pricing (if raw)

**User actions:**
- Search and filter by name, SKU, type, category, active status
- Create new product → form with type selector, UOM selector, yield, shelf life, category picker
- Edit product details (name, SKU, yield, shelf life, category, active status)
- Edit or add UOM conversion factors → inline table or modal (e.g. add "1 kg = 1000 g" conversion)
- Deactivate product (soft-delete; blocks assignment to new recipes/POs)
- Bulk deactivate
- Drill-down to recipes using this product (if recipe module is active)
- Drill-down to vendor price history for this product (routes to SI-MDM-005 or SI-PUR-007)

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL, CC-DATA-QUALITY-ALERT (if active product is used in deactivated recipe, flag on dashboard)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed, outline_variant

**Source FRs:**
FR3 (product registration with type, UOM, yield, shelf life, category), FR4 (UOM and multi-level conversion factors), FR7 (category assignment, visible here)

**Source journey(s):**
Procurement Manager — product lookup during PO creation; Kitchen Manager — recipe ingredient resolution (background master-data dependency)

**Related screens:**
sibling: SI-MDM-005 (vendor master), drill-down: SI-REC-001 (recipes using this product — ID assigned in Task 6), drill-down: SI-PUR-005 (vendor price comparison)

**Notes:**
Granularity decision: UOM and conversion factors managed inline on product form or in a collapsible section, not a separate screen; they are ≥3 fields per UOM type but don't fire journals or approvals independently. Category assignment is multi-select picklist or autocomplete; many-to-many stored in product_categories join table. Yield factor is per-product default; can be overridden per GR (FR27). Shelf-life is in days (e.g. 7 for fresh cream, 365 for flour). Products are scoped to brand_id (not location-specific).

---

#### SI-MDM-004 — Material Enablement Matrix

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** responsive-equal

**Roles & scope:**
- Store Manager (scope: location/department)
- Brand Owner (scope: brand) — for read-only review

**Purpose:**
Define and manage which raw materials are enabled for which departments; users can toggle material-department pairs on/off; view enablement as a matrix (materials × departments) or as a list per department.

**Data displayed:**
- (Matrix view, desktop) Rows = raw materials (filterable by category), columns = departments at selected location, cells = enabled/disabled toggle with last-modified timestamp and user name
- (List view, mobile/alternative) Per-department collapsible section listing enabled and disabled materials with toggle; filter by material category; display status pill per material (Enabled / Disabled)
- Material name, SKU, category, unit (from SI-MDM-003)
- Department name and type
- Timestamp of last enable/disable, username, optional reason code

**User actions:**
- Select location to view/edit enablement (dropdown or scoped to user's location if Store Manager)
- Toggle material enablement on/off for any department (must supply optional reason code)
- Bulk enable/disable materials (select multiple rows, action menu, apply)
- Filter materials by category, name, or SKU
- Search for material or department
- View audit trail for any toggle (click reason code or icon to see history)

**Cross-cutting:**
CC-AUDIT-LINK (every enable/disable recorded), CC-DRAFT-PILL (if UI allows batch operations before save)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (enabled), surface_container_high (disabled), outline_variant

**Source FRs:**
FR5 (enable/disable raw materials per department), FR8 (enforcement is service-layer; see §5 for backend mechanism)

**Source journey(s):**
Store Manager — "Material requisition processing with enablement check" (FR29, FR8); when departments request materials, enablement determines approval routing and fulfillment availability. Store Manager uses this matrix to pre-configure which materials each kitchen department can consume. Procurement Manager uses this indirectly to understand demand patterns.

**Related screens:**
parent: SI-MDM-001 (organisation hierarchy), sibling: SI-MDM-002 (department register), sibling: SI-MDM-003 (product master)

**Notes:**
Matrix view vs list view: Matrix scales well to ~30–40 materials and 5–8 departments per location; beyond that, switch to list view or add pagination/filtering. Mobile default: list view with per-department collapsible sections. Desktop default: matrix view with sticky row/column headers. Toggle states stored in `material_department_enablement` join table with audit timestamps. Reason code is optional but recommended for compliance (e.g., "Chef requested due to menu change"). Every toggle cascades availability through requisition and production workflows.

---

#### SI-MDM-005 — Vendor Master CRUD

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand) — for read-only review

**Purpose:**
Create, edit, and manage vendor records; define vendor contact, tax identity, scope (Brand / Cluster / POS level), product categories supplied, credit terms, and preferred vendor flagging.

**Data displayed:**
- Vendor name, code (system-generated `VEND-{SEQUENCE}` or user code), tax ID (GSTIN, PAN), vendor status (Active / Inactive)
- Contact person name, phone, email, address (street, city, postal code, state)
- Scope level (Brand / Cluster / POS); if Cluster or POS scope, which cluster/POS ID is linked
- Product categories supplied (multi-select from SI-MDM-006 category list)
- Credit terms (days), payment mode (Cash / Bank Transfer / Cheque)
- Preferred vendor flag (Boolean), quality rating (1–5 stars or numeric)
- Creation date, last modified date
- Row action menu: edit, deactivate, view PO history, view price history

**User actions:**
- Search and filter by name, code, category, scope, active status
- Create new vendor → form with name, contact, tax ID, scope selector, category picker, credit terms, preferred flag
- Edit vendor details (name, contact, address, credit terms, categories, quality rating)
- Bulk edit (scope or preferred flag for multiple vendors)
- Deactivate vendor (soft-delete; blocks new POs unless owner allows)
- View PO history for vendor → links to SI-PUR-### (PO list filtered to vendor — ID assigned in Task 5)
- View price history (3-month, 6-month, 12-month trends) → links to SI-PUR-007 or inline sparkline
- Price alert configuration (e.g., alert if price > X% above 30-day average)

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL, CC-DATA-QUALITY-ALERT (if vendor deactivated with open POs, flag on dashboard)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed, warning (quality/alert indicators), outline_variant

**Source FRs:**
FR6 (vendor master with scope tag Brand/Cluster/POS — visible as scope selector on form), FR46 (price spike monitoring visible here as optional alert config)

**Source journey(s):**
Procurement Manager — "Vendor price comparison before selection" (FR43), "Vendor price spike monitoring" (FR46); Procurement Manager references vendor records during PO creation and monitors price trends. View operation: read vendor list, click vendor, see price history trends.

**Related screens:**
sibling: SI-MDM-003 (product master), drill-down: SI-PUR-002 (PO list filtered to vendor), drill-down: SI-PUR-005 (vendor price comparison)

**Notes:**
Scope tag (Brand / Cluster / POS) determines visibility in PO creation forms (Epic 5) — Brand-scoped vendors appear in Brand-Owner PO creation; Cluster-scoped vendors appear in Cluster-Manager PO creation, etc. Scope visibility is enforced at the service layer (FR12, RBAC + scope filtering). Preferred vendor flag influences PO creation sorting (preferred vendors suggested first in vendor selection). Quality rating can be 1–5 stars or numeric 1–10; aggregated from GR rejections (FR47a), yield variances, and manual Brand Owner input. Deactivation is soft-delete; UI should warn if vendor has open POs and require reason code. Price history chart is inline sparkline or link to SI-PUR-005.

---

#### SI-MDM-006 — Category & Sub-Category Management

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Define and manage product categories and sub-categories; assign many-to-many mappings between products and categories; manage category metadata (description, ordering, active status).

**Data displayed:**
- Category name, code (system-generated or user-assigned), description, active status
- Sub-categories (indented/nested list or separate rows linking to parent): sub-category name, code, description, active status
- Product count per category/sub-category
- Creation date, last modified date
- Row action menu: edit, deactivate, view products in category

**User actions:**
- List all categories and sub-categories (tree or flat table)
- Create new category → form with name, code, description, active flag
- Create sub-category under category → form with name, code, parent-category selector, description
- Edit category/sub-category metadata
- Deactivate category/sub-category (soft-delete; blocks assignment to new products)
- View all products in category → drill-down to SI-MDM-003 filtered by category
- Reorder categories (drag-and-drop or explicit order-number field) for display priority

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (if bulk editing)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed, outline_variant

**Source FRs:**
FR7 (categories and sub-categories with M:N mappings to products)

**Source journey(s):**
Store Manager — category-based requisition browsing; Kitchen Manager — recipe categorisation (background master-data dependency)

**Related screens:**
sibling: SI-MDM-003 (product master; categories assigned there), drill-down: SI-MDM-003 (products in category)

**Notes:**
Category and sub-category are two-level hierarchy; no deeper nesting. Many-to-many mapping stored in `product_categories` join table, managed from product-master form (SI-MDM-003). Categories are brand-scoped (brand_id primary key). Category names used in filter dropdowns across inventory, requisition, and procurement screens. Soft-delete deactivates category without deleting product mappings (orphaned products remain but category hidden from UI).

---

#### SI-MDM-007 — Company Registration & Fiscal Year Setup

**Primary epic:** Epic 1 — Master Data Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand) — one-time setup + occasional edit

**Purpose:**
Register company legal entity details (name, address, tax IDs, contact, bank account) and define fiscal year configuration (fiscal year start date, close date, accounting currency, timezone); one-time setup screen used at brand onboarding.

**Data displayed:**
- Company legal name, trading name, logo URL pointer (to tenant config)
- Registered address (street, city, postal code, state, country)
- Tax IDs: GSTIN (if GST-registered), PAN (if applicable), any other statutory ID
- Contact person name, phone, email
- Bank account (account number, IFSC code, account holder name) — used for B2B invoice import and cash-flow reporting
- Fiscal year start date (Month-Day format, e.g., Apr-01), fiscal year-end date
- Accounting currency (INR preset; future: multi-currency support)
- Operating timezone (IST preset for India; future: expansion)
- Status (Setup Complete / Pending)

**User actions:**
- View current company details (read-only for most roles; Brand Owner only)
- Edit company details → form with all fields above; changes logged and audit-tracked
- Set fiscal year start/end dates → multi-select for month-day or date-picker; triggers period-boundary creation in Finance module (Epic 10)
- Upload or update company logo (or pointer to logo URL in tenant config)
- Mark company registration complete (one-time action; affects reporting dashboards)

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (if changes are staged before confirm)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed, outline_variant

**Source FRs:**
FR9 (company registration details: address, tax IDs, fiscal year, currency)

**Source journey(s):**
Brand Owner — "Company registration details" (FR9); used one-time at brand onboarding or occasionally when legal details change (rebranding, tax ID update, address relocation, fiscal year change).

**Related screens:**
— (standalone; no direct related screens in Epic 1; links to SI-ACC-### — ID assigned in Task 10 — in Epic 10 for period-boundary management)

**Notes:**
One-time setup screen used during brand onboarding; accessed later only for edits. Changes to fiscal year start/end date trigger period recalculation in the Finance module (handled by Epic 10 logic, not visible here). Tax ID formatting validated per India rules (GSTIN 15-char alphanumeric, PAN 10-char). Logo URL points to static asset file in tenant configuration (DESIGN.md §3.2 tenant_logo_full_url / tenant_logo_nibble_url). Timezone default is IST (UTC+5:30 or UTC+4:30 depending on daylight saving). Currency default is INR with no conversion (multi-currency support deferred to Phase 3c). All edits audit-logged with before/after snapshots (FR20).

---

### Epic 2 — User Management & Security (USR)

User Management & Security covers the lifecycle of every user account in the brand: creation by Brand Owners (with Superadmin approval for Brand-Owner-tier accounts), role and department mapping, authentication, self-service password reset, and the per-user permission-override workflow that lets Brand Owners grant or revoke individual permissions on top of fixed roles. Permission overrides carry a mandatory reason code, optional expiry, and a full audit trail; an "expiring soon" surface keeps Brand Owners ahead of access lapses. RBAC enforcement and material-enablement-as-access-control are pure service-layer concerns documented in §5; the screens here are the surfaces where Brand Owners and end users interact with identity and permissions.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-USR-001 | User List & Filter | desktop-primary | Brand Owner (brand), Cluster Manager (cluster) |
| SI-USR-002 | User Create / Edit | desktop-primary | Brand Owner (brand) |
| SI-USR-003 | Login | responsive-equal | All roles |
| SI-USR-004 | Self-Service Password Reset | responsive-equal | All roles |
| SI-USR-005 | User Effective Permissions View | desktop-primary | Brand Owner (brand) |
| SI-USR-006 | Permission Grant / Revoke Flow | desktop-primary | Brand Owner (brand) |
| SI-USR-007 | Overrides Expiring Soon | desktop-primary | Brand Owner (brand) |
| SI-USR-008 | Brand Owner Account Approval | desktop-primary | Brand Owner (brand), Superadmin (cross-brand) |

---

#### SI-USR-001 — User List & Filter

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster) — read-only listing for users in own cluster

**Purpose:**
Browse and filter all user accounts in the brand to find the user record on which to perform create, edit, deactivate, or permission-management actions.

**Data displayed:**
- User name, email, system user ID
- Role (Brand Owner / Cluster Manager / Kitchen Manager / Finance Manager / Dispatch Staff / Procurement Manager / Store Manager / POS Staff)
- Department + location mapping (or "brand-wide" for Brand Owners)
- Account status (Active / Inactive / Pending Superadmin Approval)
- Override count (number of active per-user permission grants/revokes; clickable into SI-USR-005)
- Last login timestamp
- Creation date, last modified date

**User actions:**
- Search by name, email, or user ID
- Filter by role, cluster, location, status, "has overrides" flag
- Open user record → drill-down to SI-USR-002 (edit) or SI-USR-005 (effective permissions)
- Create new user → routes to SI-USR-002 in create mode
- Activate / deactivate user (sub-affordance, single-decision confirm dialog)
- Trigger password reset on behalf of user (sends reset link; light confirm)

**Cross-cutting:**
CC-AUDIT-LINK (every activate/deactivate/role-change recorded), CC-DATA-QUALITY-ALERT (flag if user assigned to deactivated department)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (Active), status_pending_approval (Pending Superadmin Approval), surface_container_high (Inactive), outline_variant

**Source FRs:**
FR10 (user CRUD with role + department mapping; this is the list/index surface)

**Source journey(s):**
Brand Owner — user onboarding (looking up an existing user before granting an override or to deactivate a departing employee; no operational journey moment but a frequent admin task during onboarding/offboarding cycles)

**Related screens:**
drill-down: SI-USR-002 (create / edit), drill-down: SI-USR-005 (effective permissions), sibling: SI-USR-007 (overrides expiring soon), sibling: SI-USR-008 (Brand Owner accounts pending approval)

**Notes:**
RBAC enforcement on what each role can see is service-layer (FR12 — see §5); Cluster Manager view is read-only and scoped to own cluster's users. Override count column is a useful at-a-glance signal that this user has permissions diverging from their base role; clicking it routes to SI-USR-005.

---

#### SI-USR-002 — User Create / Edit

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Create a new user or edit an existing user's identity, role assignment, and department/location mapping.

**Data displayed:**
- User name (first, last), email, mobile (optional), system user ID (auto-generated on create)
- Role selector (from the 8-role enumeration in §4)
- Department + location mapping (single primary department for staff roles; brand-wide flag for Brand Owner / Finance Manager / Procurement Manager when scope-applicable)
- Active / Inactive toggle
- Initial password mode (auto-generated reset link via email vs admin-set temporary password)
- Audit metadata: created by, created at, last modified by, last modified at

**User actions:**
- Save as draft (form persists locally / server-staged) — triggers `CC-DRAFT-PILL`
- Submit to create user → if role is Brand Owner, routes to SI-USR-008 (Superadmin approval workflow); else activates immediately
- Edit name, email, role, department mapping, active flag
- Trigger password reset for this user (sub-affordance, sends reset link)
- View this user's effective permissions → drill-down to SI-USR-005
- Cancel draft (sub-affordance, confirm dialog)

**Cross-cutting:**
CC-DRAFT-PILL, CC-AUDIT-LINK, CC-PREFILL (last-used role/department defaults pre-filled when creating multiple users for the same department)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_pending_approval (when Brand Owner role triggers Superadmin approval), primary, outline_variant

**Source FRs:**
FR10 (user CRUD with role + department mapping), FR14 (Brand Owners create users; Superadmin approval for Brand Owner accounts — submit transition routes to SI-USR-008 when role is Brand Owner)

**Source journey(s):**
Brand Owner — user onboarding (creating Cluster Manager / Kitchen Manager / Store Manager etc. accounts as the brand grows; admin/setup surface invoked at hiring events and structural changes)

**Related screens:**
parent: SI-USR-001 (user list), drill-down: SI-USR-005 (effective permissions), triggers: SI-USR-008 (when role = Brand Owner, save initiates Superadmin approval)

**Notes:**
Per §7 granularity rule, this is route-bearing form with ≥3 editable fields. Brand Owner role creation does NOT activate the user immediately — it stages an approval request to Superadmin; SI-USR-008 is the approval-side surface. Department mapping respects FR12 RBAC scope (e.g., POS Staff requires location + department; Cluster Manager requires cluster only). Audit trail entries link via `CC-AUDIT-LINK` to the Epic 3 activity timeline (ID assigned in Task 3). FR13 (material enablement as access control) is enforced service-side — see §5; this screen does not expose enablement controls (those live on SI-MDM-004).

---

#### SI-USR-003 — Login

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per-user; pre-authentication surface)

**Purpose:**
Authenticate the user with email and password and establish a session for downstream RBAC-protected surfaces.

**Data displayed:**
- Brand logo / wordmark
- Email field
- Password field (masked, with show/hide toggle)
- "Remember this device" toggle (optional)
- Forgot password link → routes to SI-USR-004
- Error message area (invalid credentials, locked account, pending approval — distinct copy per case)

**User actions:**
- Enter email and password
- Submit credentials → on success, route to role-specific morning-briefing dashboard (SI-RPT-001 — ID assigned in Task 12); on failure, surface error
- Toggle password visibility
- Click "Forgot password" → SI-USR-004
- Toggle "Remember this device"

**Cross-cutting:**
None applicable — pre-authentication surface; in-app cross-cutting patterns all assume an established session

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, primary, on_primary, error (failed-login messaging), outline_variant

**Source FRs:**
FR11 (authenticate via email and password with session management)

**Source journey(s):**
All roles — start-of-day login (every operational journey begins here: Brand Owner morning dashboard review, Kitchen Manager morning briefing, POS Staff start-of-shift, etc.)

**Related screens:**
sibling: SI-USR-004 (password reset), drill-down: SI-RPT-001 (role-specific morning briefing dashboard — ID assigned in Task 12)

**Notes:**
Pre-authentication surface, so cross-cutting patterns that depend on session (CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, etc.) do not apply. Error messaging must distinguish "invalid credentials" (generic) from "account inactive" and "Brand Owner account pending Superadmin approval" (specific) to avoid forcing users into useless retry loops. RBAC enforcement (FR12, §5) kicks in on the post-login route.

---

#### SI-USR-004 — Self-Service Password Reset

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per-user; pre-authentication surface)

**Purpose:**
Let a user request and complete a password reset without admin intervention by validating an email-delivered reset token.

**Data displayed:**
- (Step 1 — request) Email field, "Send reset link" button, confirmation message after submission
- (Step 2 — set new) New password field, confirm password field, password strength indicator, complexity requirements list
- Error / success messaging (token expired, token invalid, password complexity failed, reset successful)
- Link back to SI-USR-003 (login)

**User actions:**
- Enter email → submit request → system emails reset link with single-use token
- Open reset link from email → land on Step 2
- Enter new password and confirmation → submit → on success, redirect to SI-USR-003 with confirmation banner
- Cancel and return to login

**Cross-cutting:**
None applicable — pre-authentication surface; in-app cross-cutting patterns all assume an established session

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, primary, on_primary, success (reset complete), error (validation failures), outline_variant

**Source FRs:**
FR15 (self-service password reset)

**Source journey(s):**
All roles — recovering access after forgotten password (background flow used by every role occasionally; not tied to a specific operational journey moment but blocks every operational journey when access is lost)

**Related screens:**
sibling: SI-USR-003 (login), parent: SI-USR-001 (admin-triggered reset originates here as a sub-affordance)

**Notes:**
Two-step flow (request reset → set new password) lives behind a single screen ID since both steps share the same route family (`/reset-password` and `/reset-password/{token}`). Token validity, single-use enforcement, and complexity rules are service-layer; the UI surfaces the resulting state. Admin-triggered reset (sub-affordance on SI-USR-001 and SI-USR-002) sends the same email and lands the user on Step 2.

---

#### SI-USR-005 — User Effective Permissions View

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Show a single consolidated view of the permissions a specific user can and cannot exercise right now, combining base-role permissions with active per-user grants and revokes.

**Data displayed:**
- User identity header (name, email, role, department/location)
- Permission list grouped by module (Inventory, Procurement, Production, Dispatch, Finance, etc.) with a per-permission status pill: "From role" (unmodified base), "Granted" (added on top of role), "Revoked" (removed from role)
- Per-override-row metadata: reason code, expiry date (if any), granted-by user, granted-at timestamp
- "Audit history" link per override row → opens audit timeline filtered to this override
- Summary counters: total active overrides, count expiring within 7 / 14 / 30 days
- Action buttons: "Grant new permission", "Revoke a permission" → routes to SI-USR-006 in the appropriate mode

**User actions:**
- Filter the permission list by module or by status (From role / Granted / Revoked)
- Search permissions by name
- Click an override row's "Audit history" → opens audit timeline (Epic 3 surface, ID assigned in Task 3)
- Grant a new permission → routes to SI-USR-006 in grant mode for this user
- Revoke a permission currently held by the user → routes to SI-USR-006 in revoke mode for this user
- Edit an existing override's expiry date or reason code (sub-affordance opens SI-USR-006 in edit mode)

**Cross-cutting:**
CC-PERMISSION-OVERRIDE-MGMT (this is the canonical effective-permissions surface), CC-AUDIT-LINK (per-override audit drill-down)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_confirmed (From role), status_overridden (Granted / Revoked), warning (expiring within 7 days), outline_variant

**Source FRs:**
FR15b (view user's effective permission set — role + grants + revokes consolidated), FR15c (audit-trail capture surfaced here as per-row link)

**Source journey(s):**
Brand Owner — permission override workflow for one-off needs (consult effective permissions before deciding whether a grant/revoke is needed; canonical entry point for the override workflow described in digest lines 18–25 and P2B-003)

**Related screens:**
parent: SI-USR-001 (user list), triggers: SI-USR-006 (grant / revoke flow), sibling: SI-USR-007 (overrides expiring soon — same data, different filter), drill-down: audit timeline (Epic 3 — ID assigned in Task 3)

**Notes:**
Source-of-truth surface for the `CC-PERMISSION-OVERRIDE-MGMT` pattern (P2B-003). RBAC enforcement of which roles can view this screen is service-layer (FR12 — see §5); only Brand Owner can see it. Effective-permissions resolution (role + grants − revokes) is a backend computation; the UI surfaces the resolved view. "From role" pills use `status_confirmed` to distinguish unmodified state from `status_overridden` (granted or revoked).

---

#### SI-USR-006 — Permission Grant / Revoke Flow

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Apply a per-user permission grant or revoke with a mandatory reason code and an optional expiry date, captured as an audit event.

**Data displayed:**
- Mode indicator: Grant / Revoke (set by entry context from SI-USR-005)
- Target user identity (name, email, role, department/location) — read-only
- Permission selector: searchable list of permissions; in grant mode, lists permissions NOT currently held; in revoke mode, lists permissions currently held via base role
- Mandatory reason code field (free text, minimum length enforced)
- Optional expiry date picker (date + time; if omitted, override is open-ended until manually revoked)
- Preview: "After this change, user will / will no longer be able to: <permission summary>"
- Audit metadata stub: granted-by (current Brand Owner) + timestamp will be captured on submit

**User actions:**
- Save as draft (form-level draft state) — triggers `CC-DRAFT-PILL`
- Select permission (single-select per submission; multi-permission case requires repeat invocation by design)
- Enter reason code
- Pick expiry date (optional)
- Submit → applies the override, writes audit event, returns to SI-USR-005 with the new override visible
- Cancel (sub-affordance, confirm dialog)

**Cross-cutting:**
CC-PERMISSION-OVERRIDE-MGMT, CC-DRAFT-PILL, CC-AUDIT-LINK (submit creates an audit event; link surfaces back on SI-USR-005)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_overridden (preview pill), primary, on_primary, outline_variant

**Source FRs:**
FR15a (per-user grant/revoke on top of role with timestamp, modifying user, mandatory reason code, optional expiry), FR15c (audit-trail capture)

**Source journey(s):**
Brand Owner — permission override workflow for one-off needs (digest lines 18–25; e.g., temporarily granting a Cluster Manager the ability to fill GST IRN fields normally restricted to Finance Manager + Brand Owner; or revoking a specific permission from a user pending investigation)

**Related screens:**
parent: SI-USR-005 (effective permissions; entry point), drill-down: audit timeline (Epic 3 — ID assigned in Task 3), sibling: SI-USR-007 (expiring-soon view shows downstream lifecycle of overrides created here)

**Notes:**
Granularity decision: grant and revoke consolidated into a single screen ID with a mode toggle (grant / revoke), per §7. Both modes share the same field set (target user, permission selector, mandatory reason, optional expiry, audit capture); the only material differences are (a) the permission-selector filter and (b) the preview wording. Splitting into two IDs would have duplicated 90% of the schema with no operational benefit. Edit-existing-override lands on this screen in a third "edit" sub-mode (reason code + expiry editable; permission and target user read-only). Per FR15a, every submission writes to the append-only audit trail (FR20 — see §5 for storage contract); the audit link surfaces on SI-USR-005 row by row. Honours P2B-003 — Permission Override Management UI (per the design-system parking-lot).

---

#### SI-USR-007 — Overrides Expiring Soon

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
List every active permission override whose expiry falls within the next 30 days so the Brand Owner can renew or let lapse before access changes silently.

**Data displayed:**
- Override rows sorted by expiry date ascending
- Per row: target user (name, email, role), permission, override type (Grant / Revoke), reason code, expiry date, days remaining, granted-by user, granted-at timestamp
- Urgency banding: 0–7 days (error tone), 8–14 days (warning tone), 15–30 days (default tone)
- Filter chips: 7 / 14 / 30 day windows; by override type; by user
- Action buttons per row: "Renew" (extend expiry), "Revoke now" (end early), "Open user" (drill-down to SI-USR-005)

**User actions:**
- Filter by expiry window, override type, or user
- Renew an override (sub-affordance: opens SI-USR-006 in edit mode pre-loaded with the override)
- Revoke an override now (sub-affordance: confirm dialog → ends override immediately, writes audit event)
- Open target user's effective permissions → drill-down to SI-USR-005
- Open audit history for this override → drill-down to audit timeline (Epic 3 — ID assigned in Task 3)

**Cross-cutting:**
CC-PERMISSION-OVERRIDE-MGMT (expiring-soon surface is part of the pattern), CC-DASHBOARD-TILE (the same content also appears as a tile on the Brand Owner morning-briefing dashboard), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, error (0–7 days band), warning (8–14 days band), status_overridden, outline_variant

**Source FRs:**
FR15c ("overrides expiring soon" widget on Brand Owner dashboard; this screen is the source-of-truth full-list surface), FR105 (Brand Owner cross-location dashboard surfaces expiring overrides as a tile)

**Source journey(s):**
Brand Owner — morning dashboard review (digest line 20: "expiring permission overrides" surfaced as one of the cross-location dashboard items); tile click drills here for the full list and renew/revoke actions

**Related screens:**
parent: SI-USR-001 (user list), sibling: SI-USR-005 (per-user effective permissions), sibling: SI-RPT-002 (Brand Owner cross-location dashboard tile — ID assigned in Task 12; this screen is the source-of-truth, the dashboard tile is the at-a-glance summary), triggers: SI-USR-006 (renew = edit mode)

**Notes:**
This screen is the source-of-truth full-list view; the same data also appears as a `CC-DASHBOARD-TILE` on the Brand Owner morning-briefing dashboard (SI-RPT-002 — ID assigned in Task 12) per FR105 and digest line 20. Tile shows count + 0–7 day urgent count; click opens this screen. Renew action reuses SI-USR-006 in edit mode rather than introducing a fourth screen — keeps the audit pattern consistent (every renew writes a new audit event on the existing override). Honours P2B-003 — Permission Override Management UI (per the design-system parking-lot).

---

#### SI-USR-008 — Brand Owner Account Approval

**Primary epic:** Epic 2 — User Management & Security

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand) — read-only view of their own pending submission
- Superadmin (scope: cross-brand) — approval / rejection authority

**Purpose:**
Surface a Brand Owner account creation request that is pending Superadmin approval and provide the Superadmin the action surface to approve or reject it.

**Data displayed:**
- Submitted user identity: name, email, mobile, role (always Brand Owner), brand context
- Submitter: Brand Owner who initiated the creation, submitted-at timestamp
- Status: Pending / Approved / Rejected
- Reason for elevation (free-text justification provided by submitting Brand Owner)
- Superadmin action audit: approved/rejected by, decision timestamp, decision reason (mandatory on reject)

**User actions:**
- (Submitting Brand Owner) View submission status — read-only
- (Superadmin) Open pending request → review identity + justification → approve (account activates) or reject (account discarded; submitter notified)
- (Superadmin) Enter mandatory rejection reason on reject
- Cancel pending request (sub-affordance, available to submitting Brand Owner before Superadmin acts)

**Cross-cutting:**
CC-AUDIT-LINK (every approve/reject/cancel writes an audit event), CC-APPROVAL-INBOX-CARD (Superadmin sees this request as a card in the universal approval inbox — ID assigned in Task 3)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_pending_approval, status_confirmed (Approved), status_cancelled (Rejected), primary, on_primary, outline_variant

**Source FRs:**
FR14 (Brand Owners create users; Superadmin approval for Brand Owner accounts — this is the approval-workflow surface)

**Source journey(s):**
Brand Owner — user onboarding for a peer Brand Owner account (rare admin event, e.g., adding a co-founder or a new brand-tier hire); Superadmin — cross-brand identity governance (admin/setup surface; no operational journey moment but governance-critical when invoked)

**Related screens:**
parent: SI-USR-002 (created here; submission lands here), sibling: SI-USR-001 (user list shows the row in `status_pending_approval` state), drill-down: SI-INF-### (unified approval inbox card — ID assigned in Task 3)

**Notes:**
Per §7 granularity rule, this is a route-bearing screen because it initiates an approval workflow with its own state (Pending / Approved / Rejected) and audit trail. Superadmin is a cross-brand role outside the 8-role brand-scoped enumeration in §4 — it exists specifically for governance actions like this one and is not addressed in operational journeys. Approval-inbox surfacing for the Superadmin reuses the universal `CC-APPROVAL-INBOX-CARD` pattern; the canonical inbox screen lives in Epic 3 (ID assigned in Task 3). Cancel-while-pending is available to the submitting Brand Owner up until Superadmin acts. Phase-2c gap candidate: `status_cancelled` is currently used for the Superadmin-Rejected state, but DESIGN.md §6.1 defines that token for user-cancellation; a dedicated `status_rejected` token may be added in Phase-2c review.

---

### Epic 3 — Shared Infrastructure (INF)

Shared Infrastructure defines the cross-cutting capabilities every other epic plugs into: the Unified Approval Engine and its inbox, the notification stack with preferences and digest-batching, the append-only audit trail and per-entity activity timeline, the issue tracker, broadcast announcements, and the canonical reverse-or-cancel and forms-prefill patterns. These surfaces are the canonical anchor for the shared cross-cutting patterns referenced from Epics 4 through 12, so the screens here either show the cross-module aggregate (approval inbox, audit viewer, issue list) or document the pattern that other epics embed (reverse/cancel confirmation, activity timeline). Approval-chain configuration and notification preferences are admin/setup surfaces; the inbox, audit viewer, and issue tracker are daily-use surfaces touched by Brand Owners and Cluster Managers as part of their morning triage.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-INF-001 | Unified Approval Inbox | responsive-equal | Brand Owner (brand), Cluster Manager (cluster) |
| SI-INF-002 | Approval Chain Configuration | desktop-primary | Brand Owner (brand) |
| SI-INF-003 | Notification Preferences | responsive-equal | All roles |
| SI-INF-004 | Notification Digest Preview | responsive-equal | All roles |
| SI-INF-005 | Audit Trail Viewer | desktop-primary | Brand Owner (brand), Cluster Manager (cluster), Finance Manager (brand) |
| SI-INF-006 | Activity Timeline Reference | responsive-equal | All roles |
| SI-INF-007 | Issue Ticket List | responsive-equal | All roles |
| SI-INF-008 | Issue Ticket Create / Edit | responsive-equal | All roles |
| SI-INF-009 | Broadcast Announcement Composer | desktop-primary | Brand Owner (brand) |
| SI-INF-010 | Reverse / Cancel Confirmation Pattern | responsive-equal | All roles |

---

#### SI-INF-001 — Unified Approval Inbox

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Other roles (scope: per role; sees only items routed to that role)

**Purpose:**
Aggregate every pending approval routed to the current user across all modules into a single triageable inbox with bulk-approve support and scope-filtered views.

**Data displayed:**
- Inbox list of approval cards, each showing: source module (Procurement / Inventory / Recipe / Production / Dispatch / User / etc.), entity type and reference, requesting user, requested-at timestamp, value or threshold band, current chain step, route reason (auto-routed by threshold vs delegation)
- Per-card status pill (Pending / Pending — Awaiting Prior Step / Pending — Delegated)
- Bulk-select checkboxes (for confidence-rated routine actions)
- Filter chips: scope (brand / cluster / location), module, value band, age band, originating user
- Counters: total pending, pending > 24h, pending > 72h
- Empty state when inbox is clear

**User actions:**
- Filter by module, scope, value band, age, originator
- Open a card to view source entity detail (drill-down to source-screen route, e.g. PO detail)
- Approve a single card (sub-affordance, optional comment)
- Reject a single card (mandatory reason code)
- Bulk-approve multiple selected cards (single confirm dialog summarising count and combined value)
- Delegate to another user (sub-affordance, mandatory reason code and target user picker)
- Open audit trail for the underlying entity

**Cross-cutting:**
CC-APPROVAL-INBOX-CARD, CC-AUDIT-LINK, CC-DASHBOARD-TILE (inbox count surfaces as a tile on morning-briefing dashboards)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_approval, primary, on_primary, outline_variant, warning (>24h band), error (>72h band)

**Source FRs:**
FR16 (route approval requests through configurable chains with threshold-based routing and delegation), FR17 (unified approval inbox across all modules; bulk approval capability)

**Source journey(s):**
Brand Owner — daily approval inbox triage (digest lines 18-25, including PO approvals above threshold and bundled cross-cluster transfer approvals); Cluster Manager — cluster-scoped approval inbox triage (digest lines 27-36, "clears 3 routine material requisitions in bulk action; confirms 1 unusual semi-product transfer with Kitchen Manager call")

**Related screens:**
parent: SI-RPT-002 (Brand Owner cross-location dashboard tile drills into this inbox — ID assigned in Task 12), drill-down: source-entity detail screens across every transactional epic (PO detail SI-PUR-### in Task 5, requisition SI-INV-### in Task 4, recipe SI-REC-### in Task 6, etc.), drill-down: SI-INF-005 (audit trail viewer for entity history)

**Notes:**
This is the canonical anchor for the `CC-APPROVAL-INBOX-CARD` pattern (defined in §3). Other epics never re-implement an approval queue — they rely on this inbox to surface their entities. Mobile variant collapses card detail to title plus value plus age, with swipe-to-approve and swipe-to-reject affordances; desktop variant is the wider data-grid with checkbox column. Bulk-approve is gated to "confidence-rated routine actions" only (e.g. routine material requisitions under cluster-defined threshold) per digest line 30; high-value items always require single-action confirm. Delegation invokes the FR16 chain configuration (see SI-INF-002). Honours P2B-002 indirectly — paired Brand-Store-routed transfer bundles arrive here as a single bundled `CC-PAIRED-TRANSFER-BUNDLE` card, not as two unrelated approval items.

---

#### SI-INF-002 — Approval Chain Configuration

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Configure approval chains per entity type, defining threshold bands, approver roles per band, and delegation rules used by the routing engine.

**Data displayed:**
- List of entity types with approval chains (Purchase Order, Material Requisition, Stock Transfer, Recipe Default Change, Inventory Adjustment, B2B Customer Credit Limit, etc.)
- Per chain: ordered steps with role (or named user), value-band conditions, escalation timeout, fallback delegate
- Per step: routing reason summary (e.g. "PO value > ₹50,000 → Brand Owner")
- Chain status (Active / Draft)
- Last-modified user and timestamp

**User actions:**
- Search chains by entity type
- Create new chain → form with entity type, ordered steps, value-band selector per step, escalation timeout, fallback delegate
- Edit existing chain (reorder steps, adjust thresholds, change approver role, set fallback)
- Save as draft (chain is staged but not active)
- Activate / deactivate chain
- View change history for a chain (drill-down to audit timeline)

**Cross-cutting:**
CC-DRAFT-PILL, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_confirmed (Active), surface_container_high (Inactive), primary, outline_variant

**Source FRs:**
FR16 (route approval requests through configurable approval chains with threshold-based routing and delegation)

**Source journey(s):**
Brand Owner — admin/setup surface invoked at brand onboarding to define routing thresholds (e.g. PO ≥ ₹50,000 routes to Brand Owner per digest line 22) and revisited when thresholds shift or new entity types are added

**Related screens:**
sibling: SI-INF-001 (the inbox where chains take effect), drill-down: SI-INF-005 (audit trail of chain changes)

**Notes:**
Per §7 granularity rule, this is a route-bearing admin form with ≥3 editable fields plus its own draft state. Threshold bands are entity-specific (PO value in INR, requisition quantity vs PAR multiple, recipe cost-impact %, etc.). Delegation chain is consumed by FR17 inbox routing logic. Chain changes write to the audit trail (FR20). Brand-Owner-only role per RBAC (FR12 — see §5).

---

#### SI-INF-003 — Notification Preferences

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per-user; each user manages own preferences)

**Purpose:**
Let each user configure which notification categories deliver in-app, which deliver via email, and which suppress entirely.

**Data displayed:**
- Per-category rows (Approval requests, Approval decisions, Variance alerts, Override flags, Expiry warnings, Issue ticket assignments, Broadcast announcements, Audit alerts, Data quality alerts, Integration status, etc.)
- Per category: in-app toggle, email toggle, digest-batching toggle (if eligible)
- Quiet-hours window (start time, end time; in-app banners suppressed during window, email batched for delivery after)
- Email override list (recipients beyond own email, optional)

**User actions:**
- Toggle in-app delivery per category
- Toggle email delivery per category
- Toggle digest-batching per category
- Set quiet-hours window
- Save preferences (immediate effect, no draft state needed)
- Reset to role-default preferences

**Cross-cutting:**
CC-AUDIT-LINK (preference changes are audit-logged)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (enabled), surface_container_high (disabled), primary, outline_variant

**Source FRs:**
FR18 (send notifications through configurable channels — in-app primary, email secondary — with user preferences)

**Source journey(s):**
All roles — background admin surface visited occasionally to tune signal/noise (no specific operational journey moment but every role lands here at onboarding to set defaults; Brand Owner and Finance Manager revisit when month-end pressure pushes them to enable email digests)

**Related screens:**
sibling: SI-INF-004 (digest preview, where digest-batched categories render)

**Notes:**
Per-user, not per-role; FR12 RBAC scope is "self only" so any user may edit own preferences. Role-default presets are seeded at user creation (e.g. Kitchen Manager defaults: in-app on for variance, off for broadcast). Quiet-hours suppress in-app banners but every notification still lands in the inbox (FR17) for retrieval. Phase-2c gap candidate: no token currently distinguishes "muted/quiet-hours" state from "disabled" state — may need a separate visual treatment in DESIGN.md §6.

---

#### SI-INF-004 — Notification Digest Preview

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per-user; each user previews own digest)

**Purpose:**
Show the user the next pending notification digest as it will arrive, including batched non-urgent items and any escalations triggered by unacknowledged urgent items.

**Data displayed:**
- Next-digest header: scheduled delivery time, channel (in-app / email), category breakdown
- Digest body: grouped notifications per category (Approvals, Variances, Issue Tickets, etc.) with summary count and per-item reference
- Escalation section: items overdue beyond per-category timeout, with escalation target user and trigger reason
- Empty state when no items are batched

**User actions:**
- Switch between "next digest" and "previous digests" (read-only history)
- Open a notification item to its source screen
- Acknowledge an escalated item to clear escalation
- Trigger immediate digest delivery (sub-affordance, useful for testing preferences)

**Cross-cutting:**
CC-AUDIT-LINK (digest delivery and escalation events recorded)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_approval, warning (escalation-eligible items), error (escalated items), outline_variant

**Source FRs:**
FR19 (batch non-urgent notifications into digests; escalate unacknowledged per timeout rules)

**Source journey(s):**
All roles — Brand Owner and Cluster Manager preview before tuning preferences (digest is the alternative to inbox-flooding); other roles invoke rarely but value the preview when first enabling digest mode

**Related screens:**
sibling: SI-INF-003 (preferences feed digest composition), drill-down: source-entity screens across every epic via inline notification links

**Notes:**
Digest composition is service-layer (FR19 batching rules driven by FR18 preferences); this screen surfaces the resulting state. Escalation timeout is per-category (e.g. approval requests escalate after 24h, variance alerts after 4h). Escalation target is defined in the underlying chain (SI-INF-002 fallback delegate field) for approval items, or to the next-up role in the org hierarchy for non-approval items. Mobile variant compresses to a scroll-list of category sections with collapsible groups.

---

#### SI-INF-005 — Audit Trail Viewer

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Finance Manager (scope: brand)

**Purpose:**
Browse the append-only audit trail across entities and surface before/after snapshots, filterable by entity, user, action type, or date range, with structured export support.

**Data displayed:**
- Audit event list, each row showing: timestamp, actor user, action type (Create / Update / Delete-blocked / Approve / Reject / Override / Reverse / Cancel / Prefill-applied), entity type and reference, brief change summary
- Selected event detail panel: before snapshot vs after snapshot diff (field-by-field), actor, IP address (if captured), originating screen
- Filter chips: entity type, actor, action type, date range, scope
- Counters: total events in window, override events, reverse/cancel events, prefill events
- Export button (CSV / Excel / PDF)

**User actions:**
- Filter by entity type, actor, action type, date range, scope
- Search events by entity reference (e.g. PO number, requisition ID)
- Open event row to see before/after diff
- Drill-down to current state of the underlying entity
- Export filtered audit slice (sub-affordance, format selector CSV / Excel / PDF)
- Open Activity Timeline filter for one entity to see chronological view

**Cross-cutting:**
CC-AUDIT-LINK (this screen IS the audit-link target for every other surface in the system), CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_overridden (override events), status_cancelled (cancel events), status_returned (reverse events), warning (delete-blocked events), outline_variant

**Source FRs:**
FR20 (append-only audit trail with before/after snapshots; UPDATE and DELETE blocked at DB level — read-only audit views), FR24 (export audit-trail data in CSV / Excel / PDF for internal/management audit)

**Source journey(s):**
Brand Owner — variance investigation drill-down from morning dashboard (digest line 21 — investigation tagging routed through audit references); Cluster Manager — variance investigation drill-down (digest line 32 — "drills through production output → dispatch challans → POS receipts → POS sales → closing inventory count" lands on audit events at each hop); Finance Manager — month-end audit support and integration-status reconciliation

**Related screens:**
sibling: SI-INF-006 (activity timeline — same data, entity-scoped instead of cross-entity), parent for: every transactional screen across Epics 1-12 that exposes a `CC-AUDIT-LINK` chip drilling here

**Notes:**
This screen is the destination for every `CC-AUDIT-LINK` reference across the inventory; it is the canonical viewer for FR20. Append-only contract is enforced at the DB layer (UPDATE and DELETE blocked); the UI is read-only by design. Prefill events are visible here (FR113 — see Notes on the framework decision below); auditors and Brand Owners can see when a form value originated from prefill vs explicit entry. Export uses the standard `CC-EXPORT-TRIGGER` pattern with format selector. Forms-prefill (FR113) framework decision: no dedicated SI-INF screen — `CC-PREFILL` is referenced wherever forms apply it (Epics 4-10), and prefill events surface here in the audit trail per row. This avoids creating a pattern-reference screen for what is essentially a service-layer behaviour with no user-facing route.

---

#### SI-INF-006 — Activity Timeline Reference

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per role; sees timeline for entities in own scope)

**Purpose:**
Document the canonical chronological per-entity timeline pattern that is embedded inside every entity-detail screen across Epics 1 through 12.

**Data displayed:**
- Timeline header: entity type, entity reference, current status pill
- Chronological event list (oldest at bottom or top per persona): timestamp, actor, action type, brief change description, optional inline before/after diff
- Status-change events highlighted with status-token pills (Draft → Pending GR → Confirmed → In Progress → Completed)
- Override events highlighted with `status_overridden` pill and reason code
- Reverse / cancel events highlighted with `status_returned` or `status_cancelled` pill
- Inline link from each event to full audit detail (drills to SI-INF-005)

**User actions:**
- Scroll chronologically through events
- Open an event for full detail (drills to SI-INF-005 filtered to that event)
- Filter by action type within the timeline
- Copy entity reference / TRN to clipboard
- (When embedded on a detail screen) collapse / expand the timeline section

**Cross-cutting:**
CC-AUDIT-LINK, CC-TRN-DISPLAY (TRN visible on every status-change event for financially significant entities)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, status_pending_gr, status_confirmed, status_in_progress, status_completed, status_overridden, status_cancelled, status_returned, outline_variant

**Source FRs:**
FR21 (activity timeline per entity showing chronological history)

**Source journey(s):**
Brand Owner and Cluster Manager — variance investigation (digest lines 21 and 32 — timeline is the visual representation when drilling through the chain of events on a variance); All roles — entity context lookup (every detail screen shows this timeline as a section)

**Related screens:**
sibling: SI-INF-005 (full audit viewer; timeline drills here for cross-entity context), embedded on: every entity-detail screen across Epics 1-12 (SI-MDM-### Product detail, SI-PUR-### PO detail, SI-INV-### GR detail, SI-PRO-### Production Order detail, SI-DSP-### Challan detail, SI-ACC-### Journal detail, etc. — IDs assigned in Tasks 4-12)

**Notes:**
This is a pattern-reference entry, not a standalone route the user navigates to directly. Activity timelines are embedded as a section inside entity-detail screens across every transactional epic; this entry documents the canonical structure (chronological event list with status-token pills, actor, action, optional diff, drill-down to SI-INF-005). When user clicks "View full audit history" on an embedded timeline, navigation lands on SI-INF-005 filtered to the current entity. Timeline data is sourced from the same append-only audit table as SI-INF-005 (FR20); FR21 specifies the per-entity chronological view as a distinct UI surface but the underlying contract is identical.

---

#### SI-INF-007 — Issue Ticket List

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per role; sees tickets in own scope or assigned to self)

**Purpose:**
Browse, filter, and triage all internal issue tickets with their status, priority, assignee, and reference number for the current scope.

**Data displayed:**
- Ticket list rows: reference number (system-generated `ISS-YYYY-SEQ`), title, status (Open / In Progress / Pending Info / Resolved / Closed), priority (Low / Medium / High / Critical), assignee, originator, age, last-updated timestamp, linked entity (if any)
- Filter chips: status, priority, assignee, originator, scope (brand / cluster / location), linked-module (Inventory / Procurement / Production / Dispatch / POS / Finance / Other)
- Counters: open tickets, overdue tickets, critical-priority open
- Bulk-action checkboxes (assign, close, prioritise)

**User actions:**
- Filter and search tickets
- Open ticket → drill-down to SI-INF-008 in view/edit mode
- Create new ticket → routes to SI-INF-008 in create mode
- Bulk-assign multiple tickets to a user
- Bulk-update priority or status
- Sort by age, priority, last update
- Export filtered ticket list (sub-affordance)

**Cross-cutting:**
CC-ISSUE-TICKET-LINK (every transactional screen across the system carries an affordance to "Open issue against this entity" that lands in SI-INF-008 with the entity pre-linked, then surfaces back here), CC-AUDIT-LINK, CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_pending_approval (Open), status_in_progress (In Progress), surface_container_high (Pending Info — interim; see Notes), status_completed (Resolved), status_closed (Closed), error (Critical priority), warning (High priority), outline_variant

**Source FRs:**
FR22 (create, assign, track, resolve internal issue tickets with unique reference numbers, status, priority)

**Source journey(s):**
Brand Owner — variance investigation assignment to Cluster Manager via issue tracker (digest line 21); Cluster Manager — issue tracker assignment and resolution within 4 hours (digest line 33); POS Staff — discount variance flagging by raising ticket for Cluster Manager review (POS journey discount-flag moment); All roles — secondary daily-use surface alongside approval inbox

**Related screens:**
drill-down: SI-INF-008 (ticket create / edit / view), drill-down: SI-INF-005 (audit history of a ticket), embedded references from: every transactional screen across Epics 1-12 carrying a `CC-ISSUE-TICKET-LINK`

**Notes:**
Granularity decision per §7: list and create/edit are SEPARATE route-bearing screens (SI-INF-007 list, SI-INF-008 form) because the form has ≥3 editable fields, owns its own draft state, and is invoked from many entry points (list, entity-detail screens via `CC-ISSUE-TICKET-LINK`, dashboards). A modal would have hidden the multi-entry-point usage. Reference number format `ISS-YYYY-SEQ` is auto-generated at create. Linked-entity field stores TRN/ID of the entity the ticket is about (PO number, challan ID, requisition ID, etc.); when linked, ticket appears as a chip on the entity-detail screen. Phase-2c gap candidate: dedicated `status_waiting_info` token; currently mapped onto `surface_container_high` as an interim greyed/inactive pill for the Pending Info ticket state (`status_pending_gr` is reserved for production-order/GR context per DESIGN.md §6.1 and must not be reused here).

---

#### SI-INF-008 — Issue Ticket Create / Edit

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per role; create permitted to all, edit gated by ownership or role)

**Purpose:**
Create a new issue ticket or edit an existing one to capture title, description, priority, assignee, linked entity, and resolution notes.

**Data displayed:**
- Reference number (read-only, auto-generated on create)
- Title field (mandatory)
- Description field (multi-line, supports inline image attachments)
- Priority selector (Low / Medium / High / Critical)
- Status selector (Open / In Progress / Pending Info / Resolved / Closed)
- Assignee picker (user search)
- Linked-entity picker (optional; type + reference, e.g. "PO PUR-2026-CKA-000123")
- Originator (read-only, set at create)
- Comments thread (chronological, with timestamp and author per comment)
- Attachments (files, photos)
- Audit metadata: created at, last modified at, last modified by

**User actions:**
- Save as draft (form persists as `status_draft` until submit)
- Submit to create / open ticket
- Edit fields (title, description, priority, assignee, status, linked entity)
- Add comment to thread
- Attach file
- Reassign to another user (sub-affordance, mandatory comment)
- Change status (Open → In Progress → Pending Info / Resolved → Closed)
- Cancel draft

**Cross-cutting:**
CC-DRAFT-PILL, CC-AUDIT-LINK, CC-PREFILL (when invoked via `CC-ISSUE-TICKET-LINK` from an entity-detail screen, linked-entity field is pre-filled with that entity's reference)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_pending_approval (Open), status_in_progress, primary, on_primary, outline_variant

**Source FRs:**
FR22 (create, assign, track, resolve internal issue tickets with unique reference numbers, status, priority), FR113 (forms-prefill framework — linked-entity field pre-populated via CC-PREFILL when ticket is opened from an entity-detail screen via CC-ISSUE-TICKET-LINK)

**Source journey(s):**
Brand Owner — variance investigation assignment (digest line 21); Cluster Manager — recording findings on variance and updating status (digest line 33); POS Staff — raising discount-anomaly ticket; All roles — entity-anchored ticket creation via `CC-ISSUE-TICKET-LINK` from any transactional screen

**Related screens:**
parent: SI-INF-007 (list), drill-down: SI-INF-005 (audit timeline of ticket changes), referenced from: linked-entity screens across all epics

**Notes:**
Per §7 granularity rule, this is route-bearing because the form has ≥3 editable fields, owns a draft state, and is invoked from many entry points. `CC-PREFILL` applies when entry point is `CC-ISSUE-TICKET-LINK` from an entity screen — linked-entity field pre-populated; user can clear or override. Status transitions are write-audit (each change captured per FR20). Resolved → Closed transition gated to originator or Brand Owner per RBAC convention (final lock prevents drift on closed tickets).

---

#### SI-INF-009 — Broadcast Announcement Composer

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Compose and dispatch a broadcast announcement to all locations or to a chosen scope subset, with scheduling and acknowledgement tracking.

**Data displayed:**
- Composer form: title, body (rich text), urgency (Info / Important / Critical), target scope (Brand / specific Clusters / specific Locations / specific Roles), scheduled delivery time (optional; defaults to immediate), acknowledgement-required toggle
- Preview pane rendering announcement as recipients will see it
- History list of past announcements: title, sent-at, target scope, urgency, acknowledgement count vs target count
- Per-history-row drill-down to acknowledgement detail

**User actions:**
- Save as draft
- Compose new announcement → fill form → preview → schedule or send immediately
- Edit a draft (drafts only; sent announcements are immutable)
- Cancel a scheduled announcement before send time
- View acknowledgement detail for a sent announcement (who has / has not acknowledged)
- Re-broadcast (sub-affordance: pre-fills new composer with prior announcement content)

**Cross-cutting:**
CC-DRAFT-PILL, CC-AUDIT-LINK, CC-PREFILL (re-broadcast pre-fills from prior announcement)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_pending_approval (scheduled), status_completed (sent), warning (Important urgency), error (Critical urgency), primary, on_primary, outline_variant

**Source FRs:**
FR23 (broadcast announcements to all locations)

**Source journey(s):**
Brand Owner — admin/setup surface used at policy changes, compliance updates, brand-wide events (e.g. menu launch, tax-rate change, holiday closures); occasional but high-impact when invoked

**Related screens:**
sibling: SI-INF-005 (audit history of broadcasts), drill-down: per-announcement acknowledgement detail (handled inline; not a separate route)

**Notes:**
Brand-Owner-only per RBAC (FR12 — see §5). Acknowledgement-required toggle drives whether recipients see a "must acknowledge" banner that blocks dismissal; useful for compliance announcements. Sent announcements are immutable (FR20 / FR117 — once sent, correction is a new announcement, not an edit). Urgency drives the recipient-side banner styling (Info = surface_tint, Important = warning, Critical = error). Mobile variant for the composer is deprioritised (Brand Owner desktop primary); recipient view is responsive (mobile reads announcements via in-app banner).

---

#### SI-INF-010 — Reverse / Cancel Confirmation Pattern

**Primary epic:** Epic 3 — Shared Infrastructure

**Primary device:** responsive-equal

**Roles & scope:**
- All roles (scope: per role; reverse / cancel permitted only on entities the role can edit and only in pre-confirmed states)

**Purpose:**
Document the canonical reverse-or-cancel confirmation flow that every transactional screen invokes when the user attempts to undo a pre-confirmed entity or compensate a confirmed one.

**Data displayed:**
- Confirmation dialog header: action type (Cancel — pre-confirmed / Reverse — pre-confirmed / Compensating Document — post-confirmed)
- Entity summary: entity type, reference, current status pill, value (if financial)
- Action explanation: for pre-confirmed, "this entity is in Draft / Pending GR / Pending Approval and may be cancelled cleanly"; for post-confirmed, "this entity is Confirmed and cannot be cancelled — proceeding will create a compensating document with its own TRN"
- Mandatory reason code field
- Compensating-document preview (when applicable): document type that will be created (Credit Note / Adjustment / Reversal Journal), draft TRN, value impact
- Confirm / Cancel-confirm buttons

**User actions:**
- Enter mandatory reason code
- Confirm reverse / cancel (pre-confirmed path: status moves to Cancelled; post-confirmed path: compensating document is created in draft state, navigation routes to that document for further edit)
- Cancel the confirmation (returns to source entity unchanged)

**Cross-cutting:**
CC-REVERSE-CANCEL (this screen IS the canonical pattern reference for `CC-REVERSE-CANCEL`), CC-AUDIT-LINK (every confirm writes an audit event), CC-TRN-DISPLAY (compensating-document path shows draft TRN)

**Tokens (DESIGN.md):**
surface, surface_container_low, surface_container, on_surface, on_surface_variant, status_cancelled (pre-confirmed cancel preview), status_returned (post-confirmed reversal preview), warning (post-confirmed warning band), error (irrecoverable warning if applicable), primary, on_primary, outline_variant

**Source FRs:**
FR117 (reverse or cancel transactions before confirmed status — Draft / Pending GR PO cleanly cancellable; once confirmed, correction path is always a compensating document with own TRN)

**Source journey(s):**
Finance Manager — credit-note creation against dispatched B2B challan (digest line 54 — conditional two-stage reversal); Procurement Manager — cancelling a Draft PO before sending to vendor; Kitchen Manager — cancelling a Draft production order; All roles — every transactional surface triggers this confirmation when reverse / cancel is attempted

**Related screens:**
sibling: SI-INF-005 (audit history captures every reverse / cancel), invoked from: every transactional screen across Epics 4-10 (PO list/detail SI-PUR-### in Task 5, Production Order detail SI-PRO-### in Task 7, B2B Challan detail SI-DSP-### in Task 8, Manual Journal SI-ACC-### in Task 10, etc.)

**Notes:**
This is a pattern-reference entry, not a standalone route the user navigates to. The reverse / cancel affordance lives on each transactional entity-detail screen; clicking it opens this confirmation flow as a modal or inline dialog. The two paths (pre-confirmed clean cancel vs post-confirmed compensating document) are determined by the entity's current status against the canonical lifecycle (DL-001 PO 5-status lifecycle for procurement; B2B challan lifecycle in `04-b2b-challan-spec.md` §3). Service-layer enforces immutability (FR20 append-only, FR117); the UI reflects the resulting state. Compensating-document creation routes to the appropriate entity-detail screen in draft state for further edit (Credit Note SI-DSP-### in Task 8, Adjustment SI-INV-### in Task 4, Manual Journal SI-ACC-### in Task 10). Honours FR117's transaction-immutability rule end-to-end: cleanable states are pre-confirmed only.

### Epic 4 — Inventory Management (INV)

Inventory Management is the operational heart of the F&B ERP and the heaviest epic by screen count. It surfaces real-time stock visibility for every department, drives goods receipt against POs and transfers, governs stock transfers between locations and departments, runs the daily closing inventory routine at POS and Dispatch, and surfaces expiry countdowns with cross-location suggestions to convert stock that would otherwise write off as expiry into productive movement. Every data-entry surface is durability-sensitive, so the draft-pill universality pattern is honoured throughout, and the cross-cluster reallocation flow is first-class as a paired Brand-Store-routed bundled approval — visible to the user, not hidden as an implementation detail — rather than two unrelated transfers. Two service-layer-only enforcers — the directional product-type flow and FEFO deduction order — sit in the service layer (see §5) and are cross-referenced from the Notes of the screens whose UI surfaces them indirectly; the expiry-suggestion split between single-hop within-cluster and paired cross-cluster paths is carried end-to-end through the dashboard and suggestion screens.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-INV-001 | Real-Time Stock View | mobile-first | Kitchen Manager (department), Store Manager (location), Cluster Manager (cluster), Brand Owner (brand) |
| SI-INV-002 | Department Stock Detail | responsive-equal | Kitchen Manager (department), Store Manager (location), Cluster Manager (cluster) |
| SI-INV-003 | Below-PAR Flag List | responsive-equal | Procurement Manager (brand/cluster), Store Manager (location), Kitchen Manager (department) |
| SI-INV-004 | PAR Level Configuration | desktop-primary | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location) |
| SI-INV-005 | Stock Transfer Create | mobile-first | Store Manager (location), Kitchen Manager (department) |
| SI-INV-006 | Stock Transfer Detail & Status | responsive-equal | Store Manager (location), Kitchen Manager (department), Cluster Manager (cluster) |
| SI-INV-007 | Paired Brand-Store Cross-Cluster Transfer | desktop-primary | Cluster Manager (cluster), Brand Owner (brand) |
| SI-INV-008 | Expiry Countdown Dashboard | responsive-equal | Cluster Manager (cluster), Store Manager (location), Brand Owner (brand) |
| SI-INV-009 | Cross-Location Transfer Suggestions | responsive-equal | Cluster Manager (cluster), Brand Owner (brand) |
| SI-INV-010 | Goods Receipt Entry — PO-Driven | mobile-first | Store Manager (location) |
| SI-INV-011 | Goods Receipt Entry — Transfer-Driven | mobile-first | Store Manager (location), Kitchen Manager (department) |
| SI-INV-012 | Goods Receipt Rejection at QC | mobile-first | Store Manager (location) |
| SI-INV-013 | Inventory Adjustment | responsive-equal | Store Manager (location), Kitchen Manager (department), Cluster Manager (cluster) |
| SI-INV-014 | Closing Inventory Entry — POS Daily | mobile-first | POS Staff (location) |
| SI-INV-015 | Closing Inventory Entry — Dispatch Daily | mobile-first | Dispatch Staff (location) |
| SI-INV-016 | Closing Inventory Cluster Review | desktop-primary | Cluster Manager (cluster), Brand Owner (brand) |

---

#### SI-INV-001 — Real-Time Stock View

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Kitchen Manager (scope: department)
- Store Manager (scope: location)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Surface real-time stock-on-hand for any item at any location and department within 30 seconds of the underlying movement.

**Data displayed:**
- Filter chips: scope (department / location / cluster / brand), product type (raw / semi / final), category, expiry band (24h / 48h / 72h / >72h)
- Item rows: item name, UOM, on-hand quantity, expiry-soonest batch date, PAR level, below-PAR pill if applicable, last-updated timestamp
- Aggregate counters: total items in scope, items below PAR, items with batches in 72h expiry band
- Search-by-item input
- Empty state when no items match filter

**User actions:**
- Filter by scope, product type, category, expiry band
- Search items by name or category
- Tap item row to drill into Department Stock Detail (SI-INV-002)
- Pull-to-refresh on mobile to re-query (the 30-second freshness rule is service-side; the pull is a user trust gesture)

**Cross-cutting:**
CC-DASHBOARD-TILE (counters surface as tiles on morning-briefing dashboards), CC-DATA-QUALITY-ALERT (deactivated-item rows flagged inline)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_provisional (Pending-GR-derived stock), warning (72h expiry band), error (24h expiry band), outline_variant

**Source FRs:**
FR25 (real-time stock view for any item × any location/department within 30 seconds), FR113 (forms pre-fill — filter state pre-fills from user's last session)

**Source journey(s):**
Store Manager — "views real-time stock levels for 45 raw materials in Cluster Store A" (digest line 80); Kitchen Manager — "views real-time stock levels, 3 items below PAR" on morning briefing (digest line 39); Cluster Manager — variance investigation drill-down begins from real-time stock (digest line 32)

**Related screens:**
drill-down: SI-INV-002 (department stock detail), drill-down: SI-INV-008 (expiry countdown dashboard for items in expiry bands), sibling: SI-INV-003 (below-PAR flag list filtered subset)

**Notes:**
Read-only surface — no data entry, so `CC-DRAFT-PILL` does not apply. Mobile-first because the primary use cases are on the production floor and store receiving area where staff carry phones. Desktop variant is a wider data grid with column sorting. The 30-second freshness rule (FR25) is enforced at the service layer; the screen indicates the last-updated timestamp per row so users know whether they're looking at a stale view. PROVISIONAL badge per `CC-PROVISIONAL-FLAG` appears on rows whose stock is derived from a Pending-GR PO (FR66) — handled centrally in the row component. Service-layer cross-ref: FR28 (three-product-type directional flow) governs which transfer destinations are valid downstream from this screen — see §5.

---

#### SI-INV-002 — Department Stock Detail

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: department)
- Store Manager (scope: location)
- Cluster Manager (scope: cluster)

**Purpose:**
Show full per-batch stock detail for a single item at a single department including batch-level expiry dates and movement history.

**Data displayed:**
- Item header: name, category, UOM, default standard yield factor, shelf-life policy
- Department + location context
- Batch table (FEFO-ordered): batch reference, received date, expiry date, expiry band pill, on-hand quantity, source GR or transfer reference, provisional flag if applicable
- Aggregate: total on-hand, PAR level, below-PAR pill if applicable
- Movement history (last 30 days): timestamp, movement type (receipt / consumption / transfer-in / transfer-out / adjustment / closing-variance), quantity delta, reference TRN

**User actions:**
- View movement history detail (drill-down to source transactional screen)
- Initiate stock transfer from this department (sub-affordance routes to SI-INV-005 with item + source pre-filled)
- Initiate inventory adjustment for a specific batch (sub-affordance routes to SI-INV-013 with item + batch pre-filled)
- Open audit timeline (drill-down to SI-INF-006 activity timeline)

**Cross-cutting:**
CC-AUDIT-LINK, CC-PROVISIONAL-FLAG (per provisional batch), CC-PREFILL (transfer / adjustment sub-affordances pre-fill from this context)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_provisional, status_variance_flagged (movement-history rows with variance), warning (72h expiry band), error (24h expiry band), outline_variant

**Source FRs:**
FR25 (real-time stock for any item × any location/department), FR30 (expiry tracking with batch-level visibility), FR113 (sub-affordance pre-fill)

**Source journey(s):**
Cluster Manager — variance investigation drill-down through production output, dispatch challans, POS receipts, POS sales, closing inventory (digest line 32); Store Manager — stock visibility supports dependent planning without phone calls (digest line 86)

**Related screens:**
parent: SI-INV-001 (real-time stock view), sibling: SI-INV-005 (initiate transfer), sibling: SI-INV-013 (initiate adjustment), drill-down: SI-INF-006 (audit timeline), drill-down: source GR / transfer / closing-inventory screens via movement history

**Notes:**
Batches are listed in FEFO order to mirror the deduction order applied by `inventoryService.deductStock()`. Service-layer cross-ref: FR31 (FEFO ordering inside `inventoryService.deductStock()`) — see §5; the UI mirrors but does not enforce that order. Movement-history rows that exceed implausibility thresholds are tagged via `CC-IMPLAUSIBILITY-WARN` at source-screen save time and surface here with the `status_variance_flagged` token.

---

#### SI-INV-003 — Below-PAR Flag List

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Store Manager (scope: location)
- Kitchen Manager (scope: department)

**Purpose:**
Surface items currently below their PAR level with suggested reorder quantities to drive procurement and requisition action.

**Data displayed:**
- Filter chips: scope (department / location / cluster / brand), product type, category, urgency (below 50% PAR / below PAR / approaching PAR)
- Item rows: item name, UOM, current on-hand, PAR level, PAR shortfall, suggested reorder quantity, day-of-week-adjusted PAR if applicable, last-PO reference
- Aggregate counters: total items below PAR, items below 50% PAR, items already on open PO
- "Already on open PO" indicator on rows where a procurement order is in flight

**User actions:**
- Filter by scope, product type, urgency
- Tap row to drill into item detail (SI-INV-002) or directly initiate PO creation (sub-affordance routes to SI-PUR-### create PO with item pre-filled — ID assigned in Task 5)
- Tap row to initiate material requisition (sub-affordance routes to SI-INV-005 transfer create with source = serving Brand/Cluster Store)
- Bulk-select rows for combined PO drafting (Procurement Manager only)

**Cross-cutting:**
CC-DASHBOARD-TILE (below-PAR count surfaces as a tile on Procurement Manager / Kitchen Manager morning-briefing dashboards), CC-PREFILL (PO and requisition sub-affordances pre-fill quantities from PAR-shortfall calculation per FR113)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, warning (below PAR), error (below 50% PAR), success (already on open PO), outline_variant

**Source FRs:**
FR34 (flag items below PAR; suggest reorder quantities), FR33 (PAR levels with day-of-week adjustments — surfaced here as the basis for the shortfall calculation), FR113 (suggested reorder quantity pre-fills PO / requisition draft)

**Source journey(s):**
Procurement Manager — "views 5 items below PAR across 3 locations" on morning dashboard (digest line 69); Kitchen Manager — "3 items below PAR" on morning briefing (digest line 39); POS Staff — "submits next-day product request to Central Kitchen A — bread loaves running thin" (digest line 95)

**Related screens:**
parent: SI-INV-001 (real-time stock view — this is a filtered subset), drill-down: SI-INV-002 (item detail), sibling: SI-PUR-### PO create with PAR pre-fill (ID assigned in Task 5), sibling: SI-INV-005 (transfer create for inter-department fulfilment)

**Notes:**
Read-only listing — `CC-DRAFT-PILL` does not apply. The day-of-week-adjusted PAR (FR33) is computed by the service layer; the screen displays the adjusted figure inline alongside the base PAR for transparency. Drift detection that updates PAR levels themselves (FR111) is owned by Epic 12 and surfaces in SI-RPT-### PAR Drift Recommendations (ID assigned in Task 12); this screen reflects the current configured PAR only.

---

#### SI-INV-004 — PAR Level Configuration

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)

**Purpose:**
Define and edit PAR levels per item per location with optional day-of-week adjustments to drive below-PAR flagging and reorder suggestions.

**Data displayed:**
- PAR matrix: rows = items in scope, columns = locations / departments in scope
- Per cell: base PAR value, optional day-of-week override grid (Mon–Sun)
- Filter chips: scope, product type, category
- Last-modified user and timestamp per row
- Recommendation badge if Epic 12 PAR drift detection (FR111) has flagged the row

**User actions:**
- Search items by name
- Edit base PAR per cell (mandatory positive integer)
- Open day-of-week override drawer per cell → enter per-day overrides → save
- Bulk-set PAR across selected items / locations (single value)
- Save draft (PAR values auto-save as drafts; non-draft commit on explicit confirm)
- Confirm changes → service-layer activates the new PAR levels
- Apply Epic 12 drift recommendation (sub-affordance accepts the suggested PAR per FR111)

**Cross-cutting:**
CC-DRAFT-PILL (PAR edits stage as draft until confirmed — P2B-001), CC-AUDIT-LINK (every PAR change writes an audit event)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container, on_surface, on_surface_variant, status_draft, status_confirmed, primary, on_primary, outline_variant

**Source FRs:**
FR33 (define PAR levels by item × location with day-of-week adjustments), FR113 (form pre-fills with current PAR values)

**Source journey(s):**
Procurement Manager — PAR-driven below-PAR flagging cascades from PAR configured here (digest line 69); Brand Owner — admin/setup surface for tuning operational thresholds (digest line 18-25)

**Related screens:**
sibling: SI-INV-003 (below-PAR flag list reflects the configured PAR), sibling: SI-RPT-### PAR Drift Recommendations (ID assigned in Task 12 — FR111 drift recommendations originate in Epic 12 and are accepted here)

**Notes:**
This is a ≥3-field data-entry surface with approval-class persistence so it gets its own screen ID per §7. FR111 (PAR drift detection) is primary-Epic-12; recommendations surface here as an accept-or-ignore sub-affordance, but the recommendation engine and reporting view live in Epic 12. Day-of-week overrides are a structurally optional layer — most cells use base PAR only. Honours P2B-001 with `CC-DRAFT-PILL` while edits stage.

---

#### SI-INV-005 — Stock Transfer Create

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Store Manager (scope: location)
- Kitchen Manager (scope: department)

**Purpose:**
Create a stock transfer from a source department or location to a destination with item-by-item quantities, honouring three-product-type flow rules and material enablement.

**Data displayed:**
- Source selector: department or location (defaults to user's home scope)
- Destination selector: filtered by valid destinations per FR28 three-product-type flow rules and per material enablement (FR8)
- Item picker with on-hand quantity per source batch (FEFO-ordered)
- Per-line: item, source batch reference, requested quantity, available quantity, UOM
- Reason code (mandatory for non-routine transfers)
- Implausibility warning banner when any line exceeds available quantity
- Duplicate warning banner when same-day same-source-destination-items transfer already exists
- Single-hop within-cluster suggestion banner when expiry-driven (FR32 suggestions surface here pre-filled — per P2B-004)
- Draft pill when in draft state

**User actions:**
- Pick source and destination
- Add items by search or scan (barcode/QR per FR26)
- Enter quantity per line (voice input supported per FR112)
- Override implausibility / duplicate warning with mandatory reason code
- Save as draft (auto-save)
- Submit transfer → routes through Unified Approval Engine (SI-INF-001) if value or destination triggers approval; otherwise commits and stock decrements at source on confirm

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001 — every transfer is durability-sensitive), CC-IMPLAUSIBILITY-WARN (request > available), CC-DUPLICATE-WARN (same-day duplicate), CC-VOICE-INPUT (quantity fields), CC-PREFILL (last-equivalent-transfer prefill per FR113)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, warning (implausibility / duplicate banner), error (validation failure), primary, on_primary, outline_variant

**Source FRs:**
FR29 (create stock transfers between locations/departments with enablement and flow validation), FR112 (voice input on quantity fields), FR113 (pre-fill from last equivalent transfer), FR114 (implausibility warn-and-log), FR115 (duplicate warn-and-log)

**Source journey(s):**
Store Manager — material requisition processing with enablement check (digest line 81); Store Manager — partial fulfillment handling (digest line 82); Kitchen Manager — partial production order creation creates material requisition for shortfall (digest line 41)

**Related screens:**
sibling: SI-INV-006 (transfer detail / status after submit), sibling: SI-INV-007 (paired Brand-Store cross-cluster transfer for raw materials between clusters), drill-down from: SI-INV-002 (item detail), drill-down from: SI-INV-009 (cross-location suggestions), drill-down from: SI-INV-003 (below-PAR fulfilment), routes to: SI-INF-001 (unified approval inbox when threshold triggers)

**Notes:**
Service-layer cross-ref: FR28 (three-product-type directional flow rules) is enforced at the service layer and surfaces here as destination filtering — raw materials never lateral between clusters (Master Spec §2.2); semi-products lateral within cluster only; final products production → dispatch → POS only. See §5. Single-hop within-cluster transfer is handled inside this screen (sub-affordance — no separate ID per §7); paired Brand-Store cross-cluster transfer for raw materials gets its own screen SI-INV-007 because it carries bundled-approval weight (P2B-002). Honours P2B-001 with `CC-DRAFT-PILL`.

---

#### SI-INV-006 — Stock Transfer Detail & Status

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Store Manager (scope: location)
- Kitchen Manager (scope: department)
- Cluster Manager (scope: cluster)

**Purpose:**
View a single stock transfer's lifecycle status, line items, and audit history with affordances to confirm receipt or initiate reverse / cancel.

**Data displayed:**
- Transfer header: TRN, source, destination, requested-by user, requested-at timestamp, status pill (Draft / Pending Approval / Approved / In Transit / Received / Cancelled)
- Line items: item, requested quantity, fulfilled quantity, source batch references, expiry per batch
- Reason code (if any)
- Approval chain status (if routed)
- Audit timeline link
- Reverse / cancel affordance per current status (delegates to SI-INF-010)
- Issue-ticket link

**User actions:**
- View full transfer record
- Confirm receipt at destination → status moves to Received; stock increments at destination (the destination-side staff often invoke this from a GR-style flow — see SI-INV-011)
- Cancel transfer (pre-confirmed only — invokes SI-INF-010)
- Reverse transfer (post-confirmed — invokes SI-INF-010 compensating-document path)
- Open audit timeline
- Raise issue ticket against this transfer (CC-ISSUE-TICKET-LINK)

**Cross-cutting:**
CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, CC-REVERSE-CANCEL, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, status_in_progress, status_completed, status_cancelled, status_returned, primary, outline_variant

**Source FRs:**
FR29 (stock transfers lifecycle), FR117 (reverse / cancel rule), FR22 (issue tickets), FR87 (TRN display)

**Source journey(s):**
Store Manager — material requisition processing (digest line 81); Cluster Manager — drills through transfer chain during variance investigation (digest line 32)

**Related screens:**
parent: SI-INV-005 (transfer create), sibling: SI-INV-011 (transfer-driven GR confirms receipt at destination), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-010 (reverse / cancel confirmation), drill-down: SI-INF-008 (issue ticket create)

**Notes:**
Read-mostly surface — `CC-DRAFT-PILL` not cited because draft creation lives on SI-INV-005. Reverse / cancel routing follows the canonical FR117 rule: Draft / Pending Approval cleanly cancellable; Approved / In Transit / Received require compensating document via SI-INF-010.

---

#### SI-INV-007 — Paired Brand-Store Cross-Cluster Transfer

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** desktop-primary

**Roles & scope:**
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Initiate a paired Brand-Store-routed transfer bundle that returns stock from a source cluster store to the Brand Store and draws it into a destination cluster store as a single approval object.

**Data displayed:**
- Bundle header: bundle reference, originating cluster, destination cluster, item set, expiry pressure summary
- Pair structure visible (not hidden as implementation detail, per P2B-004 design requirement):
  - Leg 1: Source Cluster Store → Brand Store (return-to-brand)
  - Leg 2: Brand Store → Destination Cluster Store (draw-from-brand)
- Per-leg: line items, quantities, source batch references, expiry per batch
- Source expiry context (e.g. "Cluster B has 80kg tomatoes expiring in 48h")
- Destination consumption context (e.g. "Cluster A can consume 60kg over 36 hours")
- Reason code (mandatory)
- Bundled-approval status pill (single object — both legs approve or reject together)
- Draft pill when in draft state

**User actions:**
- Pick source cluster store (auto-pre-filled when invoked from SI-INV-008 expiry dashboard or SI-INV-009 suggestions)
- Pick destination cluster store
- Select items and quantities (defaults from source-expiry batches and destination-consumption capacity)
- Enter mandatory reason code
- Save as draft
- Submit bundle → routes to Brand Owner as a single bundled approval object via `CC-PAIRED-TRANSFER-BUNDLE` in SI-INF-001
- Cancel draft

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-PAIRED-TRANSFER-BUNDLE (P2B-002 anchor — single bundled approval object covering both legs), CC-APPROVAL-INBOX-CARD (bundle surfaces as one card in the Brand Owner's approval inbox)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed, warning (expiry pressure context), primary, on_primary, outline_variant

**Source FRs:**
FR29 (stock transfers between locations/departments), FR32 (cross-location transfer suggestions including paired Brand-Store-routed option), FR16 (route through Unified Approval Engine)

**Source journey(s):**
Cluster Manager — "initiates paired Brand-Store-routed transfer bundle (return Cluster B tomatoes to Brand Store + draw into Cluster A Store); escalates single approval object to Brand Owner" (digest line 34)

**Related screens:**
parent: SI-INV-008 (expiry countdown dashboard — entry point for expiry-driven invocations), parent: SI-INV-009 (cross-location transfer suggestions — entry point when no within-cluster consumer is viable), drill-down: SI-INF-001 (unified approval inbox where the bundle surfaces), sibling: SI-INV-005 (single-hop within-cluster transfer for the within-cluster case)

**Notes:**
Honours P2B-002 verbatim: this is the screen anchor for `CC-PAIRED-TRANSFER-BUNDLE`. The pair structure is deliberately visible to the user (per P2B-004 design requirement: "the paired structure must be visible to the user, not hidden as an implementation detail, so the §2.2 raw-material flow rule and the Brand Store audit boundary stay legible"). Master Spec §2.2 raw-material rule (raw materials never lateral between clusters — must route via Brand Store) is the underlying constraint. After Brand Owner approval, the bundle decomposes into the two legs which each generate their own transfer TRN and lifecycle, but the approval action is atomic.

---

#### SI-INV-008 — Expiry Countdown Dashboard

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)
- Brand Owner (scope: brand)

**Purpose:**
Surface every batch approaching expiry across the user's scope grouped into 24h / 48h / 72h urgency bands with one-click affordances into the appropriate transfer flow.

**Data displayed:**
- Urgency-band columns or sections: 24h (error), 48h (warning), 72h (tertiary_container accent)
- Per-batch row: item, batch reference, location, department, on-hand quantity, hours-to-expiry countdown, value at risk
- Aggregate counters per band: batches, items, value
- Per-batch suggestion type badge: "Single-hop within-cluster" (when within-cluster consumer viable per FR32) vs "Paired Brand-Store-routed" (when cross-cluster routing via Brand Store is the only viable destination — surfaced via `CC-PAIRED-TRANSFER-BUNDLE` per P2B-004)
- "No suggestion — write off" indicator when neither path is viable
- Filter chips: scope, product type, suggestion type

**User actions:**
- Filter by scope, product type, suggestion type
- Tap row → drill into Cross-Location Transfer Suggestions (SI-INV-009) for that batch
- Tap "Single-hop" badge → initiate transfer pre-filled in SI-INV-005
- Tap "Paired Brand-Store-routed" badge → initiate paired transfer pre-filled in SI-INV-007
- Tap row → drill into batch detail (SI-INV-002) for context

**Cross-cutting:**
CC-DASHBOARD-TILE (band counters surface as tiles on Brand Owner / Cluster Manager morning-briefing dashboards), CC-PAIRED-TRANSFER-BUNDLE (paired-routed suggestions are flagged with this pattern's visual signature so the bundle structure is visible per P2B-004)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, tertiary_container (72h band accent), warning (48h band), error (24h band), primary, outline_variant

**Source FRs:**
FR30 (track expiry dates on perishables with 24h/48h/72h urgency bands), FR32 (cross-location transfer suggestions including single-hop within-cluster vs paired Brand-Store-routed split)

**Source journey(s):**
Brand Owner — morning dashboard shows expiring permission overrides and expiry pressure (digest line 18-25); Cluster Manager — "receives Cluster B tomato expiry alert; checks Cluster A consumption capacity; evaluates within-cluster absorption before escalating to Brand Owner for cross-cluster approval" (digest line 35); POS Staff — expiry-band notification on morning briefing (digest line 88); Kitchen Manager — expiry warning on morning briefing (digest line 39)

**Related screens:**
sibling: SI-INV-009 (cross-location transfer suggestions detailed view), drill-down: SI-INV-005 (single-hop transfer create), drill-down: SI-INV-007 (paired Brand-Store cross-cluster transfer), drill-down: SI-INV-002 (batch detail)

**Notes:**
Honours P2B-004 verbatim: the dashboard distinguishes the two suggestion types — single-hop within-cluster vs paired Brand-Store-routed cross-cluster — and the paired type carries the `CC-PAIRED-TRANSFER-BUNDLE` visual signature so the user sees the bundle structure before initiating. POS Staff sees a single-location filtered view (their own POS) — primarily for sell-first prioritisation per FR30 / FR35 (digest line 91). Read-only surface — `CC-DRAFT-PILL` does not apply to the dashboard itself; draft state lives on the downstream transfer screens.

---

#### SI-INV-009 — Cross-Location Transfer Suggestions

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Present per-batch transfer suggestions ranked by feasibility distinguishing single-hop within-cluster from paired Brand-Store-routed cross-cluster options.

**Data displayed:**
- Source batch context: item, source location, on-hand quantity, hours-to-expiry, value at risk
- Suggestion list ranked by feasibility:
  - Single-hop within-cluster suggestions: destination department/location, expected consumption capacity (from recipe demand × forecast), feasibility score
  - Paired Brand-Store-routed cross-cluster suggestions: destination cluster, expected consumption capacity, feasibility score, bundled-approval requirement note
- "No suggestion viable" empty state with explanation
- Filter chips: suggestion type, urgency band

**User actions:**
- Tap a single-hop suggestion → initiate transfer pre-filled in SI-INV-005
- Tap a paired Brand-Store-routed suggestion → initiate paired bundle pre-filled in SI-INV-007
- Dismiss a suggestion (logged, surfaces in expired-stock retrospective if dismissed batch later writes off)

**Cross-cutting:**
CC-PAIRED-TRANSFER-BUNDLE (paired suggestions are flagged with this pattern per P2B-002 / P2B-004), CC-PREFILL (downstream transfer drafts pre-fill from selected suggestion per FR113)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_provisional, warning (cross-cluster routing context), primary, outline_variant

**Source FRs:**
FR32 (suggest cross-location transfers when stock approaches expiry — single-hop within-cluster or paired Brand-Store-routed), FR30 (expiry tracking surface that feeds suggestions), FR16 (paired suggestions route via Unified Approval Engine)

**Source journey(s):**
Cluster Manager — "expiry-driven cross-location intelligence; checks Cluster A consumption capacity; evaluates within-cluster absorption before escalating to Brand Owner" (digest lines 27-36)

**Related screens:**
parent: SI-INV-008 (expiry countdown dashboard — typical entry point), drill-down: SI-INV-005 (single-hop transfer create), drill-down: SI-INV-007 (paired Brand-Store cross-cluster transfer)

**Notes:**
Suggestion ranking and feasibility scoring are service-layer responsibilities; this screen renders the ranked list. The paired-suggestion path explicitly surfaces the bundled-approval requirement note so the Cluster Manager understands the action escalates as a single bundle to the Brand Owner (P2B-002). Read-only surface — `CC-DRAFT-PILL` does not apply.

---

#### SI-INV-010 — Goods Receipt Entry — PO-Driven

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Store Manager (scope: location)

**Purpose:**
Record goods receipt against an open PO with per-line quantities, yield factors, expiry capture, shelf-life acceptance, and file attachments.

**Data displayed:**
- PO header: PO TRN, vendor, expected delivery date, line items expected
- Per line: item, ordered quantity, previously-received quantity, currently-received quantity (editable), UOM, default standard yield factor (editable per line — FR27), usable quantity (computed), wastage quantity (computed), adjusted cost per unit (computed), expiry date capture (editable), batch reference
- Shelf-life acceptance pill per line: PASS / EXCEPTION (when remaining shelf life < acceptance threshold per FR38)
- Implausibility warning banner when received > 150% of ordered (FR114)
- Duplicate warning banner when same-day GR for same PO already exists (FR115)
- Attachments list (photos, documents — FR39)
- Reject-at-QC affordance (links to SI-INV-012)
- Draft pill when in draft state

**User actions:**
- Open from PO list (parent: SI-PUR-### PO Detail — ID assigned in Task 5) or scan PO barcode
- Enter received quantity per line (voice input supported per FR112; barcode/QR scan supported per FR26)
- Enter or override yield factor per line
- Capture expiry date per line (mandatory for perishables)
- Override shelf-life-exception per line → triggers approval routing through SI-INF-001
- Override implausibility / duplicate warning with mandatory reason code
- Attach photos and documents (FR39)
- Save as draft (auto-save)
- Submit GR → status moves to confirmed (or Pending Approval if shelf-life exception); journal entries fire per FR89; PO progresses per DL-001 lifecycle
- Reject GR at formal QC (sub-affordance routes to SI-INV-012 — per FR47a)

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-VOICE-INPUT (quantity fields per FR112), CC-IMPLAUSIBILITY-WARN (>150% of PO per FR114), CC-DUPLICATE-WARN (same-day duplicate per FR115), CC-PREFILL (expiry / yield-factor defaults from product master per FR113), CC-AUDIT-LINK, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed, warning (shelf-life exception / implausibility / duplicate), error (validation failure), success (per-line acceptance pill), primary, on_primary, outline_variant

**Source FRs:**
FR26 (record GR against POs with partial receipts and barcode/QR scanning), FR27 (yield factor at GR with usable / wastage / adjusted cost), FR38 (shelf-life acceptance with exception approval), FR39 (file attachments to GR records), FR47a (Store Managers reject GR at formal QC — surfaced as an action; resulting vendor CN owned by Epic 5 per FR47b), FR112 (voice input on quantity fields), FR113 (form pre-fill defaults), FR114 (implausibility warn-and-log), FR115 (duplicate warn-and-log)

**Source journey(s):**
Store Manager — "records GR from Brand Store transfer (200kg mixed items); verifies quantities item-by-item using batch entry screen; captures expiry date for each item" (digest line 83); Store Manager — "uses mobile barcode scanner to populate GR details; fast entry at receiving" (digest line 84); Procurement Manager — "Store Manager records GR for 100kg tomatoes; enters yield factor 0.82 (lower than standard 0.85); system records 82kg usable, 18kg wastage; adjusted cost per kg recalculated" (digest line 73)

**Related screens:**
parent: SI-PUR-003 (PO Detail — typical entry point), sibling: SI-INV-011 (transfer-driven GR), sibling: SI-INV-012 (GR rejection at QC), routes to: SI-INF-001 (shelf-life exception approval), drill-down: SI-INF-006 (audit timeline), service-cross-ref: FR67 retrospective cost adjustment fires when this GR confirms a Pending-GR PO

**Notes:**
This is the canonical example used in the shape-design spec §6 — kept stylistically aligned. Honours P2B-001 with `CC-DRAFT-PILL`. Service-layer cross-ref: FR31 (FEFO ordering inside `inventoryService.deductStock()`) — see §5; the GR creates batch records consumed in FEFO order downstream. Service-layer cross-ref: FR28 (three-product-type directional flow) — see §5; raw-material GR feeds the brand/cluster store inventory pool which then routes downward. Shelf-life acceptance threshold per item is configured on the product master (FR3); exceptions route through Unified Approval Engine (FR16). Yield-factor changes here cascade through recipe costs per FR52 (service-layer; see §5).

---

#### SI-INV-011 — Goods Receipt Entry — Transfer-Driven

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Store Manager (scope: location)
- Kitchen Manager (scope: department)

**Purpose:**
Record goods receipt against an inbound stock transfer with per-line quantity verification at the destination department.

**Data displayed:**
- Transfer header: transfer TRN, source location/department, dispatched-by user, dispatched-at timestamp, line items expected
- Per line: item, source batch reference, dispatched quantity, currently-received quantity (editable), UOM, source expiry date (carried forward, editable only on exception), variance per line
- Implausibility warning banner when received variance exceeds tolerance (FR114)
- Reason code field (mandatory when variance per line > 0)
- Attachments list (photos for damage / shortfall — FR39)
- Draft pill when in draft state

**User actions:**
- Open from inbound transfer list or scan transfer barcode (FR26)
- Enter received quantity per line (voice input supported per FR112; barcode/QR scan supported)
- Enter mandatory reason code per variance line
- Attach photos for damage / shortfall
- Save as draft (auto-save)
- Submit GR → confirms transfer-leg receipt at destination; stock increments at destination; transfer status moves to Received (SI-INV-006)

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-VOICE-INPUT (FR112), CC-IMPLAUSIBILITY-WARN (variance tolerance per FR114), CC-PREFILL (dispatched quantities pre-fill the received-quantity field per FR113), CC-AUDIT-LINK, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_in_progress, status_completed, warning (variance), error (validation failure), primary, on_primary, outline_variant

**Source FRs:**
FR26 (record GR against transfers with partial receipts and barcode/QR scanning), FR39 (file attachments to GR records), FR112 (voice input), FR113 (pre-fill from dispatched quantities), FR114 (implausibility warn-and-log)

**Source journey(s):**
Store Manager — "records GR from Brand Store transfer (200kg mixed items); verifies quantities item-by-item using batch entry screen; captures expiry date for each item" (digest line 83); POS Staff — "at 11:35am, receives internal challan from Ravi; verifies items match; confirms receipt digitally in <30 seconds" (digest line 90 — POS-side parallel of this flow lives on SI-DSP-### digital delivery confirmation in Task 8)

**Related screens:**
parent: SI-INV-006 (stock transfer detail — typical entry point), sibling: SI-INV-010 (PO-driven GR), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Sibling of SI-INV-010 — same shape, different upstream entity (transfer instead of PO). Honours P2B-001 with `CC-DRAFT-PILL`. The POS-Staff dispatch-receipt confirmation (digest line 90) is the parallel surface on the Dispatch side and lives on the dispatch challan screen (SI-DSP-### in Task 8) because the source entity differs and the journal posture differs (Stage 1 already fired at dispatch); this screen is the inventory-facing receipt-side surface for inter-department transfers.

---

#### SI-INV-012 — Goods Receipt Rejection at QC

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Store Manager (scope: location)

**Purpose:**
Record formal QC rejection of a goods receipt with mandatory reason code, evidence attachments, and auto-drafted vendor credit note.

**Data displayed:**
- Source GR header: GR TRN, source PO TRN, vendor, received-by user, received-at timestamp
- Per line: item, received quantity, consumed-portion quantity (already drawn into production via Pending-GR override per FR65), unconsumed-portion quantity, rejection reason
- Mandatory rejection reason code dropdown (per item or per GR)
- Evidence attachments (photos, lab reports per FR39)
- Auto-drafted vendor credit note preview: VCN draft TRN (`VCN-YYYY-LOC-SEQ`), AP reduction value (full delivered value per FR47b), reference to GR TRN and PO TRN
- PO closure preview: "PO will move to Closed — GR Rejected"
- Pending-GR PO consequences preview: "Linked PO consumed value will reclassify from COGS to Wastage via compensating journal per FR67a"
- Draft pill when in draft state

**User actions:**
- Open from SI-INV-010 (sub-affordance "Reject at QC") or from SI-INV-006 (transfer-driven GR rejection)
- Enter mandatory rejection reason code per line or per GR
- Attach evidence (FR39)
- Save as draft (auto-save)
- Confirm rejection → GR status moves to GR-Rejected; vendor CN draft created (linked to SI-PUR-### vendor CN screen — ID assigned in Task 5); PO moves to Closed — GR Rejected per FR47a; if linked to Pending-GR PO, FR67a reclassification journal fires; Brand Owner notified per FR67a; surfaces on FR70 dashboard

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-AUDIT-LINK, CC-TRN-DISPLAY (vendor CN draft TRN visible)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container, on_surface, on_surface_variant, status_draft, status_gr_rejected, error_container (rejection banner), warning (Pending-GR consumed-portion warning), primary, on_primary, outline_variant

**Source FRs:**
FR47a (Store Managers reject GR at formal QC; clears Pending GR sub-status; moves PO to Closed — GR Rejected; auto-drafts vendor CN), FR39 (file attachments — evidence), FR38 (shelf-life acceptance failure is a typical rejection trigger)

**Source journey(s):**
Store Manager — formal QC rejection at receiving (implied throughout digest lines 80-86 as the closure path for failed receipt); Brand Owner — Pending-GR-resolution-outcomes review uses rejected-event drill-down (digest line 26)

**Related screens:**
parent: SI-INV-010 (PO-driven GR — typical entry point via reject sub-affordance), parent: SI-INV-011 (transfer-driven GR — rare but possible), sibling: SI-PUR-009 (Vendor Credit Note from Rejected GR — auto-drafted from this rejection), drill-down: SI-INF-006 (audit timeline), drill-down: SI-PRO-### Production Order Detail for any linked Pending-GR PO that takes the FR67a closure path (ID assigned in Task 7), surfaces on: SI-RPT-### Brand Owner override-frequency dashboard via Pending-GR-resolution-outcomes pane (ID assigned in Task 12)

**Notes:**
Separate screen from SI-INV-010 per §7 because it (a) initiates an approval/notification workflow, (b) auto-creates a TRN-generating compensating document (vendor CN), and (c) cascades into the FR67a reclassification journal when a Pending-GR PO is linked. Vendor CN itself (FR47b) is owned by Epic 5 — the screen here is the rejection-recording surface; the vendor CN management screen is SI-PUR-009 (Vendor Credit Note from Rejected GR). Honours P2B-001 with `CC-DRAFT-PILL`. The cross-listed FR47a is the action surface here; FR47b vendor CN management surface is SI-PUR-009.

---

#### SI-INV-013 — Inventory Adjustment

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** responsive-equal

**Roles & scope:**
- Store Manager (scope: location)
- Kitchen Manager (scope: department)
- Cluster Manager (scope: cluster)

**Purpose:**
Record an inventory adjustment with mandatory reason code routing through the Unified Approval Engine for value above threshold.

**Data displayed:**
- Adjustment header: department / location, requested-by user, requested-at timestamp
- Per line: item, batch reference, current on-hand, adjusted quantity, delta (positive / negative), UOM, mandatory reason code per line
- Aggregate value impact (₹) — drives approval routing
- Reason code dropdown (canonical adjustment reasons: physical recount, damage, spoilage, theft, system correction, wastage)
- Attachments list (photos / evidence per FR39 by analogy)
- Approval chain preview when value crosses threshold
- Implausibility warning banner when delta exceeds tolerance (FR114)
- Draft pill when in draft state

**User actions:**
- Open standalone or from SI-INV-002 batch detail (item + batch pre-filled)
- Add lines (item picker)
- Enter delta per line and select reason code per line
- Attach evidence
- Save as draft (auto-save)
- Submit adjustment → routes through Unified Approval Engine if value crosses threshold (FR16); otherwise commits and stock adjusts
- Cancel draft

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-IMPLAUSIBILITY-WARN (FR114), CC-AUDIT-LINK, CC-APPROVAL-INBOX-CARD (when routed for approval), CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed, warning (implausibility), error (validation failure), primary, on_primary, outline_variant

**Source FRs:**
FR37 (record inventory adjustments with mandatory reason codes and approval workflows), FR114 (implausibility warn-and-log), FR16 (route through Unified Approval Engine)

**Source journey(s):**
Kitchen Manager — "FEFO prioritisation; prioritises expiring cream into today's pastry cream batch" (digest line 42 — wastage adjustments arise from expired-stock workflow); Store Manager — variance-driven adjustments at routine recount (digest line 80-86 cluster)

**Related screens:**
parent: SI-INV-002 (batch detail — typical entry point with batch pre-filled), routes to: SI-INF-001 (unified approval inbox when threshold triggers), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-010 (reverse / cancel pre-confirmed)

**Notes:**
Separate screen ID per §7 because it (a) carries mandatory reason codes per line, (b) routes through approval engine for above-threshold value, (c) generates a TRN, and (d) involves ≥3 user-editable fields. Honours P2B-001 with `CC-DRAFT-PILL`. Reason-code taxonomy is canonical and matches FR110 unusual-activity detection (wastage spikes drive FR110 alerts). Reverse / cancel uses SI-INF-010 — pre-confirmed cancel cleanly removes; post-confirmed adjustment requires a compensating adjustment with its own TRN.

---

#### SI-INV-014 — Closing Inventory Entry — POS Daily

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- POS Staff (scope: location)

**Purpose:**
Run end-of-day physical count for final products at a POS outlet with mandatory reason codes for variance against the system-expected quantities.

**Data displayed:**
- POS context header: location, department, business date, cut-off countdown
- Per item: item name, expected quantity (opening + received − sold − wasted), counted quantity (editable), variance (computed), mandatory reason code per non-zero variance, UOM
- Aggregate: total items to count, items completed, items with unresolved variance, items with reason code missing
- Implausibility warning banner when counted > opening + receipts − dispatches per FR114
- Pre-fill defaults from yesterday's closing per FR113 (where applicable as expected starting point reference, not the count itself)
- Draft pill when in draft state
- Submit-before-cutoff banner

**User actions:**
- Scan / count actual items per line (barcode/QR per FR26 by analogy; voice input per FR112)
- Enter counted quantity per line
- Select mandatory reason code per non-zero variance line (e.g. customer sample no-purchase, dropped wastage)
- Override implausibility warning with mandatory reason code (FR114)
- Save as draft (auto-save throughout the day)
- Submit before cut-off → status moves to confirmed; journal entries fire (variance → wastage / stock-correction journal per FR89); locked from further edit

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001 — the closing inventory often spans 30+ minutes; the draft pill is critical for staff confidence), CC-VOICE-INPUT (FR112), CC-IMPLAUSIBILITY-WARN (FR114), CC-PREFILL (FR113), CC-AUDIT-LINK, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_completed, status_variance_flagged (per-line variance pill), warning (cut-off countdown / implausibility), error (cut-off missed), primary, on_primary, outline_variant

**Source FRs:**
FR35 (closing inventory at POS daily; mandatory reason codes for variance), FR112 (voice input), FR113 (pre-fill defaults), FR114 (implausibility warn-and-log)

**Source journey(s):**
POS Staff — "at 9pm, runs closing inventory on phone; system shows expected end-of-day stock (opening + received − sold − wasted); scans/counts actual items; most items match; cocoa-dust pastries show 2 missing (1 customer sample no-purchase, 1 dropped wastage); tags each with mandatory reason code; submits before cut-off" (digest line 94)

**Related screens:**
sibling: SI-INV-015 (closing inventory dispatch daily — same shape, dispatch context), parent: SI-INV-016 (closing inventory cluster review — Cluster Manager's oversight surface), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Mobile-first because POS staff use phones at end of day on the floor. Honours P2B-001 with `CC-DRAFT-PILL` — the eyebrow "DRAFT — NOT YET SAVED" applies here in mobile context per the catalogue definition. Cut-off enforcement: the screen shows a countdown to the location's configured cut-off (set on company / location master); after cut-off, the location surfaces on SI-INV-016 as not-submitted (FR36). Service-layer cross-ref: FR85 (recipe-driven inventory deduction) computes the expected quantity used as baseline — see §5.

---

#### SI-INV-015 — Closing Inventory Entry — Dispatch Daily

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** mobile-first

**Roles & scope:**
- Dispatch Staff (scope: location)

**Purpose:**
Run end-of-day physical count for final products at a Dispatch department with mandatory reason codes for variance against the system-expected quantities.

**Data displayed:**
- Dispatch context header: location, department, business date, cut-off countdown
- Per item: item name, expected quantity (production received − dispatched), counted quantity (editable), variance (computed), mandatory reason code per non-zero variance, UOM
- Aggregate: total items to count, items completed, items with unresolved variance
- Implausibility warning banner per FR114
- Draft pill when in draft state

**User actions:**
- Scan / count actual items per line (barcode/QR by analogy with FR26; voice input per FR112)
- Enter counted quantity per line
- Select mandatory reason code per non-zero variance line
- Override implausibility warning with mandatory reason code
- Save as draft (auto-save)
- Submit before cut-off → status moves to confirmed; journal entries fire per FR89; locked

**Cross-cutting:**
CC-DRAFT-PILL (P2B-001), CC-VOICE-INPUT (FR112), CC-IMPLAUSIBILITY-WARN (FR114), CC-PREFILL (FR113), CC-AUDIT-LINK, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_completed, status_variance_flagged, warning (cut-off / implausibility), error (cut-off missed), primary, on_primary, outline_variant

**Source FRs:**
FR77 (daily physical closing inventory at Dispatch and POS for final products with variance recording — the Dispatch-side framing of FR35), FR35 (cross-link — same operational rule, different department), FR112 (voice input), FR113 (pre-fill), FR114 (implausibility warn-and-log)

**Source journey(s):**
Dispatch Staff — "at end of day, performs physical closing inventory of Dispatch department; system shows expected quantities (production received − dispatched); actual vs expected reconciliation; tags variance with reason code" (digest line 65)

**Related screens:**
sibling: SI-INV-014 (closing inventory POS daily — same shape, POS context), parent: SI-INV-016 (closing inventory cluster review — Cluster Manager's oversight), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Sibling of SI-INV-014 — same shape, different department context (Dispatch vs POS) per §8. Cited as a separate ID per §8 because the roles, expected-quantity formula, and operational context genuinely differ. Honours P2B-001 with `CC-DRAFT-PILL`.

---

#### SI-INV-016 — Closing Inventory Cluster Review

**Primary epic:** Epic 4 — Inventory Management

**Primary device:** desktop-primary

**Roles & scope:**
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Review submitted closing-inventory across the cluster with per-location variance drill-down and a not-submitted-by-cutoff alert pane.

**Data displayed:**
- Filter chips: scope (cluster / brand), business date, department type (POS / Dispatch)
- Per-location row: location, department, status pill (Submitted / Not Submitted by Cut-off / Pending Review), submission timestamp, total variance value, variance items count, top variance reasons
- Not-Submitted-by-Cut-off pane: locations failing FR36 cut-off — location, department, expected cut-off time, hours overdue
- Per-location drill-in panel: line items with variance, reason codes, attachments, audit link
- Aggregate: total locations, submitted on-time, submitted late, not submitted, total cluster variance value
- Issue-ticket creation affordance per row

**User actions:**
- Filter by scope, business date, department type
- Drill into per-location detail (drill-down panel or modal showing the submitted SI-INV-014 / SI-INV-015 record)
- Mark variance acceptable (sub-affordance — closes the variance-flagged status without further action)
- Raise issue ticket against a location's variance (CC-ISSUE-TICKET-LINK → SI-INF-008)
- Trigger reminder notification to the not-submitted location (broadcast via Notification Center)
- Alert Brand Owner (if Cluster Manager) — surfaces the not-submitted set on the Brand Owner morning briefing

**Cross-cutting:**
CC-DASHBOARD-TILE (variance summary surfaces as a tile on Brand Owner / Cluster Manager morning briefings), CC-ISSUE-TICKET-LINK, CC-AUDIT-LINK, CC-DATA-QUALITY-ALERT (not-submitted-by-cut-off is a data quality signal surfaced here)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container, on_surface, on_surface_variant, status_completed, status_pending_approval, status_variance_flagged, warning (late submission), error (not submitted by cut-off), primary, outline_variant

**Source FRs:**
FR35 (closing inventory daily routine — review side), FR36 (locations not submitted closing inventory by cut-off; alert Brand Owner), FR22 (issue tickets for variance investigation)

**Source journey(s):**
Brand Owner — "morning dashboard review; variance flags, pending approvals" (digest lines 18-25); Cluster Manager — "variance investigation drill-down; pulls up POS-AB sandwich variance; drills through production output → dispatch challans → POS receipts → POS sales → closing inventory count; traces 0.8kg discrepancy to rushed recount" (digest line 32); Cluster Manager — "issue tracker assignment & resolution; records findings on variance; updates status within 4 hours; calls POS-AB manager for photo-evidence recount" (digest line 33)

**Related screens:**
sibling: SI-INV-014 (POS daily — submitted records drill into here), sibling: SI-INV-015 (Dispatch daily — submitted records drill into here), drill-down: SI-INF-008 (issue ticket create), drill-down: SI-INF-006 (audit timeline), surfaces on: SI-RPT-### Brand Owner cross-location dashboard via variance tile (ID assigned in Task 12)

**Notes:**
This is the example given in the shape-design spec §8 for the same-workflow-as-two-screens pattern (paired with the closing-inventory entry screens). Read-mostly surface — `CC-DRAFT-PILL` does not apply because no draft state is created here; the underlying entries are drafts at SI-INV-014 / SI-INV-015 only. The not-submitted-by-cut-off pane is a sub-affordance per §7 (single-field listing surfaced as a pane within this screen, not a separate screen ID). Cut-off times per location are configured on the company / location master.

### Epic 5 — Procurement (PUR)

Epic 5 covers the full purchasing and vendor-management lifecycle: creating purchase orders with PAR-based quantity suggestions, routing them through the threshold-driven approval engine, tracking PO status from Draft through to Closed, comparing vendor prices and history, distributing PO PDFs, managing recurring PO templates, monitoring vendor price spikes, assessing vendor performance, and resolving rejected goods receipts with a vendor credit note. The "Closed — GR Rejected" PO terminal state, the resulting vendor credit note, and the preferred-vendor flag are the three procurement-specific outcomes from Epic 4's GR-rejection workflow (SI-INV-012). Vendor performance and preferred-vendor management are consolidated into a single screen per the §7 granularity rule: both share the vendor-scope filter, the same roles, and the preferred-flag update action; splitting them would duplicate ~80% of the schema with no operational benefit.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-PUR-001 | PO Create with PAR Suggestions | desktop-primary | Procurement Manager (brand/cluster) |
| SI-PUR-002 | PO List & Filter | responsive-equal | Procurement Manager (brand/cluster), Brand Owner (brand), Cluster Manager (cluster) |
| SI-PUR-003 | PO Detail & Lifecycle Status | responsive-equal | Procurement Manager (brand/cluster), Brand Owner (brand), Store Manager (location) |
| SI-PUR-004 | PO Approval | desktop-primary | Brand Owner (brand), Cluster Manager (cluster) |
| SI-PUR-005 | Vendor Price Comparison | desktop-primary | Procurement Manager (brand/cluster), Brand Owner (brand) |
| SI-PUR-006 | Vendor Price Spike Alerts | responsive-equal | Procurement Manager (brand/cluster), Brand Owner (brand) |
| SI-PUR-007 | Recurring PO Template | desktop-primary | Procurement Manager (brand/cluster) |
| SI-PUR-008 | Vendor Performance & Preferred Flag | desktop-primary | Procurement Manager (brand/cluster), Brand Owner (brand) |
| SI-PUR-009 | Vendor Credit Note Issuance | desktop-primary | Procurement Manager (brand/cluster), Finance Manager (brand) |

---

#### SI-PUR-001 — PO Create with PAR Suggestions

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Create a purchase order for one or more items, using PAR-based quantity suggestions as a starting point for line-item quantities.

**Data displayed:**
- Item-selection panel: items flagged below PAR (from FR34), sorted by category; each item shows current stock, PAR level, and suggested reorder quantity (PAR − current stock)
- PO creation modes: all-items (batch all below-PAR items from one vendor), category-wise (filter by category then assign vendor), vendor-wise (select vendor first, then pick from that vendor's item list)
- Vendor selector per line: preferred vendors surfaced first (per FR47 preferred flag); vendor price history summary (last 3 prices)
- Line-item table: item name, UOM, quantity (editable, pre-filled from PAR suggestion), unit price (from last known or vendor quote), line total
- PO header: PO reference (auto-generated draft ref), vendor, delivery date, location/department, notes
- Running total and estimated value (used to determine approval routing band)
- Draft pill (status_draft)

**User actions:**
- Select PO creation mode (all-items / category / vendor-wise)
- Filter items by category or location
- Add item to PO line from the below-PAR panel or free-text search
- Edit quantity (overrides PAR suggestion; implausibility warning fires if >150% of suggested quantity per CC-IMPLAUSIBILITY-WARN)
- Select vendor per line or per PO header
- Remove line item
- Save as draft
- Submit for approval → routes to approval engine per FR41 threshold; status moves to Pending Approval
- Attach notes or reference documents
- Cancel draft

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL (last PO quantities for same vendor/items pre-filled as secondary reference), CC-IMPLAUSIBILITY-WARN (quantity >150% of PAR-based suggestion), CC-DUPLICATE-WARN (same-day PO for same items/vendor against an already-open PO), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, primary, on_primary, warning (price spike indicator on vendor line), outline_variant

**Source FRs:**
FR40 (PO creation: all-items / category / vendor-wise; PAR-based quantity suggestions), FR41 (approval routing on submit — threshold determines chain step), FR43 (vendor price history summary shown on vendor selector), FR46 (price spike badge on vendor line when current price >10% above 30-day avg), FR114 (implausibility warn on quantities), FR115 (duplicate PO detection)

**Source journey(s):**
Procurement Manager — "Purchase order creation with PAR-based suggestions" (creates PO for below-PAR items; system suggests quantities based on PAR levels minus current stock); Procurement Manager — "Vendor price comparison before selection" (pulls price history before choosing vendor on PO line)

**Related screens:**
sibling: SI-PUR-002 (PO list — navigates here after submit), sibling: SI-PUR-005 (vendor price comparison — opens from vendor selector for full price-history drill-down), parent: SI-INV-004 (PAR level management — the source of below-PAR flags), drill-down: SI-INF-001 (unified approval inbox — PO card surfaces there after submit)

**Notes:**
Three creation modes (all-items / category / vendor-wise) are sub-affordances within a single screen — they are filter/grouping choices on the item-selection panel, not separate routes. Preferred vendors surface first in the vendor selector per FR47 preferred flag maintained on SI-PUR-008. If a vendor price spike badge is shown on the vendor line (FR46), a tooltip surfaces the spike detail; clicking it opens SI-PUR-006 for the full alert context. Draft POs are cancellable cleanly (CC-REVERSE-CANCEL / FR117 — Draft status is pre-confirmed). FR44 (PO PDF distribution) is a sub-affordance on SI-PUR-003 after PO is Approved; it does not have its own screen ID per §7 (single-action, no editable fields, no journal entry).

---

#### SI-PUR-002 — PO List & Filter

**Primary epic:** Epic 5 — Procurement

**Primary device:** responsive-equal

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Browse, search, and filter all purchase orders across the user's scope to find a specific PO or monitor the pipeline by lifecycle status.

**Data displayed:**
- PO list table: PO reference, vendor name, creation date, delivery date, estimated value, status pill, location/cluster, item count
- Status pills: Draft, Pending Approval, Approved, Sent, Partially Received, Fully Received, Closed, Closed — GR Rejected, Cancelled
- Filter chips: status, vendor, cluster, location, date range, value band, category
- Summary counters: total POs, pending approval count, overdue (delivery date past with open status), GR-rejected count
- Search bar: by PO reference, vendor name, or item name

**User actions:**
- Filter by status, vendor, cluster/location, date range, value band
- Search by PO reference or vendor name
- Open PO row → drill-down to SI-PUR-003 (PO detail)
- Create new PO → routes to SI-PUR-001
- Export PO list (CSV / Excel / PDF per CC-EXPORT-TRIGGER)
- Bulk cancel draft POs (sub-affordance; confirm dialog; only for POs in Draft status)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-DATA-QUALITY-ALERT (vendor deactivated with open POs surfaced as alert row)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed, status_pending_gr, status_in_progress, status_completed, status_closed, status_cancelled, status_gr_rejected, outline_variant

**Source FRs:**
FR42 (PO lifecycle tracking — all statuses visible here including Closed — GR Rejected), FR40 (PO creation entry point), FR107 (export), FR116 (data quality alert for deactivated vendor with open POs)

**Source journey(s):**
Procurement Manager — "Morning dashboard: 2 POs pending Brand Owner approval" (digest line 67 — morning dashboard review; navigates here to find those 2 POs); Brand Owner — "Purchase order approval: reviews two POs above ₹50K threshold" (digest line 21 — may start from approval inbox but may also filter this list by pending-approval status)

**Related screens:**
drill-down: SI-PUR-003 (PO detail), sibling: SI-PUR-001 (PO create), drill-down: SI-INF-001 (unified approval inbox — overlapping surface for approval-pending POs)

**Notes:**
The "Closed — GR Rejected" status pill uses `status_gr_rejected` token from DESIGN.md §6. The GR-rejected count in the summary counters is a quick signal for vendor quality monitoring; clicking it filters the list to GR-rejected POs. This list is the primary navigation surface for the Procurement Manager's morning pipeline review.

---

#### SI-PUR-003 — PO Detail & Lifecycle Status

**Primary epic:** Epic 5 — Procurement

**Primary device:** responsive-equal

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)
- Store Manager (scope: location) — read-only, for delivery-context awareness

**Purpose:**
Show the full detail of a purchase order including all line items, lifecycle status, approval history, linked GRs, and the vendor PDF distribution status.

**Data displayed:**
- PO header: PO reference (TRN visible per CC-TRN-DISPLAY), vendor, creation date, delivery date, location, department, total value, status pill
- Status lifecycle pill — one of: Draft, Pending Approval, Approved, Sent, Partially Received, Fully Received, Closed, Closed — GR Rejected, Cancelled
- Line-item table: item, UOM, ordered quantity, received quantity to date, unit price, line total, variance (if partially received)
- Approval history: approver, decision (Approved / Rejected), timestamp, optional comment; threshold routing reason
- Linked GRs: list of GR records against this PO (each linkable to SI-INV-010); per-GR: GR reference, date, received quantity, yield factor applied, status (Confirmed / Rejected)
- For "Closed — GR Rejected" POs: GR rejection reason code, linked vendor credit note reference (VCN TRN), FR67a production-order closure note if any Pending-GR PO was linked
- PDF distribution status: "Sent to vendor" flag, sent-at timestamp, recipient email or contact
- Activity timeline (via CC-AUDIT-LINK)

**User actions:**
- Send approved PO to vendor as PDF (sub-affordance; triggers FR44 PDF generation; records sent-at timestamp)
- Mark PO as Sent (sub-affordance; updates status from Approved to Sent; light confirm dialog)
- Cancel PO (sub-affordance; available in Draft / Pending Approval status only; confirm dialog; uses CC-REVERSE-CANCEL)
- Raise issue ticket against this PO (CC-ISSUE-TICKET-LINK)
- Drill into a linked GR record (routes to SI-INV-010)
- Drill into vendor credit note (routes to SI-PUR-009, for GR-rejected POs only)
- View full audit timeline

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-REVERSE-CANCEL (Draft / Pending Approval cancellable; post-Approved states require compensating document), CC-ISSUE-TICKET-LINK, CC-PROVISIONAL-FLAG (if PO has a Pending-GR-linked production order, provisional cost badge shown on affected lines)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed, status_pending_gr, status_in_progress, status_completed, status_closed, status_gr_rejected, status_cancelled, status_provisional, primary, outline_variant

**Source FRs:**
FR42 (PO lifecycle — all statuses including Closed — GR Rejected per PRD line 650; see Notes for DL-001 distinction), FR44 (PO PDF distribution — sub-affordance on this screen), FR47a (Closed — GR Rejected state displayed; rejection reason code and linked vendor CN shown), FR47b (vendor CN reference shown for GR-rejected POs), FR66 (provisional cost badge if Pending-GR PO linked), FR87 (TRN display on PO record), FR22 (issue ticket link)

**Source journey(s):**
Procurement Manager — "Goods receipt with yield factor application: 1 with yield variance flag on tomatoes" (digest line 71 — reviews PO detail to understand GR linkage); Brand Owner — "Purchase order approval: pulls vendor price history before approval" (digest line 21 — opens PO detail before approving in the approval inbox); Store Manager — "1 expected PO delivery today" (digest line 79 — checks PO detail for expected delivery items and quantities)

**Related screens:**
parent: SI-PUR-002 (PO list), drill-down: SI-INV-010 (GR entry for this PO — linked GR records), drill-down: SI-PUR-009 (vendor credit note — shown for GR-rejected POs), sibling: SI-PUR-004 (approval action — approval card for this PO in the inbox), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket)

**Notes:**
DL-001 (decision-log.md) defines the canonical PO lifecycle for procurement (Draft → Approved → Sent → Partially Received → Fully Received → Closed); the PRD extends this with "Closed — GR Rejected" as a terminal state via FR47a. The lifecycle pill on this screen displays all states including the GR-rejected terminal. Note that DL-001 describes the production-order lifecycle (Draft → Pending GR → Confirmed → In Progress → Completed); the procurement PO lifecycle is distinct and defined by FR42, PRD line 650. The "Sent" status is the bridge between the approval side and the goods-receipt side: once Sent, the PO enters Partially Received or Fully Received as GRs are recorded against it (SI-INV-010). CC-PROVISIONAL-FLAG applies only when a production order was linked to this PO under a Pending-GR status (FR64–FR66); the flag is lifted when the GR is confirmed (FR67) or permanently locked if the GR is rejected (FR67a).

---

#### SI-PUR-004 — PO Approval

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand) — for POs above high threshold (e.g., >₹50K)
- Cluster Manager (scope: cluster) — for POs within cluster threshold (e.g., <₹50K)

**Purpose:**
Review a purchase order routed for approval and approve or reject it, with the option to view vendor price history before deciding.

**Data displayed:**
- PO approval card (CC-APPROVAL-INBOX-CARD): PO reference, vendor, total value, threshold routing reason, requesting user (Procurement Manager), submitted-at timestamp, line-item summary
- Line-item details (expandable): item, quantity, unit price, line total; price deviation indicator if any vendor price is above 30-day average
- Vendor price history summary per line (FR43): last 3 prices, average, current price deviation %
- Approval chain step indicator: current step, prior steps completed, remaining steps
- Optional comment field (free-text) on approve or reject
- Mandatory reason code on reject

**User actions:**
- Expand line items to review quantities and prices
- Open vendor price comparison for a line → drill-down to SI-PUR-005
- Approve → status moves to Approved; next step notified if multi-step chain
- Reject → mandatory reason code required; status moves back to Draft or Cancelled per chain configuration; Procurement Manager notified
- Delegate to another approver (sub-affordance; mandatory reason code + target user picker)

**Cross-cutting:**
CC-APPROVAL-INBOX-CARD (this screen is the detail surface reached from the inbox card in SI-INF-001), CC-AUDIT-LINK, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_approval, status_confirmed, primary, on_primary, warning (price deviation above 30-day avg), outline_variant

**Source FRs:**
FR41 (PO approval routing through configurable threshold-based chains), FR43 (vendor price history shown during approval review), FR16 (Unified Approval Engine routing), FR17 (surfaces as a card in the unified approval inbox)

**Source journey(s):**
Brand Owner — "Purchase order approval: reviews two POs above ₹50K threshold; pulls vendor price history before approval" (digest line 21); Procurement Manager — "PO approval routing: routes PO under ₹50K to Cluster Manager; auto-approval within the system" (digest line 71)

**Related screens:**
parent: SI-INF-001 (unified approval inbox — entry point for this screen), sibling: SI-PUR-003 (PO detail — full detail view accessible from this screen), drill-down: SI-PUR-005 (vendor price comparison — for price-history drill-down during approval review), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Per §7, this is a separate screen ID because it initiates an approval workflow (approve or reject PO, triggering status transitions and notifications). The "approve" and "reject" actions are not trivial single-decision confirms — they require review of line items, prices, and history before acting. The entry point is always the unified approval inbox (SI-INF-001) via the CC-APPROVAL-INBOX-CARD pattern; this screen is the detail destination reached by clicking an inbox card. Delegation reuses the FR16 chain configuration defined in SI-INF-002.

---

#### SI-PUR-005 — Vendor Price Comparison

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)

**Purpose:**
Compare prices for a selected item across vendors side-by-side with historical price trends to support vendor selection and negotiation decisions.

**Data displayed:**
- Item selector (search/autocomplete): item name, SKU, category
- Vendor comparison table: one column per vendor; rows show last purchase price, 30-day average, 90-day average, last 3 purchase prices (with dates), preferred flag, quality rating
- Price deviation indicators: column-level badge showing % above or below the cross-vendor average; spike badge (>10% above 30-day avg per FR46)
- Price history sparklines per vendor (last 3 months, drawn in `surface_tint` for normal, `error` for spiked)
- Date range selector for history window (1 month / 3 months / 6 months / 12 months)
- Current stock level and PAR level for context
- "Select vendor" shortcut button per column (pre-fills vendor in SI-PUR-001 if invoked from PO creation)

**User actions:**
- Search and select item to compare
- Change date range for price history
- Toggle which vendors to include in comparison (filter by vendor category or scope)
- Click "Select vendor" to return to SI-PUR-001 with vendor pre-selected
- Export comparison table (CC-EXPORT-TRIGGER: CSV / Excel)
- Open vendor record → drill-down to SI-MDM-005 (vendor master)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK (price records are audit-linked)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, surface_tint (normal price sparkline), error (spiked price sparkline), warning (price deviation badge), tertiary_container (preferred vendor column header), outline_variant

**Source FRs:**
FR43 (side-by-side vendor price comparison per item with historical tracking), FR46 (spike badge and sparkline colour when >10% above 30-day avg), FR47 (preferred vendor flag visible in comparison columns)

**Source journey(s):**
Procurement Manager — "Vendor price comparison before selection: pulls vendor price comparison for flour; reviews 3-month history for Vendor A vs Vendor B; selects based on price + quality rating" (digest line 71); Procurement Manager — "Vendor price spike monitoring: observes Vendor B butter price increased 15% over 6 months; compares with Vendor C" (digest line 74)

**Related screens:**
parent: SI-PUR-001 (PO create — entry point when invoked from vendor selector), parent: SI-PUR-004 (PO approval — entry point when reviewing price during approval), sibling: SI-PUR-006 (vendor price spike alerts — full alert mini-dashboard), sibling: SI-MDM-005 (vendor master — vendor record drill-down)

**Notes:**
This screen surfaces the vendor comparison data (FR43) that both the PO creation flow (SI-PUR-001) and the PO approval flow (SI-PUR-004) reference. When invoked from SI-PUR-001 via the vendor-selector price-history link, it opens with the item pre-selected and a "Select vendor" return path. When accessed standalone (e.g. from SI-MDM-005 "view price history" link), it opens in read-only exploration mode with no return path. Sparkline chart series: solid stroke for confirmed historical prices, `error` stroke when the latest price is a spike (>10% above 30-day avg per FR46), otherwise `surface_tint`.

---

#### SI-PUR-006 — Vendor Price Spike Alerts

**Primary epic:** Epic 5 — Procurement

**Primary device:** responsive-equal

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)

**Purpose:**
Surface all active vendor price spike alerts across the user's scope in a mini-dashboard so procurement can triage and act on price anomalies before the next PO cycle.

**Data displayed:**
- Alert list: one row per spike; columns — item, vendor, current price, 30-day average, spike % (current price vs 30-day avg), first-detected date, alert age
- Severity banding: >30% spike (error), 10–30% spike (warning)
- Filter chips: vendor, item category, cluster/location, spike severity band, alert age
- Summary counters: total active spike alerts, critical (>30%), moderate (10–30%)
- Per-alert actions: "View price comparison" (routes to SI-PUR-005 for that item), "Create PO without this vendor" (routes to SI-PUR-001 pre-filtered to alternative vendors), "Dismiss" (acknowledge and snooze; mandatory reason code)
- Dismissed / historical alerts toggle

**User actions:**
- Filter by vendor, category, cluster, severity band, age
- Open price comparison for an alert item → drill-down to SI-PUR-005
- Create a new PO for that item (pre-filtered to alternative vendors) → routes to SI-PUR-001
- Dismiss alert (snooze with reason code; alert re-surfaces after configurable period or on next price check)
- Export spike alert list (CC-EXPORT-TRIGGER)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-DASHBOARD-TILE (spike alert count surfaces as a tile on Procurement Manager morning-briefing dashboard), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, error (>30% spike rows), warning (10–30% spike rows), surface_container_high (dismissed alert rows), outline_variant

**Source FRs:**
FR46 (detect and alert on vendor price spikes >10% above 30-day average; this screen is the full alert dashboard), FR43 (price history underpins the spike calculation)

**Source journey(s):**
Procurement Manager — "Morning dashboard: vendor price alert (Vendor B butter price +8%)" (digest line 67); Brand Owner — "Food Cost Control Centre impact visibility: sees butter cost increase will push pastry food cost from 31% to 33% if unchanged; uses this data for vendor negotiation decisions" (digest line 76 — FCCC surfaces the financial impact; this screen surfaces the procurement alert that triggered it)

**Related screens:**
sibling: SI-PUR-005 (vendor price comparison — per-alert drill-down), sibling: SI-PUR-001 (PO create — action from spike alert), parent: SI-RPT-### (morning-briefing dashboard tile — ID assigned in Task 12)

**Notes:**
FR46 defines the spike threshold as >10% above 30-day average; that is the trigger for an alert to appear on this screen. The severity banding (>30% = critical, 10–30% = moderate) is a UI design decision for actionability triage — not a PRD-level distinction. A dismissed alert uses `CC-REVERSE-CANCEL` logic (pre-dismiss state is reversible; once snoozed, the alert re-surfaces at the next recalculation cycle). The Procurement Manager's morning dashboard tile (morning-briefing dashboard — ID assigned in Task 12) shows the active spike count; clicking drills here.

---

#### SI-PUR-007 — Recurring PO Template

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Create and manage recurring purchase order templates that automatically generate draft POs on a configured schedule, reducing manual effort for routine vendor orders.

**Data displayed:**
- Template list (index view): template name, vendor, frequency (daily / weekly / monthly / custom), next-run date, item count, estimated value, status (Active / Paused / Expired)
- Template detail / create form:
  - Template name, description
  - Vendor selector (preferred vendors first)
  - Recurrence frequency and schedule (day of week for weekly; day of month for monthly; custom cron-style for complex schedules)
  - Line-item table: item, UOM, default quantity (editable on each generated draft)
  - Auto-submit vs draft mode toggle (draft: generated PO appears in SI-PUR-002 for review before submitting; auto-submit: PO routed to approval engine immediately on generation)
  - Active from / Active until date range
  - Last-generated PO reference (linkable to SI-PUR-003)

**User actions:**
- Create new template → form with all template fields
- Edit existing template (name, schedule, items, quantities, dates)
- Pause / resume template (sub-affordance; light confirm dialog)
- Deactivate (expire) template
- Generate now (ad-hoc trigger outside normal schedule; creates one draft PO immediately; useful for manual catch-up)
- View last-generated PO → drill-down to SI-PUR-003
- Save template as draft (CC-DRAFT-PILL applies if template is not yet active)

**Cross-cutting:**
CC-DRAFT-PILL (template in draft state before activation), CC-PREFILL (last template's frequency and item list used as starting point for a new template), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, surface_container_high (Active interim — see Notes), status_cancelled (Paused), outline_variant (Expired interim — see Notes), primary, on_primary, outline_variant

**Source FRs:**
FR45 (recurring PO templates — create, manage, schedule, generate draft POs)

**Source journey(s):**
Procurement Manager — "Recurring PO setup" (standard routine orders for staple commodities like flour, butter, dairy; reduced manual effort for fixed-schedule vendor deliveries; operationalises the weekly/monthly ordering cycle described in journey digest line 67 context)

**Related screens:**
sibling: SI-PUR-001 (PO create — generated drafts appear here as a starting point), sibling: SI-PUR-002 (PO list — generated POs appear in the list), drill-down: SI-PUR-003 (last-generated PO detail)

**Notes:**
The generated PO inherits all line-item defaults from the template but can be edited before submission (if auto-submit is off). If auto-submit is on, the generated PO is submitted directly to the approval engine and appears in the approval inbox (SI-INF-001) without Procurement Manager review. PAR-based quantity adjustment on generated POs is a Phase-2c consideration (auto-adjusting template quantities against current PAR levels vs last-used quantities); no product decision made here — left as a configurable option in template setup. The "Generate now" action uses FR115 duplicate detection (CC-DUPLICATE-WARN) to warn if a PO already exists for this vendor/items in the current period. Phase-2c gap candidate: dedicated `status_template_active` and `status_template_expired` tokens for recurring template lifecycle. Currently using `surface_container_high` (inactive surface) and `outline_variant` (de-emphasised border) interim; revisit in Phase 2c review.

---

#### SI-PUR-008 — Vendor Performance & Preferred Flag

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)

**Purpose:**
Review vendor performance metrics aggregated from GR outcomes, yield variances, and price trends, and manage the preferred-vendor flag that influences vendor ordering in PO creation forms.

**Data displayed:**
- Vendor list with performance summary (sortable by quality rating, GR rejection rate, price stability score, preferred flag):
  - Vendor name, code, category, scope (Brand/Cluster/POS)
  - Quality rating (1–5 stars aggregated from GR rejections, yield variances, and manual input)
  - GR rejection count (total, 30-day, 90-day) with rejection reasons summary
  - Yield variance rate: % of GRs where actual yield differed from standard yield factor by >10%
  - Price stability score: measure of price consistency over 90 days (low variance = high score)
  - Price spike count (30-day): number of spike alerts from FR46
  - Preferred vendor flag (toggle)
  - Last PO date and value
- Vendor detail panel (side panel or drill-down): full GR history with yield factors, rejection events with reason codes, price history chart (links to SI-PUR-005)

**User actions:**
- Sort and filter vendor list by quality rating, GR rejection rate, price stability, preferred flag, category, scope
- Toggle preferred vendor flag (sub-affordance; light confirm dialog; records timestamp and user)
- Open full vendor record → drill-down to SI-MDM-005 (vendor master CRUD)
- Open price history for a vendor → drill-down to SI-PUR-005
- Open GR history for a vendor → filtered view of linked GR records (SI-INV-010 filtered to vendor)
- Raise issue ticket against a vendor → CC-ISSUE-TICKET-LINK
- Export vendor performance data (CC-EXPORT-TRIGGER: CSV / Excel)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK (preferred flag toggle and manual rating adjustments are audit-logged), CC-ISSUE-TICKET-LINK, CC-DATA-QUALITY-ALERT (vendor deactivated with open POs surfaced here)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, tertiary_container (preferred vendor badge), status_gr_rejected (rejection count badge), warning (yield variance flag), error (high rejection rate), success (high quality rating), outline_variant

**Source FRs:**
FR47 (vendor performance ratings and preferred vendor flagging — this screen is the management surface for both), FR43 (price history underpins price stability score; links to SI-PUR-005), FR47a (GR rejection events feed the rejection count and quality rating), FR46 (price spike count feeds price stability score)

**Source journey(s):**
Procurement Manager — "Vendor performance review: Vendor B butter price spike flag; comparing with Vendor C stable pricing; flagging for next procurement cycle" (digest lines 73–74); Procurement Manager — "Yield-to-recipe cost cascade: system flags yield factor deviation on tomatoes — confirms yield update after reviewing vendor performance" (digest line 73); Brand Owner — "Food Cost Control Centre impact visibility" (digest line 76 — vendor quality issues feed into food cost analysis)

**Related screens:**
sibling: SI-MDM-005 (vendor master CRUD — full vendor record), sibling: SI-PUR-005 (vendor price comparison — per-vendor history drill-down), drill-down: SI-INV-010 (GR records for vendor — yield factor and rejection history), drill-down: SI-PUR-006 (spike alerts for vendor), drill-down: SI-INF-008 (issue ticket for vendor)

**Notes:**
Granularity decision: vendor performance (FR47 metrics) and preferred-vendor flag management (FR47 preferred flag) are consolidated into this single screen. Both operate on the same vendor list, share the same roles (Procurement Manager + Brand Owner), and the preferred-flag toggle is a sub-affordance (single-decision confirm, no editable form fields) per §7 — it does not meet the threshold for a separate screen ID. Splitting into SI-PUR-008 (performance) + SI-PUR-009 (preferred flag) would have duplicated 80% of the schema. The quality rating is an aggregated metric updated automatically from GR rejection events (FR47a) and yield variances (FR27); manual override of the rating by a Procurement Manager is allowed but audit-logged.

---

#### SI-PUR-009 — Vendor Credit Note Issuance

**Primary epic:** Epic 5 — Procurement

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Finance Manager (scope: brand)

**Purpose:**
Review, complete, and confirm the vendor credit note auto-drafted when a goods receipt fails formal QC rejection, covering the full delivered quantity and reducing accounts payable.

**Data displayed:**
- VCN header: VCN TRN (format `VCN-YYYY-LOC-SEQ`; CC-TRN-DISPLAY), status pill (Draft / Confirmed / Cancelled), creation date
- Source references: linked GR TRN and record (routes to SI-INV-012 for rejection detail), source PO TRN and record (routes to SI-PUR-003)
- Vendor details: name, code, contact, tax ID (GSTIN)
- Line-item table: item, UOM, rejected quantity, unit price, line value; split into:
  - Unconsumed portion (physically returned to vendor)
  - Consumed-but-defective portion (non-physical refund claim for defective delivery)
- Total VCN value (full delivered value per FR47b)
- Cumulative CN validation: check that total VCN value does not exceed original PO/GR value (analogous to FR80)
- Notes field (mandatory reason code carried from GR rejection)
- Approval status (if VCN confirmation requires an approval step per the approval chain)

**User actions:**
- Review auto-drafted VCN content (pre-populated from GR rejection data)
- Edit notes or adjust line-item split between unconsumed and consumed-but-defective portions (optional refinement before confirm)
- Confirm VCN → status moves from Draft to Confirmed; accounts payable reduced by VCN value; TRN becomes immutable; journal entry fires via FR89 (DR Accounts Payable, CR [Vendor CN Clearing or equivalent account])
- Cancel VCN (sub-affordance; Draft status only; CC-REVERSE-CANCEL; mandatory reason code; cancellation does not reinstate the GR — the PO remains Closed — GR Rejected)
- Open source GR rejection record → drill-down to SI-INV-012
- Open source PO record → drill-down to SI-PUR-003
- Open linked journal entry → drill-down to SI-ACC-### (ID assigned in Task 10)
- Raise issue ticket against vendor → CC-ISSUE-TICKET-LINK

**Cross-cutting:**
CC-TRN-DISPLAY (VCN TRN visible and copy-to-clipboard), CC-DRAFT-PILL, CC-REVERSE-CANCEL (Draft cancellable; Confirmed requires compensating document), CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_confirmed, status_cancelled, status_gr_rejected (source PO status badge), primary, on_primary, error (if cumulative CN exceeds source value), outline_variant

**Source FRs:**
FR47a (GR rejection at QC — auto-drafts vendor CN; this screen manages the auto-drafted CN), FR47b (VCN TRN: `VCN-YYYY-LOC-SEQ`; references original GR + source PO; reduces AP by full delivered value), FR80 (cumulative CN ≤ source value — analogous validation applied here for vendor CNs)

**Source journey(s):**
Procurement Manager — "yesterday's GR summary: 3 processed, 1 with yield variance flag on tomatoes" (digest line 67 — monitors GR outcomes including rejections that generate vendor CNs); Finance Manager — "manages AP reduction from vendor CN after GR rejection" (vendor CN reduces accounts payable, impacting AP aging and financial statements — Finance Manager reviews and confirms)

**Related screens:**
parent: SI-PUR-003 (PO detail — entry point from vendor CN reference on GR-rejected PO), parent: SI-INV-012 (GR rejection at QC — auto-drafts this VCN on rejection; the rejection screen is the upstream trigger), drill-down: SI-INV-012 (source GR rejection detail), drill-down: SI-ACC-### (linked AP journal entry — ID assigned in Task 10), sibling: SI-PUR-002 (PO list — PO remains Closed — GR Rejected regardless of VCN state), drill-down: SI-INF-008 (issue ticket for vendor)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it (a) has ≥3 user-editable fields (notes, line-item split, confirm action), (b) fires a TRN-generating journal entry on confirmation (AP reduction), and (c) involves a distinct financial document with its own TRN (`VCN-YYYY-LOC-SEQ`). The VCN is auto-drafted by the system on GR rejection (SI-INV-012 trigger); the Procurement Manager reviews and confirms it here. Finance Manager visibility is required because confirmation reduces Accounts Payable — a ledger impact that falls within Finance Manager's financial governance remit. The journal entry fires via the FR89 auto-journal mapping (no direct UI action on the journal; it surfaces in SI-ACC-### — ID assigned in Task 10). Forward-reference: the Accounts Payable ledger impact and journal detail live in SI-ACC-### (ID assigned in Task 10).

### Epic 6 — Recipe Management (REC)

Epic 6 covers the full recipe lifecycle: defining recipes with ingredients, quantities, UOM, prep instructions, and yield; maintaining multiple versions per recipe with a designated default; calculating and auto-recalculating costs from current ingredient prices and yield factors; scaling recipes to different batch sizes; referencing sub-recipes as ingredients in parent recipes; classifying recipes with multi-dimensional tags (dietary, allergen, seasonal, complexity); and simulating cost impact from ingredient price changes before committing. Recipe cost recalculation — cascading updates from raw-material price or yield-factor changes through semi-products up to final-product costs — is a backend-only service-layer process with no UI surface of its own; the resulting cost figures surface automatically in the recipe detail and version comparison screens.

**Granularity decision:** The recipe detail view and the recipe edit form are kept as separate screens. A detail view is legitimately used in read-only mode by Kitchen Managers checking ingredient ratios, Procurement Managers understanding cost drivers, and Brand Owners auditing published defaults — none of whom need to reach the edit form. The edit form initiates a version-save workflow with several editable fields and may trigger an approval when a new version is designated as the default, warranting its own route. The two screens share the same route family and cross-reference each other as siblings.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-REC-001 | Recipe List & Search | responsive-equal | Kitchen Manager (location), Brand Owner (brand), Cluster Manager (cluster), Procurement Manager (brand/cluster) |
| SI-REC-002 | Recipe Detail — Current Default | responsive-equal | Kitchen Manager (location), Brand Owner (brand), Procurement Manager (brand/cluster), Cluster Manager (cluster) |
| SI-REC-003 | Recipe Edit | desktop-primary | Kitchen Manager (location), Brand Owner (brand) |
| SI-REC-004 | Recipe Version Comparison | desktop-primary | Kitchen Manager (location), Brand Owner (brand), Cluster Manager (cluster) |
| SI-REC-005 | Designate Default Approval | desktop-primary | Brand Owner (brand), Cluster Manager (cluster) |
| SI-REC-006 | Recipe Scaling Preview | responsive-equal | Kitchen Manager (location), Cluster Manager (cluster) |
| SI-REC-007 | Cost-Impact Simulation | desktop-primary | Kitchen Manager (location), Brand Owner (brand), Procurement Manager (brand/cluster) |
| SI-REC-008 | Recipe Categories & Tags Admin | desktop-primary | Brand Owner (brand) |

---

#### SI-REC-001 — Recipe List & Search

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Browse, search, and filter the full recipe catalogue to find and open a specific recipe or survey the cost and tagging landscape across the menu.

**Data displayed:**
- Recipe list table: recipe name, product type (raw / semi / final), category, default version number, current cost per serving, tags (dietary, allergen, seasonal, complexity — up to 3 visible inline; overflow count shown), active/archived status, last-updated date
- Status pill per recipe row: Active, Archived, Pending Default Approval (when a non-default version is awaiting approval to become default)
- Filter chips: product type, category, dietary tag, allergen tag, seasonal tag, complexity tag, active/archived, cost band, sub-recipe flag (contains sub-recipes)
- Summary counters: total active recipes, recipes with pending default approval, recipes with data quality alert (deactivated ingredient in published version — CC-DATA-QUALITY-ALERT)
- Search bar: by recipe name, ingredient name, or tag

**User actions:**
- Filter by any combination of filter chips
- Search by recipe name or ingredient
- Open recipe row → drill-down to SI-REC-002 (recipe detail — current default version)
- Create new recipe → routes to SI-REC-003 (recipe edit in create mode)
- Export recipe list (CC-EXPORT-TRIGGER: CSV / Excel)
- Bulk archive recipes (sub-affordance; bulk select; confirm dialog; Brand Owner only)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-DATA-QUALITY-ALERT (deactivated raw material active in a published recipe version — alert row surfaces here with link to the affected recipe)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_pending_approval (pending default approval pill), status_confirmed (active recipe pill), surface_container_high (Archived interim — see Notes), outline_variant

**Source FRs:**
FR48 (recipe CRUD — list is the entry surface for all recipe records), FR49 (multiple versions — default version number shown per recipe), FR50 (pending default approval status pill from approval workflow), FR55 (categorisation / tagging — filter chips and inline tag display)

**Source journey(s):**
Kitchen Manager — "Production planning against real-time availability: checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves" (recipe list is the navigation surface for locating the recipes used in production planning); Brand Owner — "Variance investigation and assignment: drills into variance report" (recipe list is the starting point for identifying which recipe a variance traces to)

**Related screens:**
drill-down: SI-REC-002 (recipe detail), sibling: SI-REC-003 (recipe edit — create mode), drill-down: SI-REC-008 (category and tag admin — accessible from filter chip management)

**Notes:**
No CC-AUDIT-LINK on the list screen — audit links appear per-record on SI-REC-002 and SI-REC-003 only. The "Pending Default Approval" status pill uses `status_pending_approval` token, which correctly describes the approval-pending state for a recipe version awaiting default designation (FR50). CC-DATA-QUALITY-ALERT fires when a raw material or ingredient referenced in any published (non-draft) recipe version has been deactivated in MDM (FR116 cross-cutting check); the alert row surfaces here and links to the affected recipe detail (SI-REC-002). Phase-2c gap candidate: dedicated `status_archived` token for archived recipes; currently using `surface_container_high` interim (DESIGN.md §6.1 reserves `status_closed` for closed periods, closed B2B challans, and closed investigations — it must not be repurposed for archived recipe state).

---

#### SI-REC-002 — Recipe Detail — Current Default

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location)
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster)
- Cluster Manager (scope: cluster) — read-only

**Purpose:**
Show the complete detail of a recipe's current default version — ingredients, quantities, yield, prep instructions, cost breakdown, and version history — so users can understand the recipe's operational and financial profile before acting.

**Data displayed:**
- Recipe header: name, product type, active status, current default version number and effective-since date
- Ingredient table (for current default version): ingredient name, type (raw / semi / sub-recipe), quantity, UOM, current unit cost, yield factor applied, net cost contribution per ingredient
- Sub-recipe indicators: ingredient rows that are sub-recipes show a sub-recipe badge with a link to that recipe's own SI-REC-002 (drill-down)
- Yield info: expected output quantity and UOM, yield %; waste allowance if defined
- Prep instructions: ordered steps (read-only rich-text; editable in SI-REC-003)
- Cost summary: total recipe cost, cost per serving, food cost % (recipe cost ÷ menu price if mapped — see SI-POS-### (ID assigned in Task 9))
- Cost auto-recalculation badge: "PROVISIONAL" badge on any cost figure derived from a Pending-GR ingredient price (CC-PROVISIONAL-FLAG); replaced with actuals on FR67 resolution
- Version history list: all versions (version number, created date, created by, status — Default / Non-default / Draft / Archived); version count
- Tags: dietary, allergen, seasonal, complexity (all applied tags shown as pills)
- Activity timeline (CC-AUDIT-LINK)

**User actions:**
- Navigate to a non-default version (opens version detail within the same screen; version history list is the selector)
- Compare two versions → routes to SI-REC-004 (version comparison)
- Edit recipe → routes to SI-REC-003 (recipe edit — creates a new version draft on open)
- Designate a version as default → triggers approval workflow (routes to initiating step; status moves to Pending Approval per SI-REC-005)
- Scale recipe to batch size → opens SI-REC-006 (recipe scaling preview; no route change — slide-over panel or modal per §7 if ≥3 fields and no journal; if fewer, stays inline)
- Simulate cost impact → routes to SI-REC-007
- Raise issue ticket against this recipe → CC-ISSUE-TICKET-LINK
- View full audit timeline

**Cross-cutting:**
CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, CC-PROVISIONAL-FLAG (cost figures derived from Pending-GR-priced ingredients carry the PROVISIONAL badge; lifted on retrospective adjustment), CC-DATA-QUALITY-ALERT (deactivated ingredient in this published version surfaces here as an alert banner)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_confirmed (active/default version pill), status_pending_approval (version awaiting default designation), status_draft (draft version pill), surface_container_high (Archived interim — see Notes), status_provisional (PROVISIONAL cost badge), primary, outline_variant

**Source FRs:**
FR48 (recipe detail — ingredients, qty, UOM, prep, yield), FR49 (version history; default version display; navigate to non-default versions), FR50 (designate default action — initiates approval workflow), FR51 (cost calculation from current ingredient prices and yield factors; auto-recalc badge), FR54 (sub-recipe ingredient rows with drill-down badge), FR55 (tags displayed as pills)

**Source journey(s):**
Kitchen Manager — "Production planning against real-time availability: checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves" (opens recipe detail to review ingredient list before creating production order); Procurement Manager — "Yield-to-recipe cost cascade: system flags yield factor deviation on tomatoes — recipe costs affected for 3 recipes" (opens recipe detail to see the updated cost following FR52 cascade); Brand Owner — "Food Cost Control Centre impact visibility: sees butter cost increase will push pastry food cost from 31% to 33% if unchanged" (reviews recipe cost breakdown to understand margin impact)

**Related screens:**
parent: SI-REC-001 (recipe list), sibling: SI-REC-003 (recipe edit), sibling: SI-REC-004 (version comparison), sibling: SI-REC-006 (recipe scaling preview), sibling: SI-REC-007 (cost-impact simulation), drill-down: SI-REC-002 (sub-recipe drill-down — self-referential for sub-recipe ingredient rows), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket)

**Notes:**
Recipe cost cascade (raw → semi → final) is a service-layer-only process. Cost figures on this screen reflect the post-cascade state automatically; there is no UI action for the cascade itself. When a cost cascade has updated figures, the auto-recalculation badge ("Costs updated — last recalculated [timestamp]") surfaces below the cost summary to make the recalc visible. The "Designate as default" action on a non-default version initiates the FR50 approval workflow and routes to SI-REC-005 for the approval step; this action satisfies §7 rule 2 (initiates approval workflow) and therefore SI-REC-005 carries its own screen ID. Scaling preview (SI-REC-006) may open as a slide-over panel from this screen if the §7 modal threshold is met (≥3 editable fields for batch size, yield override, output quantity); confirmed at Phase 3a routing design. Phase-2c gap candidate: dedicated `status_archived` token for archived recipe versions; currently using `surface_container_high` interim (DESIGN.md §6.1 reserves `status_closed` for closed periods, closed B2B challans, and closed investigations — it must not be repurposed for archived version state).

---

#### SI-REC-003 — Recipe Edit

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location)
- Brand Owner (scope: brand)

**Purpose:**
Create a new recipe or author a new version of an existing recipe by defining or updating its ingredients, quantities, UOM, yield, prep instructions, sub-recipe references, and tags.

**Data displayed:**
- Recipe header fields (editable): recipe name, product type selector (raw / semi / final), active flag
- Version context: editing creates a new version draft; the current default version label is shown as read-only reference above the form
- Draft version pill (status_draft) displayed prominently while unsaved
- Ingredient table (editable): ingredient rows — ingredient name (autocomplete from Product Master for raw/semi; from recipe catalogue for sub-recipes), quantity, UOM selector, per-unit cost (read-only, pulled from current price or last known; PROVISIONAL badge if Pending-GR), line cost (auto-calculated: qty × cost × yield factor)
- Sub-recipe selector: ingredient row type toggle (raw material / sub-recipe); if sub-recipe, autocomplete from the recipe catalogue; sub-recipe preview badge shows the sub-recipe's own cost-per-serving
- Yield info (editable): expected output quantity, output UOM, yield %
- Prep instructions (editable): ordered rich-text step list (add / remove / reorder steps)
- Tags (editable): multi-select chips — dietary (vegan, vegetarian, gluten-free, dairy-free, nut-free), allergen (gluten, dairy, eggs, nuts, soy, shellfish), seasonal (Q1/Q2/Q3/Q4, festive, special), complexity (simple, moderate, complex)
- Running cost summary: total recipe cost, cost per serving (updates on each ingredient change)
- Implausibility warning banner (CC-IMPLAUSIBILITY-WARN): fires if output quantity > theoretical maximum derivable from ingredient quantities and yield factors

**User actions:**
- Add ingredient row (raw material or sub-recipe)
- Remove ingredient row
- Edit quantity, UOM, or yield factor per ingredient row
- Reorder prep instruction steps (drag / up-down arrows)
- Add / remove tags
- Select sub-recipe as an ingredient → links to published default version of that sub-recipe
- Save as draft (version remains in Draft status; not visible as production-usable version)
- Publish version (save and move from Draft to a published non-default version; the existing default remains default unless a separate Designate Default action is taken per SI-REC-005)
- Discard draft (sub-affordance; confirm dialog; CC-REVERSE-CANCEL for Draft status)

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL (previous version's ingredient list and quantities pre-filled as starting point for the new version draft; user can override), CC-IMPLAUSIBILITY-WARN (output quantity > theoretical max from raw materials and yield factors), CC-DATA-QUALITY-ALERT (deactivated ingredient selected shows inline alert on that row), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_confirmed (published non-default version pill after publish), primary, on_primary, warning (implausibility banner, deactivated-ingredient row alert), status_provisional (PROVISIONAL badge on cost cells sourced from Pending-GR ingredient prices), outline_variant

**Source FRs:**
FR48 (recipe CRUD — ingredients, qty, UOM, prep, yield; this is the create/edit surface), FR49 (each save as publish creates a new version; the existing default is preserved), FR51 (cost per ingredient and total cost auto-calculated from current prices and yield factors; displayed in running cost summary), FR54 (sub-recipe referenced as an ingredient — type toggle on ingredient row), FR55 (tagging — multi-select chips for all classification dimensions)

**Source journey(s):**
Kitchen Manager — "Production planning against real-time availability: scales bread order down to 4 runs; creates material requisition for shortfall" (prior to this moment, recipe definition was authored here; Kitchen Manager may also edit ingredient ratios when a standard yield changes); Brand Owner — "recipe definition and version management" (Brand Owner authors new recipe versions or approves changes)

**Related screens:**
parent: SI-REC-002 (recipe detail — entry point for editing an existing recipe), sibling: SI-REC-001 (recipe list — navigates here from create-new action), sibling: SI-REC-005 (designate default approval — the next step after publishing a new version if you want it to become the default), drill-down: SI-INF-006 (audit timeline), sibling: SI-MDM-003 (product master — source of autocomplete for ingredient selection)

**Notes:**
Editing a recipe always creates a new version draft; it does not overwrite the existing default version in place. This is the enforcement mechanism for FR49 (multiple versions; existing default preserved). The "Publish version" action moves the new version from Draft to a published non-default state — it becomes visible in the version history on SI-REC-002, but the default designation requires a separate FR50 approval workflow initiated from SI-REC-002 and processed at SI-REC-005. CC-PREFILL seeds the new version draft with the previous version's ingredient table (not the entire form) so the Kitchen Manager can start from the prior state rather than a blank form. Phase-2c gap candidate: a `status_version_published` token for non-default published versions (currently relying on `status_confirmed` interim, which reads semantically as "confirmed" but is the closest available token for a published-but-not-default state; flag for Phase 2c review).

---

#### SI-REC-004 — Recipe Version Comparison

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster) — read-only

**Purpose:**
Compare two versions of a recipe side-by-side to understand what changed in ingredients, quantities, yield, cost, and tags before deciding whether to designate a new version as the default.

**Data displayed:**
- Version selector: two dropdowns or tabs (Version A / Version B), each populated from the recipe's version history; default pre-selection is current default (A) vs latest non-default version (B)
- Ingredient comparison table (side-by-side, aligned by ingredient): ingredient name, quantity (A vs B), UOM (A vs B), unit cost (A vs B), line cost (A vs B); diff highlighting — added rows (success tint), removed rows (error tint), changed values (warning tint)
- Yield comparison: output quantity, UOM, yield % (A vs B), diff indicator
- Cost comparison summary: total recipe cost (A vs B), cost per serving (A vs B), cost delta (absolute ₹ and %)
- Prep instruction comparison: step-by-step diff view (added, removed, changed steps highlighted)
- Tag comparison: tags present in A, tags present in B, tags added or removed
- Version metadata: version number, created by, created date, status (Default / Non-default / Draft / Archived) for each version

**User actions:**
- Select version A and version B from version dropdowns
- Switch which version is A vs B (flip comparison direction)
- Designate Version B as the new default → routes to initiating SI-REC-005 approval workflow (available only when user is authorised and version B is publishable)
- Navigate to Version A detail → routes to SI-REC-002 with that version selected
- Navigate to Version B detail → routes to SI-REC-002 with that version selected
- Export comparison (CC-EXPORT-TRIGGER: PDF for documentation / approval audit)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, success (added ingredient rows / cost reduction), error (removed ingredient rows / cost increase above threshold), warning (changed values), status_confirmed (default version badge), status_draft (draft version badge), outline_variant

**Source FRs:**
FR49 (multiple versions; version comparison and history — this is the dedicated comparison surface), FR50 (designate new default action is available from here, routing to SI-REC-005), FR51 (cost figures per version shown side-by-side; cost delta calculated), FR55 (tag comparison across versions)

**Source journey(s):**
Kitchen Manager — "recipe version designation: what-if cost scaling before designating a new recipe version as default" (reviews the version comparison to understand cost delta before recommending or initiating a default change); Brand Owner — "recipe definition, version designation" (reviews ingredient and cost changes across versions as part of approval due diligence)

**Related screens:**
parent: SI-REC-002 (recipe detail — entry point from "Compare versions" action), sibling: SI-REC-005 (designate default approval — launched from this screen for the candidate version), sibling: SI-REC-003 (recipe edit — if changes are needed before comparison is finalised)

**Notes:**
The version comparison is desktop-primary because the side-by-side layout requires horizontal space; a mobile view would collapse to a stacked diff view but the primary use case (deliberate version review before approval) is desktop. The "Designate as default" action from this screen initiates the same FR50 approval workflow as from SI-REC-002; both entry points route to SI-REC-005. Export as PDF is valuable here because the comparison document can serve as an attachment to the approval request, giving approvers the diff view rather than requiring them to navigate both versions independently.

---

#### SI-REC-005 — Designate Default Approval

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand) — approver
- Cluster Manager (scope: cluster) — approver (if approval chain configured at cluster level)
- Kitchen Manager (scope: location) — initiator (read-only after submission)

**Purpose:**
Review and approve or reject a request to designate a new recipe version as the brand default, completing the FR50 approval workflow before the version becomes the production-usable default.

**Data displayed:**
- Approval card (CC-APPROVAL-INBOX-CARD): recipe name, proposed default version number, current default version number, initiator (Kitchen Manager), submitted-at timestamp
- Ingredient and cost summary comparison: current default vs proposed version (cost per serving delta; key ingredient changes — top 3 by cost impact)
- Full version comparison link → routes to SI-REC-004 (for full diff review)
- Approval chain status: current step, approver(s) at this step, prior steps completed
- Optional comment field (free-text) on approve or reject
- Mandatory reason code on reject
- Activity timeline (CC-AUDIT-LINK)

**User actions:**
- Review ingredient and cost delta summary inline
- Open full version comparison → SI-REC-004
- Approve → the proposed version becomes the new default; previous default version is preserved in version history as a non-default published version; all downstream production orders will now default to the new version (FR50); Kitchen Manager notified
- Reject → mandatory reason code required; version remains non-default; initiator notified
- Delegate to another approver (sub-affordance; mandatory reason code + target user picker; per FR16 chain delegation)

**Cross-cutting:**
CC-APPROVAL-INBOX-CARD, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_approval (approval card header pill), status_confirmed (approved outcome pill), status_cancelled (rejected outcome pill — see Notes), primary, on_primary, outline_variant

**Source FRs:**
FR50 (designate version as default — approval workflow via Unified Approval Engine), FR16 (Unified Approval Engine routing — configurable approval chains and delegation), FR17 (surfaces as a card in the unified approval inbox)

**Source journey(s):**
Kitchen Manager — "recipe version designation: designates new version as default; approval routed to Brand Owner" (initiates the workflow; this screen is the approval-side surface); Brand Owner — "recipe definition, version designation" (reviews and approves or rejects the default designation request)

**Related screens:**
parent: SI-INF-001 (unified approval inbox — entry point; the approval card appears there and routes here on click), sibling: SI-REC-004 (version comparison — opened from this screen for full diff), sibling: SI-REC-002 (recipe detail — destination after approval completes; default version updated), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it (a) initiates an approval workflow (FR50 — designate version as default, routing through the Unified Approval Engine per FR16), (b) fires a consequential state change (default version pointer updated; all future production orders for this recipe default to the new version), and (c) has a distinct approver-only role split not present on the recipe detail or comparison screens. The `status_cancelled` token is used for the "rejected" outcome pill here as an interim — "Rejected" as an approval decision does not have a dedicated semantic token. Phase-2c gap candidate: a `status_approval_rejected` token distinct from `status_cancelled`; flag for Phase 2c review. The entry point is always the unified approval inbox (SI-INF-001) via CC-APPROVAL-INBOX-CARD; this screen is the detail surface reached from that card.

---

#### SI-REC-006 — Recipe Scaling Preview

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location)
- Cluster Manager (scope: cluster)

**Purpose:**
Preview a recipe scaled to a different batch size — with automatically adjusted ingredient quantities and updated cost — to support production planning without committing a new recipe version.

**Data displayed:**
- Recipe context header: recipe name, current default version, standard batch size and UOM
- Batch size input: target batch size (editable number field) and UOM selector
- Scaled ingredient table: ingredient name, standard quantity, scaled quantity (auto-calculated: standard qty × [target batch / standard batch]), UOM, unit cost, scaled line cost
- Sub-recipe rows: if an ingredient is a sub-recipe, its row shows the scaled quantity that would be required; sub-recipe label badge links to that recipe's SI-REC-002
- Yield output row: expected output quantity at the target batch size and yield %
- Cost summary: total cost at target batch size, cost per serving at target batch
- Read-only flag: this preview does not create a new recipe version or production order; it is a planning reference only

**User actions:**
- Enter target batch size
- Change UOM (if the recipe supports multiple output UOM)
- Reset to standard batch size (sub-affordance; reverts to the recipe's defined default output)
- Export scaling preview (CC-EXPORT-TRIGGER: PDF or CSV — useful for kitchen reference sheets)
- Navigate to create a production order for this batch size → routes to SI-PRO-### (ID assigned in Task 7)

**Cross-cutting:**
CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, on_primary, outline_variant

**Source FRs:**
FR53 (scale recipes to different batch sizes with automatic ingredient quantity adjustment), FR54 (sub-recipe ingredient rows shown with scaled quantities)

**Source journey(s):**
Kitchen Manager — "Partial production order creation: finds flour short; scales bread order down to 4 runs" (opens recipe scaling preview to determine ingredient requirements at the reduced batch size before creating the partial production order); Kitchen Manager — "recipe definition, version designation, what-if cost scaling" (uses scaling preview to plan batch economics)

**Related screens:**
parent: SI-REC-002 (recipe detail — entry point; "Scale recipe" action opens this screen), sibling: SI-PRO-### (production order create — ID assigned in Task 7; navigated to after scaling preview confirms the batch parameters)

**Notes:**
Scaling preview is read-only and does not create any record — it is a calculation aid. Per §7, it receives its own screen ID because it has ≥3 user-editable fields (target batch size, UOM, optional per-ingredient overrides in future) and provides a distinct operational workflow moment (batch planning before production-order creation). The "Navigate to create production order" CTA passes the batch size as a pre-fill parameter to SI-PRO-### so the Kitchen Manager does not re-enter the quantity.

---

#### SI-REC-007 — Cost-Impact Simulation

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location)
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Simulate the effect of hypothetical ingredient price changes on a recipe's cost per serving before committing to a vendor price or yield factor update, so stakeholders can make informed decisions on procurement and menu pricing.

**Data displayed:**
- Recipe selector: recipe name (search/autocomplete), current default version, current cost per serving
- Simulation ingredient table: one row per ingredient in the selected recipe; columns — ingredient name, current unit cost, simulated unit cost (editable; defaults to current cost), change % (auto-calculated), line cost delta, line cost (simulated)
- Sub-recipe rows: if an ingredient is a sub-recipe, its current aggregate cost and simulated aggregate cost are shown; a sub-recipe simulation badge indicates the sub-recipe's own costs are held constant unless that sub-recipe is also opened for simulation (see Notes)
- Cost summary: current total recipe cost, simulated total recipe cost, delta (₹ and %), simulated cost per serving
- Food cost % indicator: simulated food cost % (simulated cost ÷ mapped menu price if available via SI-POS-### (ID assigned in Task 9)); threshold alert if simulated food cost % exceeds brand-configurable threshold (default 35%)
- Read-only flag: simulation does not commit any price changes; changes take effect only through the procurement workflow

**User actions:**
- Select recipe to simulate
- Edit simulated unit cost per ingredient (override from current; multiple simultaneous edits supported)
- Reset individual ingredient to current cost (sub-affordance per row)
- Reset all ingredients to current costs (clears the simulation)
- Export simulation results (CC-EXPORT-TRIGGER: PDF or CSV — useful for vendor negotiation evidence)
- Navigate to vendor price comparison for an ingredient → routes to SI-PUR-005 (vendor price comparison)

**Cross-cutting:**
CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, on_surface, warning (food cost % exceeds threshold), error (cost increase delta > 10%), success (cost reduction delta), tertiary_container (simulation-mode indicator banner), outline_variant

**Source FRs:**
FR56 (simulate recipe cost impact from ingredient price changes before committing — this is the dedicated simulation surface), FR51 (cost calculation logic underpins the simulation; same formula applied to simulated prices), FR54 (sub-recipe ingredient rows shown with aggregate simulated cost)

**Source journey(s):**
Procurement Manager — "Food Cost Control Centre impact visibility: sees butter cost increase will push pastry food cost from 31% to 33% if unchanged; uses this data for vendor negotiation decisions" (opens simulation for the affected pastry recipe, enters the new butter price, and views the projected food cost % before committing to the vendor switch or negotiation); Brand Owner — "Override pattern monitoring / food cost visibility" (uses simulation to understand the cost envelope of ingredient price movements before approving procurement decisions); Kitchen Manager — "recipe definition, version designation, what-if cost scaling" (uses simulation to evaluate the cost impact of an ingredient substitution before formally editing the recipe)

**Related screens:**
sibling: SI-REC-002 (recipe detail — shows current costs; entry point from "Simulate cost impact" action), sibling: SI-PUR-005 (vendor price comparison — navigate to for ingredient price history context), sibling: SI-RPT-### (FCCC operational analytics — ID assigned in Task 12; simulation results inform menu engineering decisions)

**Notes:**
FR52 (recipe cost cascade) is a backend-only process (§5) that fires automatically when ingredient prices or yield factors are updated. The simulation on this screen is a before-commit what-if tool; FR52 applies after the actual price change is committed via procurement. Sub-recipe ingredient rows show the sub-recipe's aggregate cost held constant in the simulation (the sub-recipe's own ingredients are not recursively expanded into the simulation pane) — this is a deliberate simplification for the MVP simulation surface. A Phase-2c enhancement could add recursive sub-recipe simulation, but no product decision is made here. The food cost % threshold alert uses `warning` token (not a lifecycle status token) to indicate threshold breach — semantically correct per DESIGN.md §5 (semantic functional tokens).

---

#### SI-REC-008 — Recipe Categories & Tags Admin

**Primary epic:** Epic 6 — Recipe Management

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Create, rename, reorder, and retire the controlled vocabulary of recipe categories and tag values across all four tag dimensions (dietary, allergen, seasonal, complexity) used to classify recipes across the brand.

**Data displayed:**
- Category list: recipe categories (one per row); category name, recipe count using this category, created date, active status; sortable
- Tag dimension panels (one panel per dimension — dietary, allergen, seasonal, complexity):
  - Existing tag values: tag name, recipe count using this tag, active status
  - Order within dimension (drag-to-reorder for display priority in filters and forms)
- Inactive / retired tag values: shown in a collapsed section per dimension; recipe count shows historical usage (tags are never deleted — only retired to preserve existing recipe classification)

**User actions:**
- Create new category (name field; auto-slugged key; active flag)
- Rename existing category (affects display name only; existing recipe associations preserved)
- Deactivate category (recipes already tagged retain the category; it no longer appears in new-recipe category selectors)
- Create new tag value within a dimension (name field; active flag)
- Rename existing tag value
- Reorder tag values within a dimension (drag or up/down arrows; affects display order in recipe forms and filter chips)
- Retire tag value (removes from new-recipe selectors; recipes tagged with it retain the tag; retired tag shown with count of still-tagged recipes)
- Export tag catalogue (CC-EXPORT-TRIGGER: CSV)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK, CC-DATA-QUALITY-ALERT (surfaced here if a category or tag used in a published recipe is retired; alert links to the affected recipe list)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_confirmed (active category / tag), surface_container_highest (retired / inactive tags — de-emphasised surface), outline_variant, primary, on_primary

**Source FRs:**
FR55 (recipe categorisation and tagging — multi-dimensional classification; dietary, allergen, seasonal, complexity; this is the admin surface for managing that controlled vocabulary)

**Source journey(s):**
Brand Owner — "recipe definition and version management" (Brand Owner owns the classification taxonomy for the recipe catalogue; sets up tag vocabulary during initial menu design and extends it as the menu evolves seasonally)

**Related screens:**
sibling: SI-REC-001 (recipe list — filter chips reference categories and tags managed here), sibling: SI-REC-003 (recipe edit — tag multi-select chips are populated from values managed here), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Tags are never hard-deleted to preserve historical recipe classification integrity — retiring a tag removes it from new-recipe selectors while leaving it on existing recipes. If a retired tag is used in a published recipe, CC-DATA-QUALITY-ALERT can surface this here (and on SI-REC-001) as a cross-module inconsistency per FR116. Categories are a separate dimension from the four tag dimensions (dietary, allergen, seasonal, complexity) — categories group recipes by type (e.g., Pastry, Bread, Beverages) while tags provide cross-cutting classification. FR52 has no UI surface on this screen; it is service-layer-only (§5) and cross-referenced from SI-REC-002 Notes and SI-REC-007 Notes.

### Epic 7 — Production Planning (PRO)

Epic 7 covers the full production order lifecycle: creating recipe-driven production orders with batch size, target department, and schedule; defaulting to the current default recipe version with a warning when a non-default version is selected; checking ingredient availability and material enablement at PO creation under the warn-and-log model; creating partial POs when stock is insufficient; substituting ingredients on a specific batch with mandatory reason codes; overriding enablement or stock warnings with reason codes; raising enablement requests or emergency overrides for immediate unblocking; linking POs to Pending GRs and overriding unconfirmed GR situations; using Last Known Price and standard yield as provisional costs while a Pending GR is unresolved; recording production output with actual yield versus expected and mandatory variance reason codes; and the explicit In Progress transition that fires inventory deduction and the COGS journal atomically. The canonical five-status PO lifecycle (Draft → Pending GR → Confirmed → In Progress → Completed) is fixed by the canonical 5-status production-order lifecycle (decision-log) and is the spine that every screen in this epic references; the stock-deduction fire-point at the In Progress transition (service-layer-only — see §5) and retrospective cost adjustment when the GR is later confirmed are backend-only service-layer processes with no UI surface of their own, and the override-frequency dashboard (lives in Epic 12) — this epic feeds the data via warn-and-log overrides, ingredient substitutions, and Pending-GR resolution outcomes.

**Granularity decision:** Each warn-and-log workflow that initiates a side-effect (substitution, enablement override, enablement request, Pending GR linkage, Pending GR override, In Progress transition) gets its own screen ID per §7 rule 2, because each carries either an approval-initiating action, a TRN-generating or journal-firing transition, or a mandatory-reason-code capture distinct from the parent PO detail surface. Per the same rule, the Production Output Entry surface is a separate screen because it captures actual versus expected yield with mandatory variance reason codes and surfaces an implausibility warning (warn-and-log on physically implausible quantities) — distinct from passive PO detail viewing. The Pending GR Resolution Outcomes drill-through is a separate screen because it is reached from two distinct entry points (the Brand Owner override-frequency dashboard in Epic 12, and the Production Order detail screen) and surfaces the GR-rejected closure path reclassification audit thread (provisional cost permanent and reclassification journal) that does not naturally belong on the PO detail itself.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-PRO-001 | Production Order List & Filter | responsive-equal | Kitchen Manager (location/department), Cluster Manager (cluster), Brand Owner (brand) |
| SI-PRO-002 | Production Order Create | desktop-primary | Kitchen Manager (location/department) |
| SI-PRO-003 | Production Order Detail | responsive-equal | Kitchen Manager (location/department), Cluster Manager (cluster), Brand Owner (brand), Store Manager (location) |
| SI-PRO-004 | Ingredient Substitution Flow | desktop-primary | Kitchen Manager (location/department) |
| SI-PRO-005 | Enablement / Stock Override Flow | desktop-primary | Kitchen Manager (location/department) |
| SI-PRO-006 | Enablement Request | responsive-equal | Kitchen Manager (location/department) |
| SI-PRO-007 | Pending GR Linkage Interface | desktop-primary | Store Manager (location), Kitchen Manager (location/department) |
| SI-PRO-008 | Pending GR Override | desktop-primary | Kitchen Manager (location/department) |
| SI-PRO-009 | Pending GR Resolution Outcomes | desktop-primary | Brand Owner (brand), Cluster Manager (cluster) |
| SI-PRO-010 | Production Output Entry | mobile-first | Kitchen Manager (location/department) |
| SI-PRO-011 | In Progress Transition Confirm | responsive-equal | Kitchen Manager (location/department) |

---

#### SI-PRO-001 — Production Order List & Filter

**Primary epic:** Epic 7 — Production Planning

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location/department)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Browse, filter, and search production orders across the kitchen so Kitchen Managers can plan today's work and oversight roles can monitor status and overrides.

**Data displayed:**
- PO list table: PO reference (TRN visible per CC-TRN-DISPLAY), recipe name, recipe version (with non-default badge if applicable per FR58), batch size, target department, scheduled date, current lifecycle status, provisional-cost flag (if any line uses Pending-GR-derived cost per FR66)
- Status pill per row reflecting the canonical DL-001 5-status lifecycle: Draft, Pending GR, Confirmed, In Progress, Completed (plus terminal Cancelled and the FR67a-permanent GR-Rejected variant)
- Override indicators per row: substitution badge (FR61), enablement override badge (FR62), Pending GR override badge (FR65)
- Filter chips: status (DL-001 lifecycle states), target department, scheduled date range, recipe, override-present flag, provisional-cost flag, has-Pending-GR-link flag
- Summary counters: total POs in current view, POs in Pending GR, POs In Progress, POs with provisional cost
- Search bar: by PO reference, recipe name, or batch number

**User actions:**
- Filter and search by any combination of chips and search terms
- Open PO row → drill-down to SI-PRO-003 (Production Order detail)
- Create new PO → routes to SI-PRO-002
- Export list (CC-EXPORT-TRIGGER: CSV / Excel)
- Bulk close completed POs older than retention threshold (sub-affordance; bulk select; confirm dialog; Brand Owner only)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY, CC-PROVISIONAL-FLAG (row-level provisional badge for any PO using Pending-GR-derived costs)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_pending_gr, status_confirmed, status_in_progress, status_completed, status_cancelled, status_gr_rejected, status_provisional, status_overridden (override badges per FR61/FR62/FR65), outline_variant

**Source FRs:**
FR57 (production order list is the navigation surface for all PO records), FR58 (non-default recipe version badge displayed per row), FR62 (override-present badge surfaces enablement/stock override visibility for oversight roles), FR66 (provisional-cost flag per row when Pending GR drives cost)

**Source journey(s):**
Kitchen Manager — "production planning against real-time availability: pulls production planning screen; checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves" (digest line 40 — list is the navigation surface for finding and opening today's production orders); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code" (digest line 31 — uses override-filter chips to surface flagged POs in cluster scope); Brand Owner — "morning dashboard review: views override frequency metrics" (digest line 20 — drills from Epic 12 dashboard widget into a filtered list of override-bearing POs)

**Related screens:**
drill-down: SI-PRO-003 (Production Order detail), sibling: SI-PRO-002 (Production Order create), drill-down from: SI-RPT-### Brand Owner override-frequency dashboard (ID assigned in Task 12 — CC-OVERRIDE-WIDGET drills here filtered by override type)

**Notes:**
No CC-AUDIT-LINK on the list screen — audit links appear per-record on SI-PRO-003 only. The DL-001 5-status lifecycle (Draft → Pending GR → Confirmed → In Progress → Completed) is the canonical state set displayed in the status pill column; the Cancelled and GR-Rejected terminals are additional non-DL-001 outcomes (the GR-Rejected variant is the FR67a permanent state). Override badges (substitution / enablement override / Pending GR override) feed into the CC-OVERRIDE-WIDGET aggregating dashboard tile in Epic 12 (SI-RPT-### — ID assigned in Task 12); the badges themselves are the row-level surface, while the aggregating widget instance lives on the Brand Owner dashboard.

---

#### SI-PRO-002 — Production Order Create

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Create a new production order driven by a chosen recipe, batch size, target department, and scheduled date, with availability and enablement checks surfaced inline before submission.

**Data displayed:**
- Recipe selector (autocomplete from the Epic 6 recipe catalogue); on selection, the current default version is pre-filled per FR58 with a non-default warning banner if a different version is chosen
- Recipe context summary: recipe name, selected version number, default-version indicator, standard batch size, expected output, yield %, ingredient count
- Batch size input with UOM selector; on change, ingredient quantities recalculate using the FR53 scaling logic
- Target department selector (from MDM departments scoped to user's permitted production departments)
- Scheduled date and time picker
- Ingredient availability table: ingredient name, required quantity (post-scaling), current available stock at the target department (live), enablement status for that material × department pair, availability status pill (Sufficient / Partial / Insufficient), warn-and-log indicator if availability or enablement check fails
- Maximum producible quantity calculator: when stock is insufficient, system surfaces the maximum batch size achievable from currently available ingredients (FR60)
- Partial-PO mode toggle: when triggered, batch size is reduced to the maximum producible quantity and remaining shortfall is surfaced for material requisition follow-up
- Draft pill (status_draft) prominent while unsaved
- Implausibility warning banner (CC-IMPLAUSIBILITY-WARN): fires if the requested batch size would require ingredient quantities exceeding any plausible department holding capacity

**User actions:**
- Select recipe and (optionally) override default version
- Enter batch size and UOM; system auto-recalculates ingredient quantities
- Select target department and scheduled date
- Reduce to maximum producible quantity (FR60 — partial PO mode)
- Override availability or enablement warning at this stage (sub-affordance; opens SI-PRO-005 for the override flow with mandatory reason code; only proceeds after override is captured)
- Save as draft (PO remains in Draft status; not yet committed to schedule)
- Submit PO → status moves to Confirmed if all checks pass, or to Pending GR if any line is linked to an unconfirmed GR via SI-PRO-007 (DL-001 lifecycle entry transitions)
- Cancel draft (sub-affordance; confirm dialog; CC-REVERSE-CANCEL for Draft status)

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL (recipe selection pre-fills batch size and target department from the most recent equivalent PO for the same recipe), CC-IMPLAUSIBILITY-WARN, CC-REVERSE-CANCEL (Draft status pre-confirmed, cleanly cancellable)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, warning (non-default recipe version banner, availability warn-and-log row, implausibility banner), error (insufficient stock indicator), success (sufficient stock indicator), primary, on_primary, outline_variant

**Source FRs:**
FR57 (production order create — recipe-driven; batch size, target department, scheduled date), FR58 (default to current default recipe version with non-default warning banner), FR59 (availability and enablement check at PO creation under warn-and-log; surfaced in the ingredient availability table), FR60 (partial PO when stock insufficient — maximum producible quantity calculator and partial-PO mode toggle), FR113 (CC-PREFILL pre-fills from last equivalent PO)

**Source journey(s):**
Kitchen Manager — "production planning against real-time availability: pulls production planning screen; checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves" (digest line 40); Kitchen Manager — "partial production order creation: finds flour short; scales bread order down to 4 runs; creates material requisition for shortfall" (digest line 41 — uses the FR60 partial-PO mode and follows up with a separate material requisition through Epic 4)

**Related screens:**
parent: SI-PRO-001 (PO list — entry point for create), sibling: SI-PRO-003 (PO detail — destination after submit), sibling: SI-PRO-005 (enablement / stock override flow — invoked when a warn-and-log warning needs to be overridden during creation), sibling: SI-PRO-007 (Pending GR linkage — invoked when the user wants to pre-link an unconfirmed GR while creating the PO), sibling: SI-INV-005 (stock transfer create — partial-PO shortfall workflow continues into a material requisition or transfer here), drill-down: SI-REC-002 (recipe detail — for ingredient context before committing)

**Notes:**
This is a Draft-state form (P2B-001 honoured via CC-DRAFT-PILL). The FR59 availability and enablement check uses the warn-and-log model — the form does not block submission on warnings; instead, the user must invoke SI-PRO-005 to capture the override reason code if they want to proceed past a warning. Submission routes the PO to Confirmed (DL-001 fourth-from-last state) directly when all checks pass; if the user has linked a Pending GR via SI-PRO-007 from this form, the PO enters the Pending GR sub-state (DL-001 second state) on submit instead. Stock deduction does not fire here — that fires only at the In Progress transition per FR68 and DL-001, surfaced via SI-PRO-011. CC-PREFILL seeds the recipe / batch size / department from the most recent equivalent PO for this recipe per FR113.

---

#### SI-PRO-003 — Production Order Detail

**Primary epic:** Epic 7 — Production Planning

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location/department)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)
- Store Manager (scope: location) — read-only, for Pending GR linkage awareness

**Purpose:**
Show the complete state of a production order — lifecycle position, ingredient lines, override history, linked Pending GRs, provisional costs, and output records — so the Kitchen Manager can act on the next transition and oversight roles can audit decisions.

**Data displayed:**
- PO header: PO reference (CC-TRN-DISPLAY), recipe name, recipe version (with non-default badge per FR58 if applicable), batch size, target department, scheduled date, creation user and timestamp
- Lifecycle pill — one of the canonical DL-001 five statuses (Draft, Pending GR, Confirmed, In Progress, Completed) plus the non-DL-001 terminals Cancelled and GR-Rejected (FR67a permanent state)
- Lifecycle progress strip: visualises the DL-001 5-status flow with the current status highlighted and prior states marked as completed; deduction-fires marker on the In Progress step (informational, references FR68)
- Ingredient line table: ingredient name (raw / semi / sub-recipe), required quantity, UOM, source (current stock / Pending GR-linked / substituted), unit cost (Provisional badge per CC-PROVISIONAL-FLAG when Pending GR is the cost source per FR66), line cost
- Substitution rows: any FR61 substitution shown as a strikethrough on the original ingredient with the substitute ingredient highlighted, substitution reason code visible, originating user and timestamp
- Pending GR linkage panel: linked GR records (each linkable to SI-INV-010), per-GR — GR reference, vendor, expected items, status (Pending / Confirmed / Rejected); FR67a permanent-flag indicator if any linked GR was rejected at QC
- Override history list: chronological log of any FR62 enablement override, FR65 Pending GR override, FR61 substitution, with reason codes and originating users
- Provisional cost summary: provisional total cost (current), expected actuals on GR confirmation; FR67 retrospective adjustment indicator (with timestamp once fired); FR67a permanent-provisional indicator if applicable
- Production output panel (visible when status is In Progress or Completed): expected output quantity, recorded actual yield, variance, variance reason code (links to SI-PRO-010)
- Activity timeline (CC-AUDIT-LINK)

**User actions:**
- Substitute an ingredient (sub-affordance; routes to SI-PRO-004 with the line pre-selected)
- Override enablement or stock warning (sub-affordance; routes to SI-PRO-005 with the warning context pre-loaded)
- Raise enablement request or emergency override (sub-affordance; routes to SI-PRO-006)
- Link a Pending GR (sub-affordance; routes to SI-PRO-007)
- Override a Pending GR situation (sub-affordance; routes to SI-PRO-008; only surfaces when at least one linked GR is unconfirmed)
- Drill into Pending GR Resolution Outcomes (sub-affordance; routes to SI-PRO-009; surfaces only when at least one linked GR was rejected at QC under FR47a/FR67a)
- Confirm transition to In Progress (sub-affordance; routes to SI-PRO-011 — separate screen because the transition fires inventory deduction and the COGS journal atomically per DL-001 / FR68 / FR89)
- Record production output (sub-affordance; routes to SI-PRO-010; available when status is In Progress)
- Cancel PO (sub-affordance; available in Draft status only per CC-REVERSE-CANCEL / FR117; post-confirmation correction is a compensating document)
- Raise issue ticket against this PO (CC-ISSUE-TICKET-LINK)
- View full audit timeline

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, CC-PROVISIONAL-FLAG (per-line provisional cost badge when Pending GR drives the cost; permanent if FR67a closure path), CC-REVERSE-CANCEL (Draft cancellable; post-confirmed correction via compensating record)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_gr, status_confirmed, status_in_progress, status_completed, status_cancelled, status_gr_rejected, status_provisional, status_overridden (override history pills for FR61/FR62/FR65), status_variance_flagged (variance row pill once output is recorded), primary, outline_variant

**Source FRs:**
FR57 (PO detail surface), FR58 (non-default recipe version badge), FR60 (partial PO context shown if applicable), FR61 (substitution rows visible with reason codes), FR62 (enablement / stock override history visible), FR63 (enablement request entry point shown), FR64 (Pending GR linkage panel), FR65 (Pending GR override history visible; entry point to SI-PRO-008), FR66 (provisional cost badge per CC-PROVISIONAL-FLAG), FR67a (permanent-provisional indicator and FR67a closure-path drill-through), FR69 (production output panel surfaces variance and reason code), FR87 (TRN display per CC-TRN-DISPLAY), FR22 (issue ticket link)

**Source journey(s):**
Kitchen Manager — "production planning against real-time availability: pulls production planning screen; checks ingredient availability" (digest line 40 — opens PO detail to act on the next lifecycle transition); Kitchen Manager — "FEFO prioritisation: prioritises expiring cream into today's pastry cream batch; material selection auto-ordered by system" (digest line 42 — sees the FEFO-ordered ingredient list on PO detail); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code" (digest line 31 — uses the override history list on this screen); Brand Owner — "Pending-GR resolution outcomes review: drills from dashboard pane into rejected GR + linked PO + reclassification journal" (digest line 25 — opens the linked-PO surface from the Epic 12 dashboard drill-through)

**Related screens:**
parent: SI-PRO-001 (PO list — typical entry point), sibling: SI-PRO-002 (PO create), sibling: SI-PRO-004 (substitution flow), sibling: SI-PRO-005 (enablement / stock override flow), sibling: SI-PRO-006 (enablement request), sibling: SI-PRO-007 (Pending GR linkage), sibling: SI-PRO-008 (Pending GR override), drill-down: SI-PRO-009 (Pending GR resolution outcomes — when any linked GR is FR67a-rejected), sibling: SI-PRO-010 (production output entry), sibling: SI-PRO-011 (In Progress transition confirm), drill-down: SI-INV-010 (linked GR records), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket), surfaces on: SI-RPT-### Brand Owner override-frequency dashboard via CC-OVERRIDE-WIDGET (ID assigned in Task 12)

**Notes:**
DL-001 (decision-log.md, 2026-05-02) is the canonical 5-status Production Order lifecycle: Draft → Pending GR → Confirmed → In Progress → Completed. Stock deduction fires exactly at the In Progress transition via inventoryService.deductStock() per FR68 — never earlier (Pending GR or Confirmed do not deduct) and never later. This screen displays the full lifecycle pill including non-DL-001 terminal outcomes (Cancelled per FR117; GR-Rejected per FR67a permanent state). FR67 retrospective cost adjustment is service-layer-only (§5) — when a linked Pending GR is confirmed (FR64), the journal entry fires and provisional cost figures on this screen are replaced by actuals automatically; the timeline marks the adjustment timestamp. FR67a is the GR-rejected closure path: provisional cost stays permanent (`CC-PROVISIONAL-FLAG` becomes a permanent indicator), and the consumed-portion value is reclassified from COGS to Wastage via a compensating journal (visible on the Pending GR Resolution Outcomes drill at SI-PRO-009). FR68 stock deduction is service-layer-only (§5) — surfaced here only as the deduction-fires marker on the lifecycle progress strip; the actual transition is captured at SI-PRO-011. FR70 override-frequency dashboard pieces live in Epic 12 (SI-RPT-### — ID assigned in Task 12) — this screen feeds the data via override history rows.

---

#### SI-PRO-004 — Ingredient Substitution Flow

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Substitute a specific ingredient on a production order with a permitted alternative under the warn-and-log model, capturing the mandatory reason code and validating enablement on the substitute before committing the change.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, current lifecycle status
- Original ingredient row: ingredient name, required quantity, UOM, current source (stock / Pending GR / sub-recipe)
- Substitute selector: autocomplete from the Product Master, filtered to ingredients of the same product type (raw or semi or sub-recipe); enablement status for the candidate substitute × target department pair displayed inline
- Substitute quantity input: defaults to the original quantity; editable to reflect a different conversion ratio
- Substitute cost preview: unit cost (Provisional badge per CC-PROVISIONAL-FLAG if substitute is Pending-GR-priced), line cost delta versus the original
- Mandatory reason code dropdown (e.g., out-of-stock / quality issue / dietary substitution / cost optimisation / other)
- Free-text comment field (optional)
- Warn-and-log preview: confirmation that the substitution will be logged on PO detail (SI-PRO-003), in the audit timeline, and surfaced on the Brand Owner override-frequency dashboard (Epic 12)
- Enablement-check warning banner (warn-and-log): fires if the substitute is not currently enabled for the target department; user can override by capturing an additional reason code, satisfying FR62 enablement override

**User actions:**
- Select substitute ingredient
- Adjust substitute quantity
- Select reason code (mandatory)
- Enter optional comment
- Confirm substitution → original ingredient is replaced on the PO; cost recalculated; substitution row recorded on SI-PRO-003 with reason code; audit log written; data feeds Epic 12 CC-OVERRIDE-WIDGET
- Cancel substitution (sub-affordance; confirm dialog; no changes committed)

**Cross-cutting:**
CC-AUDIT-LINK, CC-PROVISIONAL-FLAG (substitute cost may carry the Provisional badge if substitute is Pending-GR-priced)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_overridden (substitution outcome pill on confirmation), warning (enablement-check warn-and-log banner), status_provisional (substitute cost Provisional badge), primary, on_primary, outline_variant

**Source FRs:**
FR61 (ingredient substitution at production order level — warn-and-log; mandatory reason code; enablement check on substitute; audit trail; affects batch cost only; surfaces on override-frequency dashboard), FR62 (enablement override on substitute when substitute is not enabled for the target department — warn-and-log with reason code)

**Source journey(s):**
Kitchen Manager — "ingredient substitution at production order level: can substitute ingredient on specific batch (warn-and-log); mandatory reason code; enablement check on substitute; audit trail capture; affects batch cost only; surfaced on Brand Owner override-frequency dashboard" (digest line 44); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code" (digest line 31 — Cluster Manager reviews these substitution events from the Epic 12 dashboard and from SI-PRO-003 override history)

**Related screens:**
parent: SI-PRO-003 (PO detail — entry point via the "Substitute ingredient" sub-affordance on a line), sibling: SI-PRO-005 (enablement / stock override flow — invoked when the substitute itself is not enabled at the target department), drill-down: SI-INF-006 (audit timeline), surfaces on: SI-RPT-### Brand Owner override-frequency dashboard via CC-OVERRIDE-WIDGET (ID assigned in Task 12)

**Notes:**
Per §7 granularity rule, substitution is a separate screen ID because it (a) captures a mandatory reason code distinct from the parent PO detail, (b) initiates a side-effect (cost recalculation, audit log entry, dashboard data feed), and (c) carries its own validation surface (enablement check on substitute). P2B-005 honoured: this screen is one of the override-firing screens whose data feeds the CC-OVERRIDE-WIDGET aggregating instance on Epic 12 SI-RPT-### (ID assigned in Task 12) — the widget itself does not live here. FR61 explicitly scopes the substitution effect to the batch only; the underlying recipe version is unchanged (recipe edits live on SI-REC-003). If the substitute is not enabled at the target department, the user must capture a second reason code via SI-PRO-005 — this composition is intentional per FR62 because the enablement override is a distinct warn-and-log decision from the substitution itself. This screen is invoked as a workflow modal or slide-over from SI-PRO-003 per §7 rule 2.

---

#### SI-PRO-005 — Enablement / Stock Override Flow

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Capture a Kitchen Manager's override of an enablement or stock-availability warning under the warn-and-log model, with mandatory reason code, so the production order can proceed without blocking despite the warning.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, current lifecycle status
- Warning context panel: the specific warning being overridden — material not enabled for department, stock insufficient at department, or both; affected ingredient(s) and quantities
- Mandatory reason code dropdown (e.g., enablement extension / cluster surplus available / temporary shortage / kitchen judgement / other)
- Free-text comment field (optional but encouraged for non-routine reasons)
- Warn-and-log preview: confirmation that the override will be logged on PO detail (SI-PRO-003), in the audit timeline, and surfaced on the Brand Owner override-frequency dashboard (Epic 12) and the management override visibility surfaces (Cluster Manager)
- Notification preview: list of users who will be notified on submit (Cluster Manager for cluster-scoped overrides; Brand Owner for repeated patterns per Epic 12 widget)

**User actions:**
- Select reason code (mandatory)
- Enter optional comment
- Confirm override → warning is logged with reason code; PO proceeds past the check; override row recorded on SI-PRO-003; audit log written; data feeds Epic 12 CC-OVERRIDE-WIDGET; configured roles notified
- Cancel override (sub-affordance; warning remains active; PO does not proceed past the check)

**Cross-cutting:**
CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_overridden (override outcome pill on confirmation), warning (warning context panel), error_container (visual emphasis on the override-action surface so the irreversibility of warn-and-log is visible), primary, on_primary, outline_variant

**Source FRs:**
FR62 (Kitchen Manager overrides enablement or stock warnings with reason codes; visible on management dashboards — this is the dedicated override-capture surface), FR59 (the FR59 availability and enablement check at PO creation surfaces here when overridden during creation)

**Source journey(s):**
Kitchen Manager — "Pending GR override under warn-and-log: can override unconfirmed GR situations with reason code; proceeds immediately with notification to Store Manager" (digest line 43 — though Pending-GR-specific overrides route to SI-PRO-008, this screen is the parallel surface for general enablement and stock warnings); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code" (digest line 31 — overrides captured here surface in the cluster's review pane on SI-PRO-001 with the reason-code chip)

**Related screens:**
parent: SI-PRO-002 (PO create — entry point during creation when a warning needs to be overridden), parent: SI-PRO-003 (PO detail — entry point via the "Override warning" sub-affordance on an existing PO), parent: SI-PRO-004 (substitution flow — entry point when a substitute is not enabled at the target department), drill-down: SI-INF-006 (audit timeline), surfaces on: SI-RPT-### Brand Owner override-frequency dashboard via CC-OVERRIDE-WIDGET (ID assigned in Task 12)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it captures a mandatory reason code with side-effects (audit log, dashboard feed, notifications) distinct from the parent PO detail and the parent substitution flow. P2B-005 honoured: this screen is one of the override-firing screens whose data feeds the CC-OVERRIDE-WIDGET aggregating instance on Epic 12 SI-RPT-### (ID assigned in Task 12) — the widget itself does not live here. The `status_overridden` token reflects the resulting state of the warning row on PO detail; the override-action surface itself uses `error_container` and `warning` to make the warn-and-log decisiveness visible. FR63 enablement requests are a different workflow (proactive request for enablement extension that initiates an approval) — that lives on SI-PRO-006; this screen is the warn-and-log override path.

---

#### SI-PRO-006 — Enablement Request

**Primary epic:** Epic 7 — Production Planning

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Raise a formal enablement request or an emergency override request for an ingredient × department pair, initiating an approval workflow so the Kitchen Manager can be unblocked through proper channels rather than only via warn-and-log.

**Data displayed:**
- PO context header (if invoked from a PO context): PO reference, recipe name, batch size, target department; otherwise, request stands alone
- Request-type toggle: standard enablement request (routes to standard approval chain) or emergency override (routes to high-priority approval chain with shortened SLA)
- Ingredient selector: ingredient name (autocomplete from the Product Master), required quantity, UOM
- Target department selector
- Justification reason code (mandatory): e.g., new menu item / one-off batch / urgent customer order / other
- Free-text justification field (mandatory for emergency override; optional for standard)
- Approval chain preview: who will receive the request, expected SLA, escalation path
- Request status pill (status_pending_approval after submit; status_confirmed once approved; status_cancelled once rejected)

**User actions:**
- Select request type (standard or emergency)
- Choose ingredient and target department
- Enter quantity required
- Select reason code (mandatory)
- Enter free-text justification (mandatory if emergency)
- Submit request → routes through the Unified Approval Engine (SI-INF-001) per FR16 with threshold rules; Kitchen Manager notified on resolution
- Cancel draft request (sub-affordance; CC-REVERSE-CANCEL for the pre-submitted state)
- Track status of the request (read-only view of approval-chain progress)

**Cross-cutting:**
CC-DRAFT-PILL, CC-APPROVAL-INBOX-CARD (request surfaces as a card in SI-INF-001 once submitted), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval (after submit), status_confirmed (approved), status_cancelled (rejected), warning (emergency-override mode banner), primary, on_primary, outline_variant

**Source FRs:**
FR63 (Kitchen Managers raise enablement requests or emergency overrides for immediate unblocking — this is the dedicated request-capture surface), FR16 (Unified Approval Engine routing — request flows through configurable chains), FR17 (request surfaces as a card in the unified approval inbox)

**Source journey(s):**
Kitchen Manager — "Pending GR override under warn-and-log: can override unconfirmed GR situations with reason code; proceeds immediately with notification to Store Manager" (digest line 43 — the warn-and-log path lives at SI-PRO-005 and SI-PRO-008; this screen is the formal-request alternative for cases where the Kitchen Manager wants to be unblocked through approval rather than override); Kitchen Manager — "ingredient substitution at production order level" (digest line 44 — used when an enablement extension is preferred over a one-time substitution for a recurring need)

**Related screens:**
parent: SI-PRO-002 (PO create — entry point when a warning surfaces and the user prefers a formal request over a warn-and-log override), parent: SI-PRO-003 (PO detail — entry point via the "Raise enablement request" sub-affordance), sibling: SI-PRO-005 (enablement / stock override flow — the warn-and-log alternative), drill-down: SI-INF-001 (unified approval inbox — the request surfaces there as an approval card), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it initiates an approval workflow (FR16 routing) and creates a tracked request entity distinct from the warn-and-log override path on SI-PRO-005. The two paths satisfy different operational needs: SI-PRO-005 is "I am proceeding now and accepting the override is logged" (warn-and-log under FR62); SI-PRO-006 is "I want this approved formally before proceeding, possibly via fast-track emergency chain" (FR63). The emergency-override mode shortens the approval SLA via a high-priority chain configured in SI-INF-002. P2B-005 does not apply directly here — this is an approval-tracked request, not a warn-and-log override; the override-frequency widget aggregates only warn-and-log events.

---

#### SI-PRO-007 — Pending GR Linkage Interface

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Store Manager (scope: location)
- Kitchen Manager (scope: location/department)

**Purpose:**
Link a production order to one or more unconfirmed Pending GRs so the PO can enter the Pending GR sub-state of the DL-001 lifecycle and use Last Known Price plus standard yield as provisional costs until the linked GRs confirm.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, current lifecycle status
- Affected ingredient lines: ingredient name, required quantity, current available stock, deficit quantity (if any)
- Pending GR candidate list: open GRs at the target department or feeding store with status Pending Confirmation; per-GR — GR reference, vendor, expected items and quantities, expected confirmation window, source PO TRN
- Linkage selector: per ingredient line, select one or more candidate GRs to satisfy the deficit; system pre-suggests the best-matching GR (matching ingredient, sufficient quantity, earliest expected confirmation)
- Linkage preview: post-link state — which ingredient lines will become Pending-GR-sourced (provisional cost via CC-PROVISIONAL-FLAG), expected provisional total cost (LKP × standard yield per FR66), expected actuals on confirmation
- DL-001 lifecycle preview: PO status will move to Pending GR on submit; will auto-progress to Confirmed once all linked GRs are confirmed via FR64 auto-progression rule

**User actions:**
- Select Pending GR candidates per affected ingredient line
- Confirm linkage → PO status moves to Pending GR (DL-001 second state); affected lines flagged with CC-PROVISIONAL-FLAG; provisional total cost computed per FR66; Store Manager notified of the linkage commitment
- Unlink a previously-linked Pending GR (sub-affordance; available before the GR confirms; reverts the affected line to its prior source)
- Drill into a candidate GR record (sub-affordance; routes to SI-INV-010 in read-only mode for linkage validation)

**Cross-cutting:**
CC-AUDIT-LINK, CC-PROVISIONAL-FLAG (preview surface for the cost figures the linkage will produce)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_gr (PO state preview), status_provisional (cost preview pill), warning (deficit indicator on affected lines), primary, on_primary, outline_variant

**Source FRs:**
FR64 (Pending GR linkage on POs — auto-progress when linked GR is confirmed; this is the dedicated linkage surface), FR66 (LKP × standard yield as provisional costs once linked — preview shown here)

**Source journey(s):**
Kitchen Manager — "Pending GR override under warn-and-log: can override unconfirmed GR situations with reason code" (digest line 43 — the formal Pending-GR linkage path is captured here; the warn-and-log override path is at SI-PRO-008); Store Manager — "morning store management screen: 1 expected PO delivery today" (digest line 79 — Store Manager pre-links expected GRs to upcoming production orders so Kitchen Manager can plan against the Pending GR lifecycle state)

**Related screens:**
parent: SI-PRO-002 (PO create — entry point during creation when the user wants to pre-link a Pending GR before submit), parent: SI-PRO-003 (PO detail — entry point via the "Link Pending GR" sub-affordance on an existing PO in Draft or Confirmed state), sibling: SI-PRO-008 (Pending GR override — used when the Kitchen Manager wants to proceed without waiting for confirmation), drill-down: SI-INV-010 (GR entry — for read-only validation of candidate GR records), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it (a) initiates a side-effect linkage that drives the PO into the DL-001 Pending GR sub-state, (b) commits provisional cost figures per FR66 with downstream cascade implications, and (c) involves cross-entity selection across the GR queue. FR64 specifies auto-progression: when a linked GR is confirmed, the PO automatically advances from Pending GR to Confirmed (DL-001 third state). FR67 retrospective cost adjustment then fires service-side (§5) to replace provisional figures with actuals. If a linked GR is rejected at QC instead, the FR67a closure path fires — provisional costs become permanent (CC-PROVISIONAL-FLAG locked), and the FR47a/FR67a reclassification journal fires; the Kitchen Manager and Brand Owner are notified, and the resolution thread is surfaced at SI-PRO-009.

---

#### SI-PRO-008 — Pending GR Override

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Capture a Kitchen Manager's override of an unconfirmed GR situation under the warn-and-log model so production can proceed immediately without waiting for the GR to be formally confirmed by the Store Manager, with mandatory reason code and notification.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, current lifecycle status (typically Pending GR or pre-linkage)
- Unconfirmed GR context: linked or candidate GR reference, vendor, expected items and quantities, expected confirmation window, time elapsed since expected confirmation
- Override scope: which ingredient lines will be sourced from the unconfirmed delivery before formal GR confirmation
- Mandatory reason code dropdown (e.g., delivery received but GR pending / time-critical batch / Store Manager unavailable / other)
- Free-text comment field (mandatory — Kitchen Manager must justify the override)
- Notification preview: Store Manager will be notified immediately; Brand Owner notified for repeat-pattern detection via Epic 12 widget; Cluster Manager visible per FR62 management dashboards
- Warn-and-log preview: confirmation that the override will be logged on PO detail (SI-PRO-003), in the audit timeline, surfaced on the Brand Owner override-frequency dashboard (Epic 12 — CC-OVERRIDE-WIDGET data), and counted in Pending-GR-resolution-outcomes once the underlying GR is resolved

**User actions:**
- Select reason code (mandatory)
- Enter free-text comment (mandatory)
- Confirm override → PO proceeds past the unconfirmed-GR block; provisional cost via FR66 already in effect from the linkage; override row recorded on SI-PRO-003; Store Manager notified; audit log written; data feeds Epic 12 CC-OVERRIDE-WIDGET and Pending-GR-resolution-outcomes pane
- Cancel override (sub-affordance; PO continues to wait for formal GR confirmation; Kitchen Manager remains blocked on the affected lines)

**Cross-cutting:**
CC-AUDIT-LINK, CC-PROVISIONAL-FLAG (provisional cost remains in force until the underlying GR resolves per FR67 / FR67a)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_pending_gr (lifecycle context), status_overridden (override outcome pill on confirmation), warning (unconfirmed-GR context banner), error_container (visual emphasis on the override-action surface), status_provisional, primary, on_primary, outline_variant

**Source FRs:**
FR65 (Kitchen Managers override unconfirmed GR situations with reason codes; proceed immediately with Store Manager notification — this is the dedicated override-capture surface), FR62 (override visible on management dashboards), FR66 (provisional cost via LKP × standard yield remains in effect during the override; resolved by FR67 or FR67a)

**Source journey(s):**
Kitchen Manager — "Pending GR override under warn-and-log: can override unconfirmed GR situations with reason code; proceeds immediately with notification to Store Manager" (digest line 43); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code (tomatoes arrived 5am, started prep before GR confirmed at 9am); tags for epic retrospective" (digest line 31 — overrides captured here surface for cluster review through SI-PRO-003 override history and the Epic 12 widget)

**Related screens:**
parent: SI-PRO-003 (PO detail — entry point via the "Override Pending GR" sub-affordance), sibling: SI-PRO-007 (Pending GR linkage — typically invoked before this screen to set up the linkage), sibling: SI-PRO-005 (general enablement / stock override flow — the parallel surface for non-Pending-GR warnings), drill-down: SI-PRO-009 (Pending GR resolution outcomes — destination once the underlying GR is rejected at QC under FR47a/FR67a), drill-down: SI-INV-010 (linked GR entry — for context), drill-down: SI-INF-006 (audit timeline), surfaces on: SI-RPT-### Brand Owner override-frequency dashboard via CC-OVERRIDE-WIDGET (ID assigned in Task 12)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it (a) captures a mandatory reason code with mandatory free-text justification, (b) fires immediate notifications to the Store Manager, and (c) is one of the warn-and-log override-firing surfaces whose aggregate count is the operational signal on the Brand Owner dashboard. P2B-005 honoured: this screen is one of the override-firing screens whose data feeds the CC-OVERRIDE-WIDGET aggregating instance on Epic 12 SI-RPT-### (ID assigned in Task 12) — the widget itself does not live here. The override does not change the DL-001 lifecycle state directly — the PO remains in Pending GR until the underlying GR is resolved (FR67 confirms → Confirmed; FR67a rejects → Cancelled / GR-Rejected terminal). The provisional cost flag (CC-PROVISIONAL-FLAG) on the PO remains until the linked GR is resolved; on FR67 the flag lifts and actuals replace provisional figures, and on FR67a the flag becomes permanent and the FR47a/FR67a reclassification journal fires.

---

#### SI-PRO-009 — Pending GR Resolution Outcomes

**Primary epic:** Epic 7 — Production Planning

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Drill into the resolution outcome of a previously Pending GR-linked production order — specifically a GR rejected at formal QC (FR47a) — so the Brand Owner can audit the rejected GR, the linked PO, the FR67a permanent provisional flag, and the reclassification journal that moved consumed-portion value from COGS to Wastage.

**Data displayed:**
- Resolution context header: PO reference (CC-TRN-DISPLAY), recipe name, batch size, target department, original Pending GR linkage timestamp, resolution timestamp, resolution outcome (GR Confirmed / GR Rejected — focus of this screen is the Rejected outcome path)
- Rejected GR detail: GR reference, vendor, items and quantities, rejection reason code (FR47a), rejection user (Store Manager), rejection timestamp; link to SI-INV-012 GR rejection screen
- Source PO link: vendor PO TRN (Procurement-side); status (Closed — GR Rejected per FR47a); link to SI-PUR-003
- Vendor Credit Note link: VCN TRN (auto-drafted under FR47b); link to SI-PUR-009
- Linked production order summary: ingredient lines that were sourced from the rejected GR; provisional unit costs that became permanent under FR67a (CC-PROVISIONAL-FLAG with permanent badge)
- Reclassification journal entry: source journal TRN, debit account (Wastage and Write-offs), credit account (COGS — Raw Material Consumption), amount (consumed-portion value reclassified per FR67a), timestamp, link to SI-ACC-### (ID assigned in Task 10)
- Notification trail: Brand Owner notification timestamp per FR67a; any linked vendor-investigation issue ticket (CC-ISSUE-TICKET-LINK)
- Activity timeline (CC-AUDIT-LINK)

**User actions:**
- Drill into the rejected GR record → routes to SI-INV-012
- Drill into the source PO → routes to SI-PUR-003
- Drill into the vendor Credit Note → routes to SI-PUR-009
- Drill into the production order detail → routes to SI-PRO-003
- Drill into the reclassification journal → routes to SI-ACC-### (ID assigned in Task 10)
- Raise issue ticket against the vendor for the underlying quality issue (CC-ISSUE-TICKET-LINK)
- Export the resolution audit thread (CC-EXPORT-TRIGGER: PDF — useful for vendor escalation documentation)
- View full audit timeline

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, CC-EXPORT-TRIGGER, CC-PROVISIONAL-FLAG (permanent badge under FR67a; replaces the standard lift-on-confirmation behaviour of FR67), CC-PENDING-GR-DRILL (this screen is the destination of the drill-through pattern from the Epic 12 override-frequency dashboard Pending-GR-resolution-outcomes pane)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_gr_rejected (rejected-GR pill), status_provisional (permanent provisional-cost badge under FR67a), status_closed (source PO terminal pill), error (rejection-context emphasis), primary, outline_variant

**Source FRs:**
FR67a (when PO linked to Pending GR is rejected at QC: lock at provisional, permanent GR-Rejected flag, reclassify consumed-portion value from COGS to Wastage via compensating journal, notify Brand Owner, surface on FR70 dashboard — this is the dedicated drill-through surface for that closure path), FR47a (Store Manager rejects GR at formal QC — referenced for the rejection context), FR47b (vendor Credit Note auto-drafted from rejected GR — referenced for the vendor CN link), FR66 (provisional cost figures remain in effect; under FR67a the badge becomes permanent), FR70 (this screen feeds the Pending-GR-resolution-outcomes pane on the Brand Owner override-frequency dashboard in Epic 12), FR22 (vendor-investigation issue ticket link)

**Source journey(s):**
Brand Owner — "Pending-GR resolution outcomes review: drills from dashboard pane into rejected GR + linked PO + reclassification journal to investigate vendor quality issues" (digest line 25 — this is the dedicated drill-through destination); Cluster Manager — "Kitchen Manager override visibility: reviews Priya's override from yesterday with reason-code; tags for epic retrospective" (digest line 31 — Cluster Manager uses the resolution-outcomes drill to understand which Pending-GR overrides resolved adversely)

**Related screens:**
parent: SI-RPT-### Brand Owner override-frequency dashboard Pending-GR-resolution-outcomes pane (ID assigned in Task 12 — entry point via CC-PENDING-GR-DRILL), parent: SI-PRO-003 (PO detail — alternative entry point when a PO has a FR67a-rejected linked GR), drill-down: SI-INV-012 (rejected GR record), drill-down: SI-PUR-003 (source PO), drill-down: SI-PUR-009 (vendor Credit Note from rejected GR), drill-down: SI-ACC-### (reclassification journal — ID assigned in Task 10), drill-down: SI-INF-008 (issue ticket create — for vendor investigation), drill-down: SI-INF-006 (audit timeline)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because it has two distinct entry points (the Epic 12 dashboard drill-through via CC-PENDING-GR-DRILL, and the SI-PRO-003 sub-affordance) and surfaces a cross-entity audit thread (rejected GR + linked PO + vendor CN + reclassification journal) that does not naturally belong on any single parent. FR67a is the canonical authority for the permanent CC-PROVISIONAL-FLAG behaviour on this screen — under standard FR67 retrospective adjustment, the flag lifts when the linked GR is confirmed; under FR67a it becomes permanent because the consumed portion's value can never be aligned to a confirmed actual price (the GR was rejected, so no confirmed price exists). The reclassification journal is the FR67a service-side artefact (FR67 itself is service-layer-only per §5; FR67a's UI surface is exactly this drill-through). This screen is the realisation of the implicit Pass-C item "Pending-GR-Resolution-Outcomes Drill-Down" honoured via CC-PENDING-GR-DRILL.

---

#### SI-PRO-010 — Production Output Entry

**Primary epic:** Epic 7 — Production Planning

**Primary device:** mobile-first

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Record the actual production output of an in-progress production order — actual quantity produced, variance versus expected, and mandatory reason code for any variance — so yield is captured accurately for cost, inventory, and operational analytics.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, scheduled date, current lifecycle status (must be In Progress)
- Expected output panel: expected quantity, UOM, expected yield % (per FR53 scaling and recipe yield)
- Actual output input: actual quantity field (numeric; voice input supported per CC-VOICE-INPUT), UOM (pre-filled from recipe)
- Variance summary: actual versus expected, variance quantity (absolute and %), variance direction (over / under)
- Mandatory variance reason code dropdown (only required when variance is non-zero beyond a configurable tolerance band): e.g., raw material quality / equipment issue / operator skill / measurement difference / waste / over-production / other
- Free-text comment field (optional; encouraged for non-routine variances)
- Implausibility warning banner (CC-IMPLAUSIBILITY-WARN): fires when actual output quantity exceeds the theoretical maximum derivable from the consumed raw materials (per FR114); requires mandatory reason code to override
- Submit-state preview: PO will move to Completed (DL-001 fifth state); variance row recorded on PO detail; data flows to Epic 12 yield-variance reporting

**User actions:**
- Enter actual quantity (keyboard or voice via CC-VOICE-INPUT)
- Select variance reason code (mandatory if variance exceeds tolerance)
- Enter optional comment
- Confirm implausibility-warning override with reason code (only if CC-IMPLAUSIBILITY-WARN fires)
- Submit output → PO status moves from In Progress to Completed (DL-001 final transition); variance row recorded on SI-PRO-003; audit log written; data feeds Epic 12 yield-variance reporting and FCCC analytics
- Save as draft (PO remains In Progress; output capture incomplete)

**Cross-cutting:**
CC-DRAFT-PILL, CC-VOICE-INPUT (quantity field — per FR112), CC-IMPLAUSIBILITY-WARN (actual output exceeds theoretical max from consumed raw materials per FR114), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_in_progress (PO context pill), status_completed (post-submit pill), status_variance_flagged (variance summary pill when variance exceeds tolerance), warning (implausibility banner, variance-reason-required indicator), success (variance within tolerance), primary, on_primary, outline_variant

**Source FRs:**
FR69 (production output recording — actual yield versus expected; variance recording with mandatory reason codes — this is the dedicated capture surface), FR112 (voice input for quantity fields during production output recording — CC-VOICE-INPUT), FR114 (implausibility warning when output exceeds theoretical maximum — CC-IMPLAUSIBILITY-WARN)

**Source journey(s):**
Kitchen Manager — "production output recording: records actual yield vs expected; tags variance with mandatory reason code; system captures variance traceability" (digest line 45); Cluster Manager — "variance investigation drill-down: pulls up POS-AB sandwich variance; drills through production output → dispatch challans → POS receipts → POS sales → closing inventory count" (digest line 32 — Cluster Manager uses the production-output records captured here as one node in the variance drill-through chain)

**Related screens:**
parent: SI-PRO-003 (PO detail — entry point via the "Record output" sub-affordance, available when status is In Progress), sibling: SI-PRO-011 (In Progress transition confirm — the prior step in the lifecycle that moves the PO into the In Progress state allowing output entry), drill-down: SI-INF-006 (audit timeline), surfaces on: SI-RPT-### Brand Owner cross-location dashboard yield-variance tile (ID assigned in Task 12)

**Notes:**
FR68 (stock deduction at In Progress transition) is service-layer enforcement — see §5; this screen records the post-deduction output. Mobile-first per the kitchen environment: hands-free voice input for the quantity field is enabled per FR112 / CC-VOICE-INPUT, and the touch-target sizing follows DESIGN.md §15 mobile-touch rules. The implausibility check (CC-IMPLAUSIBILITY-WARN per FR114) is computed against the consumed raw material quantities (which became visible at the stock-deduction event captured at SI-PRO-011); if the actual output exceeds the theoretical maximum from those consumed materials, the warn-and-log override requires a mandatory reason code per FR114. The DL-001 lifecycle transition fired here is In Progress → Completed; this is a non-deduction transition (deduction already fired at Confirmed → In Progress per SI-PRO-011). Tolerance band for "variance reason code mandatory" is configured at the brand level (default 5%); within tolerance, the reason code field is hidden.

---

#### SI-PRO-011 — In Progress Transition Confirm

**Primary epic:** Epic 7 — Production Planning

**Primary device:** responsive-equal

**Roles & scope:**
- Kitchen Manager (scope: location/department)

**Purpose:**
Capture the explicit Kitchen Manager start of a production order — the DL-001 Confirmed → In Progress transition — which atomically fires inventory deduction at the target department and the COGS journal entry, so the deduction event is deliberate rather than implicit.

**Data displayed:**
- PO context header: PO reference, recipe name, batch size, target department, scheduled date, current lifecycle status (must be Confirmed)
- Lifecycle transition preview: current status (Confirmed) → next status (In Progress); deduction-fires marker visible
- Ingredient deduction summary: per ingredient — name, deduction quantity (post-FEFO ordering per FR31, surfaced informationally here), source batch(es) and expiry dates (FEFO order), unit cost (Provisional badge per CC-PROVISIONAL-FLAG if Pending-GR-priced per FR66)
- Total deduction value: cumulative value of raw materials about to be deducted (used for the FR89 COGS journal entry)
- Journal entry preview: target journal — DR COGS — Raw Material Consumption (deduction value), CR Inventory — Raw Materials (deduction value); reference TRN visible (CC-TRN-DISPLAY)
- Confirmation banner: "This action deducts stock and fires the COGS journal. It cannot be undone except via a compensating record (FR117)."
- Activity timeline preview (CC-AUDIT-LINK)

**User actions:**
- Review the deduction summary and journal preview
- Confirm transition → PO status moves from Confirmed to In Progress (DL-001 fourth-state transition); inventoryService.deductStock() fires for all ingredient lines per FR68; FR89 journal entry fires atomically; PO becomes available for output recording at SI-PRO-010
- Cancel transition (sub-affordance; no state change; PO remains in Confirmed)

**Cross-cutting:**
CC-TRN-DISPLAY (journal entry TRN), CC-AUDIT-LINK, CC-PROVISIONAL-FLAG (deduction summary may show Provisional badges on Pending-GR-priced lines)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_confirmed (current state pill), status_in_progress (target state pill), status_provisional (Provisional badge on Pending-GR-priced lines), warning (irreversibility confirmation banner), primary, on_primary, outline_variant

**Source FRs:**
FR66 (provisional cost figures shown for Pending-GR-priced lines), FR87 (TRN display on journal entry preview), FR89 (auto-journal mapping fires at this transition — service-layer-only per §5; preview shown here for visibility)

**Source journey(s):**
Kitchen Manager — "production planning against real-time availability: pulls production planning screen; checks ingredient availability for 8 chocolate cakes, 12 croissant batches, 6 bread loaves" (digest line 40 — the Kitchen Manager explicitly starts each PO from this screen, beginning the deduction); Kitchen Manager — "FEFO prioritisation: prioritises expiring cream into today's pastry cream batch; material selection auto-ordered by system" (digest line 42 — the FEFO-ordered deduction summary is surfaced here so the Kitchen Manager can see which batches will be consumed before confirming)

**Related screens:**
parent: SI-PRO-003 (PO detail — entry point via the "Start production" sub-affordance, available when status is Confirmed), sibling: SI-PRO-010 (production output entry — destination after this transition; output can only be recorded once status is In Progress), drill-down: SI-INF-006 (audit timeline), drill-down: SI-ACC-### (journal entry detail — ID assigned in Task 10)

**Notes:**
FR68 (stock deduction at In Progress transition) is service-layer enforcement — see §5; this screen is the trigger that initiates the deduction, not the deduction logic itself. The canonical authority for the 5-status Production Order lifecycle (Draft → Pending GR → Confirmed → In Progress → Completed) is the decision-log entry that defines its sequence. This screen captures the Confirmed → In Progress transition exactly — the moment at which inventoryService.deductStock() fires per FR68 and the FR89 journal entry mapping fires atomically (DR COGS — Raw Material Consumption, CR Inventory — Raw Materials). The decision-log explicitly requires that the Kitchen Manager start the production order deliberately — that deliberateness is the reason this screen exists as a separate ID per §7 rather than being an inline confirm dialog on SI-PRO-003. FR68 is service-layer-only per §5 (the deduction itself is a backend operation); the surface here is the trigger and preview, not the deduction logic. FR67 retrospective cost adjustment (also service-layer-only per §5) fires later if any Pending-GR-priced line is resolved by GR confirmation; under the GR-rejected closure path the provisional cost stays permanent and the reclassification journal fires instead. The CC-PROVISIONAL-FLAG on the deduction summary surfaces any line where the cost figure is provisional per FR66; the COGS journal value reflects provisional cost at the time of deduction and is later adjusted by retrospective cost adjustment or the GR-rejected closure path as appropriate.

### Epic 8 — Dispatch & Distribution (DSP)

Epic 8 covers the full dispatch and distribution workflow on two parallel tracks. The internal track moves final products from production departments (Central Kitchens) to POS outlets via internal dispatch challans with digital delivery confirmation at the receiving end. The B2B track moves goods from a Brand or Cluster location to an external business customer via B2B challans with a more elaborate lifecycle: Draft → Dispatched → Delivered → terminal closure (Closed — GST Invoiced, Closed — No GST Invoice, Cancelled, or Closed — Returned). The B2B track carries the two-stage journal model of the F&B ERP — Stage 1 (DR Accounts Receivable, CR Revenue — B2B Sales) fires automatically when the challan moves to Dispatched and the DC TRN is generated; Stage 2 (DR Accounts Receivable, CR GST Liability) fires only when Finance Manager or Brand Owner pastes the IRN and atomically sets `gst_invoice_raised = true`. Credit notes against dispatched B2B challans support full or partial returns, fire conditional reversal entries (both stages reversed if `gst_invoice_raised = true` on the source, Stage 1 only otherwise), reinstate stock at the originating department, and carry their own CN TRN with mandatory reference to the original DC TRN. The B2B customer master with its GST registration type enum (Regular / Composition / Unregistered / Consumer) is the gating record before any B2B challan can be created. Cross-cutting GST safeguards — GST registration type checks and unregistered/consumer customer warnings — ride on the B2B GST closure surface. Daily closing inventory at Dispatch and POS departments is cross-listed with Epic 4 (already covered by the inventory closing screens — handled by the Inventory epic) — see Notes on the relevant screens. The credit-note ceiling validation is service-layer-only — see §5.

**Granularity decision:** Internal and B2B challan workflows get separate screen IDs because their lifecycles and journal models are structurally different — the internal challan is a two-step operational document with no GST or credit-note machinery, while the B2B challan carries the full two-stage model and four terminal closure variants. Within the B2B track, each lifecycle transition that fires a journal entry, generates a TRN, or captures atomic compliance data gets its own screen ID per §7 rule 2: dispatch confirmation (Stage 1 + DC TRN), delivery confirmation (also handles refused-on-arrival per UC-7 as an inline disposition because the role and form are the same), GST closure (Stage 2 + IRN paste atomic), no-GST closure (terminal close path that does not fire Stage 2), and credit note creation (CN TRN + reversal journal). The B2B Customer Master is its own screen because the GST registration type enum is the gating contract for FR119 warnings on the closure surface; consolidating it into a settings panel would hide the cross-cutting compliance surface that the closure flow depends on.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-DSP-001 | Internal Dispatch Challan List | responsive-equal | Dispatch Staff (location/department), Cluster Manager (cluster), Brand Owner (brand) |
| SI-DSP-002 | Internal Dispatch Challan Create | desktop-primary | Dispatch Staff (location/department) |
| SI-DSP-003 | Dispatch Receipt Sign-off | mobile-first | POS Staff (location), Dispatch Staff (location) |
| SI-DSP-004 | B2B Customer Master | desktop-primary | Finance Manager (brand), Brand Owner (brand), Cluster Manager (cluster) |
| SI-DSP-005 | B2B Challan List | responsive-equal | Finance Manager (brand), Dispatch Staff (location/department), Brand Owner (brand), Cluster Manager (cluster) |
| SI-DSP-006 | B2B Challan Create | desktop-primary | Finance Manager (brand), Brand Owner (brand), Cluster Manager (cluster) |
| SI-DSP-007 | B2B Challan Detail | responsive-equal | Finance Manager (brand), Brand Owner (brand), Dispatch Staff (location/department), Cluster Manager (cluster) |
| SI-DSP-008 | B2B Dispatch Confirmation | mobile-first | Dispatch Staff (location/department), Finance Manager (brand), Brand Owner (brand) |
| SI-DSP-009 | B2B Delivery Confirmation | mobile-first | Dispatch Staff (location/department), Finance Manager (brand), Brand Owner (brand) |
| SI-DSP-010 | B2B GST Closure | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-DSP-011 | B2B Closure Without GST Invoice | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-DSP-012 | B2B Credit Note Creation | desktop-primary | Finance Manager (brand), Brand Owner (brand) |

---

#### SI-DSP-001 — Internal Dispatch Challan List

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** responsive-equal

**Roles & scope:**
- Dispatch Staff (scope: location/department)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Browse, filter, and search internal dispatch challans from production departments to POS outlets so Dispatch Staff can see today's dispatch queue and oversight roles can monitor delivery confirmations.

**Data displayed:**
- Challan list table: DC reference (TRN visible per CC-TRN-DISPLAY once dispatched), origin department, destination POS outlet, item count, total quantity, scheduled dispatch date, current status pill, delivery-confirmed indicator
- Status pill per row reflecting the internal challan lifecycle: Draft, Dispatched, Delivered (no GST closure for internal challans)
- Filter chips: status, origin department, destination outlet, date range, has-attachments flag
- Summary counters: total challans in current view, awaiting dispatch, awaiting delivery confirmation, delivered today
- Search bar: by DC reference or destination outlet

**User actions:**
- Filter and search by any combination of chips and search terms
- Open challan row → drill-down to internal challan detail (consolidated into SI-DSP-002 in edit mode for Draft, read-only for non-Draft per §7)
- Create new internal challan → routes to SI-DSP-002
- Export list (CC-EXPORT-TRIGGER: CSV / Excel)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_in_progress, status_completed, outline_variant

**Source FRs:**
FR71 (internal dispatch challans from production departments to POS — list is the navigation surface), FR82 (challan PDF generation — sub-affordance per row to download challan PDF)

**Source journey(s):**
Dispatch Staff — "dispatch order visibility: opens dispatch screen on mobile; sees 2 internal dispatch orders (POS-AA, POS-AB) + 1 B2B challan (Sunrise Cafe)" (digest line 60 — list is the navigation surface for finding today's dispatch queue); Cluster Manager — "variance investigation drill-down: pulls up POS-AB sandwich variance; drills through production output → dispatch challans → POS receipts" (digest line 32 — uses the list to find the dispatch challan in the variance audit thread)

**Related screens:**
sibling: SI-DSP-002 (internal challan create), drill-down: SI-DSP-003 (dispatch receipt sign-off — destination after dispatch), drill-down: SI-INF-006 (audit timeline)

**Notes:**
No CC-AUDIT-LINK on the list screen — audit links appear per-record on the consolidated detail/create surface (SI-DSP-002 in read-only mode for non-Draft) only. Internal challans use the Draft / Dispatched / Delivered shape only — there is no GST closure step and no credit note workflow (those are B2B-only). The status pill uses status_draft, status_in_progress for Dispatched, status_completed for Delivered — internal flow does not have its own dedicated semantic tokens and the generic lifecycle tokens fit per the §3 token discipline. No CC-DRAFT-PILL on the list (no inline editing); the pill is on the create / detail surface.

---

#### SI-DSP-002 — Internal Dispatch Challan Create

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Dispatch Staff (scope: location/department)

**Purpose:**
Create a new internal dispatch challan from a production department to a POS outlet with item lines, quantities, and optional file attachments before confirming dispatch.

**Data displayed:**
- Origin department selector (auto-defaulted to user's current department; restricted to production departments where the user has dispatch authority)
- Destination POS outlet selector (autocomplete from the MDM hierarchy, restricted to POS outlets within the brand)
- Scheduled dispatch date and time picker (defaults to today)
- Item lines table: item name (autocomplete from final-product master per FR28 product-type direction), required quantity, UOM, current available stock at origin department (live), enablement status for the item × destination pair, availability status pill (Sufficient / Partial / Insufficient)
- File attachment area (FR81 — photos, dispatch notes, vehicle docket scans)
- Draft pill (status_draft) prominent while unsaved
- Implausibility warning (CC-IMPLAUSIBILITY-WARN): fires if any line quantity exceeds plausible holding capacity at origin
- Duplicate warning (CC-DUPLICATE-WARN): fires if a same-day challan to the same destination with overlapping items already exists per FR115

**User actions:**
- Select origin department and destination outlet
- Add item lines (with autocomplete and live stock check)
- Adjust quantities
- Attach files (drag/drop or file picker)
- Save as draft (DC remains in Draft status; no inventory movement; no TRN yet per FR75)
- Submit and confirm dispatch → routes to SI-DSP-003 sign-off context for the receiving end and triggers DC TRN generation per FR75 once dispatch is confirmed
- Cancel draft (sub-affordance; confirm dialog; CC-REVERSE-CANCEL for Draft status)
- Generate challan PDF (FR82 — sub-affordance available once challan has DC TRN)

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL (item lines pre-fill from yesterday's equivalent challan to the same destination per FR113), CC-IMPLAUSIBILITY-WARN, CC-DUPLICATE-WARN, CC-REVERSE-CANCEL (Draft cleanly cancellable per FR117), CC-AUDIT-LINK, CC-TRN-DISPLAY (DC TRN once dispatched)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_in_progress (Dispatched pill once submitted), warning (implausibility / duplicate banners), success (sufficient stock indicator), error (insufficient stock indicator), primary, on_primary, outline_variant

**Source FRs:**
FR71 (create internal dispatch challan with items, quantity, target POS), FR75 (DC TRN generation at Dispatched status — `DC-YYYY-LOC-SEQ`), FR81 (file attachments to dispatch challan), FR82 (challan PDF generation), FR113 (CC-PREFILL pre-fills from yesterday's equivalent challan), FR114 (implausibility warn-and-log), FR115 (duplicate warn-and-log)

**Source journey(s):**
Dispatch Staff — "internal challan generation: confirms quantities against production output; generates internal challans for POS-AA and POS-AB; stock decremented from Dispatch department; loads vehicle" (digest line 61 — the create surface is exactly this moment); Dispatch Staff — "dispatch order visibility: opens dispatch screen on mobile; sees 2 internal dispatch orders" (digest line 60 — entry into create from the list)

**Related screens:**
parent: SI-DSP-001 (list — entry point for create), sibling: SI-DSP-003 (dispatch receipt sign-off — receiving-end confirmation after dispatch), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-010 (reverse / cancel confirmation pattern for Draft cancellation), drill-down: SI-ACC-### (journal entry detail — ID assigned in Task 10 — internal dispatch typically does not fire AR / Revenue journals because the recipient is internal; transfer-style movement entries may apply per Epic 10 mapping rules)

**Notes:**
Per §7 granularity rule, the internal challan list (SI-DSP-001) and the create / detail surface (this screen) consolidate into two IDs because internal challans have no separate GST or closure workflow — the screen reads as Detail in non-Draft status (read-only view of confirmed lines, attachments, delivery status) and reads as Create / Edit in Draft status. P2B-001 honoured via CC-DRAFT-PILL while the challan is Draft. Inventory decrement fires only at Dispatched per FR74 lifecycle rule (cross-cited from B2B but the same enforcement applies here). FR82 PDF generation sub-affordance becomes active once the DC TRN exists. Daily closing inventory on the dispatch department per FR77 is cross-listed with Epic 4 — see SI-INV-015 (closing inventory entry — dispatch daily). FR115 duplicate detection compares same-day same-destination challans per the §3 catalogue contract; the conflicting record reference is shown in the warning banner.

---

#### SI-DSP-003 — Dispatch Receipt Sign-off

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** mobile-first

**Roles & scope:**
- POS Staff (scope: location)
- Dispatch Staff (scope: location)

**Purpose:**
Confirm digital receipt of an internal dispatch challan at the destination POS outlet with quantity verification so inventory updates simultaneously at both ends.

**Data displayed:**
- Challan header: DC TRN (CC-TRN-DISPLAY), origin department, dispatched-at timestamp, vehicle / driver reference (if recorded)
- Item lines table: item name, dispatched quantity, received quantity input (defaults to dispatched), UOM, variance flag if received < dispatched
- Variance reason code dropdown (per line, mandatory if received quantity < dispatched): short-receipt / damage in transit / spoilage / counting discrepancy / other
- Free-text comment field per varying line (optional)
- Implausibility warning (CC-IMPLAUSIBILITY-WARN): fires if received quantity exceeds dispatched quantity (per FR114 logic adapted for receiving end)
- Sign-off confirmation block: receiving user identity (auto-captured from session), receiving timestamp (auto-captured on submit)

**User actions:**
- Verify item lines against the physical delivery (mobile scan support per FR26 carries through, though primary scope here is sign-off not full GR)
- Edit received quantity per line (with mandatory reason code on shortfall)
- Use voice input on the received-quantity field (CC-VOICE-INPUT per FR112)
- Confirm receipt → status moves to Delivered; inventory increments at destination POS and decrements at origin department atomically per FR76
- Raise issue ticket against this dispatch (CC-ISSUE-TICKET-LINK — for disputes that need follow-up beyond sign-off variance)

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-IMPLAUSIBILITY-WARN, CC-VOICE-INPUT (received-quantity field), CC-ISSUE-TICKET-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_in_progress (Dispatched pre-sign-off), status_completed (Delivered after sign-off), status_variance_flagged (per-line pill when received < dispatched), warning (implausibility banner), primary, on_primary, outline_variant

**Source FRs:**
FR76 (digital delivery confirmation by receiving staff with quantity verification; inventory updates at both locations), FR71 (internal dispatch — sign-off completes the internal flow), FR112 (voice input on quantity fields), FR114 (implausibility warn-and-log on over-receipt), FR22 (issue ticket link for disputes)

**Source journey(s):**
Dispatch Staff — "digital delivery confirmation — receiving: at POS-AA, receiving staff opens internal challan on phone, verifies quantities, confirms receipt digitally; inventory updates simultaneously at both ends" (digest line 62 — this screen is exactly that moment); POS Staff — "digital dispatch receipt confirmation: at 11:35am, receives internal challan from Ravi; verifies items match; confirms receipt digitally in <30 seconds" (digest line 90 — POS Staff is the primary user on the receiving end of internal challans)

**Related screens:**
parent: SI-DSP-001 (internal challan list — entry point on the receiving side), sibling: SI-DSP-002 (internal challan create — origin-side surface), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket — for variance disputes)

**Notes:**
Mobile-first because the primary use case is on the receiving floor at the POS outlet where staff carry phones; desktop variant is a wider table for batch sign-off when multiple challans arrive together. The atomic both-ends inventory update is a service-layer guarantee per FR76 — the screen surfaces the trigger and the success state, but the service ensures the two-sided write is atomic. Variance at sign-off (received < dispatched) is captured here with a mandatory reason code per the journey moment, but the formal closing-inventory variance reconciliation lives in Epic 4 SI-INV-014/015 per FR77 cross-listing — sign-off variance is the immediate operational signal; closing inventory is the daily reconciliation. CC-VOICE-INPUT honours FR112 since the voice scope explicitly covers GR and production output quantity fields and the sign-off received-quantity is the same shape.

---

#### SI-DSP-004 — B2B Customer Master

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster) — read-only when scope-mismatched; create / edit allowed at brand scope only

**Purpose:**
Maintain B2B customer master records — the gating data structure that any B2B challan creation requires — with GST registration type, GSTIN, credit terms, and contact details.

**Data displayed:**
- Customer list table (left pane or top-of-screen): customer code (auto-generated `CUST-{SEQUENCE}`), customer name, GST registration type, GSTIN (if any), credit terms, status (Active / Inactive)
- Customer detail / edit form (right pane or below): customer code (read-only after creation), customer name, registered address (multi-line), GSTIN (optional, validated to 15-character format if provided), GST registration type enum (Regular / Composition / Unregistered / Consumer), credit terms in days (e.g., 30 / 45 / 60), contact person name, contact phone, status (Active / Inactive)
- Filter chips: GST registration type, status, credit terms band
- Search bar: by name, customer code, or GSTIN
- Open-challan-count indicator per row: count of B2B challans against this customer not yet in a terminal state (data-quality awareness for deactivation)

**User actions:**
- Search and filter the customer list
- Create new customer → form opens with empty fields; system assigns `CUST-{SEQUENCE}` on save per FR73
- Edit customer details (all fields editable except customer code)
- Deactivate customer (soft-delete; system warns if customer has open B2B challans not in terminal state per FR116 cross-module consistency)
- Reactivate customer

**Cross-cutting:**
CC-DRAFT-PILL (form-level draft state while edits are unsaved), CC-AUDIT-LINK, CC-DATA-QUALITY-ALERT (deactivation attempt with open challans surfaces per FR116)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft (form draft), status_confirmed (Active customer pill), surface_container_high (Inactive), warning (deactivation-with-open-challans banner), primary, on_primary, outline_variant

**Source FRs:**
FR73 (B2B customer master CRUD with auto-generated customer code, GST registration type enum, credit terms, contact details), FR116 (data quality alert when deactivating a customer with open B2B challans)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow — Stage 2 initiation: identifies 3 B2B challans in Delivered status needing GST invoice confirmation" (digest line 51 — the customer master is the prerequisite record set; Finance maintains it as part of monthly B2B operations); Dispatch Staff — "B2B challan dispatch: confirms dispatch on B2B challan for Sunrise Cafe" (digest line 63 — Dispatch references the customer record, doesn't edit it; Cluster Manager may create at cluster scope when onboarding new B2B accounts in their region)

**Related screens:**
sibling: SI-DSP-005 (B2B challan list — uses customer as a filter facet), sibling: SI-DSP-006 (B2B challan create — selects customer from this master), drill-down: SI-INF-006 (audit timeline)

**Notes:**
The GST registration type enum (Regular / Composition / Unregistered / Consumer) on this screen is the gating contract for the FR119 warning that surfaces on SI-DSP-010 (B2B GST closure) — when Finance attempts to set `gst_invoice_raised = true` on a challan whose customer has registration type Unregistered or Consumer, the CC-UNREGISTERED-CUSTOMER-WARN fires there. The customer code format (`CUST-{SEQUENCE}`) is system-generated at create per FR73 and is the immutable customer reference used on all challans, exports, and AR aging reports. Credit terms are informational in MVP per the B2B challan spec §2 — no automatic credit-limit blocking. FR116 cross-module consistency: deactivating a customer with open challans surfaces a CC-DATA-QUALITY-ALERT on the Brand Owner dashboard via Epic 12 (SI-RPT-### — ID assigned in Task 12) — the deactivation itself is allowed but flagged.

---

#### SI-DSP-005 — B2B Challan List

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** responsive-equal

**Roles & scope:**
- Finance Manager (scope: brand)
- Dispatch Staff (scope: location/department)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Browse, filter, and search B2B challans across the full lifecycle so Finance can drive the GST closure queue, Dispatch can find dispatch-ready records, and oversight roles can monitor open AR exposure.

**Data displayed:**
- Challan list table: DC reference (TRN visible per CC-TRN-DISPLAY once dispatched; draft challans show no TRN per FR75), customer name, customer GST registration type pill, item count, total base value, current lifecycle status pill, gst_invoice_raised flag indicator, dispatched-at timestamp (when applicable)
- Status pill per row reflecting the canonical B2B lifecycle from `04-b2b-challan-spec.md` §3: Draft, Dispatched, Delivered, Closed — GST Invoiced, Closed — No GST Invoice, Cancelled, Closed — Returned
- Open-CN indicator per row: count of credit notes against this challan (visual cue on partially-returned challans)
- Filter chips: status (full lifecycle), customer, customer GST registration type, gst_invoice_raised flag (true / false / pending), date range (dispatched-at), origin location
- Summary counters: total challans in current view, awaiting dispatch (Draft), awaiting delivery (Dispatched), awaiting GST closure (Delivered), open AR value
- Search bar: by DC reference, customer name, or customer code

**User actions:**
- Filter and search by any combination of chips and search terms
- Open challan row → drill-down to SI-DSP-007 (B2B Challan Detail)
- Create new B2B challan → routes to SI-DSP-006
- Export list (CC-EXPORT-TRIGGER: CSV / Excel / PDF; the Sales Register accountant export per FR96 also covers this list — see Notes)
- Bulk download challan PDFs for selected rows (FR82 — sub-affordance; bulk select + confirm)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_in_progress (Dispatched pill), status_completed (Delivered pill), status_closed (Closed — GST Invoiced and Closed — No GST Invoice pills), status_cancelled, status_returned (Closed — Returned pill), outline_variant

**Source FRs:**
FR72 (B2B dispatch challans for external business customers — list is the navigation surface), FR74 (full B2B challan lifecycle visible per row — Draft, Dispatched, Delivered, Closed — GST Invoiced, Closed — No GST Invoice, Cancelled, Closed — Returned), FR75 (DC TRN visible per CC-TRN-DISPLAY once challan reaches Dispatched), FR82 (challan PDF generation — bulk-download sub-affordance)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow — Stage 2 initiation: identifies 3 B2B challans in Delivered status needing GST invoice confirmation" (digest line 51 — Finance uses the Delivered status filter to find the GST closure queue); Dispatch Staff — "dispatch order visibility: opens dispatch screen on mobile; sees ... 1 B2B challan (Sunrise Cafe)" (digest line 60 — Dispatch uses the Draft / Dispatched filters to find dispatch-ready B2B records); Cluster Manager — "variance investigation drill-down: pulls up POS-AB sandwich variance; drills through ... dispatch challans" (digest line 32 — uses the list to trace the audit thread for B2B-flavoured variance investigations)

**Related screens:**
sibling: SI-DSP-006 (B2B challan create — entry point from list), drill-down: SI-DSP-007 (B2B challan detail — primary drill-target), drill-down: SI-INF-006 (audit timeline), exported via: SI-ACC-### Sales Register / Customer AR Aging exports (IDs assigned in Task 10 — FR96 export structure covers all B2B challans on this list)

**Notes:**
No CC-AUDIT-LINK on the list screen — audit links appear per-record on SI-DSP-007. The status pill uses status_in_progress for Dispatched (in transit / awaiting acknowledgement) and status_completed for Delivered (acknowledged but not yet GST-closed) per the §3 token discipline; the two terminal closure variants (GST Invoiced and No GST Invoice) both use status_closed, with the gst_invoice_raised flag visible as a distinct indicator on the row so Finance can scan the queue. Closed — Returned uses status_returned (semantically appropriate per the §3 catalogue). The Sales Register export per FR96 is owned by Epic 10 (SI-ACC-### — ID assigned in Task 10); this list is the operational dual surface — one drives accountant handoff, the other drives daily lifecycle work.

---

#### SI-DSP-006 — B2B Challan Create

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Create a B2B dispatch challan in Draft status with customer reference, item lines, rates, and optional GST placeholder fields before Dispatch Staff confirms the actual dispatch event.

**Data displayed:**
- Customer selector: autocomplete from B2B customer master (SI-DSP-004); on selection, customer code, GSTIN, GST registration type, credit terms, address auto-displayed in a read-only context block
- Origin location selector (auto-defaulted to user's permitted location/cluster scope)
- Optional B2B customer reference field (e.g., customer's PO number or order reference)
- Item lines table: item name (autocomplete from final-product master per FR28 product-type direction; raw materials cannot be sold via B2B challan), quantity, UOM, rate per UOM, line value, optional HSN code per line (selected from GSTN dropdown per `04-b2b-challan-spec.md` §7 — not free text)
- Totals strip: subtotal (sum of line values), tax fields preview (read-only at create stage; Finance fills GST fields later on SI-DSP-010 if applicable; placeholder fields per FR97 are nullable and may be left empty)
- Optional GST placeholder fields block (collapsed by default; Finance Manager / Brand Owner only — other roles see read-only): place_of_supply, tax_rate_percent, cgst_amount, sgst_amount, igst_amount, buyer_gstin (defaults from customer master if present)
- File attachment area (FR81 — photos, dispatch notes, customer-PO scan)
- Draft pill (status_draft) prominent while unsaved
- Implausibility warning (CC-IMPLAUSIBILITY-WARN): fires if any line quantity exceeds plausible holding capacity at origin
- Duplicate warning (CC-DUPLICATE-WARN): fires if a same-day challan to the same customer with overlapping items already exists per FR115
- GST validation warning (CC-GST-FIELD-VALIDATION): fires if the optional GST fields are partially filled in an inconsistent place-of-supply / CGST-SGST-IGST combination per FR118

**User actions:**
- Select customer (gates the rest of the form per FR73)
- Select origin location
- Add item lines with quantity, rate, UOM, optional HSN code
- Optionally fill GST placeholder fields (Finance Manager / Brand Owner only; FR97 role binding for GST field editing)
- Attach files (drag/drop or file picker)
- Save as draft (challan remains in Draft status; no inventory movement; no DC TRN per FR75; no journal entries fire)
- Submit and pass to Dispatch Staff for confirmation (status remains Draft until Dispatch confirms on SI-DSP-008; this submit is purely a workflow handoff, not a status transition per `04-b2b-challan-spec.md` §3)
- Cancel draft (sub-affordance; confirm dialog; CC-REVERSE-CANCEL for Draft status — clean no-op per UC-6 with no inventory or accounting impact)

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL (line items pre-fill from last equivalent challan to the same customer per FR113), CC-IMPLAUSIBILITY-WARN, CC-DUPLICATE-WARN, CC-GST-FIELD-VALIDATION, CC-REVERSE-CANCEL (Draft cleanly cancellable per FR117 and UC-6), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, warning (implausibility / duplicate / GST validation banners), error (insufficient stock indicator), success (sufficient stock indicator), primary, on_primary, outline_variant

**Source FRs:**
FR72 (B2B challan create with customer reference, items, quantities, rates), FR73 (customer selection from B2B customer master with GST registration type and GSTIN context), FR74 (Draft is the lifecycle entry state; no inventory or journal impact yet), FR75 (DC TRN does not generate at Draft — generates at Dispatched on SI-DSP-008), FR81 (file attachments to dispatch challan), FR97 (GST placeholder fields role binding — Finance Manager and Brand Owner only for GST edits), FR113 (CC-PREFILL pre-fills from last equivalent challan), FR114 (implausibility warn-and-log), FR115 (duplicate warn-and-log), FR118 (GST tax field combination validation per CC-GST-FIELD-VALIDATION)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow" entry point (digest line 51 — Finance creates B2B challans as part of monthly B2B operations; GST fields filled at create when known, otherwise at SI-DSP-010); Dispatch Staff — "dispatch order visibility: ... 1 B2B challan (Sunrise Cafe)" (digest line 60 — Dispatch picks up the Draft challan created here and progresses it via SI-DSP-008)

**Related screens:**
parent: SI-DSP-005 (B2B list — entry point for create), sibling: SI-DSP-004 (B2B customer master — customer selection source), drill-down: SI-DSP-007 (B2B detail — destination after save), sibling: SI-DSP-008 (B2B dispatch confirmation — Draft → Dispatched transition surface; Dispatch Staff acts there), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-010 (reverse / cancel confirmation pattern for Draft cancellation)

**Notes:**
Per §7 granularity rule, this is a Draft-state form — P2B-001 honoured via CC-DRAFT-PILL. The DC TRN is NOT generated here per FR75 and `04-b2b-challan-spec.md` §5 — TRN generates at the Dispatched transition on SI-DSP-008. No journal entries fire here either; Stage 1 fires at Dispatched per `04-b2b-challan-spec.md` §6. GST placeholder fields are intentionally optional at create per E-1 of the B2B challan spec — Finance can fill them later on SI-DSP-010 before closure; the system never fails on empty GST fields. The CC-GST-FIELD-VALIDATION cross-cutting fires only when fields are partially filled inconsistently per FR118 (intra-state requires CGST+SGST with IGST null; inter-state requires IGST with CGST+SGST null) — empty fields are valid. The FR97 role binding is enforced at the form level: Finance Manager and Brand Owner can edit the GST placeholder block; Cluster Manager sees it read-only. Cancellation of Draft is a clean no-op per UC-6 and CC-REVERSE-CANCEL — no inventory or accounting impact.

---

#### SI-DSP-007 — B2B Challan Detail

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** responsive-equal

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Dispatch Staff (scope: location/department)
- Cluster Manager (scope: cluster)

**Purpose:**
Show the complete state of a B2B challan — lifecycle position, item lines, attachments, GST fields, journal entries, related credit notes, and refused-on-arrival disposition — so any role can act on the next available transition or audit prior decisions.

**Data displayed:**
- Challan header: DC TRN (CC-TRN-DISPLAY once Dispatched; nothing displayed at Draft per FR75), customer name with code, customer GST registration type pill (with CC-UNREGISTERED-CUSTOMER-WARN visual reminder if Unregistered or Consumer), origin location, creation user and timestamp, scheduled dispatch
- Lifecycle pill — one of the canonical seven B2B states from `04-b2b-challan-spec.md` §3: Draft, Dispatched, Delivered, Closed — GST Invoiced, Closed — No GST Invoice, Cancelled, Closed — Returned
- Lifecycle progress strip: visualises the lifecycle flow with the current status highlighted; Stage 1 journal-fires marker on the Dispatched step; Stage 2 journal-fires marker on the Closed — GST Invoiced step
- Item lines table: item name, quantity, UOM, rate, line value, HSN code per line (per `04-b2b-challan-spec.md` §7 — HSN is per line, not header)
- Attachments panel: file thumbnails / icons with download links (per FR81)
- GST fields panel (Finance Manager / Brand Owner editable until Closed per E-1; locked once Closed per E-2): buyer_gstin, place_of_supply, tax_rate_percent, cgst_amount, sgst_amount, igst_amount, gst_invoice_raised flag, irn (read-only display; populated atomically with flag on SI-DSP-010), gst_invoice_raised_at timestamp, irn_generated_at timestamp
- Refused-on-arrival flag (visible per UC-7 when applicable; surfaces the dispute disposition captured on SI-DSP-009)
- Related credit notes panel: list of CN TRNs created against this DC TRN (each linkable to SI-DSP-012), per-CN — CN TRN, value, created-at; cumulative CN value vs source value with FR80 ceiling indicator (the validation itself is service-layer per §5)
- Journal entries summary: Stage 1 entry (DR Accounts Receivable, CR Revenue — B2B Sales) once Dispatched; Stage 2 entry (DR Accounts Receivable, CR GST Liability) once GST closed (links to SI-ACC-### journal detail — IDs assigned in Task 10)
- Activity timeline (CC-AUDIT-LINK)

**User actions:**
- Confirm dispatch (sub-affordance; routes to SI-DSP-008; available when status is Draft)
- Confirm delivery or mark as refused on arrival (sub-affordance; routes to SI-DSP-009; available when status is Dispatched)
- Close with GST invoice — paste IRN (sub-affordance; routes to SI-DSP-010; available when status is Delivered; Finance Manager / Brand Owner only per FR78)
- Close without GST invoice (sub-affordance; routes to SI-DSP-011; available when status is Delivered; Finance Manager / Brand Owner only per FR74 closure path)
- Create credit note (sub-affordance; routes to SI-DSP-012; available when status is Dispatched, Delivered, or any Closed terminal; Finance Manager / Brand Owner only)
- Edit GST placeholder fields inline (Finance Manager / Brand Owner only; available until Closed per E-1; locked thereafter per E-2)
- Cancel challan (sub-affordance; available in Draft status only per CC-REVERSE-CANCEL / FR117 / UC-6; post-Dispatched correction is a credit note via SI-DSP-012)
- Generate challan PDF (FR82 — sub-affordance available once challan has DC TRN)
- Attach additional files (FR81 — sub-affordance; allowed in any non-Closed state; locked thereafter per E-2)
- Raise issue ticket against this challan (CC-ISSUE-TICKET-LINK)
- View full audit timeline

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK, CC-UNREGISTERED-CUSTOMER-WARN (visual reminder when customer GST registration type is Unregistered or Consumer; the actionable warning fires on SI-DSP-010 when Finance attempts to set gst_invoice_raised), CC-REVERSE-CANCEL (Draft cancellable; post-Dispatched correction via credit note)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_in_progress (Dispatched pill), status_completed (Delivered pill), status_closed (Closed — GST Invoiced and Closed — No GST Invoice pills), status_cancelled, status_returned (Closed — Returned pill), warning (Unregistered customer reminder banner; refused-on-arrival flag), primary, outline_variant

**Source FRs:**
FR72 (B2B challan detail surface), FR73 (customer context with GST registration type pill), FR74 (full B2B lifecycle visible — all seven states; refused-on-arrival flag per UC-7 disposition surfaced on the detail), FR75 (DC TRN visible once Dispatched; CN TRN visible per related-CN panel), FR78 (GST closure entry point — Finance Manager / Brand Owner only sub-affordance), FR79 (credit note entry point with related-CN panel), FR81 (file attachments visible and editable until Closed), FR82 (challan PDF generation), FR87 (TRN display per CC-TRN-DISPLAY), FR97 (GST field role binding visible as edit-affordance gating), FR117 (cancellation pre-Dispatched only; post-Dispatched correction is credit note), FR119 (Unregistered/Consumer customer reminder pill), FR22 (issue ticket link)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow — Stage 2 initiation: identifies 3 B2B challans in Delivered status needing GST invoice confirmation; ... receives IRNs from accountant for 2 challans; pastes IRNs into challan records" (digest lines 51-52 — Finance lands on the detail of each Delivered challan to invoke the GST closure sub-affordance); Finance Manager — "credit note creation with conditional two-stage reversal: customer dispute arrives; creates Credit Note for partial return" (digest line 54 — Finance opens the source challan detail to invoke the credit note sub-affordance); Dispatch Staff — "B2B delivery confirmation: delivers to customer; customer signs off digitally; status moves to Delivered" (digest line 64 — Dispatch lands on detail to invoke the delivery confirmation sub-affordance); Cluster Manager — "variance investigation drill-down: ... drills through production output → dispatch challans" (digest line 32 — uses detail for B2B audit trace)

**Related screens:**
parent: SI-DSP-005 (B2B list — typical entry point), sibling: SI-DSP-006 (B2B challan create), sibling: SI-DSP-008 (B2B dispatch confirmation), sibling: SI-DSP-009 (B2B delivery confirmation), sibling: SI-DSP-010 (B2B GST closure), sibling: SI-DSP-011 (B2B closure without GST invoice), sibling: SI-DSP-012 (B2B credit note creation), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket), drill-down: SI-INF-010 (reverse / cancel confirmation for Draft cancellation), drill-down: SI-ACC-### (journal entry detail for Stage 1 and Stage 2 — IDs assigned in Task 10)

**Notes:**
This is the central B2B challan navigation surface — every transition action is a sub-affordance routing to a dedicated screen per §7 rule 2 (each transition fires either a TRN, a journal entry, or atomic compliance data and therefore deserves its own screen ID). The lifecycle uses six distinct semantic tokens — status_draft, status_in_progress (for Dispatched), status_completed (for Delivered), status_closed (for both closure terminals), status_cancelled, status_returned — with the gst_invoice_raised flag distinguishing the two Closed variants on the row. Refused-on-arrival is captured as a flag on the Delivered transition via SI-DSP-009 per UC-7; the flag is surfaced here as a visible badge so Finance knows to expect a credit note follow-up. CC-UNREGISTERED-CUSTOMER-WARN appears here as a reminder pill (passive); the actionable warning with mandatory reason code fires on SI-DSP-010 per FR119. GST field locking once Closed per E-2 of the B2B spec is enforced at the form level on this screen — edit affordances are removed in Closed states; correction path is then a credit note plus a fresh challan. Cumulative CN value vs source value indicator visualises the FR80 ceiling, but the validation itself is service-layer per §5 — `creditNoteService.validateCumulativeLimit()` blocks creation if exceeded.

---

#### SI-DSP-008 — B2B Dispatch Confirmation

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** mobile-first

**Roles & scope:**
- Dispatch Staff (scope: location/department)
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Confirm the physical dispatch of a B2B challan moving the status from Draft to Dispatched, generating the DC TRN, decrementing inventory at the origin, and firing the Stage 1 journal entry atomically.

**Data displayed:**
- Challan header: customer name and code, origin location, scheduled dispatch, item count, total base value
- Item lines summary: item name, quantity, UOM, current available stock at origin, enablement status for the item × destination contract per FR8 (gating)
- Pre-dispatch checks panel: enablement check pass/fail per line (from inventoryService.checkEnablement per the §5 service-layer enforcement); insufficient-stock indicator per line; FEFO-ordered batch preview per line (which batches will be consumed at deduction per FR31)
- Vehicle / driver reference field (optional) and dispatch timestamp (defaults to now, editable)
- Confirmation block: explicit consequences shown — "On confirm: status → Dispatched, DC TRN generated (DC-YYYY-LOC-SEQ), inventory decremented from origin, Stage 1 journal entry fires (DR Accounts Receivable, CR Revenue — B2B Sales)"
- Implausibility warning (CC-IMPLAUSIBILITY-WARN): fires if any quantity exceeds the source-stock max plausible

**User actions:**
- Verify item lines and pre-dispatch checks
- Enter optional vehicle / driver reference
- Adjust dispatch timestamp if dispatching back-dated (within tolerance)
- Confirm dispatch → status moves to Dispatched; DC TRN generated per FR75; inventory deducted via inventoryService.deductStock() per `04-b2b-challan-spec.md` §4; Stage 1 journal entry fires per FR89 / FR92 mapping rule
- Cancel and return to detail (no state change)

**Cross-cutting:**
CC-DRAFT-PILL (pre-confirmation the challan is still Draft), CC-TRN-DISPLAY (DC TRN appears on confirmation), CC-AUDIT-LINK, CC-IMPLAUSIBILITY-WARN

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft (pre-confirmation pill), status_in_progress (Dispatched pill on confirm), warning (implausibility banner), success (enablement / stock pass indicator), error (enablement / stock fail indicator), primary, on_primary, outline_variant

**Source FRs:**
FR72 (B2B challan dispatch — confirmation surface), FR74 (Draft → Dispatched transition; inventory decrement only at Dispatched per `04-b2b-challan-spec.md` §3), FR75 (DC TRN generation at Dispatched — `DC-YYYY-LOC-SEQ`), FR114 (implausibility warn-and-log), FR8 (material enablement check is service-layer-enforced per §5 — surfaces here as gating indicator)

**Source journey(s):**
Dispatch Staff — "B2B challan dispatch & Stage 1 journal trigger: confirms dispatch on B2B challan for Sunrise Cafe; status moves to Dispatched; DC TRN generated (DC-2026-CKA-000045); Stage 1 journal entry fires (DR Accounts Receivable, CR Revenue — B2B Sales)" (digest line 63 — this screen is exactly that moment)

**Related screens:**
parent: SI-DSP-007 (B2B detail — entry point via the "Confirm dispatch" sub-affordance, available when status is Draft), sibling: SI-DSP-009 (B2B delivery confirmation — destination after Dispatched), drill-down: SI-INF-006 (audit timeline), drill-down: SI-ACC-### (journal entry detail — Stage 1 — ID assigned in Task 10)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because the transition (a) generates a TRN per FR75, (b) fires the Stage 1 journal entry per FR89 / FR92, and (c) decrements inventory atomically — three side-effects that warrant a deliberate confirmation surface rather than an inline button on detail. Mobile-first because the primary use case is dispatch loading bay where Dispatch Staff carries a phone (mirrors the journey moment). The transition is immutable per `04-b2b-challan-spec.md` §3 — once Dispatched, the challan cannot move back to Draft; correction path post-confirmation is a credit note via SI-DSP-012. FR8 material enablement check is service-layer-enforced per §5 — the screen surfaces the gating indicator but the service blocks the transition at the API boundary if enablement fails. FR31 FEFO ordering inside inventoryService.deductStock() is service-layer-only per §5 — the screen surfaces the FEFO-ordered batch preview for transparency before the user commits. FR89 / FR92 atomic two-stage journal model: Stage 1 fires here and is the always-fires entry (base value AR + Revenue); Stage 2 conditionally fires later on SI-DSP-010 when GST is closed.

---

#### SI-DSP-009 — B2B Delivery Confirmation

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** mobile-first

**Roles & scope:**
- Dispatch Staff (scope: location/department)
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Confirm customer acknowledgement of a dispatched B2B challan moving status from Dispatched to Delivered, or capture a refused-on-arrival disposition that flags the challan for credit note follow-up.

**Data displayed:**
- Challan header: DC TRN (CC-TRN-DISPLAY), customer name and code, dispatched-at timestamp, vehicle / driver reference (if recorded)
- Item lines summary: item name, dispatched quantity (read-only — quantities cannot be edited at delivery; correction is via credit note)
- Disposition selector: "Delivered — customer acknowledged" (default) / "Refused on arrival — customer declined delivery" (UC-7 disposition)
- Customer sign-off block (visible when disposition is Delivered): customer signatory name, signatory phone (optional), signatory timestamp (auto-captured), digital signature capture area (touch / mouse) or photo upload of physical sign-off
- Refusal reason block (visible when disposition is Refused on arrival): mandatory reason code (e.g., wrong items / damaged / customer cancelled / quality issue / other), free-text comment (mandatory)
- Confirmation block: explicit consequences shown — "On Delivered: status → Delivered, no journal entry fires (Stage 1 already fired at Dispatch). On Refused: status → Delivered with refused-on-arrival flag set, Finance must follow up with full credit note via SI-DSP-012 to reach Closed — Returned terminal"

**User actions:**
- Select disposition (Delivered / Refused on arrival)
- Capture customer sign-off (Delivered path) — name, phone, signature
- Capture refusal reason code and comment (Refused path)
- Confirm → status moves to Delivered (with refused-on-arrival flag set if that disposition was selected); audit log written; if Refused, Finance is notified to create the credit note via SI-DSP-012
- Raise issue ticket against this delivery (CC-ISSUE-TICKET-LINK — for disputes that need follow-up beyond refusal capture)
- Cancel and return to detail (no state change)

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_in_progress (Dispatched pre-confirmation pill), status_completed (Delivered pill on confirm), warning (refused-on-arrival disposition banner), error_container (visual emphasis on refusal capture surface), primary, on_primary, outline_variant

**Source FRs:**
FR74 (Dispatched → Delivered transition; refused-on-arrival is a flagged Delivered state per `04-b2b-challan-spec.md` UC-7 with credit-note follow-up), FR76 (digital delivery confirmation by receiving staff with signature capture), FR22 (issue ticket link for delivery disputes)

**Source journey(s):**
Dispatch Staff — "B2B delivery confirmation: delivers to customer; customer signs off digitally; status moves to Delivered" (digest line 64 — the standard Delivered path); Dispatch Staff — variation per UC-7 — "customer refuses to accept goods on arrival" (`04-b2b-challan-spec.md` UC-7 — the refused-on-arrival path is captured in the same screen because the role and form are the same; the disposition selector branches the data block but the routing context is identical)

**Related screens:**
parent: SI-DSP-007 (B2B detail — entry point via the "Confirm delivery" sub-affordance, available when status is Dispatched), sibling: SI-DSP-008 (B2B dispatch confirmation — origin transition), sibling: SI-DSP-010 (B2B GST closure — destination after Delivered for the standard path), sibling: SI-DSP-011 (B2B closure without GST invoice — alternative destination after Delivered), sibling: SI-DSP-012 (B2B credit note — follow-up destination on the refused-on-arrival path), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-008 (issue ticket)

**Notes:**
Per §7 granularity rule, this consolidates the standard Delivered path and the refused-on-arrival disposition into one screen ID because (a) the role is the same, (b) the form is the same with a single disposition selector branching the data block, and (c) routing back to detail is the same. UC-7 from `04-b2b-challan-spec.md` is honoured by the refused-on-arrival flag — the flag is set on the challan record and surfaces back on SI-DSP-007 as a visible badge prompting Finance to invoke SI-DSP-012 for the full credit note that closes the loop with Closed — Returned terminal. The Delivered transition does not fire any journal entry per `04-b2b-challan-spec.md` §6 — Stage 1 already fired at Dispatch; Stage 2 fires only on GST closure. Mobile-first for the same delivery-bay reason as SI-DSP-008. Customer signature capture is a touch / mouse digital signature widget plus optional photo of physical sign-off — implementation detail to be finalised in design system §6 component spec.

---

#### SI-DSP-010 — B2B GST Closure

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Atomically fill GST fields, paste the IRN from the IRP portal, and set `gst_invoice_raised = true` on a Delivered B2B challan, firing the Stage 2 journal entry and moving status to Closed — GST Invoiced.

**Data displayed:**
- Challan header: DC TRN (CC-TRN-DISPLAY), customer name and code, customer GST registration type pill (with CC-UNREGISTERED-CUSTOMER-WARN active state if Unregistered or Consumer per FR119), origin location, dispatched-at timestamp, base value
- GST fields form: buyer_gstin (defaults from customer master if present; editable; validated to 15-character format), place_of_supply (two-digit state code dropdown per `04-b2b-challan-spec.md` §7), tax_rate_percent (dropdown: 0 / 5 / 12 / 18 / 28), cgst_amount (intra-state only), sgst_amount (intra-state only), igst_amount (inter-state only), hsn_code per line (visible from create; editable until atomic save)
- IRN paste field: 64-character hash from IRP portal per `04-b2b-challan-spec.md` §7 (validated to 64-char length)
- gst_invoice_raised toggle (true on save; cannot be set to true without IRN per E-3; the two are atomic per the field-set contract)
- GST validation panel (CC-GST-FIELD-VALIDATION): live indicator of place-of-supply / CGST-SGST-IGST consistency per FR118 — intra-state must use CGST+SGST with IGST null; inter-state must use IGST with CGST+SGST null; save blocked on invalid combination
- Unregistered customer warning panel (CC-UNREGISTERED-CUSTOMER-WARN): when customer GST registration type is Unregistered or Consumer, an active warning banner displays the warning text per FR119 — "This customer is not GST-registered. Raising a GST invoice may not be legally valid." — and a mandatory reason code dropdown gates the save
- Confirmation block: explicit consequences shown — "On atomic save: gst_invoice_raised = true, IRN persisted, status → Closed — GST Invoiced, Stage 2 journal entry fires (DR Accounts Receivable [tax amount only], CR GST Liability), challan locked from further GST edits per E-2"

**User actions:**
- Fill or edit GST placeholder fields (Finance Manager / Brand Owner only per FR97)
- Paste IRN from IRP portal
- Provide mandatory reason code if customer is Unregistered or Consumer (CC-UNREGISTERED-CUSTOMER-WARN gating)
- Atomic save → IRN and gst_invoice_raised = true persist together per E-3; status moves to Closed — GST Invoiced; Stage 2 journal fires per FR89 / FR92 mapping; challan locks for further GST edits per E-2; if Unregistered/Consumer override was used, override is logged and surfaces on Brand Owner dashboard per FR119
- Cancel and return to detail (no state change)

**Cross-cutting:**
CC-TRN-DISPLAY, CC-GST-FIELD-VALIDATION, CC-UNREGISTERED-CUSTOMER-WARN, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_completed (Delivered pre-save pill), status_closed (Closed — GST Invoiced pill on save), warning (Unregistered/Consumer warning banner; GST validation banner), error (invalid GST combination indicator; missing IRN indicator), error_container (visual emphasis on the atomic-save action), primary, on_primary, outline_variant

**Source FRs:**
FR78 (Finance Managers and Brand Owners atomically fill GST placeholder fields and set gst_invoice_raised with IRN — no other role without FR15a override), FR74 (Delivered → Closed — GST Invoiced terminal closure path), FR75 (DC TRN remains the canonical reference; no new TRN at GST closure), FR89 (Stage 2 auto-journal mapping rule for B2B Challan Stage 2 GST confirmed), FR92 (two-stage B2B journal model — Stage 2 fires here), FR97 (GST field role binding — Finance Manager and Brand Owner only), FR118 (GST tax field combination validation per CC-GST-FIELD-VALIDATION), FR119 (Unregistered/Consumer customer warning per CC-UNREGISTERED-CUSTOMER-WARN with mandatory reason code override)

**Source journey(s):**
Finance Manager — "IRN paste & Stage 2 journal trigger: receives IRNs from accountant for 2 challans; pastes IRNs into challan records; sets gst_invoice_raised = true; Stage 2 journal entries fire automatically; AR balance increments with tax amount" (digest lines 51-52 — this screen is exactly that moment); Finance Manager — "B2B challan GST workflow — Stage 2 initiation: identifies 3 B2B challans in Delivered status needing GST invoice confirmation" (digest line 51 — Finance lands here from each Delivered challan)

**Related screens:**
parent: SI-DSP-007 (B2B detail — entry point via the "Close with GST invoice — paste IRN" sub-affordance, available when status is Delivered), sibling: SI-DSP-011 (B2B closure without GST invoice — alternative terminal closure), sibling: SI-DSP-012 (B2B credit note — post-closure correction path), drill-down: SI-INF-006 (audit timeline), drill-down: SI-ACC-### (journal entry detail — Stage 2 — ID assigned in Task 10)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because (a) the IRN paste and gst_invoice_raised flag must be set atomically per E-3 of the B2B spec — atomicity is the canonical contract that warrants a deliberate save surface, (b) it fires the Stage 2 journal entry per FR92, and (c) it carries two cross-cutting compliance patterns (CC-GST-FIELD-VALIDATION and CC-UNREGISTERED-CUSTOMER-WARN) that need a focused form. FR97 role binding is enforced at route-level: Finance Manager and Brand Owner only — other roles cannot access this screen without a FR15a per-user override. The atomic save semantics per E-3: IRN cannot be saved without gst_invoice_raised = true, and vice versa — both fields persist in a single transaction. FR118 intra-state vs inter-state rule per E-4: place_of_supply matching the dispatching location's state requires CGST+SGST with IGST null; differing requires IGST with CGST+SGST null — the validation runs at save and blocks invalid combinations. FR119 Unregistered/Consumer warning gates the save with a mandatory reason code; the override is logged via CC-AUDIT-LINK and feeds the Brand Owner dashboard via Epic 12 SI-RPT-### (ID assigned in Task 12). Once saved, the challan is locked from further GST edits per E-2 — correction path post-closure is credit note (SI-DSP-012) plus a fresh challan.

---

#### SI-DSP-011 — B2B Closure Without GST Invoice

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Close a Delivered B2B challan with `gst_invoice_raised = false` (no GST invoice will be raised) moving status to Closed — No GST Invoice without firing a Stage 2 journal entry.

**Data displayed:**
- Challan header: DC TRN (CC-TRN-DISPLAY), customer name and code, customer GST registration type pill, origin location, dispatched-at timestamp, base value
- Closure rationale: mandatory reason code dropdown (e.g., unregistered customer / customer declined invoice / GST not applicable / sample dispatch / other), free-text comment (optional but encouraged)
- Confirmation block: explicit consequences shown — "On confirm: status → Closed — No GST Invoice, gst_invoice_raised remains false, no Stage 2 journal entry fires, AR balance remains at base value only, challan locked from further GST edits per E-2"
- Stage 1 entry summary (read-only): the already-fired Stage 1 entry (DR Accounts Receivable [base value], CR Revenue — B2B Sales)

**User actions:**
- Select closure reason code (mandatory)
- Enter optional comment
- Confirm closure → status moves to Closed — No GST Invoice; no Stage 2 journal entry; challan locks for GST edits per E-2; audit log written
- Cancel and return to detail (no state change)

**Cross-cutting:**
CC-TRN-DISPLAY, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_completed (Delivered pre-confirmation pill), status_closed (Closed — No GST Invoice pill on confirm), warning (no-GST closure rationale banner), primary, on_primary, outline_variant

**Source FRs:**
FR74 (Delivered → Closed — No GST Invoice terminal closure path; Finance Manager / Brand Owner explicit confirmation per `04-b2b-challan-spec.md` §3), FR78 (Finance Manager and Brand Owner only role binding for GST closure decisions; closing without GST is the negative branch of the same authority), FR97 (role binding for closure decisions)

**Source journey(s):**
Finance Manager — "B2B challan closure without GST invoice: closes third challan with gst_invoice_raised = false (unregistered customer); Stage 1 only, no Stage 2" (digest line 53 — this screen is exactly that moment)

**Related screens:**
parent: SI-DSP-007 (B2B detail — entry point via the "Close without GST invoice" sub-affordance, available when status is Delivered), sibling: SI-DSP-010 (B2B GST closure — alternative terminal closure with Stage 2 firing), sibling: SI-DSP-012 (B2B credit note — post-closure correction path), drill-down: SI-INF-006 (audit timeline), drill-down: SI-ACC-### (journal entry detail — Stage 1 already fired; ID assigned in Task 10)

**Notes:**
Per §7 granularity rule, this is a separate screen ID from the GST closure (SI-DSP-010) because the two terminal paths (a) carry different journal-fire consequences — GST closure fires Stage 2; no-GST closure fires nothing additional, and (b) carry different rationale capture — GST closure captures IRN and atomic compliance data; no-GST closure captures a closure reason code that explains why the challan will never receive a GST invoice. FR78 role binding is enforced at route-level: Finance Manager and Brand Owner only. The no-GST closure path is permanent per `04-b2b-challan-spec.md` §3 — once closed, the challan cannot be re-opened to GST closure; correction path is credit note plus a fresh challan. AR balance for this challan equals the base value only (Stage 1 entry standing alone) per `04-b2b-challan-spec.md` §6 Stage 1 Only example.

---

#### SI-DSP-012 — B2B Credit Note Creation

**Primary epic:** Epic 8 — Dispatch & Distribution

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Create a credit note against a dispatched B2B challan for a full or partial return, generating the CN TRN, reinstating stock, and firing conditional reversal journal entries based on whether the source challan had `gst_invoice_raised = true`.

**Data displayed:**
- Source challan header: source DC TRN (CC-TRN-DISPLAY), customer name and code, source challan status, source challan base value, source challan gst_invoice_raised flag
- CN reference field (read-only after save): CN TRN displayed once generated per FR75 — `CN-YYYY-LOC-SEQ`
- Return scope selector: "Full return — all source items and quantities" / "Partial return — selected items and quantities"
- Item lines table (visible when partial return): source item lines with checkboxes; for selected lines, return quantity input (defaults to source dispatched qty; editable down to it; cannot exceed source dispatched qty per line per E-6); per-line value calculated from source rate × return qty
- Cumulative CN ceiling indicator: cumulative CN value (this CN + prior CNs against same source) vs source challan value; CC-IMPLAUSIBILITY-WARN visual cue if approaching ceiling per FR80 (the validation itself blocks save service-side per §5)
- Mandatory reason code dropdown: damaged / quality issue / customer dispute / refused on arrival / wrong items / over-supply / other
- Free-text comment field (mandatory)
- Reversal preview panel: explicit consequences shown — "On confirm: CN TRN generated, stock reinstated at originating location/department per `04-b2b-challan-spec.md` §4, journal reversal fires — Stage 1 reversal (DR Revenue, CR Accounts Receivable for return value); Stage 2 reversal (DR GST Liability, CR Accounts Receivable for tax portion) fires only if source challan has gst_invoice_raised = true per E-5"
- Closure-impact note: if this CN is a full return against a previously-closed source, the source challan transitions to Closed — Returned per `04-b2b-challan-spec.md` UC-7 / §3

**User actions:**
- Select return scope (full / partial)
- Select returned items and adjust return quantities (partial path)
- Select mandatory reason code
- Enter mandatory comment
- Attach files (FR81 — return docket scan, photos of damaged goods, customer correspondence)
- Confirm credit note → CN TRN generated per FR75; stock reinstated per `04-b2b-challan-spec.md` §4; conditional reversal journal entries fire per E-5; if full return, source challan moves to Closed — Returned per UC-7; audit log written
- Cancel draft (sub-affordance; CC-REVERSE-CANCEL for the pre-confirmed CN draft state)

**Cross-cutting:**
CC-DRAFT-PILL, CC-TRN-DISPLAY (CN TRN once generated; source DC TRN throughout), CC-AUDIT-LINK, CC-IMPLAUSIBILITY-WARN (cumulative CN ceiling cue), CC-REVERSE-CANCEL (Draft CN cleanly cancellable)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft (CN draft pill pre-confirm), status_confirmed (CN confirmed pill on save), status_returned (source challan terminal pill if this is a full return), warning (cumulative-ceiling banner; reversal preview banner), error (cumulative-ceiling exceeded indicator), error_container (visual emphasis on the conditional-reversal action), primary, on_primary, outline_variant

**Source FRs:**
FR79 (credit notes against dispatched challans for full or partial returns; stock reinstatement; conditional two-stage reversal based on source challan gst_invoice_raised), FR75 (CN TRN generation at creation — `CN-YYYY-LOC-SEQ` — with mandatory reference to original DC TRN), FR74 (Closed — Returned terminal on source challan when full credit note is raised per UC-7), FR81 (file attachments to credit notes — return dockets, evidence), FR89 (auto-journal mapping for credit note creation reversal), FR92 (two-stage B2B journal model — conditional reversal of Stage 1 always, Stage 2 only if source had gst_invoice_raised), FR97 (Finance Manager / Brand Owner role binding for credit note creation), FR117 (compensating-document correction path post-confirmation per FR117 doctrine), FR80 (cumulative CN ≤ source value validation — service-layer per §5; visualised as ceiling indicator here)

**Source journey(s):**
Finance Manager — "credit note creation with conditional two-stage reversal: customer dispute arrives; creates Credit Note for partial return (1 of 6 croissant batches); system checks source challan's gst_invoice_raised flag; reversal fires on Stage 1 only (no GST invoice on source); stock reinstated at originating department" (digest line 54 — this screen is exactly that moment for the partial-return path); Dispatch Staff — refused-on-arrival path (UC-7 from `04-b2b-challan-spec.md` — when delivery is refused via SI-DSP-009, Finance follows up here with a full credit note that closes the loop with Closed — Returned terminal on the source)

**Related screens:**
parent: SI-DSP-007 (B2B detail — entry point via the "Create credit note" sub-affordance, available when source status is Dispatched, Delivered, or any Closed terminal), sibling: SI-DSP-009 (B2B delivery confirmation — refused-on-arrival path that initiates the full credit note workflow), sibling: SI-DSP-010 (B2B GST closure — source-side counterpart that determines the two-stage reversal branch), drill-down: SI-INF-006 (audit timeline), drill-down: SI-INF-010 (reverse / cancel confirmation pattern for Draft CN), drill-down: SI-ACC-### (journal entry detail — reversal entries — IDs assigned in Task 10)

**Notes:**
Per §7 granularity rule, this is a separate screen ID because (a) it generates a TRN per FR75 (CN TRN with mandatory reference to source DC TRN), (b) it fires conditional journal reversal entries per FR92 / E-5 (Stage 1 always reversed; Stage 2 reversed only if source had gst_invoice_raised = true — the reversal branch is determined automatically by reading the flag on the source), and (c) it captures mandatory reason / comment data. P2B-001 honoured via CC-DRAFT-PILL on the pre-confirm CN draft state. The CN TRN format `CN-YYYY-LOC-SEQ` per FR75 / `04-b2b-challan-spec.md` §5 is generated at confirmation and stores the mandatory reference to the source DC TRN per the same spec section. FR80 cumulative CN ≤ source value validation is service-layer per §5 — `creditNoteService.validateCumulativeLimit(sourceChallanId)` blocks creation if cumulative would exceed source; this screen surfaces the ceiling as a CC-IMPLAUSIBILITY-WARN visual cue but does not own the enforcement. E-6 from the B2B spec (multiple partial returns against the same challan): each partial return is a separate CN with its own TRN; the sum is what FR80 validates. UC-7 refused-on-arrival path: the full credit note created here moves the source challan to Closed — Returned terminal per `04-b2b-challan-spec.md` §3. Stock reinstatement uses `inventoryService.deductStock()` inverse — increments back into originating department per `04-b2b-challan-spec.md` §4. FR117 doctrine: this credit note IS the compensating document for any post-Dispatched correction on a B2B challan; direct edits to a Dispatched or Closed challan are blocked per E-2.

---

### Epic 9 — POS Integration (POS)

Epic 9 covers the integration between the ERP's recipe-driven inventory and the POS system's menu and sales operations. The primary workflows are (1) mapping menu items offered at each POS outlet to their underlying recipes so that sales transactions trigger recipe-driven inventory deduction via the backend service, and (2) managing menu item availability and pricing within the ERP rather than in the POS system itself, so that Cluster Managers and Brand Owners can control sell-first ordering for items approaching expiry without re-syncing POS configuration. POS sales are imported from the external POS system via REST API (service-layer only — no UI) with near-real-time recipe-driven inventory consumption flowing back (also service-layer only per FR85). The POS Staff daily closing inventory at POS outlets is cross-listed with Epic 4 (already covered by the inventory closing screens). An integration-health dashboard is planned for Epic 10 (FR98 — operational view of recent imports, pending transactions).

**Granularity decision:** Menu Item List and Menu Item Recipe Mapping are separate screens because they serve different user journeys — the first is a day-to-day operational reference for POS Staff and Cluster Managers to see current availability and pricing, and the second is a configuration screen for Cluster Managers and Brand Owners to set up or adjust recipe linkages. POS Sales Integration Status is a dedicated screen (not a sub-pane on the menu list) because it carries cross-cutting integration metadata and status indicators that POS Staff check separately from the menu lineup during morning briefing (journey digest line 89).

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-POS-001 | Menu Item List | responsive-equal | POS Staff (location), Cluster Manager (cluster), Brand Owner (brand) |
| SI-POS-002 | Menu Item Recipe Mapping | desktop-primary | Cluster Manager (cluster), Brand Owner (brand) |
| SI-POS-003 | POS Sales Integration Status | desktop-primary | POS Staff (location), Cluster Manager (cluster), Brand Owner (brand) |

---

#### SI-POS-001 — Menu Item List

**Primary epic:** Epic 9 — POS Integration

**Primary device:** responsive-equal

**Roles & scope:**
- POS Staff (scope: location)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Browse and manage menu item availability and pricing at each POS outlet so POS Staff can see today's sellable items and spot expiry-band prioritisation, and Cluster Managers can adjust pricing and availability without leaving the ERP.

**Data displayed:**
- Menu item list table: item name, category, current price (INR), available quantity at location, UOM, recipe-linked indicator, shelf-life / expiry window, availability status pill (Available / Limited / Out of Stock), expiry-band flag (red if <24h to expiry, yellow if <48h)
- Filter chips: category, availability status, expiry-band flag, recipe-linked status
- Summary counters: total menu items, available items, limited availability, out of stock, items expiring within 24h
- Search bar: by item name or category

**User actions:**
- Filter and search by any combination of chips and terms
- Open menu item row → drill-down to detail view (read-only for POS Staff; edit availability and price fields for Cluster Manager and Brand Owner)
- Quick-edit price inline (Cluster Manager, Brand Owner only) with save confirmation
- Quick-toggle availability on/off per row (Cluster Manager, Brand Owner only; triggers immediate update to POS system sync queue)
- Tag expiring items as "sell first" (prioritises them at top of POS menu display on next sync cycle per FR30, FR35)
- Export list (CC-EXPORT-TRIGGER: CSV / Excel)

**Cross-cutting:**
CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_draft, status_in_progress, status_completed, success, warning, error, outline_variant

**Source FRs:**
FR86 (manage menu item availability and pricing within the ERP)

**Source journey(s):**
POS Staff — "expiry-band sell-first prioritisation: tags 2 expiring croissants; they appear at top of menu display; promoted for sale before regular items" (digest line 91 — the list shows expiry flags and the tag action initiates the sell-first mark); Cluster Manager — "morning briefing dashboard" references today's expected dispatch; this list shows what is currently in stock to fulfil that dispatch (digest line 89)

**Related screens:**
sibling: SI-POS-002 (menu item recipe mapping — configuration surface), sibling: SI-POS-003 (POS sales integration status — integration health check), drill-down: SI-INV-### (inventory detail — ingredient-level drill if available per role; IDs assigned in Task 4)

**Notes:**
Availability on/off toggle immediately queues a sync message to the external POS system's menu configuration API (service-layer implementation detail, not displayed here). Expiry-band flags are computed from the recipe → ingredient → GR received-date chain; the list surface does NOT own the computation (that lives in the inventory service per FR35). POS Staff do not have edit rights on price or availability — read-only for them. The "sell first" tag is a lightweight marking on the menu item that persists locally and syncs to POS; no TRN or journal entry. Search and filter are local (client-side) for responsive performance on mobile. Cross-references: expiry-band visibility uses Epic 4 expiry tracking (FR30); sell-first prioritisation supports Epic 4 closing-inventory variance reduction (FR35); PDF export of menu pricing is a local sub-affordance on this screen, not the Epic 8 challan PDF generator (FR82).

---

#### SI-POS-002 — Menu Item Recipe Mapping

**Primary epic:** Epic 9 — POS Integration

**Primary device:** desktop-primary

**Roles & scope:**
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Create and manage the mapping between POS menu items and their underlying recipes so that sales transactions trigger recipe-driven inventory deduction.

**Data displayed:**
- Menu item selector (autocomplete, scoped to items currently used across the cluster/brand)
- Mapped recipes section: table of recipes linked to this menu item, recipe name, recipe version (current / historical), yield (quantity + UOM), ingredient breakdown (collapsible per row, shows ingredient name, standard consumed quantity per yield, UOM, current on-hand at primary kitchen, projected usage if sold N units)
- Effective-from date picker (for recipe version transitions — allows a menu item to use Recipe V1 until a date, then switch to Recipe V2; supports recipe evolution without breaking historical sales data)
- Quantity warning (CC-IMPLAUSIBILITY-WARN): if recipe yield would consume >150% of current ingredient stock at primary kitchen, flags as yellow warning
- Save confirmation block

**User actions:**
- Select a menu item to map
- Add a new recipe to the menu item mapping (search recipes by name)
- Set effective-from date for recipe version transition
- View ingredient breakdown per recipe (inline collapse/expand, no separate modal)
- Edit effective-from date on an existing mapping
- Remove recipe from menu item (soft-delete; historical sales remain linked to the removed recipe version for audit)
- Generate mapping report (exports CSV of all menu item-to-recipe linkages for the cluster; used for POS team audits)

**Cross-cutting:**
CC-IMPLAUSIBILITY-WARN, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, warning (ingredient availability warning), outline_variant, secondary_container

**Source FRs:**
FR83 (map menu items to recipes; link POS sales to recipe-based inventory consumption)

**Source journey(s):**
Cluster Manager — "implied: when setting up a new menu offering at a POS, Cluster Manager / Brand Owner creates the menu-to-recipe link so that sales auto-import knows how much inventory to deduct per item sold" (digest line 92 references the auto-import and recipe-driven deduction; this screen is where the linkage is established)

**Related screens:**
parent: SI-POS-001 (menu item list — entry point if "manage recipe mapping" drill-down link is present), sibling: SI-REC-### (recipe detail — drill-down for ingredient detail; IDs assigned in Task 6), drill-down: SI-INF-006 (audit timeline)

**Notes:**
This is a configuration-heavy screen, desktop-primary by design. Recipe versioning allows Cluster Managers to evolve recipes (e.g. seasonal ingredient substitution) without breaking backward compatibility on historical sales data. The "effective-from date" field is optional; if not set, the mapping is effective immediately. When a recipe is removed from the menu item (soft-delete), historical sales using that recipe version remain intact and still trigger inventory deduction based on the old recipe — forward-looking sales use the active recipe. Quantity warning fires if any ingredient in the recipe is projected to run out if the menu item sells N units; this is a yield-to-on-hand ratio check, not a hard block (user can save anyway with reason code if overridden — deferred to Phase 3a interaction design). Cross-references: ingredient availability context shown in the recipe breakdown (projected usage vs. on-hand) draws from Epic 4 inventory tracking (FR30); expiry-band tie-in in the ingredient list informs the menu item list's expiry flags (FR35) — neither FR owns this screen's primary obligation.

---

#### SI-POS-003 — POS Sales Integration Status

**Primary epic:** Epic 9 — POS Integration

**Primary device:** desktop-primary

**Roles & scope:**
- POS Staff (scope: location)
- Cluster Manager (scope: cluster)
- Brand Owner (scope: brand)

**Purpose:**
Monitor the health of the POS sales import integration so that operations staff can spot import failures, check last-import timestamps, and verify that recipe-driven inventory deduction is processing correctly.

**Data displayed:**
- Integration status card: last import time (ISO timestamp + relative time "2 hours ago"), import frequency (near-real-time, ≤5 minutes), connection status pill (Connected / Offline / Error)
- Recent import summary: transaction count in last 24h, transaction count in last 7 days, pending transactions awaiting inventory deduction, failed import count with error classification
- Pending transactions table: transaction ID (from external POS), transaction timestamp, menu item sold, quantity, attempted deduction status (In Progress / Pending / Failed), error detail if failed
- Error log (last 20 errors): timestamp, transaction ID, error type (API timeout / invalid item mapping / insufficient inventory / recipe not found), brief message, retry action (per row)
- Retry controls: bulk-retry failed imports (via modal with count confirmation)

**User actions:**
- View last import timestamp and connection status at a glance
- Drill into pending or failed transactions → see error detail and retry status
- Retry a single failed transaction (rolls back any partial inventory deduction and re-runs the full pipeline)
- Bulk-retry all failed transactions in the last 24h (modal confirmation showing count)
- Export error log (CC-EXPORT-TRIGGER: CSV)
- Link to integration settings (forward-ref to SI-INF-### or Epic 10 FR98 operational dashboard if exists; ID assigned in Task 10)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-DASHBOARD-TILE (status card applies the tile pattern for the connection status + recent summary), CC-AUDIT-LINK (per-transaction integration log rows carry audit-able retry/error-resolution state)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, primary, on_primary, success, warning, error, outline_variant

**Source FRs:**
FR84, FR85 (service-layer outcomes — see §5; primary integration dashboard is SI-ACC-### in Epic 10, ID assigned in Task 10)

**Source journey(s):**
POS Staff — "POS-scoped morning dashboard: Views yesterday's sales auto-imported from POS system (₹1.1L across 142 transactions)" (digest line 89 — this screen is the detailed status check behind that morning-briefing summary); POS Staff — "Sales auto-import with recipe-driven inventory deduction: Through the day, sales flow in from POS system; ERP imports near-real-time; each sale's recipe-driven inventory consumption auto-deducts from POS-AA inventory; no manual decrement" (digest line 92 — this screen shows the status of that automatic process)

**Related screens:**
sibling: SI-POS-001 (menu item list — if import fails on item mapping, user drills from error detail here to the menu mapping screen to verify linkage), sibling: SI-INF-### (integration settings / connection configuration if exists; ID assigned in Task 3), forward-ref: SI-ACC-### (integration dashboard showing export-side health per FR98; ID assigned in Task 10)

**Notes:**
FR84 is service-layer-only (no UI surface for the REST API import machinery itself), but operational visibility of import health is a POS Staff daily task (FR104 morning briefing). This screen surfaces that operational visibility without diving into API configuration (which would be in Epic 3 infrastructure or Epic 10 accounting setup per FR98). Pending transactions are those where the import arrived but inventory deduction is still in flight (typical latency <5 sec); they are not errors unless they stay pending >60 sec, at which point they move to the failed log and require manual retry. Error retries are idempotent (re-running the full deduction pipeline on an already-deducted transaction is safe because inventory movements are immutable — the retry sees the prior movement in the ledger and skips re-deduction). A future integration dashboard in Epic 10 (FR98) will surface the accountant export side (sales register exports to Tally, Zoho, etc.); this screen is POS import-side only.

---

### Epic 10 — Accounting & Financial (ACC)

Epic 10 owns the financial infrastructure of the F&B ERP: the Chart of Accounts that backs automated journal generation, the financial statements rendered from the internal ledger, Daily Sales Report capture, budget tracking, the Food Cost Control Centre financial framing, and the accountant handoff exports that bridge the ERP to Tally, Zoho Books, or Generic CSV. Four FRs are service-layer-only with no UI surface: FR87 (TRN generation engine — display is CC-TRN-DISPLAY), FR89 (auto-journal mapping engine — the configurable rules have their own admin surface as SI-ACC-002, but the generation itself is backend), FR90 (internal ledger maintenance — rendered through the statement screens, not directly editable), and FR92 (two-stage B2B journal model — triggered by challan status transitions in Epic 8, never via a standalone Epic 10 screen). The FCCC financial framing surface (FR95) is the financial half of CC-FCCC-DUAL-SURFACE; the operational analytics framing (FR108) lives in Epic 12 as SI-RPT-### (ID assigned in Task 12). Finance Manager and Brand Owner are the primary roles throughout; Procurement Manager has read-only access to the FCCC financial framing for cost-cascade visibility. Trial Balance, P&L Statement, Balance Sheet, and Cash Flow Statement are four separate screens because their filter dimensions, account groupings, and export shapes differ — consolidating them would require hiding the complexity that Finance needs for period-close validation.

**Granularity decisions:** FR91 yields four screen IDs (Trial Balance, P&L, Balance Sheet, Cash Flow) because each statement has a distinct structure, filter logic, and export format; their shared filter chrome is a pattern, not a reason to merge. FR94 (Budget) stays as two IDs — Budget Create/Edit (data-entry surface, fires no journal but has ≥3 editable fields and will initiate approval workflow) and Budget vs Actual Variance (read-only analytical surface); they share a parent but have different roles and actions. SI-ACC-008 and SI-ACC-009 cross-link as parent/drill-down. FR97 (Compliance Placeholder Editor) is its own screen because it is role-bound with restricted write permissions — embedding it in transaction forms would obscure the role boundary that FR78 and FR97 both depend on. FR99 (Manual Journal Voucher) is its own screen per §7 rule 2: fires a TRN-generating action, has ≥3 editable fields (JV lines with debit/credit per account), and the screen is Finance-Manager-only.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-ACC-001 | Chart of Accounts Admin | desktop-primary | Brand Owner (brand), Finance Manager (brand) |
| SI-ACC-002 | Journal Mapping Rules Admin | desktop-primary | Brand Owner (brand), Finance Manager (brand) |
| SI-ACC-003 | Trial Balance | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-004 | Profit & Loss Statement | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-005 | Balance Sheet | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-006 | Cash Flow Statement | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-007 | Daily Sales Report Capture | desktop-primary | Finance Manager (brand), Brand Owner (brand), Cluster Manager (cluster) |
| SI-ACC-008 | Budget Create / Edit | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-009 | Budget vs Actual Variance | desktop-primary | Finance Manager (brand), Brand Owner (brand), Cluster Manager (cluster) |
| SI-ACC-010 | FCCC Financial Framing | desktop-primary | Finance Manager (brand), Brand Owner (brand), Procurement Manager (brand/cluster) |
| SI-ACC-011 | Accountant Handoff Exports | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-012 | Compliance Placeholder Editor | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-013 | Integration Status Dashboard | desktop-primary | Finance Manager (brand), Brand Owner (brand) |
| SI-ACC-014 | Manual Journal Voucher | desktop-primary | Finance Manager (brand), Brand Owner (brand) |

---

#### SI-ACC-001 — Chart of Accounts Admin

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Finance Manager (scope: brand)

**Purpose:**
Maintain the simplified F&B Chart of Accounts that backs all automated journal entry generation and financial statement rendering.

**Data displayed:**
- Account list: account code, account name, account type (Asset / Liability / Equity / Revenue / Expense), sub-type (e.g. Current Asset, COGS, Operating Expense), parent account (for hierarchical grouping), active status
- Account grouping tree (P&L lines and Balance Sheet sections) showing how accounts roll up into statement lines
- Pre-seeded default accounts at initial launch (flagged as system-defaults; not deletable)
- Filter chips: account type, sub-type, active status
- Search bar: by account code or account name

**User actions:**
- Search and filter the account list
- Create new account → form with account code (user-assigned per naming convention), account name, type, sub-type, parent account, active flag
- Edit account name, sub-type, parent grouping (code is immutable once referenced by a journal entry)
- Deactivate account (soft-delete; system warns if account has non-zero ledger balance in any open period)
- Reassign account to a different P&L or Balance Sheet grouping line
- Reactivate account

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (for in-progress edits before save)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (active account), surface_container_high (inactive account), primary, on_primary, outline_variant

**Source FRs:**
FR88 (simplified F&B Chart of Accounts; pre-seeded at launch; configurable mapping)

**Source journey(s):**
Finance Manager — "month-end financial snapshot: opens Finance dashboard; sees all transactions from previous month already recorded with TRNs; automated journal entries generated; Trial Balance already available" (digest lines 49–50 — the COA is the precondition structure enabling the Trial Balance to be available; Finance validates COA structure as part of month-end setup)

**Related screens:**
drill-down: SI-ACC-002 (journal mapping rules — which transactions map to which accounts), sibling: SI-ACC-003 (Trial Balance — renders from the COA structure)

**Notes:**
FR88 requires that a minimum default account structure be pre-seeded at launch. System-default accounts (e.g. Accounts Receivable, Revenue — B2B Sales, COGS — Raw Material Consumption, GST Liability, Wastage and Write-offs) are flagged as non-deletable; they can be renamed or regrouped but not removed, because FR89 auto-journal mapping rules reference them by code. Deactivating an account with a non-zero ledger balance requires a compensating manual journal voucher first (see SI-ACC-014). FR89 (auto-journal generation engine) is service-layer-only — see §5. FR90 (internal ledger) is service-layer-only — see §5.

---

#### SI-ACC-002 — Journal Mapping Rules Admin

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Finance Manager (scope: brand)

**Purpose:**
Configure which accounts debit and credit for each automated transaction event so that journal entries are generated correctly when operational transactions reach confirmed status.

**Data displayed:**
- Mapping rules table: transaction event type (e.g. GR Confirmed, PO In Progress, B2B Challan Dispatched Stage 1, B2B Challan Stage 2 GST Confirmed, Credit Note Created, Sales Import Confirmed, Inventory Adjustment), debit account (from COA), credit account (from COA), condition notes (e.g. Stage 2 only when gst_invoice_raised = true), active status
- Pre-configured minimum rule set at launch (flagged as system defaults)
- Filter chips: transaction event type, active status
- Preview panel: given a sample transaction amount, shows what the resulting journal entry would look like (DR/CR amounts per account)

**User actions:**
- View all mapping rules in the table
- Edit debit or credit account on a non-system-default rule → account picker from COA (SI-ACC-001)
- Add a custom mapping rule for an event type not in the default set
- Deactivate a custom mapping rule (system-default rules cannot be deactivated without Brand Owner + Finance co-approval)
- Preview journal output for a hypothetical transaction amount using the selected rule

**Cross-cutting:**
CC-AUDIT-LINK, CC-DRAFT-PILL (for in-progress rule edits before save)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (active rule), surface_container_high (inactive rule), primary, on_primary, outline_variant, warning (preview panel showing unbalanced entry)

**Source FRs:**
FR89 (auto-generate balanced journal entries for confirmed operational transactions via configurable mapping rules; minimum set pre-configured — this is the admin surface for those rules; the generation engine itself is service-layer-only per §5)

**Source journey(s):**
Finance Manager — "month-end financial snapshot: automated journal entries generated; Trial Balance already available" (digest line 49 — the mapping rules are the configuration that makes automated journal generation possible; Finance reviews and adjusts rules as part of initial setup and COA changes)

**Related screens:**
parent: SI-ACC-001 (Chart of Accounts — accounts must exist before mapping rules can reference them), sibling: SI-ACC-014 (Manual Journal Voucher — for adjustments not covered by automated mapping)

**Notes:**
FR89 auto-generation is a service-layer concern — see §5. This screen (SI-ACC-002) is the admin configuration surface for the rules, which is a UI-bearing obligation: Finance or Brand Owner must be able to see and adjust which accounts debit/credit for each event type. The minimum pre-configured rule set covers the six events listed in FR89: GR Confirmed, PO moved to In Progress, B2B Challan Dispatched (Stage 1), B2B Challan Stage 2 GST Confirmed, Credit Note Created, Sales Import Confirmed. FR92 (two-stage B2B journal model) is service-layer-only — the Stage 1 and Stage 2 rules appear here as read-only system-default entries keyed to their respective challan events (see SI-DSP-008 for the dispatch trigger and SI-DSP-010 for the GST closure trigger in Epic 8).

---

#### SI-ACC-003 — Trial Balance

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
View the Trial Balance for a selected period and scope so Finance can validate that all accounts are balanced and revenue, COGS, and AP match the operational records before period close.

**Data displayed:**
- Period selector (month/quarter/custom date range) and scope selector (brand, cluster, specific location)
- Trial Balance table: account code, account name, account type, opening balance, period debit total, period credit total, closing balance; rows grouped by account type (Asset / Liability / Equity / Revenue / Expense)
- Summary footer: total debits = total credits (balanced indicator); if not balanced, error banner with the imbalance amount
- Variance indicators per account: flagged rows where the closing balance deviates significantly from the prior period (colour-coded using warning or error tokens)
- Drill-down affordance per account row: opens the account's journal ledger for the selected period (transaction-level detail)

**User actions:**
- Select period and scope (filters the table)
- Drill down into a specific account → view all journal entries contributing to that account's balance (transaction-level; links back to source TRN per CC-TRN-DISPLAY)
- Export Trial Balance (CC-EXPORT-TRIGGER: CSV / Excel / PDF)
- Navigate to P&L Statement from the Revenue / Expense account group section

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to source transactions shows TRN)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (balanced footer), error (imbalanced footer, unbalanced row), warning (prior-period variance flag), outline_variant, primary

**Source FRs:**
FR91 (Trial Balance generated from internal journal; filterable by period, location, cluster)

**Source journey(s):**
Finance Manager — "Trial Balance review: validates revenue matches daily sales reports; COGS aligns with production consumption; AP matches Purchase Register" (digest line 50 — this is the canonical Trial Balance review moment in the month-end close journey)

**Related screens:**
sibling: SI-ACC-004 (P&L Statement), sibling: SI-ACC-005 (Balance Sheet), sibling: SI-ACC-006 (Cash Flow Statement), parent: SI-ACC-001 (COA structure — determines account groupings shown here)

**Notes:**
FR90 (internal ledger) is service-layer-only — see §5. The Trial Balance renders from the ledger but does not expose ledger-row create/edit (those are locked to the auto-journal service and the manual journal voucher SI-ACC-014). No CC-AUDIT-LINK on the Trial Balance — it is a read-only report, not a per-record editable surface; audit trail links appear on the source transaction detail screens in their respective epics. The drill-down from an account row to its journal entry list is an inline expansion or modal, not a separate route; each journal entry in that list carries CC-TRN-DISPLAY so Finance can navigate back to the source transaction (e.g. a GR, a PO, a B2B challan). CC-EXPORT-TRIGGER applies with both FR107 formats (CSV/Excel/PDF) — the Tally/Zoho/Generic CSV multi-format is reserved for SI-ACC-011 (Accountant Handoff Exports) which owns the full accountant export pipeline per FR96.

---

#### SI-ACC-004 — Profit & Loss Statement

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Generate the Profit & Loss Statement for a selected period and scope so Finance and Brand Owner can review revenue, COGS, and operating expenses and close the financial period.

**Data displayed:**
- Period selector and scope selector (brand, cluster, specific location)
- P&L table: configurable account groupings (Revenue, COGS, Gross Profit, Operating Expenses, EBITDA, Depreciation / Amortisation if applicable, Net Profit) derived from COA account grouping in SI-ACC-001
- Each line shows current period value, prior period value (for comparison), and percentage-of-revenue
- Drill-down affordance per line: opens the contributing journal entries for that P&L line in the selected period
- Comparison toggles: Month-on-Month, Quarter-on-Quarter, Year-on-Year (maps to FR95 period comparison requirement)

**User actions:**
- Select period, scope, and comparison period
- Drill down into any P&L line → view contributing account balances and their source transactions
- Export P&L Statement (CC-EXPORT-TRIGGER: CSV / Excel / PDF)
- Navigate to Balance Sheet or Trial Balance

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to source transactions shows TRN)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (positive gross profit), error (net loss), warning (variance vs prior period above threshold), outline_variant, primary

**Source FRs:**
FR91 (P&L Statement from internal journal; filterable by period, location, cluster)

**Source journey(s):**
Finance Manager — "financial statement generation: generates P&L, Balance Sheet, Cash Flow Statement from internal journal; reviews, validates, closes month within 2 working days" (digest line 56 — P&L generation is the core moment in monthly financial statement workflow)

**Related screens:**
sibling: SI-ACC-003 (Trial Balance), sibling: SI-ACC-005 (Balance Sheet), sibling: SI-ACC-006 (Cash Flow Statement), parent: SI-ACC-001 (COA grouping configuration)

**Notes:**
Account grouping into P&L lines is configurable via the COA admin (SI-ACC-001). No hardcoded P&L line names — the P&L statement reflects whatever grouping Finance has defined. No CC-AUDIT-LINK on the statement — read-only report; audit trail links live on source transaction detail screens. FR90 is service-layer-only — see §5.

---

#### SI-ACC-005 — Balance Sheet

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Render the Balance Sheet as at a selected date so Finance can validate asset, liability, and equity positions and confirm the accounting equation is satisfied.

**Data displayed:**
- As-at date selector and scope selector (brand, cluster, specific location)
- Balance Sheet table: Assets (Current Assets including Accounts Receivable, Inventory Value, Cash; Non-Current Assets), Liabilities (Current Liabilities including Accounts Payable, GST Liability; Long-Term Liabilities), Equity — all lines configurable from COA grouping in SI-ACC-001
- Accounting equation check: Total Assets = Total Liabilities + Equity (success/error indicator in footer)
- Comparison column (same date prior year or prior month-end as selected)
- Drill-down per line → contributing accounts and their balances as at date

**User actions:**
- Select as-at date and scope
- Drill down into any Balance Sheet line → account-level balances with drill-through to source transactions
- Export Balance Sheet (CC-EXPORT-TRIGGER: CSV / Excel / PDF)
- Navigate to P&L Statement or Trial Balance

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to source transactions shows TRN)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (accounting equation balanced), error (accounting equation unbalanced), outline_variant, primary

**Source FRs:**
FR91 (Balance Sheet from internal journal; filterable by period, location, cluster)

**Source journey(s):**
Finance Manager — "financial statement generation: generates P&L, Balance Sheet, Cash Flow Statement from internal journal; reviews, validates, closes month within 2 working days" (digest line 56)

**Related screens:**
sibling: SI-ACC-003 (Trial Balance), sibling: SI-ACC-004 (P&L Statement), sibling: SI-ACC-006 (Cash Flow Statement)

**Notes:**
No CC-AUDIT-LINK — read-only report. FR90 is service-layer-only — see §5. GST Liability line on the Balance Sheet will reflect Stage 2 journal entries from B2B challans (SI-DSP-010) — those entries credit GST Liability, which is cleared when the accountant files the GST return externally. The Balance Sheet does not own GST return preparation (out of scope per §6.4 of master spec).

---

#### SI-ACC-006 — Cash Flow Statement

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Generate the Cash Flow Statement using the indirect method for a selected period so Finance can review operating, investing, and financing cash movements from the internal journal.

**Data displayed:**
- Period selector and scope selector (brand, cluster, specific location)
- Cash Flow table (indirect method): Operating Activities (Net Profit from P&L, adjustments for non-cash items, changes in working capital items like AR/AP/Inventory); Investing Activities; Financing Activities; Net Change in Cash; Opening Cash Balance; Closing Cash Balance
- Account groupings configurable from COA structure (SI-ACC-001)
- Prior period comparison column

**User actions:**
- Select period and scope
- Drill down into any cash flow line → contributing journal entries
- Export Cash Flow Statement (CC-EXPORT-TRIGGER: CSV / Excel / PDF)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to source transactions shows TRN)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (positive net operating cash flow), error (negative net operating cash flow), outline_variant, primary

**Source FRs:**
FR91 (Cash Flow Statement from internal journal; filterable by period, location, cluster)

**Source journey(s):**
Finance Manager — "financial statement generation: generates P&L, Balance Sheet, Cash Flow Statement from internal journal; reviews, validates, closes month within 2 working days" (digest line 56)

**Related screens:**
sibling: SI-ACC-003 (Trial Balance), sibling: SI-ACC-004 (P&L Statement), sibling: SI-ACC-005 (Balance Sheet)

**Notes:**
Indirect method requires Net Profit as a starting point (from SI-ACC-004 P&L data) and then adjusts for non-cash movements in the ledger. This is rendered from the internal journal — no live connection to external banking. No CC-AUDIT-LINK — read-only report. FR90 is service-layer-only — see §5.

---

#### SI-ACC-007 — Daily Sales Report Capture

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Capture and validate Daily Sales Reports by location with sales categories, settlement modes, and expense categories before finalisation so the internal ledger has accurate daily sales data.

**Data displayed:**
- Location and date selectors (defaults to current user's scope and today or last-unfinalised date)
- Sales categories table: category name (dine-in, takeaway, delivery, B2B, etc.), gross sales amount, number of transactions, discount total, net sales amount
- Settlement modes breakdown: cash, card, UPI, digital wallets, credit (B2B) — amounts and transaction counts per mode
- Expenses section: expense category (petty cash, staff meals, utilities, other operational), amount, notes field per line
- Running total: gross sales − discounts = net sales; expenses total; net position for the day
- Validation status: Draft (editable), Submitted (locked), Finalised (locked + signed-off by Finance)
- Prior-day comparison panel (optional; for anomaly visibility)
- Pre-fill from last equivalent DSR per CC-PREFILL (settlement mode weights and expense lines)

**User actions:**
- Enter or edit sales category amounts and settlement mode breakdowns
- Add or remove expense lines with category and amount
- Use CC-PREFILL to carry forward last-day expense lines and amend
- Validate totals (system checks: settlement mode sum = net sales; basic implausibility check via CC-IMPLAUSIBILITY-WARN if totals deviate >30% from 7-day average)
- Save as Draft (status_draft; no journal entry yet)
- Submit for Finance review → status moves to Submitted; triggers notification to Finance Manager
- Finalise DSR (Finance Manager action) → status moves to Finalised; triggers daily sales journal entry via FR89 mapping rules
- View history of all DSRs for a location (list view toggle)

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL, CC-IMPLAUSIBILITY-WARN (totals implausibility vs 7-day average), CC-AUDIT-LINK, CC-TRN-DISPLAY (SA TRN generated on finalisation — `SA-YYYY-LOC-SEQ`)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval (Submitted), status_confirmed (Finalised), warning (implausibility banner, prior-day deviation), primary, on_primary, outline_variant

**Source FRs:**
FR93 (capture and validate Daily Sales Reports by location with sales categories, settlement modes, expense categories)

**Source journey(s):**
Finance Manager — "Trial Balance review: validates revenue matches daily sales reports; COGS aligns with production consumption" (digest line 50 — the DSR is the source data that revenue in the Trial Balance must match; Finance finalises DSRs as part of period-close validation)

**Related screens:**
sibling: SI-ACC-003 (Trial Balance — revenue line validates against DSR totals), sibling: SI-ACC-004 (P&L Statement — revenue feeds from finalised DSR journal entries)

**Notes:**
The SA TRN (`SA-YYYY-LOC-SEQ`) is generated on Finalisation (not on Submit), mirroring the pattern that TRNs are generated at the moment a transaction moves to its confirmed/financially significant state. FR89 (auto-journal for confirmed operational transactions) fires the sales journal entry on Finalisation — this is a service-layer trigger, not a manual entry. CC-PREFILL applies to expense lines and settlement mode proportions (pre-fills from yesterday's DSR for the same location; user overrides as needed). The implausibility check (CC-IMPLAUSIBILITY-WARN) compares today's gross sales against a 7-day rolling average — a deviation >30% triggers a warn-and-log banner that Finance must acknowledge before submission. This is not the same as FR114 (which is for quantity fields in GR/production) — it is an analogous pattern applied to financial totals; no new FR is required as FR93 owns the validation scope.

---

#### SI-ACC-008 — Budget Create / Edit

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Create and manage budgets by cluster, location, and department for a fiscal period so that actuals from the internal ledger can be compared against planned targets.

**Data displayed:**
- Budget name, fiscal period (month, quarter, or full year), scope (cluster, location, or department selector)
- Budget lines table: account or P&L line (from COA grouping), budgeted amount, notes field per line
- Pre-fill from prior period budget per CC-PREFILL (carries forward prior-year same-period budget as starting template)
- Status pill: Draft (editable), Submitted (routes through approval if required), Approved (locked; actuals compared against this)
- Total budget summary at footer

**User actions:**
- Create new budget → select period, scope, enter budget lines
- Edit budget lines (amount and notes) while in Draft status
- Use CC-PREFILL to carry forward prior period budget lines and adjust
- Submit for approval (routes through Unified Approval Engine per FR16 if approval threshold configured)
- Approve or reject budget (Brand Owner; routes back to Finance for revision on rejection)
- Deactivate / archive superseded budget version

**Cross-cutting:**
CC-DRAFT-PILL, CC-PREFILL, CC-APPROVAL-INBOX-CARD (if budget approval is configured), CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_pending_approval, status_confirmed (Approved), primary, on_primary, outline_variant

**Source FRs:**
FR94 (create and track budgets by cluster, location, department)

**Source journey(s):**
Finance Manager — "month-end financial snapshot: opens Finance dashboard; sees all transactions from previous month already recorded" (digest line 49 — budget entry is the forward-looking complement to the month-end close; Finance enters next period's budget after closing the current period)

**Related screens:**
drill-down: SI-ACC-009 (Budget vs Actual Variance — the read-only companion to this create surface), sibling: SI-INF-002 (Unified Approval Inbox — budget approval appears there if routing is configured)

**Notes:**
Budget does not fire a journal entry — it is a planning record, not an accounting transaction. No TRN is generated and CC-TRN-DISPLAY does not apply. CC-APPROVAL-INBOX-CARD applies if the Brand Owner configures a budget approval threshold in the Unified Approval Engine; in early-stage setups where no threshold is configured, the Approved status is reached by direct Brand Owner action on this screen without routing through the inbox. FR94 also owns variance tracking — that lives on SI-ACC-009.

---

#### SI-ACC-009 — Budget vs Actual Variance

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Track budget vs actual spend by cluster, location, and department for a selected period so Finance and management can identify and investigate material variances.

**Data displayed:**
- Period selector and scope selector (brand, cluster, location, department)
- Variance table: account or P&L line, budgeted amount, actual amount from internal ledger, variance amount (actual − budget), variance percentage, direction indicator (favourable / unfavourable)
- Variance status flags: rows exceeding a configurable threshold percentage are colour-coded (warning or error token)
- Period comparison: current period vs prior period actuals
- Drill-down affordance per variance line: opens contributing journal entries for that account in the period

**User actions:**
- Select period and scope
- Drill down into a variance line → account-level journal detail with source TRNs (CC-TRN-DISPLAY on entries)
- Navigate to SI-ACC-008 to edit the budget for the selected period
- Export variance report (CC-EXPORT-TRIGGER: CSV / Excel / PDF)
- Raise issue ticket against a material variance (CC-ISSUE-TICKET-LINK — for assignment to Cluster Manager or Store Manager for investigation)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to source transactions shows TRN), CC-ISSUE-TICKET-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, warning (variance within tolerance but notable), error (variance above threshold), success (favourable variance), outline_variant, primary

**Source FRs:**
FR94 (track budgets by cluster, location, department with Budget vs Actual variance reporting)

**Source journey(s):**
Finance Manager — "month-end financial snapshot: opens Finance dashboard; sees all transactions from previous month already recorded with TRNs; automated journal entries generated; Trial Balance already available" (digest line 49 — budget variance review is the analytical companion to the Trial Balance review, both performed as part of month-end close)

**Related screens:**
parent: SI-ACC-008 (Budget Create / Edit — the source of the budgeted amounts), sibling: SI-ACC-003 (Trial Balance — the actual figures come from the same internal journal), drill-down: SI-INF-008 (issue ticket — for variance investigation assignment)

**Notes:**
This is a read-only analytical surface — no CC-DRAFT-PILL, no CC-AUDIT-LINK (no per-record edits here). CC-ISSUE-TICKET-LINK allows Finance to raise a formal investigation ticket against a material variance line without leaving the screen. The variance threshold for colour-coding is configurable (a system setting managed in Epic 1 or Epic 3 infrastructure; not surfaced here). FR94 owns both budget entry (SI-ACC-008) and variance tracking (this screen).

---

#### SI-ACC-010 — FCCC Financial Framing

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster) — read-only access for cost-cascade visibility

**Purpose:**
View the Food Cost Control Centre's financial framing — theoretical vs actual food cost per item, vendor price trends, margin analysis, and wastage cost percentage — so Finance and Procurement can drive cost control decisions using a period-comparable view.

**Data displayed:**
- Period selector (current period, prior period; M-o-M, Q-o-Q, Y-o-Y toggles per FR95)
- Scope selector (brand, cluster, specific location)
- Per-item table: item name (final product or semi-product), theoretical food cost %, actual food cost %, variance (actual − theoretical), margin per item, wastage cost % of revenue for the period
- Vendor price tracking panel: items with active vendor price alerts (>10% above 30-day average per FR95 and FR46), current price vs 30-day average, alert severity
- Period comparison panel: M-o-M and Q-o-Q food cost % trend lines per item
- Drill-through affordance per item (≤2 clicks per FR95): recipe → ingredient → vendor → PO → GR chain without losing context

**User actions:**
- Select period, scope, and comparison period
- Drill through from any item's food cost % → recipe detail → ingredient usage → vendor → source PO → GR with yield variance (drill chain ≤2 clicks per FR95)
- Filter by category, item type, or food cost % threshold
- Export FCCC financial report (CC-EXPORT-TRIGGER: CSV / Excel / PDF)
- Navigate to SI-RPT-006 (FCCC Operational Analytics Framing) for the operational analytics framing (CC-FCCC-DUAL-SURFACE partner); menu engineering matrix at SI-RPT-007

**Cross-cutting:**
CC-FCCC-DUAL-SURFACE, CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-through to source PO and GR shows TRN)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, warning (food cost % above configurable threshold), error (food cost % significantly above standard), success (food cost % within target), tertiary, tertiary_container (vendor price alert panel accent), outline_variant, primary

**Source FRs:**
FR95 (Food Cost Control Centre — financial framing: theoretical vs actual per item, vendor price tracking with alerts, margin analysis, wastage cost %, period comparisons, drill-through to source transactions ≤2 clicks)

**Source journey(s):**
Procurement Manager — "Food Cost Control Centre impact visibility: sees butter cost increase will push pastry food cost from 31% to 33% if unchanged; uses this data for vendor negotiation decisions" (digest line 76 — FCCC financial framing is the exact screen Anil uses to quantify the vendor price impact on food cost); Finance Manager — "Trial Balance review: COGS aligns with production consumption" (digest line 50 — food cost data validates against the COGS lines in the Trial Balance)

**Related screens:**
sibling: SI-RPT-006 (FCCC Operational Analytics Framing — CC-FCCC-DUAL-SURFACE partner; cost-per-serving alerts, product mix Pareto, time-series trends, actionable suggestions from FR108), sibling: SI-RPT-007 (Menu Engineering Matrix — Stars/Puzzles/Plowhorses/Dogs quadrant view, part of the operational half), drill-down: SI-PUR-005 (vendor price comparison — ID assigned in Task 5), drill-down: SI-INV-006 (GR detail — ID assigned in Task 4), drill-down: SI-REC-001 (recipe detail — ID assigned in Task 6)

**Notes:**
This screen is the financial half of CC-FCCC-DUAL-SURFACE. The operational analytics framing (FR108 — cost-per-serving alerts, product mix Pareto, time-series trends, actionable suggestions) lives in Epic 12 as SI-RPT-006 (FCCC Operational Analytics Framing); the menu engineering matrix (Stars/Puzzles/Plowhorses/Dogs quadrant view) is SI-RPT-007. Both SI-RPT-006 and this screen share underlying data queries and drill-down state — the Phase 2c design must ensure they cross-link without duplicating drill-down context (e.g. navigating from the operational framing's item detail to this financial framing's vendor price panel should not reset the selected item). FR95 explicitly requires the drill-through chain reach GR in ≤2 clicks; this drives the information architecture of the drill-through path rather than any specific navigation mechanism. FR87 (TRN generation — service-layer) and FR89 (auto-journal — service-layer) are referenced via CC-TRN-DISPLAY when the drill-through reaches PO or GR records; those FRs have no screen here — see §5.

---

#### SI-ACC-011 — Accountant Handoff Exports

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Generate structured accountant handoff exports across all report types and formats simultaneously so the accountant receives a complete, TRN-keyed export package ready for import into Tally, Zoho Books, or generic accounting tools.

**Data displayed:**
- Export type selector (multi-select or all): Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost
- Format selector: Tally, Zoho Books, Generic CSV (all three can be generated simultaneously per FR96)
- Period selector (date range or closed accounting period)
- Scope selector (brand-wide or specific cluster/location)
- Export history table: past exports with export date, report types included, format, period covered, exported-by user, download link (time-limited), re-download affordance
- Pending transactions indicator: count of transactions in the selected period that have not yet been exported in any format (visibility into handoff completeness)

**User actions:**
- Select report types, formats, period, and scope
- Initiate export → system generates files in all selected formats simultaneously; status indicator during generation
- Download individual format files or all as a ZIP
- Re-download prior exports from the history table
- View pending transactions count → drill-down to list of unexported transactions
- Mark export as sent (optional manual annotation in export history for tracking)

**Cross-cutting:**
CC-EXPORT-TRIGGER (FR96 multi-format export; also FR107 standard formats where applicable), CC-TRN-DISPLAY (export files are keyed on TRN per FR96)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (export completed), warning (pending transactions not yet exported), error (export failed), primary, on_primary, outline_variant, status_completed (successful export row), status_pending_approval (export in-progress)

**Source FRs:**
FR96 (generate structured accountant handoff exports in three simultaneous formats — Tally, Zoho Books, Generic CSV; fixed column names keyed on TRN; format selection recorded in export history)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow — Stage 2 initiation: downloads Sales Register export (FR96); sends to accountant for external GST invoice generation in Tally" (digest line 51 — this screen is the exact tool Finance uses to pull the Sales Register for the accountant); Finance Manager — "Integration Status Dashboard review: checks daily Integration Status Dashboard for export status, pending transactions, last export date per type" (digest line 55 — the export history on this screen feeds what the Integration Status Dashboard summarises)

**Related screens:**
sibling: SI-ACC-013 (Integration Status Dashboard — shows summary of export status from this screen's history), sibling: SI-DSP-005 (B2B Challan List — the operational list whose Sales Register is exported here), sibling: SI-ACC-003 (Trial Balance — the Transaction Journal export validates against the Trial Balance)

**Notes:**
FR96 requires all three formats simultaneously — the export engine generates Tally XML (or compatible format), Zoho Books CSV, and Generic CSV in a single export run keyed on the same TRN references. Fixed column names per format are defined in the architecture phase (Phase 3a) — this screen does not own the column-name spec; it surfaces the trigger and history. The export history records format selection (which of the three formats were generated) and is the operational audit trail of accountant handoffs, not the financial audit trail (which lives on individual transaction records). No CC-AUDIT-LINK on this screen — it is a generation surface, not a per-record editable surface; the export history is append-only by nature.

---

#### SI-ACC-012 — Compliance Placeholder Editor

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand) — edits TDS fields and GST / IRN / e-way bill fields
- Brand Owner (scope: brand) — edits GST / IRN / e-way bill fields; cannot edit TDS fields without FR15a override

**Purpose:**
Maintain compliance placeholder fields (GST amounts, IRN, TDS, e-way bill) on relevant transactions in a role-bound editor so the correct fields are visible and editable per the role binding defined in FR97.

**Data displayed:**
- Transaction search / filter: by TRN, transaction type (PO, GR, B2B Challan, Sales), period, location
- Transaction list with compliance-field completeness indicator per row (number of placeholder fields filled vs total applicable)
- Per-transaction detail panel: all applicable placeholder fields per the master spec §6.5 field tables — GST fields (vendor_gstin, buyer_gstin, hsn_code, place_of_supply, tax_rate_percent, cgst_amount, sgst_amount, igst_amount), E-Invoicing fields (irn, irn_generated_at), TDS fields (tds_applicable, tds_section, tds_rate_percent, tds_amount, tds_certificate_number), E-Way Bill fields (eway_bill_number, eway_bill_validity_date, transporter_id, vehicle_number)
- Role-based field availability: TDS fields greyed out for Brand Owner (editable only by Finance Manager); all other fields editable by both Finance Manager and Brand Owner
- Validation status per field: GST field combination validation per CC-GST-FIELD-VALIDATION (place-of-supply determines CGST+SGST vs IGST)
- Completion percentage per transaction (visual progress indicator)

**User actions:**
- Search and filter the transaction list
- Select a transaction → open detail panel with applicable placeholder fields
- Fill or update any editable placeholder field (nullable; system proceeds whether filled or not per FR97)
- GST field validation fires on save (CC-GST-FIELD-VALIDATION; rejects invalid CGST+SGST+IGST combination per FR118)
- Save changes → changes audit-logged per FR20 with before/after snapshots
- Navigate to source transaction detail (e.g. drill-down to SI-DSP-007 for a B2B Challan record)

**Cross-cutting:**
CC-AUDIT-LINK, CC-GST-FIELD-VALIDATION, CC-TRN-DISPLAY

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, success (field fully completed), warning (partially completed), error (invalid GST combination), outline_variant, primary, on_primary, status_confirmed (all fields complete indicator)

**Source FRs:**
FR97 (maintain compliance placeholder fields — GST, e-invoicing, TDS, e-way bill — as optional nullable on relevant transactions; role bindings: Finance Manager edits TDS; Finance Manager + Brand Owner edit GST, IRN, e-way bill)

**Source journey(s):**
Finance Manager — "B2B challan GST workflow — Stage 2 initiation: identifies 3 B2B challans in Delivered status needing GST invoice confirmation; downloads Sales Register export (FR96); sends to accountant" (digest line 51 — compliance fields like IRN must be filled after receiving them from the accountant; this screen provides the canonical editor for that workflow, complementing the inline GST closure on SI-DSP-010)

**Related screens:**
sibling: SI-DSP-010 (B2B GST Closure — the inline GST closure surface for individual challans; SI-ACC-012 is the batch compliance editor across all transaction types), sibling: SI-ACC-011 (Accountant Handoff Exports — exports include GST and IRN data from these fields)

**Notes:**
FR97 establishes a canonical role binding for compliance placeholder fields. This screen is the Finance-level batch editor for compliance fields across all transaction types — it is the "go to one place to fill all IRNs" surface after the accountant returns them. Individual transaction detail screens (SI-DSP-007 for B2B Challan, SI-PUR-002 for PO) also expose the same compliance fields inline for field-level edits in context, but those are sub-affordances on their parent screens — SI-ACC-012 is the canonical reference screen for the role binding. FR118 (CC-GST-FIELD-VALIDATION) fires on every save of GST fields. FR119 (CC-UNREGISTERED-CUSTOMER-WARN) is not triggered from this screen directly — that warning fires on SI-DSP-010 when gst_invoice_raised is being set; this screen handles GST field population, not the gst_invoice_raised atomic action. All placeholder fields remain nullable; the system never fails if they are empty (per master spec §6.5 and FR97). E-invoicing, TDS, and e-way bill features are post-MVP (§6.4); the fields exist as placeholders from day one.

---

#### SI-ACC-013 — Integration Status Dashboard

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Monitor the export status, pending transaction counts, and last export date per report type so Finance has a daily operational view of the accountant handoff pipeline.

**Data displayed:**
- Per-report-type status tiles (Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost): last export date, last export format(s), pending transaction count (transactions confirmed but not yet exported), days since last export
- Pending transactions table: TRN, transaction type, amount, confirmed date, export status (never exported / partially exported for some formats / all formats exported)
- POS import health summary (cross-listed from Epic 9 SI-POS-003 — see Notes): last import timestamp, pending import count, failed import count
- Integration health alerts: any export failure events in the last 24h, any POS import failures requiring retry

**User actions:**
- View all integration health tiles at a glance
- Drill down into pending transactions for a specific report type → filtered list of unexported confirmed transactions
- Navigate to SI-ACC-011 (Accountant Handoff Exports) to trigger a new export run
- Retry failed POS import (sub-affordance; links to SI-POS-003 functionality)
- Export the Integration Status Dashboard summary (CC-EXPORT-TRIGGER: CSV for audit or sharing with accountant)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-TRN-DISPLAY (drill-down to pending transactions shows TRN), CC-DASHBOARD-TILE

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (all exports current, zero pending), warning (pending transactions above threshold or days since export > configurable limit), error (export failure or import failure), outline_variant, primary, tertiary_container (integration health tile background)

**Source FRs:**
FR98 (Integration Status Dashboard showing export status, pending transactions, last export date per type)

**Source journey(s):**
Finance Manager — "Integration Status Dashboard review: checks daily Integration Status Dashboard for export status, pending transactions, last export date per type; visibility into handoff pipeline" (digest line 55 — this screen is the exact FR98 surface described in that journey moment)

**Related screens:**
sibling: SI-ACC-011 (Accountant Handoff Exports — the action surface this dashboard monitors), sibling: SI-POS-003 (POS Import Status — ID assigned in Task 9 — cross-listed here for POS import health)

**Notes:**
No CC-AUDIT-LINK — this is a read-only operational monitoring surface, not a per-record editable screen. The POS import health summary cross-listed from Epic 9 (SI-POS-003) provides Finance with a unified view of both outbound exports and inbound POS imports without navigating to separate areas. In the Epic 9 Notes for SI-POS-003, it is stated that a future Epic 10 (FR98) dashboard will surface the accountant export side — this screen is that dashboard, and SI-POS-003 is the operational POS import monitoring screen. The cross-reference is bidirectional.

---

#### SI-ACC-014 — Manual Journal Voucher

**Primary epic:** Epic 10 — Accounting & Financial

**Primary device:** desktop-primary

**Roles & scope:**
- Finance Manager (scope: brand)
- Brand Owner (scope: brand)

**Purpose:**
Create a manual journal voucher for adjustments not covered by automated journal mapping rules, generating its own JV TRN and maintaining the double-entry integrity of the internal ledger.

**Data displayed:**
- JV reference: JV TRN (`JV-YYYY-LOC-SEQ`) — auto-generated on save/confirmation; displayed as "DRAFT — TRN pending" while in draft per CC-TRN-DISPLAY and CC-DRAFT-PILL
- Journal date (defaults to today; editable)
- Narration (description of the adjustment reason — mandatory text field)
- Debit/credit lines table: account selector (from COA — SI-ACC-001), debit amount, credit amount, line narration (optional per line); ≥2 lines required; totals must balance (debit sum = credit sum)
- Running balance indicator: real-time check showing whether current entry is balanced (debit total vs credit total)
- Reference fields (optional): source TRN field (links this JV to the transaction it is correcting, e.g. the GR TRN that had a provisional cost now being permanently reclassified), supporting document attachment
- Reversing JV option: flag to auto-generate a reversing entry at period start

**User actions:**
- Add debit and credit lines (account picker, amount entry, optional line narration)
- Enter mandatory narration for the voucher
- Link to a source TRN (optional but recommended for traceability)
- Attach supporting documents (e.g. approval email, accountant instruction)
- Save as Draft (no journal entry written to ledger yet; CC-DRAFT-PILL active; no JV TRN generated)
- Submit → ledger write occurs; JV TRN generated (`JV-YYYY-LOC-SEQ`); status moves from Draft to Confirmed; entry is immutable from this point (correction path is a new reversing JV per FR117 / CC-REVERSE-CANCEL)
- Cancel Draft (sub-affordance; available only in Draft status per CC-REVERSE-CANCEL and FR117)
- Post-submission: view the confirmed JV in read-only mode with full debit/credit lines, TRN, and audit timeline

**Cross-cutting:**
CC-DRAFT-PILL, CC-TRN-DISPLAY, CC-AUDIT-LINK, CC-REVERSE-CANCEL (Draft cancellation only; post-confirmed correction = new reversing JV)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, status_draft, status_confirmed, success (entry balanced), error (entry unbalanced — blocks submission), warning (missing source TRN reference — advisory only), primary, on_primary, outline_variant, inverse_surface (confirmed / locked state indicator chrome)

**Source FRs:**
FR99 (create manual journal vouchers with own TRN for adjustments not covered by automated entries — `JV-YYYY-LOC-SEQ`)

**Source journey(s):**
Finance Manager — "month-end financial snapshot: sees all transactions from previous month already recorded with TRNs; automated journal entries generated; Trial Balance already available" (digest line 49 — manual JVs are the correction path when automated journals need adjustment; Finance uses this during month-end to create reclassifications, accruals, or corrections not fired by operational events); Finance Manager — "IRN paste & Stage 2 journal trigger: creates Credit Note with conditional two-stage reversal" (digest line 52 — JV creation is the Finance-level correction path; credit notes are separate from JVs but Finance may create a JV to handle adjustments arising from the B2B challan workflow that do not fit into the credit note path)

**Related screens:**
sibling: SI-ACC-002 (Journal Mapping Rules Admin — auto-mapping configuration; JV is the manual complement), sibling: SI-ACC-003 (Trial Balance — JVs affect account balances visible here), drill-down: SI-INF-006 (audit timeline — every JV is audit-logged with before/after ledger state)

**Notes:**
FR99 specifies `JV-YYYY-LOC-SEQ` as the TRN format for manual journal vouchers. The LOC segment reflects the location scope of the Finance Manager initiating the entry — brand-level entries use the brand location code. The JV is immutable once confirmed per FR117 and the CC-REVERSE-CANCEL pattern; the correction path for a confirmed JV is a new reversing JV referencing the original JV TRN. FR87 (TRN generation — service-layer) fires when the JV is submitted; the display is CC-TRN-DISPLAY — see §5 for FR87. FR89 (auto-journal mapping) is the automated complement; FR99 is the manual path for gaps — both paths write to the same internal ledger (FR90 — service-layer — see §5). The supporting document attachment on this screen is a first-class Finance workflow requirement for audit evidence of manual adjustments; it is not covered by a named FR but is implied by FR20 (append-only audit trail with before/after snapshots).

---

### Epic 11 — HRMS (HRM)

Epic 11 covers the foundational Human Resource Management module: employee master data, basic attendance tracking, shift definitions and assignments, and duty roster visibility. This epic is admin/setup-focused with no primary operational journey moments driving its screens in the digest §A — it is a supporting infrastructure epic that enables operational roles to manage workforce planning. All screens in this epic are used by Brand Owner (brand-wide HR administration) and Cluster Manager (cluster-scoped HR administration) — there is no dedicated HR Admin role in this MVP per §4's 8-role catalogue — as well as Store Managers for location-level staff configuration and operational roles for read-only roster visibility. Brand Owner and Cluster Manager handle HR administration (no dedicated HR Admin role in this MVP per §4). No payroll, no performance management, and no financial compensation rules are in scope for the MVP (Tier 3 depth per Master Spec §3).

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-HRM-001 | Employee List | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location) |
| SI-HRM-002 | Employee Create / Edit | desktop-primary | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location) |
| SI-HRM-003 | Attendance Entry / Log | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location) |
| SI-HRM-004 | Shift Definition Admin | desktop-primary | Brand Owner (brand), Cluster Manager (cluster) |
| SI-HRM-005 | Duty Roster View | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Store Manager (location), Kitchen Manager (location/department) |

---

#### SI-HRM-001 — Employee List

**Primary epic:** Epic 11 — HRMS

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)

**Purpose:**
Maintain a searchable register of all employees across the brand, cluster, or location with employment status, department assignment, and shift visibility.

**Data displayed:**
- Employee name, employee ID, status (Active / Inactive), department assignment
- Location assignment, role/designation (if captured)
- Date of joining, phone contact (optional)
- Row action menu: edit, deactivate, view roster

**User actions:**
- Filter by location, department, active status
- Search by name or employee ID
- Create new employee → routes to SI-HRM-002
- Edit employee details → routes to SI-HRM-002
- Deactivate employee (soft-delete, prevents roster assignment to future shifts)
- Bulk deactivate
- View duty roster for employee (if applicable) → drill-down to SI-HRM-005
- Export list (CC-EXPORT-TRIGGER: CSV / Excel)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_confirmed (active pill), surface_container_high (inactive pill), outline_variant

**Source FRs:**
FR100 (employee records list view)

**Source journey(s):**
Brand Owner / Cluster Manager / Store Manager — employee onboarding and roster management (admin/setup surface; no primary journey moment in digest §A)

**Related screens:**
drill-down: SI-HRM-002 (employee edit), sibling: SI-HRM-005 (duty roster — employee roster assignments), drill-down: SI-HRM-005 (view roster for specific employee)

**Notes:**
Desktop variant: sortable multi-column table with status filter and department grouping. Mobile variant: card list with status badge and department label. Employee ID is either system-generated or user-assigned. Inactive employees are soft-deleted and hidden from roster assignment but retained for audit trail. Bulk operations (export, bulk deactivate) require confirmation modal. Search is client-side for responsive performance on mobile. Phase-2c gap candidate: dedicated `status_inactive` token for deactivated employees; currently using `surface_container_high` interim (matches MDM/DSP master-data inactive pattern).

---

#### SI-HRM-002 — Employee Create / Edit

**Primary epic:** Epic 11 — HRMS

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)

**Purpose:**
Create and maintain individual employee records with personal details, employment information, department and location mapping, and shift assignment eligibility.

**Data displayed:**
- Employee personal details: full name, phone number, email (optional), date of birth (optional for compliance placeholder)
- Employment information: employee ID (system-generated or user-input), role/designation (text field or dropdown), date of joining, employment status (Active / Inactive)
- Department assignment: current department (dropdown, scoped to locations accessible to user)
- Location assignment: primary work location (dropdown, scoped to brand/cluster/location per role scope)
- Eligible shifts: multi-select list of shift IDs assigned to this employee (sourced from SI-HRM-004)
- Save confirmation block

**User actions:**
- Create new employee → form with all fields required except optional fields marked
- Edit employee details (name, phone, email, designation, date of joining, location, department)
- Change employment status (Active ↔ Inactive)
- Add or remove eligible shifts from the employee's assignment list
- Save employee record (creates TRN if new; updates if existing; no journal entry — HR records are not financial)
- Cancel and return to SI-HRM-001

**Cross-cutting:**
CC-DRAFT-PILL, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, outline_variant

**Source FRs:**
FR100 (create and maintain employee records)

**Source journey(s):**
Brand Owner / Cluster Manager / Store Manager — employee onboarding and update workflow (admin/setup surface; no primary journey moment in digest §A)

**Related screens:**
parent: SI-HRM-001 (employee list), sibling: SI-HRM-004 (shift definition — for shift assignment options), sibling: SI-HRM-005 (duty roster — shows roster impact of assignment changes)

**Notes:**
This screen is the single point of entry for new employee creation and updates. Draft-pill indicates unsaved changes. Shift eligibility is a many-to-many mapping — an employee can be eligible for multiple shifts, and the duty roster (SI-HRM-005) uses this eligibility to populate roster slots. Location and department must be within the user's scope (enforced by dropdown scoping rules per role RBAC). Soft-delete (deactivate) prevents future roster assignments but retains attendance history for audit. Phone number validation is light (non-empty, plausible format); email is optional to support on-site/kitchen staff who may not have email. Employment status change (Active → Inactive) requires confirmation modal but no approvals — it is a data change, not a business transaction.

---

#### SI-HRM-003 — Attendance Entry / Log

**Primary epic:** Epic 11 — HRMS

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)

**Purpose:**
Record and view daily employee attendance (time in/out, absences, leave) with summary leave-balance tracking.

**Data displayed:**
- Daily attendance log table: date, employee name, time in (HH:MM format), time out (HH:MM format), attendance status (Present / Absent / On Leave / Half Day), leave type (if applicable: Sick / Casual / Earned / Unpaid), notes (optional)
- Leave balance summary card: total leave balance, leave used this period, leave available, breakdown by type (if applicable)
- Filter/search: by date range, employee name, department, location, status
- Summary counters: days present, days absent, days on leave, average daily hours

**User actions:**
- Record time in (scan employee badge or manual entry of name/ID + timestamp)
- Record time out (scan employee badge or manual entry of timestamp)
- Mark absence (select employee, date, reason/type, confirm)
- Mark leave (select employee, date range, leave type, confirm; deducts from leave balance)
- Edit attendance record (time in/out, status, leave type, notes) with reason code
- Export attendance log (CC-EXPORT-TRIGGER: CSV / Excel)
- View leave balance (read-only per-employee breakdown)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, success (present), warning (absent), outline_variant

**Source FRs:**
FR101 (track basic employee attendance)

**Source journey(s):**
Brand Owner / Cluster Manager / Store Manager — daily attendance entry and leave tracking (admin/setup surface; no primary journey moment in digest §A)

**Related screens:**
parent: SI-HRM-001 (employee list — used to identify attendance for specific employees), sibling: SI-HRM-005 (duty roster — roster schedules inform expected attendance), drill-down: SI-HRM-001 (view employee details from attendance row)

**Notes:**
Desktop variant: dense multi-column table with inline edit and date range picker. Mobile variant: card list per day with time in/out entry buttons and leave status indicator. Attendance is location-scoped; Store Manager can only enter/edit attendance for their location. Leave types and leave balance logic are placeholders — the MVP does not implement leave-accrual rules or complex balance tracking (post-MVP feature). Time in/out capture supports manual entry (HH:MM) and badge-scan integration (service-layer detail — not UI visible). Absence and leave recording both require a reason code (Sick / Casual / etc.) for audit traceability. Leave balance display is a simple summary; no detailed accrual schedule is shown in the MVP.

---

#### SI-HRM-004 — Shift Definition Admin

**Primary epic:** Epic 11 — HRMS

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Create and manage shift definitions (working hours, roles, location assignments) that will be assigned to employees and used to populate duty rosters.

**Data displayed:**
- Shift list table: shift name (e.g. "Morning Kitchen", "POS Afternoon"), shift code (system-generated or user-assigned), start time (HH:MM), end time (HH:MM), applicable roles (multi-select: Chef / Pastry / Dispatch / POS / Store Manager / Etc.), applicable locations (multi-select), active status, creation date
- Row action menu: edit, deactivate, view roster using this shift

**User actions:**
- Search and filter by name, location, role, active status
- Create new shift → form with shift name, code, start time, end time, role selector, location selector, active flag
- Edit shift details (name, code, start/end times, roles, locations, active status)
- Deactivate shift (soft-delete; prevents assignment to future roster slots but retains historical usage)
- Bulk deactivate
- View roster assignments for this shift → drill-down to SI-HRM-005
- Export shift list (CC-EXPORT-TRIGGER: CSV / Excel)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, primary, status_confirmed (active pill), surface_container_high (inactive pill), outline_variant

**Source FRs:**
FR102 (create shift definitions and assign shifts to employees by role and location)

**Source journey(s):**
Brand Owner / Cluster Manager — shift definition and role-based assignment setup (admin/setup surface; no primary journey moment in digest §A)

**Related screens:**
sibling: SI-HRM-002 (employee create/edit — shift eligibility is assigned here), sibling: SI-HRM-005 (duty roster — shifts are used to populate roster), drill-down: SI-HRM-005 (view roster for specific shift)

**Notes:**
Shift definitions are brand or cluster-wide master data that are then assigned to employees and used to structure the duty roster. A single shift can apply to multiple roles and locations (e.g. "Morning Kitchen" applies to Pastry and Bakery roles at Central Kitchen A). Start and end times are stored as HH:MM; no timezone handling in MVP (single-timezone assumption per master spec). Shift deactivation prevents new roster assignments but does not erase historical roster records — past rosters using the deactivated shift remain visible. Shift codes are optional but useful for printed rosters and integration with external HR systems. No shift-duration validation or overlap checks are enforced at create time — the MVP assumes Cluster Managers know their operational constraints. Phase-2c gap candidate: dedicated `status_inactive` token for deactivated shifts; currently using `surface_container_high` interim (matches MDM/DSP master-data inactive pattern).

---

#### SI-HRM-005 — Duty Roster View

**Primary epic:** Epic 11 — HRMS

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Store Manager (scope: location)
- Kitchen Manager (scope: location/department)

**Purpose:**
View and manage the duty roster (shift schedule) for employees across locations and departments, with shift-to-employee mapping and roster fill/confirmation status.

**Data displayed:**
- Roster calendar/grid view: rows = employees or departments (selectable), columns = dates/days, cells = shift assignments (shift name + start/end time + assigned employee name if filled)
- Roster summary: total shifts scheduled, shifts filled, shifts open/unfilled, fill rate %
- Filters: by date range, location, department, shift, employee status (active/inactive)
- Legend: filled shift (color-coded by shift type), open shift (outline/placeholder style), conflict indicator (employee double-booked or outside eligible shifts), cancelled shift (strikethrough)
- Cell action affordances (desktop: hover-reveal; mobile: long-press): assign employee, remove assignment, mark shift as cancelled

**User actions:**
- View roster by location or department (scoped by user role)
- Filter by date range, shift, employee
- Assign employee to open shift → modal to select eligible employee and confirm
- Remove employee from shift → confirm modal
- Cancel shift → confirm modal
- View conflict warnings (double-booked, ineligible assignment)
- Export roster (CC-EXPORT-TRIGGER: CSV / Excel / PDF for printing)
- Drill-down: click employee name → view that employee's full roster (SI-HRM-001 drill)
- Drill-down: click shift name → view all assignments for that shift (SI-HRM-004 drill)

**Cross-cutting:**
CC-EXPORT-TRIGGER, CC-AUDIT-LINK

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, primary_container, success (filled), warning (open/unfilled), error (conflict), outline_variant

**Source FRs:**
FR103 (view duty rosters and shift schedules)

**Source journey(s):**
Brand Owner / Cluster Manager / Kitchen Manager — duty roster planning and schedule visibility (admin/setup surface; no primary journey moment in digest §A)

**Related screens:**
parent: SI-HRM-001 (employee list — roster shows employee assignments), parent: SI-HRM-004 (shift definition — roster uses defined shifts), drill-down: SI-HRM-001 (view employee details), drill-down: SI-HRM-004 (view shift definition)

**Notes:**
Roster view is the aggregated view of all employee-shift assignments. The grid layout (date/employee/shift) is the canonical operational view used by Cluster Managers to plan staff scheduling and Kitchen Managers to see today's expected staff. Eligible shifts for an employee are defined in SI-HRM-002 — assignments outside that set trigger a conflict warning but can be forced with a reason code [→ Phase 3a interaction design]. Phase 3a deferred: force-override UI flow for ineligible roster assignment (reason-code capture, confirmation step, and audit trail for the override). Open/unfilled shifts are visual placeholders (e.g. gray outline) that Cluster Managers can click to assign an employee. Roster conflicts (double-booked, ineligible) are surfaced as warning colours and optional reason codes. The MVP does not implement auto-scheduling algorithms or conflict resolution — all assignments are manual. Export to PDF is used for printed rosters posted in break rooms or kitchen stations. Roster is read-only for Kitchen Managers (location/department-scoped visibility only); edit rights are Cluster Manager and above.

---

### Epic 12 — Analytics & Reporting (RPT)

Epic 12 is the brand's read surface: the personalised morning briefing every role lands on at login, the Brand Owner cross-location dashboard, the cluster-scoped variant for Cluster Managers, the standard operational reports library and per-report runner, the FCCC operational analytics surface (paired with the financial half in the Accounting epic through CC-FCCC-DUAL-SURFACE) including the menu engineering matrix, the unusual-activity feed driven by rule-based detection, and the PAR drift recommendations report. None of these screens write business state — they are all read-only views built from data that other epics produce. Two parking-lot items realise here: P2B-005 (the override-frequency widget on the Brand Owner dashboard), and the implicit Pending-GR-resolution-outcomes drill-through (CC-PENDING-GR-DRILL originates on the Brand Owner dashboard pane and lands on the Pending-GR resolution outcomes detail in the Production epic). The implicit FCCC two-surface item closes here: the FCCC operational analytics surface and the menu engineering matrix together form the operational half of the dual surface, paired with the financial framing in the Accounting epic. Because every screen here is read-only, none carry CC-AUDIT-LINK (the per-record audit affordance lives on the source-of-truth screens in the originating epics); CC-EXPORT-TRIGGER appears on every report and dashboard per FR107, and CC-DASHBOARD-TILE is the universal tile pattern enabling the FR109 ≤2-click drill-down rule. Brand Owner and Cluster Manager are the dominant primary roles; Procurement Manager, Kitchen Manager, Finance Manager, Store Manager, Dispatch Staff, and POS Staff each see role-scoped instances of the morning briefing.

#### Per-epic screen table

| Screen ID | Screen name | Primary device | Primary roles |
|---|---|---|---|
| SI-RPT-001 | Personalised Morning Briefing | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Kitchen Manager (location/department), Finance Manager (brand), Procurement Manager (brand/cluster), Store Manager (location), Dispatch Staff (department), POS Staff (location/department) |
| SI-RPT-002 | Brand Owner Cross-Location Dashboard | desktop-primary | Brand Owner (brand) |
| SI-RPT-003 | Cluster Manager Cluster Dashboard | responsive-equal | Cluster Manager (cluster) |
| SI-RPT-004 | Reports Library Index | desktop-primary | Brand Owner (brand), Cluster Manager (cluster), Finance Manager (brand), Procurement Manager (brand/cluster) |
| SI-RPT-005 | Report Detail Runner | desktop-primary | Brand Owner (brand), Cluster Manager (cluster), Finance Manager (brand), Procurement Manager (brand/cluster), Store Manager (location) |
| SI-RPT-006 | FCCC Operational Analytics Framing | desktop-primary | Brand Owner (brand), Procurement Manager (brand/cluster), Finance Manager (brand) |
| SI-RPT-007 | Menu Engineering Matrix | desktop-primary | Brand Owner (brand), Procurement Manager (brand/cluster) |
| SI-RPT-008 | Unusual Activity Feed | responsive-equal | Brand Owner (brand), Cluster Manager (cluster), Procurement Manager (brand/cluster) |
| SI-RPT-009 | PAR Drift Recommendations | desktop-primary | Procurement Manager (brand/cluster), Brand Owner (brand), Cluster Manager (cluster) |

---

#### SI-RPT-001 — Personalised Morning Briefing

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Kitchen Manager (scope: location/department)
- Finance Manager (scope: brand)
- Procurement Manager (scope: brand/cluster)
- Store Manager (scope: location)
- Dispatch Staff (scope: department)
- POS Staff (scope: location/department)

**Purpose:**
Land every authenticated user on a role-scoped briefing that surfaces the actionable items waiting on them at the start of the working day in one screen.

**Data displayed:**
- Greeting block with date, role label, and persisted scope filter selector
- Role-specific tile grid drawn from CC-DASHBOARD-TILE — each tile shows a count or KPI plus secondary text and an optional sparkline
- Approvals-pending tile (count of items in the user's approval inbox)
- Open issue tickets assigned to the user (count + urgency indicator)
- Role-specific pinned tiles per the role catalogue in §4 (e.g. below-PAR count for Procurement Manager and Kitchen Manager, expiry-band counters for Store Manager and POS Staff, integration export status for Finance Manager, dispatch queue for Dispatch Staff)
- Today's date and last-login timestamp

**User actions:**
- Change persisted scope filter (brand / cluster / location / department per role)
- Click any tile to drill into the source-of-truth screen in ≤2 clicks per FR109
- Pin or unpin tiles within the role-scoped allowed set
- Refresh briefing data

**Cross-cutting:**
CC-DASHBOARD-TILE, CC-EXPORT-TRIGGER (briefing snapshot to PDF for offline review)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, outline_variant

**Source FRs:**
FR104 (personalised morning briefing per role), FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR109 (drill-down from summary dashboards to transaction detail)

**Source journey(s):**
Brand Owner — "morning dashboard review" (digest line 20); Cluster Manager — "cluster-scoped morning briefing" (digest line 29); Kitchen Manager — "morning briefing dashboard" (digest line 39); Procurement Manager — "morning dashboard" (digest line 69); Store Manager — "morning store management screen" (digest line 80); POS Staff — "POS-scoped morning dashboard" (digest line 89); Finance Manager — "month-end financial snapshot" entry context (digest line 49)

**Related screens:**
drill-down: SI-RPT-002 (Brand Owner dashboard — Brand Owner instance entry point), drill-down: SI-RPT-003 (Cluster Manager dashboard — Cluster Manager instance entry point), drill-down: SI-INV-003 (below-PAR list), drill-down: SI-INV-008 (expiry countdown), drill-down: SI-INF-007 (issue ticket list), drill-down: SI-INF-001 (Unified Approval Inbox — Epic 3)

**Notes:**
This is a meta-screen — the briefing itself is one route, but the tile composition differs by role. Per-role tile sets: Brand Owner sees a compact preview that links to SI-RPT-002 for the full cross-location view; Cluster Manager sees a compact preview that links to SI-RPT-003; Kitchen Manager sees real-time stock, items below PAR, pending production orders, expiry warnings (per digest line 39); Finance Manager sees integration export status and pending GST workflows (per digest line 49); Procurement Manager sees below-PAR counts, POs pending approval, GR summary, vendor price alerts (per digest line 69); Store Manager sees real-time stock, expiry-band counts, pending material requisitions, expected POs (per digest line 80); Dispatch Staff sees dispatch queue and pending receipts (per digest line 60); POS Staff sees yesterday's sales summary, expected dispatch, expiry-band sell-first items (per digest line 89). The persisted scope filter (FR105 requirement) is implemented uniformly so that selecting a scope on any landing carries through subsequent drill-downs. No CC-AUDIT-LINK because this is a read-only summary view; the underlying data carries audit links on the originating screens.

---

#### SI-RPT-002 — Brand Owner Cross-Location Dashboard

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)

**Purpose:**
Give the Brand Owner a single brand-wide control surface combining financial KPIs, operational health metrics, override-pattern monitoring, data-quality alerts, and drill-throughs into every concerning record in two clicks.

**Data displayed:**
- Persisted scope filter (brand / cluster / location) at top — selection survives across sessions
- Financial tiles: food cost % (current vs target), raw material stock value, daily sales total
- Operational tiles: variance flags count (closing inventory variance, production yield variance), pending approvals count above value threshold, provisional cost counts (Pending-GR-derived), Pending-GR-resolution-outcomes summary (recent rejections), key operational risks
- Override-frequency widget (CC-OVERRIDE-WIDGET): hero rate per 100 production orders + 30-day sparkline + per-type filter (FR67 Pending GR overrides, FR61 ingredient substitutions, FR62 enablement / stock overrides)
- Pending-GR-resolution-outcomes pane: recent rejected GRs and their reclassification journals, with drill-through into the resolution thread (CC-PENDING-GR-DRILL)
- Expiring permission overrides tile (count + 0–7 day urgent count) sourced from FR15c
- Cross-module data quality alerts pane (CC-DATA-QUALITY-ALERT): deactivated material in published recipe, deactivated vendor with open POs, etc.
- Unusual activity summary (count of active alerts from FR110)
- Last-refreshed timestamp

**User actions:**
- Change persisted scope filter (selection persists across sessions)
- Click any tile to drill into the source-of-truth screen in ≤2 clicks per FR109
- Filter override-frequency widget by override type
- Drill from Pending-GR-resolution-outcomes pane into the rejected-GR thread (CC-PENDING-GR-DRILL → SI-PRO-009)
- Drill from expiring-overrides tile into SI-USR-007
- Drill from data-quality alerts pane into the offending master-data record
- Export dashboard snapshot (CC-EXPORT-TRIGGER: PDF for board reporting)
- Pin or rearrange tiles within Brand Owner allowed set

**Cross-cutting:**
CC-DASHBOARD-TILE, CC-OVERRIDE-WIDGET, CC-PENDING-GR-DRILL, CC-DATA-QUALITY-ALERT, CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, surface_container_high, on_surface, on_surface_variant, primary, surface_tint, error, warning, outline_variant

**Source FRs:**
FR105 (Brand Owner cross-location dashboard with persisted scope filter and ≤2-click tile drill-through), FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR70 (override frequency metrics surfacing as operational health indicators — feeds CC-OVERRIDE-WIDGET), FR109 (drill-down from summary dashboards), FR15c (expiring permission overrides surface as a tile linking to SI-USR-007), FR116 (cross-module inconsistency alerts surface as data quality alerts pane)

**Source journey(s):**
Brand Owner — "morning dashboard review" + "variance investigation & assignment" + "cross-location drill-down & scope persistence" + "override pattern monitoring" + "Pending-GR resolution outcomes review" (digest lines 20–25)

**Related screens:**
drill-down: SI-PRO-009 (Pending GR Resolution Outcomes — destination of CC-PENDING-GR-DRILL), drill-down: SI-USR-007 (Overrides Expiring Soon — destination of expiring-overrides tile), drill-down: SI-INV-003 (Below-PAR list), drill-down: SI-INV-008 (expiry countdown), drill-down: SI-INV-016 (Closing Inventory Cluster Review — variance summary surfaces here; per-row variance entry deferred [→ Phase 3a]), drill-down: SI-PRO-003 (PO detail — for any flagged production order), drill-down: SI-PRO-001 (Production Order list), drill-down: SI-PUR-005 (vendor price comparison — for vendor price alerts), drill-down: SI-INF-007 (issue ticket list — for assigning investigations), drill-down: SI-RPT-006 (FCCC Operational Framing), drill-down: SI-ACC-010 (FCCC Financial Framing), drill-down: SI-RPT-008 (Unusual Activity Feed), drill-down: SI-MDM-003 (Product Master — destination from data-quality alert about deactivated material in active recipe), drill-down: SI-MDM-005 (Vendor Master — destination from data-quality alert about deactivated vendor with open POs), drill-down: SI-INF-001 (Unified Approval Inbox — Epic 3)

**Notes:**
This is the realisation of P2B-005 — the override-frequency widget lives here as the single aggregating instance, not on each override-firing screen (those screens feed data into this widget per the entries in Epic 7 SI-PRO-003, SI-PRO-004, SI-PRO-005, SI-PRO-008). The widget aggregates all warn-and-log override types (FR61, FR62, FR65, FR67) with per-type filters inside the widget, hero rate per 100 production orders, and the variance-style 30-day sparkline (DESIGN.md §6.6 visual signature) — `error` line colour when above rolling-7-day average, `surface_tint` otherwise. The Pending-GR-resolution-outcomes pane is the originating surface for CC-PENDING-GR-DRILL — the drill-through lands on SI-PRO-009 where the cross-entity audit thread (rejected GR + linked PO + reclassification journal) is presented. The expiring-permission-overrides tile is the dashboard mirror of SI-USR-007 per the parking-lot P2B-003 design — both surfaces share the same data; this tile shows the count and urgent-band breakdown only and clicks through to the full list. The cross-module data-quality alerts pane realises FR116 — Epic 1 detection rules feed alert rows here (raw material deactivated while active in published recipe version, vendor deactivated with open POs, department deactivated with enabled materials). Persisted scope filter is the FR105 requirement and is honoured uniformly across all drill-throughs. Tiles must respect the FR109 ≤2-click drill rule — direct landing on the source-of-truth screen with appropriate filters pre-applied. No CC-AUDIT-LINK because this dashboard does not carry per-record state of its own; audit affordances appear on each drilled-into record's source-of-truth screen.

---

#### SI-RPT-003 — Cluster Manager Cluster Dashboard

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** responsive-equal

**Roles & scope:**
- Cluster Manager (scope: cluster)

**Purpose:**
Give the Cluster Manager a cluster-scoped operational dashboard surfacing pending approvals, Kitchen Manager overrides flagged for review, variance investigations assigned by the Brand Owner, and cross-cluster surplus or expiry alerts.

**Data displayed:**
- Cluster-scope filter (default: user's assigned cluster; toggle to view neighbouring clusters where surplus/expiry alerts apply)
- Pending approvals tile (material requisitions, auto-approved POs for review, paired-transfer bundles)
- Kitchen Manager override review tile (cluster-scoped count of recent warn-and-log overrides flagged for retrospective review)
- Variance investigations assigned by Brand Owner (count + status breakdown)
- Cross-cluster surplus / expiry alerts (e.g. neighbouring-cluster items expiring in 48h that this cluster could absorb)
- Cluster-scoped operational health: items below PAR per location, expiring batches per location, open issue tickets cluster-scoped
- Recent variance reason codes summary (last 7 days)
- Last-refreshed timestamp

**User actions:**
- Change cluster scope (default own cluster; viewing neighbouring cluster surplus alerts requires toggle)
- Click any tile to drill into the source-of-truth screen in ≤2 clicks per FR109
- Initiate paired-transfer bundle from cross-cluster expiry alert (drill-through to SI-INV-005 with paired-bundle context pre-filled)
- Drill from override review tile into specific PO override entries
- Export dashboard snapshot (CC-EXPORT-TRIGGER: PDF / CSV)

**Cross-cutting:**
CC-DASHBOARD-TILE, CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, warning, error, outline_variant

**Source FRs:**
FR104 (cluster-scoped morning briefing instance), FR105 (cross-location dashboard logic — cluster-scoped variant), FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR109 (drill-down from dashboards)

**Source journey(s):**
Cluster Manager — "cluster-scoped morning briefing" + "Kitchen Manager override visibility" + "variance investigation drill-down" + "cross-cluster reallocation initiation" + "expiry-driven cross-location intelligence" (digest lines 29–35)

**Related screens:**
drill-down: SI-INF-001 (Unified Approval Inbox — Epic 3, for approvals tile), drill-down: SI-PRO-003 (PO detail — for override review), drill-down: SI-INV-008 (expiry countdown — for cross-cluster expiry alerts), drill-down: SI-INV-005 (Stock Transfer Create — for paired-transfer bundle initiation), drill-down: SI-INV-003 (below-PAR list cluster-scoped), drill-down: SI-INF-007 (issue ticket list — variance investigations), drill-down: SI-RPT-008 (Unusual Activity Feed — cluster-scoped subset)

**Notes:**
This is the cluster-scoped variant of SI-RPT-002 — same dashboard pattern, different scope and tile composition. The Cluster Manager does not see brand-wide financial KPIs or the override-frequency widget (those are Brand Owner surfaces); instead the focus is operational throughput, variance investigation, and cross-cluster coordination. Cross-cluster expiry alerts respect Master Spec §2.2 — raw materials never lateral between clusters; the affordance to initiate transfer routes through the paired Brand-Store-routed bundle pattern (CC-PAIRED-TRANSFER-BUNDLE, owned by Epic 4 SI-INV-005). No CC-AUDIT-LINK on this read-only dashboard. Persisted scope filter follows the FR105 pattern but is cluster-scoped by default for this role.

---

#### SI-RPT-004 — Reports Library Index

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Finance Manager (scope: brand)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Provide a single discoverable index of all standard operational reports available in the system, grouped by domain, with quick filters and recent-report shortcuts.

**Data displayed:**
- Report category groups: Procurement (Purchase Register, Vendor Price Trend), Inventory (Inventory Movement, Closing Inventory Variance, Wastage by Reason/Item), Production (Production-vs-Yield Variance), Dispatch (Dispatch Volume), Sales (B2B Sales Register, POS Sales by Item/Location/Day-Part), Cost (Food Cost), Accounting (Trial Balance, P&L, Balance Sheet, Cash Flow — links into Epic 10), HR (Roster, Attendance — links into Epic 11)
- Per-report row: report name, one-line description, last-run timestamp, default scope, available export formats
- Recent reports shortcut list (user's last 5 run reports)
- Search by report name or domain
- Role visibility: only reports the user has data-scope to view appear

**User actions:**
- Search and filter reports by name, domain, recently used
- Click report name to navigate to SI-RPT-005 with that report selected
- Mark report as favourite (pinned in user shortcut list)
- Export the index itself as a reference (CC-EXPORT-TRIGGER: CSV — listing reports + scope only, no data)

**Cross-cutting:**
CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, outline_variant

**Source FRs:**
FR106 (standard operational reports index covering Purchase Register, Inventory Movement, Food Cost, Production-vs-Yield Variance, Wastage by Reason/Item, Closing Inventory Variance, Dispatch Volume, B2B Sales Register, POS Sales by Item/Location/Day-Part, Accounting, HR Roster/Attendance), FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER)

**Source journey(s):**
Brand Owner — "variance investigation & assignment" entry into reports (digest line 21); Finance Manager — "B2B challan GST workflow — Stage 2 initiation downloads Sales Register export" (digest line 51); Procurement Manager — "morning dashboard" entry into vendor / GR reports (digest line 69)

**Related screens:**
drill-down: SI-RPT-005 (Report Detail Runner — every report in this index opens here), sibling: SI-RPT-002 (Brand Owner dashboard — alternative entry into reports via tile drill-throughs), sibling: SI-ACC-003 (Trial Balance), sibling: SI-ACC-004 (Profit & Loss Statement), sibling: SI-ACC-005 (Balance Sheet), sibling: SI-ACC-006 (Cash Flow Statement — Epic 10 financial statements remain in Epic 10 but are linked from this index for discoverability)

**Notes:**
This index is the discovery surface for FR106. Each report listed here opens via SI-RPT-005 with the chosen report's parameters bound. Accounting reports (Trial Balance, P&L, Balance Sheet, Cash Flow) live as full screens in Epic 10 (SI-ACC-005 through SI-ACC-008) per the per-statement design rationale documented at Epic 10's preamble — this index links to them rather than re-rendering them in the runner. HR reports (Roster, Attendance) similarly link into SI-HRM-005 and SI-HRM-003. The runner (SI-RPT-005) handles the operational reports proper. Role-visibility filter ensures Procurement Manager does not see B2B Sales Register, Finance Manager sees all Accounting reports, etc. — visibility is data-scope-driven, not separate role-permission entries.

---

#### SI-RPT-005 — Report Detail Runner

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Finance Manager (scope: brand)
- Procurement Manager (scope: brand/cluster)
- Store Manager (scope: location)

**Purpose:**
Run any standard operational report against parametrised filters with shared chrome (period, scope, item, vendor, customer, category) and surface the result with row-level drill-through and export.

**Data displayed:**
- Report header: report name, current parameters summary, last-run timestamp, render time
- Shared filter chrome: period selector (date range), scope selector (brand / cluster / location / department), item picker, vendor picker (where applicable), customer picker (where applicable), category picker
- Report result table or chart per report shape (Purchase Register: rows of POs with TRN, vendor, value; Inventory Movement: in/out per item; Food Cost: theoretical vs actual per item; Production-vs-Yield Variance: rows of POs with output deviation; Wastage by Reason/Item: grouped wastage volume and reason code; Closing Inventory Variance: per-item variance per closing event; Dispatch Volume: dispatches per location and period; B2B Sales Register: B2B challans with GST status; POS Sales by Item/Location/Day-Part: pivoted sales table)
- Aggregate summary row (totals, averages where applicable)
- Per-row drill-through affordance (click row → source TRN-bearing screen in originating epic)
- Pagination or virtualised scroll for large result sets

**User actions:**
- Adjust filters and re-run (filter changes auto-update result; period change requires explicit re-run for large datasets)
- Sort and group result columns
- Drill-through any row into source transaction in originating epic per FR109
- Export result (CC-EXPORT-TRIGGER: CSV / Excel / PDF per FR107)
- Save current filter set as a named saved-filter for later recall
- Schedule the report (queue an email-delivered version — interaction depth deferred to Phase 3a)

**Cross-cutting:**
CC-DASHBOARD-TILE (aggregate summary cards apply the tile pattern), CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, outline_variant

**Source FRs:**
FR106 (standard operational reports — parametrised), FR107 (export reports in CSV / Excel / PDF), FR109 (drill-down from summary to transaction detail)

**Source journey(s):**
Brand Owner — "drills into variance report (e.g. closing inventory deviation)" (digest line 21); Finance Manager — "downloads Sales Register export" (digest line 51); Procurement Manager — vendor price trend review entry path (digest line 71)

**Related screens:**
parent: SI-RPT-004 (Reports Library Index — typical entry point), drill-through: SI-PUR-003 (PO Detail & Lifecycle Status — Purchase Register row drill), drill-through: SI-INV-001 (Real-Time Stock View — nearest proxy; dedicated movement-detail surface deferred [→ Phase 3a]), drill-through: SI-PRO-003 (Production Order detail — Production-vs-Yield Variance row drill), drill-through: SI-DSP-007 (B2B Challan Detail — B2B Sales Register row drill), drill-through: SI-POS-003 (POS Sales Integration Status — surfaces sales-record imports; per-record sales drill-down deferred [→ Phase 3a]), drill-through: SI-INV-016 (Closing Inventory Cluster Review — variance summary surfaces here; per-row variance entry deferred [→ Phase 3a]), drill-through: SI-INV-013 (Inventory Adjustment — wastage is a reason code on this screen; dedicated wastage entry deferred [→ Phase 3a])

**Notes:**
Per §7 granularity rule, this is one screen with parametrised behaviour rather than ten separate report screens because the chrome (filter set, scope selector, export controls, drill-through pattern) is identical across all FR106 reports — split into ten screens would multiply the same UX 10× and complicate cross-report navigation. The result table shape varies per report (rows + columns differ), but the surrounding chrome is shared. Reports enumerated by FR106 and rendered by this runner: Purchase Register, Inventory Movement, Food Cost, Production-vs-Yield Variance, Wastage by Reason/Item, Closing Inventory Variance, Dispatch Volume, B2B Sales Register, POS Sales by Item/Location/Day-Part. Accounting reports (Trial Balance, P&L, Balance Sheet, Cash Flow) and HR reports (Roster, Attendance) are separate dedicated screens in Epic 10 / Epic 11 respectively because their grouping logic, column shapes, and accountant-export formats are distinctive enough to warrant per-screen design (see SI-RPT-004 Notes for rationale). FR106 explicitly requires <3s render time — this is an architectural performance target that this screen must meet (caching, query plan optimisation, virtualised result rendering as needed). FR107 export covers CSV, Excel, PDF — every CC-EXPORT-TRIGGER instance on this screen must offer all three. Drill-through from any row lands in the originating epic with the source TRN as the entity context. Tally / Zoho Books / Generic CSV accountant-format exports (FR96) are scoped to Epic 10 financial statements, not the operational reports here. No CC-AUDIT-LINK because this is a read-only report runner; audit affordances appear on the drilled-into source records.

---

#### SI-RPT-006 — FCCC Operational Analytics Framing

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster)
- Finance Manager (scope: brand)

**Purpose:**
Surface the Food Cost Control Centre's operational analytics view — cost-per-serving alerts, product mix analysis, time-series trend lines, and actionable suggestions — paired with the financial framing in Epic 10 through a shared underlying-data and drill-down model.

**Data displayed:**
- Period selector and scope selector (brand / cluster / location)
- Cost-per-serving panel: per-item current cost-per-serving with brand-configurable threshold alert (default 35%); items above threshold flagged in `error`, items in caution band in `warning`
- Product mix panel: Pareto view ranking items by sales contribution (volume × margin), top-quartile and tail items distinguished
- Time-series trend lines: cost-per-serving and contribution margin over period with anomaly highlighting (outliers above rolling baseline marked in `error`)
- Actionable suggestions panel surfaced at top: top 3–5 items recommended for promotion, re-engineer, retire, vendor-switch, or yield-variance review (each suggestion carries the rationale and source data link)
- Drill-down affordance from any item to recipe / ingredients / vendor / sales / batches
- Cross-link to FCCC Financial Framing (SI-ACC-010) — the partner surface in CC-FCCC-DUAL-SURFACE
- Cross-link to Menu Engineering Matrix (SI-RPT-007) — the dedicated quadrant view

**User actions:**
- Adjust period and scope (filter changes propagate to all panels)
- Adjust cost-per-serving threshold (brand-configurable; persisted)
- Click an item in any panel to drill into recipe / ingredients / vendor / sales / batches
- Click an actionable suggestion to drill into the supporting evidence and the action surface (e.g. vendor-switch suggestion drills into SI-PUR-005 vendor price comparison)
- Navigate to SI-ACC-010 (CC-FCCC-DUAL-SURFACE partner — financial framing) without losing the selected item context
- Navigate to SI-RPT-007 (Menu Engineering Matrix)
- Export panel data (CC-EXPORT-TRIGGER: CSV / Excel / PDF)

**Cross-cutting:**
CC-FCCC-DUAL-SURFACE, CC-DASHBOARD-TILE (cost-per-serving and product-mix summary cards apply tile pattern), CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, surface_tint, warning, error, outline_variant

**Source FRs:**
FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR108 (FCCC operational analytics framing — cost-per-serving with threshold alerts, product mix Pareto, time-series trends with anomaly highlighting, actionable suggestions, drill-down from item to recipe / ingredients / vendor / sales / batches), FR109 (drill-down from summary to transaction detail)

**Source journey(s):**
Brand Owner — "morning dashboard review" → drill into cost cascade and FCCC review (digest line 20); Procurement Manager — "Food Cost Control Centre impact visibility" — sees butter cost increase pushes pastry food cost from 31% to 33% (digest line 76)

**Related screens:**
sibling: SI-ACC-010 (FCCC Financial Framing — partner surface in CC-FCCC-DUAL-SURFACE), drill-down: SI-RPT-007 (Menu Engineering Matrix), drill-down: SI-REC-001 (recipe detail), drill-down: SI-PUR-005 (vendor price comparison — for vendor-switch actionable suggestion), drill-down: SI-INV-006 (GR detail — for yield-variance investigation), drill-down: SI-RPT-005 (Report Detail Runner — for POS Sales by Item drill from product mix), parent: SI-RPT-002 (Brand Owner dashboard — typical entry point via FCCC tile)

**Notes:**
This screen is the operational half of CC-FCCC-DUAL-SURFACE. The financial half is SI-ACC-010 (FR95) — both surfaces share underlying data queries and drill-down state per the Phase 2c design constraint documented on SI-ACC-010 Notes — navigation between the two surfaces must preserve the selected item context to avoid orphaned analytics. The menu engineering matrix (Stars / Puzzles / Plowhorses / Dogs quadrant view) is broken out as SI-RPT-007 because the quadrant interaction model and per-quadrant action affordances justify a dedicated route per §7 granularity rule (it has its own quadrant-filter affordances, distinct drill-throughs, and quadrant-specific actionable suggestions). Cost-per-serving threshold default is 35% per FR108; brand-configurable. Anomaly highlighting on the time-series uses `error` for outliers above the rolling baseline. Actionable suggestions panel is the FR108 "surfaced at top" requirement — promotion / re-engineer / retire / vendor-switch / yield-variance categories with supporting evidence on each. No CC-AUDIT-LINK because this is a read-only analytics view; the drilled-into records carry audit links on their source-of-truth screens. Honours the implicit Phase 2b "FCCC Two-Surface Design" item — together with SI-ACC-010 it closes the dual-surface obligation.

---

#### SI-RPT-007 — Menu Engineering Matrix

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Brand Owner (scope: brand)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Render the Stars / Puzzles / Plowhorses / Dogs quadrant view of the menu with per-quadrant action affordances and item-level drill-through into recipe, vendor, sales, and batch context.

**Data displayed:**
- Period selector and scope selector (brand / cluster / location)
- Quadrant grid: Stars (high margin, high volume), Puzzles (high margin, low volume), Plowhorses (low margin, high volume), Dogs (low margin, low volume) — items plotted by contribution margin (Y-axis) and sales volume (X-axis)
- Each item is a clickable point or chip showing item name; quadrant boundaries are configurable via threshold settings
- Per-quadrant summary cards: count of items, total contribution, total volume, recommended action label (Stars: promote / protect; Puzzles: re-engineer / re-price / promote; Plowhorses: re-engineer cost; Dogs: retire / re-position)
- Quadrant filter chips (toggle visibility)
- Threshold configuration affordance (margin and volume thresholds — brand-configurable, persisted)

**User actions:**
- Adjust period and scope
- Click any item to drill into recipe / ingredients / vendor / sales / batches (same drill-through as SI-RPT-006)
- Apply per-quadrant filter to focus on one or more quadrants
- Adjust quadrant thresholds (margin and volume cut-offs)
- Click a per-quadrant action label (e.g. "Re-engineer cost on these Plowhorses") to surface the candidate list and route to the action surface (e.g. SI-REC-001 recipe detail for cost-engineering)
- Export matrix snapshot (CC-EXPORT-TRIGGER: CSV / Excel / PDF for menu review meetings)

**Cross-cutting:**
CC-FCCC-DUAL-SURFACE (this screen is part of the operational half), CC-EXPORT-TRIGGER

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, primary_container, success (Stars), tertiary (Puzzles), warning (Plowhorses), error (Dogs), outline_variant

**Source FRs:**
FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR108 (menu engineering matrix Stars / Puzzles / Plowhorses / Dogs with per-quadrant actions), FR109 (drill-down from summary to transaction detail)

**Source journey(s):**
Brand Owner — FCCC review path during morning dashboard review (digest line 20)

**Related screens:**
parent: SI-RPT-006 (FCCC Operational Analytics Framing — typical entry point), sibling: SI-ACC-010 (FCCC Financial Framing — CC-FCCC-DUAL-SURFACE partner), drill-down: SI-REC-001 (recipe detail — for re-engineer action), drill-down: SI-PUR-005 (vendor price comparison — for vendor-switch action), drill-down: SI-RPT-005 (Report Detail Runner — for POS Sales by Item drill)

**Notes:**
Per §7 granularity rule, the menu engineering matrix is a separate route from the broader FCCC Operational Framing because (a) the quadrant interaction model has its own affordances (quadrant filtering, threshold configuration, per-quadrant action labels), (b) it has distinct visual structure (2×2 quadrant plot vs panel-based dashboard), and (c) it is a focal review surface used in periodic menu meetings rather than ambient monitoring. Mapping of `success` / `tertiary` / `warning` / `error` to the four quadrants is by operational sentiment (Stars = positive outcome, Dogs = retire candidate); these tokens are used semantically here per their general operational meaning, not as lifecycle status — no `status_*` tokens are used because this is not a lifecycle surface. Quadrant thresholds are brand-configurable and persisted per the FR108 "brand-configurable" pattern. No CC-AUDIT-LINK; drilled-into records carry their own audit links.

---

#### SI-RPT-008 — Unusual Activity Feed

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** responsive-equal

**Roles & scope:**
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)
- Procurement Manager (scope: brand/cluster)

**Purpose:**
Surface a rule-based unusual activity feed of operational anomalies with each alert linking to the underlying data and a suggested remediation path.

**Data displayed:**
- Period selector and scope selector (brand / cluster / location)
- Alert feed (chronological, most recent first): each row shows alert type, timestamp, scope (brand / cluster / location / item / vendor), description, suggested remediation, source-data link
- Alert types: wastage spikes >30% above 30-day average, vendor price jumps >10% above last-3-purchase average, production yield variance >15% below standard for 2 consecutive batches, closing inventory variance patterns >3 consecutive days, override frequency anomalies, unresolved provisional-cost aging, sales mix shocks >50% volume change vs 7-day baseline, Pending-GR-then-rejected event spikes per location/vendor
- Alert status filters: active, acknowledged, resolved
- Threshold configuration affordance (brand-configurable per FR110)
- Aggregate summary tile: active alert count by category

**User actions:**
- Adjust period, scope, and alert-type filters
- Click any alert to drill through to the underlying data with the suggested remediation path pre-surfaced
- Acknowledge an alert (marks as acknowledged with the user and timestamp captured for downstream audit)
- Configure thresholds (brand-configurable per alert type)
- Export feed (CC-EXPORT-TRIGGER: CSV / PDF for periodic review)

**Cross-cutting:**
CC-DASHBOARD-TILE (aggregate alert summary applies tile pattern), CC-EXPORT-TRIGGER, CC-DATA-QUALITY-ALERT (each unusual activity alert renders with the same visual chrome as data-quality alerts; FR110 anomalies and FR116 inconsistencies are both surfaced through this consistent pattern even though their detection rules differ)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, warning, error, error_container, outline_variant

**Source FRs:**
FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR109 (drill-down to underlying data), FR110 (rule-based unusual activity detection covering wastage spikes, vendor price jumps, yield variance, closing-inventory variance patterns, override frequency anomalies, unresolved provisional-cost aging, sales mix shocks, Pending-GR-then-rejected event spikes — each alert links to underlying data with suggested remediation; brand-configurable thresholds)

**Source journey(s):**
Brand Owner — "variance investigation & assignment" (digest line 21); Cluster Manager — "variance investigation drill-down" (digest line 32); Procurement Manager — "vendor price spike monitoring" (digest line 75)

**Related screens:**
parent: SI-RPT-002 (Brand Owner dashboard — typical entry via Unusual Activity summary tile), parent: SI-RPT-003 (Cluster Manager dashboard — cluster-scoped entry), drill-through: SI-INV-013 (Inventory Adjustment — wastage is a reason code on this screen; dedicated wastage entry deferred [→ Phase 3a]), drill-through: SI-PUR-005 (vendor price comparison — for vendor price jump), drill-through: SI-PRO-003 (Production Order detail — for yield variance), drill-through: SI-INV-016 (Closing Inventory Cluster Review — variance summary surfaces here; per-row variance entry deferred [→ Phase 3a]), drill-through: SI-PRO-009 (Pending GR Resolution Outcomes — for Pending-GR-then-rejected event spikes), drill-through: SI-RPT-005 (Report Detail Runner — for POS Sales mix shock investigation), drill-through: SI-INF-008 (issue ticket create — for raising an investigation ticket)

**Notes:**
This screen is the FR110 surface — the detection logic is service-layer (rule-based with brand-configurable thresholds) and surfaces here as a chronological feed. Each alert row includes the suggested remediation path per FR110's explicit requirement. CC-DATA-QUALITY-ALERT visual chrome is reused for visual consistency between FR110 anomalies and FR116 cross-module inconsistencies — the user perceives both classes as "things flagged that need attention" with the same affordance shape, even though their detection rules differ in origin (FR110 = rule-based anomaly detection on operational data; FR116 = cross-module master-data inconsistency). Acknowledge action does not resolve the underlying data — it marks the alert reviewed for the audit trail. Threshold configuration is brand-configurable per FR110. No CC-AUDIT-LINK because this is a read-only feed; the acknowledged-by audit is captured by the underlying detection service (no separate audit timeline screen needed for the feed itself).

---

#### SI-RPT-009 — PAR Drift Recommendations

**Primary epic:** Epic 12 — Analytics & Reporting

**Primary device:** desktop-primary

**Roles & scope:**
- Procurement Manager (scope: brand/cluster)
- Brand Owner (scope: brand)
- Cluster Manager (scope: cluster)

**Purpose:**
Surface items whose actual consumption pattern has drifted from their configured PAR levels with recommended PAR updates, so PAR configuration tracks operational reality.

**Data displayed:**
- Scope selector (brand / cluster / location / department) and analysis period selector
- Item rows: item name, location, current PAR, observed average daily consumption over period, observed peak daily consumption, day-of-week variation indicator, recommended PAR (system-suggested), drift magnitude (% above or below current PAR), confidence indicator
- Aggregate summary: total items with drift, items recommended for PAR increase, items recommended for PAR decrease
- Sorting: by drift magnitude, by item, by location
- Filter by drift direction (over-set vs under-set) and confidence level

**User actions:**
- Adjust scope and analysis period
- Filter by drift direction and confidence
- Click an item row to view consumption history (drill-down into Epic 4 inventory movement view)
- Apply recommended PAR (drill-through to SI-INV-004 PAR Level Configuration with the recommended value pre-filled in the appropriate row — user confirms the change in the configuration screen, where the audit and approval logic lives)
- Export recommendations (CC-EXPORT-TRIGGER: CSV / Excel / PDF)

**Cross-cutting:**
CC-DASHBOARD-TILE (aggregate summary applies tile pattern), CC-EXPORT-TRIGGER, CC-PREFILL (recommended PAR pre-fills the SI-INV-004 row when the user routes through to apply per FR113)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, surface_container_low, on_surface, on_surface_variant, primary, warning, error, outline_variant

**Source FRs:**
FR107 (export to CSV/Excel/PDF via CC-EXPORT-TRIGGER), FR109 (drill-down from summary to transaction detail), FR111 (PAR level drift detection report with update recommendations based on consumption patterns), FR113 (recommended PAR pre-fills the configuration screen)

**Source journey(s):**
Procurement Manager — periodic PAR review during "purchase order creation with PAR-based suggestions" workflow context (digest line 70); Brand Owner — periodic operational review during "morning dashboard review" workflow (digest line 20)

**Related screens:**
drill-down: SI-INV-004 (PAR Level Configuration — destination of "Apply recommended PAR" with pre-filled value), drill-down: SI-INV-001 (Real-Time Stock View — nearest proxy for consumption history; dedicated movement-detail surface deferred [→ Phase 3a]), drill-down: SI-INV-002 (department stock detail — for context on current stock vs PAR), parent: SI-RPT-004 (Reports Library Index — entry point), parent: SI-RPT-002 (Brand Owner dashboard — alternative entry via tile drill)

**Notes:**
This screen presents the recommendation; the actual PAR change is committed at SI-INV-004 (Epic 4) where the audit log entry, approval routing (if applicable per threshold configuration), and downstream data refresh happens. CC-PREFILL is the bridge — the recommended PAR value is carried as the pre-filled row value into the configuration screen, where the user confirms or edits before saving. No CC-AUDIT-LINK because this is a read-only recommendation surface; the audit is captured at the SI-INV-004 commit point. Confidence indicator is service-side derived from the consistency and span of the consumption data — high confidence requires sufficient observations and stable variance; low confidence is shown in `warning` to discourage acting on noise. Drift magnitude in `error` for >50% drift, `warning` for 20–50%, default surface tone for ≤20%.

---

## 7 Appendix A — Role × Screen matrix

> _Populated in Task 13._

---

## 8 Appendix B — Journey × Screen traceability

> _Populated in Task 13._

---

## 9 Appendix C — FR × Screen traceability

> _Populated in Task 13._

---

## 10 Appendix D — Parking-lot honour

> _Populated in Task 13. Validation harness summary added in Task 14._

Parking-lot row stubs (unpopulated — screens assigned during per-epic build):

- P2B-001 — TBD
- P2B-002 — TBD
- P2B-003 — TBD
- P2B-004 — TBD
- P2B-005 — TBD
- Implicit FCCC dual-surface — TBD
- Implicit Pending-GR drill — TBD

---

*Screen Inventory — F&B ERP · Phase 2b deliverable · 2026-05-04*
