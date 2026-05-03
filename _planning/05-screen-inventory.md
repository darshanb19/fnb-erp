---
inputDocuments:
  - _planning/02-master-spec.md
  - _planning/03-prd.md
  - _planning/04-b2b-challan-spec.md
  - _planning/_internal/phase-2b-digest.md
  - docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md
documentCounts:
  epics: 12
  screensEstimated: '95–115 (firm count after per-epic build)'
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
| FR80 | Cumulative credit-note ≤ source value validation | `creditNoteService.validateCumulativeLimit(sourceChalllanId)` before credit note creation |
| FR84 | POS sales import via REST API | Scheduled ingestion job or webhook endpoint; no UI for the import itself |
| FR85 | Recipe-driven inventory deduction calculation | `inventoryService.deductByRecipe(saleLineItems)` called post-import per sale transaction |
| FR87 | TRN generation engine | `trnService.generate(transactionType, entityId)` — display is `CC-TRN-DISPLAY`; generation is backend-only |
| FR89 | Auto-journal mapping rules | `journalService.autoMap(transactionId)` applies configured chart-of-accounts mapping on every TRN-generating event |
| FR90 | Internal ledger maintenance | Ledger rows written by `journalService` on every auto-journal; no direct UI for ledger row creation |
| FR92 | Two-stage B2B journal model | Stage 1 on dispatch confirmation; Stage 2 on IRN paste — both triggered automatically via challan status transitions |

---

## 6 Per-epic screens

### Epic 1 — Master Data Management (MDM)

> _Populated in Task 1. (~6–8 screens estimated.)_

### Epic 2 — User Management & Security (USR)

> _Populated in Task 2. (~7–9 screens estimated.)_

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
