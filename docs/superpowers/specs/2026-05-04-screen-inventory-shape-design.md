# Phase 2b — Screen Inventory: Document Shape Design

| | |
|---|---|
| **Document type** | Brainstorming spec (Superpowers `brainstorming` skill output) |
| **Date** | 2026-05-04 |
| **Status** | Approved — locks the SHAPE of `_planning/05-screen-inventory.md` |
| **Phase** | 2b — UX / Screen Inventory |
| **Author** | Solo dev + Claude Code (Opus 4.7) |
| **Supersedes** | None — first Phase-2b artefact |

> This document fixes the **shape** of the Phase 2b deliverable. The deliverable itself — `_planning/05-screen-inventory.md` — is built by walking the 12 epics in order and populating the schema defined here. A later Superpowers `writing-plans` artefact decomposes that build into per-epic chunks with explicit context-budgeting checkpoints.

---

## 1. Goal & non-goals

### Goal

Produce a single, navigable screen inventory document that serves as the bridge between the locked PRD (`_planning/03-prd.md`) plus the locked design system (`DESIGN.md`) on one side, and the visual mockup phase (Phase 2c) plus the architecture phase (Phase 3a) on the other. Every UI-bearing requirement and every user-journey moment must trace to at least one screen ID.

### Non-goals

- **No visual mockups.** Visual layout, component composition, and pixel-level styling belong to Phase 2c (after the design tooling is selected per Master Spec §3.3).
- **No route maps or framework-specific decisions.** URL paths, React Router structure, state-management shape — all Phase 3a.
- **No per-screen interaction prototypes.** State diagrams beyond the canonical PO 5-status lifecycle (DL-001) and the B2B challan lifecycle (`04-b2b-challan-spec.md` §3) belong to Phase 3a / 3b.
- **No new product decisions.** If a product ambiguity surfaces during the build, log it as a Phase-2b ambiguity in `_planning/prd-review-notes.md`; do not silently re-open closed FRs.
- **No new design tokens.** If a screen needs a token DESIGN.md doesn't provide, surface as a Phase-2c gap in `prd-review-notes.md` — do not edit DESIGN.md from this session.

---

## 2. Document outline

`_planning/05-screen-inventory.md` is one file, organised in this order:

1. **Preamble** — purpose, scope, validation harness rules, how to read the doc.
2. **Epic abbreviation key** (§3 of this spec).
3. **Cross-cutting pattern catalogue** — the `CC-*` IDs (§4 of this spec).
4. **Roles & scope conventions** — 8 role identifiers + 4 scope filters.
5. **Service-layer-only FRs** — flat table for FRs with no UI surface (§5 of this spec).
6. **Per-epic screen sections** — Epic 1 through Epic 12; each opens with a one-paragraph epic recap and a per-epic screens table, then per-screen entries in the schema defined in §6 of this spec.
7. **Appendix A — Role × Screen matrix.**
8. **Appendix B — Journey × Screen traceability.**
9. **Appendix C — FR × Screen traceability.**
10. **Appendix D — Parking-lot honour table** (opens with the validation harness summary).

The 12 epic sections account for ~95–115 screens (estimate; firm count emerges during the build).

---

## 3. Epic abbreviation key

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

## 4. Cross-cutting pattern catalogue

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

## 5. Service-layer-only FRs (no UI surface)

The inventory document devotes a short section to FRs that are pure service-layer enforcement and have no first-class UI surface. The format is a flat table:

```
| FR ID | One-line summary | Enforced in (service / mechanism) |
```

Initial set (subject to confirmation during the per-epic build):

- FR8 — Material enablement enforcement
- FR12 — RBAC enforcement
- FR13 — Material enablement as access control
- FR28 — Three-product-type directional flow
- FR31 — FEFO ordering inside `inventoryService.deductStock()`
- FR52 — Recipe cost cascade
- FR67 — Retrospective cost adjustment journal
- FR68 — Stock deduction at PO `In Progress` transition (DL-001)
- FR80 — Cumulative credit-note ≤ source value validation
- FR84 — POS sales import via REST API
- FR85 — Recipe-driven inventory deduction calculation
- FR87 — TRN generation engine (the *display* is `CC-TRN-DISPLAY`; generation itself is backend-only)
- FR89 — Auto-journal mapping rules
- FR90 — Internal ledger maintenance
- FR92 — Two-stage B2B journal model

These FRs reappear with cross-references in Appendix C as "no screen — see §5", so the FR-traversal harness completes cleanly in either direction.

---

## 6. Per-screen schema

Every screen entry follows this exact shape:

```
### SI-{EPIC}-### — {Screen name in Title Case}

  Primary epic:        Epic N — {epic name}
  Primary device:      mobile-first | desktop-primary | responsive-equal
  Roles & scope:       {role 1} (scope: {brand|cluster|location|department})
                       {role 2} (scope: ...)
  Purpose:             One sentence — the user job this screen exists to do.
  Data displayed:      • {field / aggregate 1}
                       • {field / aggregate 2}
                       • ...
  User actions:        • {CRUD verb or workflow transition}
                       • ...
  Cross-cutting:       CC-XXXX, CC-YYYY, CC-ZZZZ
  Tokens (DESIGN.md):  {semantic colour tokens}, {component patterns},
                       {status colour tokens}, {sidebar/dashboard chrome}
  Source FRs:          FR##, FR## (also FR##a/b/c)
  Source journey(s):   {Role} — "{journey moment phrase}"; {Role} — "..."
  Related screens:     parent: SI-XXX-###    drill-down: SI-XXX-###
                       sibling: SI-XXX-###   modal-of: SI-XXX-###
  Notes:               {anything that doesn't fit elsewhere — e.g. DL-001
                       lifecycle, decision-log refs, deferred-token gaps,
                       open Phase-2b ambiguities}
```

### Field rules

- **Screen name** — five words or fewer where possible; uses verbs + nouns matching the user's task framing (e.g. "Goods Receipt Entry", not "GR Form Component"). Names route through the `design:ux-copy` skill before the doc is closed, to align with the DESIGN.md tone-of-voice baseline.
- **Primary device** — exactly one of three values. `responsive-equal` is reserved for screens that are genuinely used at parity on both surfaces (e.g. browse-recipes, view-PO-detail). Most screens skew one way.
- **Roles & scope** — list every role with non-trivial access. Scope filter is the *strictest* scope the role can exercise on this screen (a Brand Owner viewing a department-scoped screen still sees department scope; the role-scope pair is the row, not the role alone).
- **Purpose** — exactly one sentence. If two sentences are needed, the screen is probably two screens.
- **Data displayed** — bullet list. Names of fields/aggregates the user sees. No layout commentary.
- **User actions** — bullet list. Each bullet is a verb the user can perform. Workflow transitions (e.g. "Confirm dispatch → status moves to Dispatched") are explicit.
- **Cross-cutting** — comma-separated `CC-*` IDs. If a pattern instance has a screen-specific tweak, add a brief parenthetical (`CC-IMPLAUSIBILITY-WARN (>150% of PO)`).
- **Tokens** — only DESIGN.md-named tokens; no hex, no hard-coded sizes. If a needed token is missing, log in `Notes:` as a Phase-2c gap and continue.
- **Source FRs** — every FR that has any UI obligation on this screen. Do not omit FRs already implicit via a `CC-*` pattern; redundancy is cheap and the harness depends on it.
- **Source journey(s)** — at least one journey moment phrase per screen (verbatim or near-verbatim from the journey synthesis). This is the journey-traversal validation evidence.
- **Related screens** — only direct relationships (parent / drill-down / sibling / modal-of / triggers). Not a full graph.
- **Notes** — short. Long notes signal an ambiguity that should be logged in `prd-review-notes.md` instead.

---

## 7. Granularity rule

A "screen" in this inventory is **one of**:

1. A distinct route the user navigates *to* (URL-bearing destination).
2. A heavyweight modal/drawer/inline workflow that satisfies *any* of:
   - Has ≥3 user-editable fields, or
   - Fires a journal entry / TRN-generating action, or
   - Initiates an approval workflow, or
   - Involves a paired/bundled multi-record action (e.g. P2B-002 paired transfer).

Examples that get their own screen ID under rule 2:

- B2B challan GST closure modal (FR78 — fires Stage 2 journal, paste IRN, validates GST fields).
- Paired Brand-Store transfer initiation (P2B-002, P2B-004 — bundled approval object).
- Manual journal voucher entry (FR99 — TRN-generating, multi-line debit/credit).
- Pending-GR override on production order (FR65 — workflow initiation with reason code).
- Permission grant/revoke flow (FR15a — initiates audit-tracked change with optional expiry).

Examples that stay as sub-affordances on a parent screen:

- "Approve PO" / "Reject PO" light modals (single decision, optional reason).
- "Mark delivered" confirm dialog (single field).
- "Resend to vendor" drawer (no editable state).
- "Cancel draft" confirm.

Sub-affordances are listed inside the parent screen's `User actions:` bullets. They do not get their own ID.

---

## 8. Mobile vs desktop variants

Each screen has exactly one ID. The `Primary device:` attribute carries the mobile-first / desktop-primary / responsive-equal classification, aligned with DESIGN.md §19.

When the *same workflow* genuinely splits into two operational variants — different roles, different data displayed, different actions — these are **two separate screens**, not one screen with two breakpoints.

Canonical example:

```
SI-INV-022  Closing Inventory Entry (POS daily)
            Primary device: mobile-first
            Roles: POS Staff (location)
            Purpose: Run end-of-day count for final products at POS
            User actions: scan/count, enter variance + reason code, submit

SI-INV-023  Closing Inventory Review (cluster oversight)
            Primary device: desktop-primary
            Roles: Cluster Manager (cluster), Brand Owner (brand)
            Purpose: Review submitted closing-inventory across cluster, drill
                     into per-POS variance, raise issue tickets
            User actions: filter by location, drill into POS detail, raise
                          issue ticket, mark variance acceptable
```

Both reference each other in `Related screens:` (`sibling`).

---

## 9. Validation harness

Before the inventory document is closed, three checks must pass. The results live at the top of Appendix D inside the doc itself, and are duplicated in the PR description.

### Check 1 — Journey traversal

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

### Check 2 — FR traversal

Walk every FR in the PRD (FR1 through FR119, plus FR15a/b/c, FR47a/b, FR67a). Every FR with a UI surface must have at least one `SI-*` ID. Service-layer-only FRs are listed in §5 and flagged "no screen — see §5" in Appendix C.

Output format (illustrative — actual UI-bearing vs service-only split confirmed during the build):

```
FR × Screen — 119 base FRs + 6 sub-FRs (FR15a/b/c, FR47a/b, FR67a) = 125 reviewed
  • UI-bearing FRs:           NN / NN mapped to ≥1 SI-* ID
  • Service-layer-only FRs:   NN / NN listed in §5
  • Total:                    125 / 125 reviewed
```

### Check 3 — Parking-lot honour

Walk the 7 Phase-2b parking-lot items (P2B-001 through P2B-005 plus the 2 implicit Pass-C items). Each must be honoured by at least one `SI-*` screen and/or `CC-*` pattern. Appendix D is the full table.

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

## 10. Build sequence & context budgeting

The per-epic build runs in canonical order, Epic 1 → Epic 12, matching Master Spec §5. This:

- Surfaces upstream-screen dependencies naturally (e.g. `SI-PUR-*` Procurement screens reference `SI-INV-*` Inventory screens for goods receipt).
- Aligns the Phase 2b artefact with how every downstream phase will consume it (architecture, stories, implementation all walk epics in order).
- Gives predictable per-epic context-window chunks so the user's `60–70%` context-management rule (CLAUDE.md, Master Spec §7.8) can be enforced cleanly per chunk.

A separate Superpowers `writing-plans` artefact decomposes the build into 12 chunks, each with explicit context-budget targets, commit checkpoints, and the validation harness re-run at chunk boundaries. That artefact is the next thing produced after this design is approved.

---

## 11. Pacing & commit cadence

- **Notify at ~40% context** during the build, per the user's pacing rule.
- **Commit incrementally per epic chunk.** A clean commit at each epic boundary keeps the PR diff readable and bounds rework if a chunk needs a rewrite.
- **No `/compact` during inventory drafting** — context-management is enforced via the per-epic chunk boundaries, not via compression that loses parking-lot nuance.

---

## 12. Open ambiguities (none at the shape level)

All five shape decisions and four follow-on structural decisions were resolved during the brainstorming pass:

| Decision | Resolution |
|---|---|
| Primary organisation axis | By epic (12 sections) + role-index appendix |
| Screen ID convention | `SI-{EPIC}-###`, three-letter epic codes (PUR/PRO swap to avoid PRD/Production collision) |
| Granularity rule | Hybrid — route-level by default; modals separate when carrying independent state, validation, or workflow weight |
| Cross-cutting handling | Dedicated `CC-*` catalogue at top of doc; screens cite IDs |
| Mobile/desktop variants | Single screen per workflow with `Primary device:` attribute; genuine operational splits = separate screens |
| Service-layer-only FRs | Flat table in §5; FR×Screen appendix flags "no screen — see §5" |
| Validation harness output | Inside the doc (top of Appendix D) + duplicated in PR description |
| Decision-log cross-refs | Inline in screen `Notes:` (not a separate appendix) |
| Build order | Canonical Epic 1 → 12 |

Per-epic ambiguities (which screen for which journey moment, screen names, sub-affordance vs first-class IDs) will surface during the build itself and be resolved chunk-by-chunk against this contract. Anything that contradicts the locked PRD must be logged in `prd-review-notes.md` rather than silently changing scope.

---

## 13. Skill use during the build

Per the user's Phase-2b kickoff brief, the per-epic build leans on the following skills:

| Skill | When to use |
|---|---|
| `superpowers:writing-plans` | Decompose this design into the per-epic build plan. (Next step.) |
| `superpowers:executing-plans` | Walk the per-epic plan, with the chunk checkpoints. |
| `design:design-critique` | After each epic chunk — sanity-check screen names, hierarchy, and consistency against earlier chunks. |
| `design:ux-copy` | Screen names, primary CTA labels, override warning text, empty-state copy, error messages — keep tone aligned with DESIGN.md tone-of-voice baseline. |
| `design:accessibility-review` | Per dense / data-heavy screen — keyboard navigation, focus management, reduced-motion, mobile touch targets. |
| `design:user-research` / `design:research-synthesis` | When a journey moment doesn't obviously map to a screen affordance — interrogate intent before inventing a surface. |
| `superpowers:verification-before-completion` | Before declaring the inventory complete — run the harness in §9; assert pass before committing the closing PR commit. |

---

## 14. Definition of done for the inventory itself

The inventory document `_planning/05-screen-inventory.md` is considered complete when, against this design:

1. All 12 epic sections are populated, each screen following the §6 schema.
2. The §3 epic abbreviation key is published verbatim.
3. The §4 cross-cutting pattern catalogue is published, expanded if needed (additively only — no ID renames).
4. The §5 service-layer-only FR table is published.
5. Appendix A (Role × Screen) is complete.
6. Appendix B (Journey × Screen) is complete and the journey-traversal harness passes.
7. Appendix C (FR × Screen) is complete and the FR-traversal harness passes.
8. Appendix D (Parking-lot honour) is complete and all 7 items map to ≥1 screen and/or pattern.
9. The PR titled "Phase 2b — Screen Inventory" on branch `phase-2b/screen-inventory` carries the harness summary in its body.
10. A close note is appended to `_planning/prd-review-notes.md` recording the inventory totals and any open Phase-2b ambiguities surfaced during the build.

---

*End of design — Phase 2b screen-inventory document shape · 2026-05-04*
