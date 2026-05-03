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
sibling: SI-MDM-005 (vendor master), drill-down: SI-REC-001 (recipes using this product — ID assigned in Task 6), drill-down: SI-PUR-007 (vendor price history)

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
sibling: SI-MDM-003 (product master), drill-down: SI-PUR-### (PO list for vendor — ID assigned in Task 5), drill-down: SI-PUR-007 (vendor price comparison)

**Notes:**
Scope tag (Brand / Cluster / POS) determines visibility in PO creation forms (Epic 5) — Brand-scoped vendors appear in Brand-Owner PO creation; Cluster-scoped vendors appear in Cluster-Manager PO creation, etc. Scope visibility is enforced at the service layer (FR12, RBAC + scope filtering). Preferred vendor flag influences PO creation sorting (preferred vendors suggested first in vendor selection). Quality rating can be 1–5 stars or numeric 1–10; aggregated from GR rejections (FR47a), yield variances, and manual Brand Owner input. Deactivation is soft-delete; UI should warn if vendor has open POs and require reason code. Price history chart is inline sparkline or link to SI-PUR-007.

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
| SI-USR-008 | Brand Owner Account — Pending Superadmin Approval | desktop-primary | Brand Owner (brand), Superadmin (cross-brand) |

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
Per §7 granularity rule, this is route-bearing form with ≥3 editable fields. Brand Owner role creation does NOT activate the user immediately — it stages an approval request to Superadmin; SI-USR-008 is the approval-side surface. Department mapping respects FR12 RBAC scope (e.g., POS Staff requires location + department; Cluster Manager requires cluster only). Audit trail entries link via `CC-AUDIT-LINK` to the Epic 3 activity timeline (ID assigned in Task 3).

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

**Source parking-lot:**
P2B-003 (Permission Override Management UI — this screen is the canonical grant/revoke flow honouring the parking-lot item)

**Source journey(s):**
Brand Owner — permission override workflow for one-off needs (digest lines 18–25; e.g., temporarily granting a Cluster Manager the ability to fill GST IRN fields normally restricted to Finance Manager + Brand Owner; or revoking a specific permission from a user pending investigation)

**Related screens:**
parent: SI-USR-005 (effective permissions; entry point), drill-down: audit timeline (Epic 3 — ID assigned in Task 3), sibling: SI-USR-007 (expiring-soon view shows downstream lifecycle of overrides created here)

**Notes:**
Granularity decision: grant and revoke consolidated into a single screen ID with a mode toggle (grant / revoke), per §7. Both modes share the same field set (target user, permission selector, mandatory reason, optional expiry, audit capture); the only material differences are (a) the permission-selector filter and (b) the preview wording. Splitting into two IDs would have duplicated 90% of the schema with no operational benefit. Edit-existing-override lands on this screen in a third "edit" sub-mode (reason code + expiry editable; permission and target user read-only). Per FR15a, every submission writes to the append-only audit trail (FR20 — see §5 for storage contract); the audit link surfaces on SI-USR-005 row by row.

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

**Source parking-lot:**
P2B-003 (Permission Override Management UI — expiring-soon view is item 3 of the four-part workflow)

**Source journey(s):**
Brand Owner — morning dashboard review (digest line 20: "expiring permission overrides" surfaced as one of the cross-location dashboard items); tile click drills here for the full list and renew/revoke actions

**Related screens:**
parent: SI-USR-001 (user list), sibling: SI-USR-005 (per-user effective permissions), sibling: SI-RPT-002 (Brand Owner cross-location dashboard tile — ID assigned in Task 12; this screen is the source-of-truth, the dashboard tile is the at-a-glance summary), triggers: SI-USR-006 (renew = edit mode)

**Notes:**
This screen is the source-of-truth full-list view; the same data also appears as a `CC-DASHBOARD-TILE` on the Brand Owner morning-briefing dashboard (SI-RPT-002 — ID assigned in Task 12) per FR105 and digest line 20. Tile shows count + 0–7 day urgent count; click opens this screen. Renew action reuses SI-USR-006 in edit mode rather than introducing a fourth screen — keeps the audit pattern consistent (every renew writes a new audit event on the existing override).

---

#### SI-USR-008 — Brand Owner Account — Pending Superadmin Approval

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
CC-AUDIT-LINK (every approve/reject/cancel writes an audit event), CC-DRAFT-PILL (on the submission while it is in Pending state at the submitter's end), CC-APPROVAL-INBOX-CARD (Superadmin sees this request as a card in the universal approval inbox — ID assigned in Task 3)

**Tokens (DESIGN.md):**
surface, surface_container_lowest, on_surface, on_surface_variant, status_pending_approval, status_confirmed (Approved), status_cancelled (Rejected), primary, on_primary, outline_variant

**Source FRs:**
FR14 (Brand Owners create users; Superadmin approval for Brand Owner accounts — this is the approval-workflow surface)

**Source journey(s):**
Brand Owner — user onboarding for a peer Brand Owner account (rare admin event, e.g., adding a co-founder or a new brand-tier hire); Superadmin — cross-brand identity governance (admin/setup surface; no operational journey moment but governance-critical when invoked)

**Related screens:**
parent: SI-USR-002 (created here; submission lands here), sibling: SI-USR-001 (user list shows the row in `status_pending_approval` state), drill-down: SI-INF-### (unified approval inbox card — ID assigned in Task 3)

**Notes:**
Per §7 granularity rule, this is a route-bearing screen because it initiates an approval workflow with its own state (Pending / Approved / Rejected) and audit trail. Superadmin is a cross-brand role outside the 8-role brand-scoped enumeration in §4 — it exists specifically for governance actions like this one and is not addressed in operational journeys. Approval-inbox surfacing for the Superadmin reuses the universal `CC-APPROVAL-INBOX-CARD` pattern; the canonical inbox screen lives in Epic 3 (ID assigned in Task 3). Cancel-while-pending is available to the submitting Brand Owner up until Superadmin acts.

---

### Epic 3 — Shared Infrastructure (INF)

> _Populated in Task 3. (~8–10 screens estimated.)_

### Epic 4 — Inventory Management (INV)

> _Populated in Task 4. (~14–18 screens estimated.)_

### Epic 5 — Procurement (PUR)

> _Populated in Task 5. (~8–11 screens estimated.)_

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
