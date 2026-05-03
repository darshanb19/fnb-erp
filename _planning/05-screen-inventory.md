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

> _Populated in Task 6. (~6–8 screens estimated.)_

### Epic 7 — Production Planning (PRO)

> _Populated in Task 7. (~10–13 screens estimated.)_

### Epic 8 — Dispatch & Distribution (DSP)

> _Populated in Task 8. (~10–13 screens estimated.)_

### Epic 9 — POS Integration (POS)

> _Populated in Task 9. (~3–5 screens estimated.)_

### Epic 10 — Accounting & Financial (ACC)

> _Populated in Task 10. (~10–13 screens estimated.)_

### Epic 11 — HRMS (HRM)

> _Populated in Task 11. (~3–5 screens estimated.)_

### Epic 12 — Analytics & Reporting (RPT)

> _Populated in Task 12. (~9–12 screens estimated.)_

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
