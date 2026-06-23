# Phase 4 Epic 4 INV — Arc (b) Mockups Design

**Date:** 2026-06-23
**Branch:** `phase-4/epic-4-inv-arc-a-backend` (Arc (a) backend + Arc (b) mockups co-located on this branch until PR #25 merges; mockups touch only `mockups/` + planning docs)
**Scope:** Just-in-time mockups for Epic 4's still-deferred SI-INV screens, plus the first visual treatment of two reusable pattern shells (`CC-IMPLAUSIBILITY-WARN`, `CC-VOICE-INPUT`). **Mockups only.** No production frontend (Arc c), no backend changes, no merging PR #25.

This spec is the binding contract for the Arc (b) build. Build agents follow it exactly. It consumes the real data shapes exposed by the Arc (a) backend (`docs/superpowers/specs/2026-06-23-epic-4-inv-arc-a-backend-design.md`) so every mockup reflects the true field set, statuses, and flows.

---

## 0. Decisions captured this session

- **DL-047 — CC-IMPLAUSIBILITY-WARN + CC-VOICE-INPUT first visual treatment.** (a) `CC-IMPLAUSIBILITY-WARN` (FR114) renders as an **inline, per-line warn-and-log panel** beneath the offending quantity field — a sibling of the existing `CCDuplicateWarn` shell (DL-026). It uses the `warning` token family with a `border-l-4` warning pip (allow-listed per CLAUDE.md) and the `AlertTriangle` (`triangle-alert`) glyph to distinguish it from DuplicateWarn's `AlertCircle`. It **never blocks and never disables** the submit (warn-and-log per FR114/§Epic-3): the user picks a mandatory reason code, clicks "Override & continue", and the panel collapses to an "Overridden · reason: …" confirmation chip. (b) `CC-VOICE-INPUT` (FR112) renders as a **trailing mic button inside a quantity field**, scoped to quantity fields only; tapping it shows a compact "Listening…" state with the heard number and accept/cancel. (c) The only motion is a subtle `animate-pulse` on the listening indicator — interaction feedback on a control, **not** an entrance animation on a table/form/dashboard — guarded with `motion-reduce:animate-none` per DESIGN.md §10.3/§10.5. Formal entry appended to `decision-log.md` during the build (DL-047+).

(The Arc (a) session's DL-043/044/045/046 already cover the backend; this session adds DL-047 onward.)

---

## 1. Invariants honoured (mirror of CLAUDE.md "Design token enforcement")

- **No hex literals** — all colours from DESIGN.md tokens (sole exception `mockups/src/tokens.ts`, not touched here).
- **Lucide React icons only**; **Inter font only**.
- **Closed status palette** — only the canonical 20 `status_*` tokens. Verified the set needed is already present: `status_draft`, `status_pending_approval`, `status_confirmed`, `status_in_progress` (transfer "In Transit"), `status_completed` (transfer "Received" / closing "Submitted"), `status_cancelled`, `status_returned`, `status_gr_rejected`, `status_variance_flagged`, `status_provisional`, `status_inactive`, `status_overridden`. **No new status token invented — no stop-the-line.** Implausibility/cut-off use the *semantic* `warning`/`error`/`tertiary`/`error_container` tokens (which exist), not a new `status_*` name.
- **No sectioning borders** — use `<SectionShift>` for tonal breaks. Only the allow-listed `border-l-2/4/8` (status-pip pattern) and `focus-visible:`/`aria-invalid:` border utilities.
- **Animation policy** — NO entrance animations on inventory/transaction screens. The single exception is the documented `CCVoiceInput` listening-indicator pulse (§2.2), reduced-motion-guarded.
- **`tenant_brand_accent` is decorative-only** — never used as a status/state colour here.
- **Chrome reuse** — match the established foundation chrome exactly (the `@/shell` components, `SI-INV-001` grid idiom). The Epic-4 chrome-freeze gate runs at Epic 4 *close* (after Arc c); build so it passes (zero ad-hoc patterns).

---

## 2. New pattern shells (`mockups/src/shell/`)

Both follow the existing shell conventions: typed props interface exported, JSDoc header citing the CC-pattern + FRs + DL, named export added to `mockups/src/shell/index.ts`, token-only styling.

### 2.1 `CCImplausibilityWarn` (`CC-IMPLAUSIBILITY-WARN`, FR114)

**Purpose.** Inline warn-and-log panel surfaced beneath a quantity field whose value crosses an implausibility threshold (GR > 150% of PO; closing count > opening + receipts − dispatches; adjustment/transfer delta beyond tolerance). Mirrors `CCDuplicateWarn`'s placement and philosophy.

**Props:**
```ts
export interface ImplausibilityReasonCode { value: string; label: string }
export interface CCImplausibilityWarnProps {
  /** Human-readable explanation, e.g. "165 kg is 165% of the 100 kg ordered." */
  message: string
  reasonCodes: ReadonlyArray<ImplausibilityReasonCode>
  selectedReason: string | null
  onSelectReason: (value: string) => void
  /** Fires when the user confirms the override (only enabled once a reason is picked). */
  onOverride: () => void
  /** When true, the panel collapses to an "Overridden · reason: …" chip. */
  overridden: boolean
  className?: string
}
```

**Visual.** Left `border-l-4` warning pip; `bg-surface-container` (or warning-tinted container) body; `AlertTriangle` icon in `text-warning`/`text-tertiary`; the `message` in `text-on-surface`; a reason-code `Select` (from `@/shell` / `components/ui/select`) labelled "Reason · required"; an "Override & continue" `Button variant="tonal"` disabled until `selectedReason` is set. When `overridden`, render a single-line chip: `AlertTriangle` + "Overridden · {reasonLabel}" in muted tone. **Never** renders a disabled/blocked submit — the gate lives in the consumer screen.

### 2.2 `CCVoiceInput` (`CC-VOICE-INPUT`, FR112)

**Purpose.** Quantity-field input with an embedded mic affordance for hands-busy kitchen/store entry. Scoped to **quantity fields only** (per FR112 — not a general voice interface).

**Props:**
```ts
export interface CCVoiceInputProps {
  value: string
  onChange: (next: string) => void
  unit?: string                 // e.g. "kg", "L", "ea" — rendered as a trailing adornment
  placeholder?: string
  'aria-label': string
  disabled?: boolean
  /** Mockup-only: the value the simulated transcription "hears" when the mic is tapped. */
  simulatedHeardValue?: string
  className?: string
}
```

**Behaviour / states.**
- **Idle** — wraps `Input` (number-style), trailing unit adornment + a `Mic` icon button (min 44×44 touch target; `aria-label="Enter quantity by voice"`).
- **Listening** — tapping the mic reveals a compact inline strip (not a modal): three-dot indicator with `animate-pulse motion-reduce:animate-none`, the heard value (`simulatedHeardValue`), and accept (`Check`) / cancel (`X`) buttons. Accept calls `onChange(simulatedHeardValue)` and returns to idle; cancel returns to idle unchanged.
- A `role="status"` live region announces "Listening…" then the heard value for screen-reader parity.

**Motion compliance.** The pulse is interaction feedback on a control, reduced-motion-guarded — it is **not** an entrance animation and never decorates the surrounding table/form. Documented here so the chrome-freeze reviewer reads it as intentional.

---

## 3. Shared fixtures (`mockups/src/lib/sample-data.ts`, extended)

Built in W0 as the shared dependency. New fixtures mirror the Arc (a) field shapes (read-only, deterministic — no `Date.now()`/`Math.random()` so renders are stable). Add as exported const arrays + TS interfaces, alongside the existing `materials`/`inventoryPositions`/`locations`/`departments`:

- **`stockBatches`** — `{ id, materialId, departmentId, batchNumber, quantityRemaining, expiryDate|null, receivedDate, yieldFactor, costPerUnit, uom, sourceType: 'goods_receipt'|'transfer'|'adjustment'|'opening', sourceRef|null, provisional }`. Spread across 24h/48h/72h/fresh expiry bands; a few provisional. Backs SI-INV-002, 008, 009.
- **`goodsReceipts` + `grLines`** — GR header `{ grTrn, poId|null, transferId|null, destinationDepartmentId, status: 'draft'|'confirmed'|'pending_approval'|'rejected', receivedBy, receivedAt }`; lines `{ materialId, orderedQty, previouslyReceivedQty, receivedQty, yieldFactor, usableQty, wastageQty, adjustedCostPerUnit, expiryDate, batchNumber, varianceQty|null, reasonCode|null }`. Include one line that trips FR114 (>150% of PO) and one same-day duplicate for FR115. Backs SI-INV-010/011/012.
- **`stockTransfers` + `transferLines`** — header `{ stTrn, sourceDepartmentId, destinationDepartmentId, status: 'draft'|'pending_approval'|'approved'|'in_transit'|'received'|'cancelled', reasonCode, bundleLegId|null, requestedBy, requestedAt, approvalRequestId|null }`; lines `{ materialId, requestedQty, fulfilledQty|null, sourceBatchId, reasonCode|null }`. One transfer per lifecycle state for SI-INV-006's stepper. Plus `transferBundles` + `transferBundleLegs` (leg 1 source→brand store, leg 2 brand store→dest) for SI-INV-008/009 paired badges (SI-INV-007 already exists and consumes `PairedTransferBundle`).
- **`transferSuggestions`** — computed-live shape `{ batchId, materialId, sourceLocationId, hoursToExpiry, valueAtRisk, suggestionType: 'single_hop'|'paired', destination, feasibilityScore, dismissed }`. Backs SI-INV-008/009.
- **`inventoryAdjustments` + `adjustmentLines`** — header `{ adjTrn, departmentId, status: 'draft'|'pending_approval'|'confirmed'|'cancelled', aggregateValueImpact, requestedBy, requestedAt }`; lines `{ materialId, batchId, currentOnHand, delta, reasonCode }`. Canonical reason codes: physical recount, damage, spoilage, theft, system correction, wastage. One over-threshold (approval-routed) + one FR114-tripping line. Backs SI-INV-013.
- **`closingInventory` + `closingInventoryLines` + `cutOffRegistry`** — header `{ ciTrn, locationId, departmentId, businessDate, status: 'draft'|'confirmed'|'variance_flagged', submissionTimestamp|null, cutOffStatus: 'on_time'|'late'|'not_submitted', totalVarianceValue, varianceItemsCount, varianceAcceptable }`; lines `{ materialId, expectedQty, countedQty, variance, reasonCode|null }`; cut-off `{ locationId, departmentId|null, cutOffTime }`. POS context (014) + Dispatch context (015) + a cluster spread incl. a not-submitted-by-cutoff row for 016. One FR114-tripping count.
- **`parLevels`** — `{ materialId, locationId|null, departmentId|null, basePar, dayOfWeekOverrides: { mon?,…,sun? }|null, lastModifiedBy, lastModifiedAt }`; plus derived below-PAR shortfall + suggested-reorder for SI-INV-003/004.

Where an existing fixture (`inventoryPositions`) already carries a usable field (on-hand, par_level, provisional), reuse it rather than duplicating; the new arrays add the batch/transaction depth the existing one lacks.

---

## 4. Screens (14) — build waves

Each screen: a default-exported component in `mockups/src/screens/inv/SI-INV-0NN.tsx`; registered with an `import` + `<Route path="/SI-INV-0NN" …>` in `mockups/src/App.tsx` and an entry in both the registered-list and the label-map in `mockups/src/lib/screen-catalog.ts`; consumes `@/shell` + the §3 fixtures; honours the device class from the screen inventory. JSDoc header citing screen ID, tier, FRs, CC-patterns, and the reused chrome (match `SI-INV-001`'s header style). No entrance animations.

### W1 — read / list / dashboard (reuse the SI-INV-001 stock-grid chrome)
- **SI-INV-002 Department Stock Detail** (responsive-equal). Item header (name, category, UOM, yield, shelf-life policy) + FEFO batch table (batch ref, received, expiry + `ExpiryPip`, on-hand, source GR/transfer ref, `ProvisionalFlag`) + aggregate on-hand/PAR/below-PAR pill + 30-day movement history (type, signed delta, TRN). `CC-AUDIT-LINK` (`AuditLink`), `CC-PROVISIONAL-FLAG`. Sub-affordances: "Transfer from here" → /SI-INV-005, "Adjust batch" → /SI-INV-013, audit → SI-INF-006. Variance movement rows tagged `status_variance_flagged`.
- **SI-INV-003 Below-PAR Flag List** (responsive-equal). Filter chips (scope, product type, category, urgency: below-50% / below-PAR / approaching). Rows: item, UOM, on-hand, base PAR, day-of-week-adjusted PAR, shortfall, suggested reorder, "already on open PO" indicator. `CC-DASHBOARD-TILE` counters (total below PAR / below 50% / on open PO). Sub-affordances → PO create (stubbed link), → /SI-INV-005. `warning`=below PAR, `error`=below 50%, `success`=on open PO. Read-only (no draft pill).
- **SI-INV-008 Expiry Countdown Dashboard** (responsive-equal). 24h(`error`)/48h(`warning`)/72h(`tertiary_container`) band sections; per-batch row (item, batch ref, location, dept, on-hand, hours-to-expiry, value at risk); per-band counters as `DashboardTile`; suggestion-type badge "Single-hop within-cluster" vs "Paired Brand-Store-routed" (the paired badge carries the `PairedTransferBundle` visual signature per P2B-004) vs "No suggestion — write off". Filter chips. Row → /SI-INV-009; badges → /SI-INV-005 or /SI-INV-007.
- **SI-INV-009 Cross-Location Transfer Suggestions** (responsive-equal). Source batch context (item, location, on-hand, hours-to-expiry, value at risk); ranked suggestion list split single-hop vs paired (destination, expected consumption capacity, feasibility score, bundled-approval note on paired); "no suggestion viable" empty state; filter chips. Single-hop → /SI-INV-005, paired → /SI-INV-007, dismiss (logged, visual). `CC-PAIRED-TRANSFER-BUNDLE`, `CC-PREFILL`.
- **SI-INV-016 Closing Inventory Cluster Review** (desktop-primary). Filter chips (scope, business date, dept type). Per-location row: location, dept, status pill (Submitted=`status_completed` / Not-Submitted-by-Cutoff=`error` / Pending Review=`status_pending_approval`), submission timestamp, total variance value, variance items count, top reasons. Not-Submitted-by-Cut-off pane (`DataQualityAlert`-style; location, dept, expected cut-off, hours overdue). Per-location drill-in (variance lines, reasons, attachments, audit link). Aggregate tiles. `CC-ISSUE-TICKET-LINK` (`IssueTicketLink`) per row, "Mark variance acceptable" sub-affordance, reminder broadcast. Read-only.

### W2 — config + transfer
- **SI-INV-004 PAR Level Configuration** (desktop-primary). PAR matrix (rows=items, columns=locations/departments in scope); per-cell base PAR (editable positive integer) + day-of-week override drawer (Mon–Sun); filter chips; last-modified per row; FR111 drift-recommendation badge (accept/ignore sub-affordance, Epic-12-owned — visual only). Bulk-set across selection. `CC-DRAFT-PILL` (`DraftPill`) while edits stage, `CC-AUDIT-LINK`. `status_draft`/`status_confirmed`.
- **SI-INV-005 Stock Transfer Create** (mobile-first). Source/destination selectors (destination filtered by FR28 flow rules + enablement — surfaced as a filtered list with disabled-with-reason entries); item picker with FEFO per-batch on-hand; per-line item, source batch, requested qty (**`CCVoiceInput`**), available qty, UOM; mandatory reason code; **`CCImplausibilityWarn`** when requested > available; **`CCDuplicateWarn`** (existing) for same-day duplicate; single-hop within-cluster suggestion banner (pre-filled when arriving from 008/009). `CC-DRAFT-PILL`, `CC-PREFILL`, `CC-VOICE-INPUT`, `CC-IMPLAUSIBILITY-WARN`, `CC-DUPLICATE-WARN`. Submit → routes to SI-INF-001 when over threshold. `status_draft`/`status_pending_approval`.
- **SI-INV-006 Stock Transfer Detail & Status** (responsive-equal). Header (TRN via `TrnDisplay`, source, destination, requested-by, requested-at, status pill); `LifecycleStepper` across Draft→Pending Approval→Approved→In Transit→Received (Cancelled/Returned as terminal); line items (requested, fulfilled, source batches, expiry); reason code; approval-chain status (if routed); `CC-AUDIT-LINK`; `CC-ISSUE-TICKET-LINK`; **`CCReverseCancelDialog`** (existing) for reverse/cancel per FR117 (Draft/Pending cleanly cancellable; Approved/In Transit/Received → compensating doc). Read-mostly (no draft pill). Confirm-receipt affordance. Status mapping: In Transit=`status_in_progress`, Received=`status_completed`, Cancelled=`status_cancelled`, Returned=`status_returned`.

### W3 — goods receipt + adjustment + closing
- **SI-INV-010 Goods Receipt Entry — PO-Driven** (mobile-first). PO header (PO TRN, vendor, expected date, expected lines); per line: item, ordered qty, previously-received, currently-received (**`CCVoiceInput`**), UOM, yield factor (editable, FR27 default pre-filled), usable qty (computed), wastage qty (computed), adjusted cost/unit (computed), expiry capture (mandatory perishables), batch ref; shelf-life acceptance pill PASS/EXCEPTION per line (FR38); **`CCImplausibilityWarn`** (>150% of PO, FR114); **`CCDuplicateWarn`** (same-day same-PO, FR115); attachments (`CCFileAttachUploader`, FR39); reject-at-QC → /SI-INV-012. `CC-DRAFT-PILL`, `CC-PREFILL`, `CC-AUDIT-LINK`, `CC-TRN-DISPLAY`. `status_draft`/`status_pending_approval`/`status_confirmed`; shelf-life exception routes to SI-INF-001. This is the canonical GR shape — kept stylistically aligned with the shape-design §6 example.
- **SI-INV-011 Goods Receipt Entry — Transfer-Driven** (mobile-first). Sibling of 010, different upstream entity: transfer header (TRN, source location/dept, dispatched-by, dispatched-at, expected lines); per line: item, source batch ref, dispatched qty, currently-received (**`CCVoiceInput`**), UOM, source expiry (carried forward, editable on exception), variance per line; **`CCImplausibilityWarn`** (variance tolerance, FR114); mandatory reason code when variance > 0; attachments (damage/shortfall photos). `CC-DRAFT-PILL`, `CC-PREFILL` (dispatched qty pre-fills received), `CC-AUDIT-LINK`, `CC-TRN-DISPLAY`. Submit → confirms transfer-leg receipt, increments destination, transfer → Received (SI-INV-006). `status_draft`/`status_in_progress`/`status_completed`.
- **SI-INV-012 Goods Receipt Rejection at QC** (mobile-first). Source GR header (GR TRN, source PO TRN, vendor, received-by, received-at); per line: item, received qty, consumed-portion (Pending-GR override, FR65), unconsumed-portion, rejection reason; mandatory rejection reason code (per line or per GR); evidence attachments (`CCFileAttachUploader`); auto-drafted vendor-CN preview (VCN draft TRN, AP reduction value, GR+PO refs — Epic 5 stub, visual only); PO-closure preview ("Closed — GR Rejected"); Pending-GR reclassification preview (FR67a, `warning`). `CC-DRAFT-PILL`, `CC-AUDIT-LINK`, `CC-TRN-DISPLAY`. `status_draft`/`status_gr_rejected`; `error_container` rejection banner.
- **SI-INV-013 Inventory Adjustment** (responsive-equal). Header (department/location, requested-by, requested-at); per line: item, batch ref, current on-hand, adjusted qty, delta (signed), UOM, mandatory reason code (canonical taxonomy); *(no `CC-VOICE-INPUT` — the screen inventory does not cite FR112 for adjustments);* aggregate value impact (₹, drives approval routing); approval-chain preview when over threshold (`ApprovalInboxCard`); **`CCImplausibilityWarn`** (delta beyond tolerance, FR114); attachments. `CC-DRAFT-PILL`, `CC-AUDIT-LINK`, `CC-APPROVAL-INBOX-CARD`, `CC-TRN-DISPLAY`, and `CCReverseCancelDialog` for reverse/cancel (FR117). `status_draft`/`status_pending_approval`/`status_confirmed`.
- **SI-INV-014 Closing Inventory Entry — POS Daily** (mobile-first) **⭐ Tier 1 Acceptance**. POS context header (location, dept, business date, **cut-off countdown**); per item: name, expected qty (opening + received − sold − wasted), counted qty (**`CCVoiceInput`**), variance (computed), mandatory reason code per non-zero variance (e.g. customer sample no-purchase, dropped wastage), UOM; aggregate (items to count / completed / unresolved variance / reason missing); **`CCImplausibilityWarn`** (counted > opening + receipts − dispatches, FR114); `CC-PREFILL` (yesterday's closing as reference); submit-before-cutoff banner. `CC-DRAFT-PILL` (critical — count spans 30+ min), `CC-VOICE-INPUT`, `CC-IMPLAUSIBILITY-WARN`, `CC-AUDIT-LINK`, `CC-TRN-DISPLAY`. `status_draft`/`status_completed`/`status_variance_flagged`; `warning`=cut-off countdown, `error`=cut-off missed.
- **SI-INV-015 Closing Inventory Entry — Dispatch Daily** (mobile-first) **⭐ Tier 1 Acceptance**. Sibling of 014, Dispatch context: expected qty = production received − dispatched; same shape, same patterns, Dispatch Staff role. `status_draft`/`status_completed`/`status_variance_flagged`.

---

## 5. Build sequence

1. **W0 — foundations:** `CCImplausibilityWarn`, `CCVoiceInput`; export both from `shell/index.ts`; add §3 fixtures to `sample-data.ts`. Verify: `npm run typecheck` clean; both shells render in the components index (`mockups/src/dev/ComponentsIndex.tsx`) or a scratch route.
2. **W1 — read/list (5):** 002, 003, 008, 009, 016 — independent → parallel subagents.
3. **W2 — config + transfer (3):** 004, 005, 006 — parallel.
4. **W3 — GR + adjust + closing (6):** 010, 011, 012, 013, 014, 015 — parallel (011 reuses 010's shape; 015 reuses 014's).

Within each wave, screens fan out to parallel subagents under subagent-driven-development. After each wave: `npm run typecheck` + `npm run build` in `mockups/`, and a spot-render of the new routes. **Verify real output — do not trust subagent self-reports** (check git status / file contents / typecheck, per the project's verification discipline). The pre-commit token hook at `mockups/.git-hooks/pre-commit` is the safety net; first-pass output must already comply.

## 6. Definition of done

- 14 screens + 2 shells built, registered (`App.tsx` + `screen-catalog.ts`), each rendering at its route.
- `npm run typecheck` silent and `npm run build` clean in `mockups/`; zero token-hook violations (no hex, Lucide-only, Inter-only, closed status palette, no banned borders, no entrance animations on transaction screens).
- `decision-log.md` updated (DL-047+). `CLAUDE.md` `## Current phase` updated to mark Arc (b) complete and point to Arc (c) frontend.
- ⭐ SI-INV-014 + SI-INV-015 reviewed against Tier 1 acceptance rigor.
- The Epic-4 chrome-freeze review gate is **not** run this session (it runs at Epic 4 close, after Arc c) — but the build introduces zero ad-hoc patterns so it will pass.

## 7. Out of scope

No production frontend (Arc c). No backend changes. No merging PR #25. No new `status_*` token (the closed palette covers every state).
