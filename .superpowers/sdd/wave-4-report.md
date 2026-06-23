# Wave 4 Implementation Report — Inventory Adjustments + Closing Inventory

**Date:** 2026-06-23
**Branch:** worktree-agent-a6d9ecfbbebba88a9 (derived from phase-4/epic-4-inv-arc-a-backend)
**Commit:** 127eafe

---

## Summary

Wave 4 is complete. All schema, service methods, routes, and integration tests for
Inventory Adjustments and Closing Inventory are committed and GREEN.

---

## Task 4.1 — Schema + Migration

**Status: ✅ Already complete (inherited from W4 schema commit on epic-4 branch)**

Tables already existed in `apps/api/src/db/schema/inventory.ts` and the migrations:
- `apps/api/src/db/migrations/0016_inv_adjust_closing.sql` — DDL for all 5 tables
- `apps/api/src/db/migrations/0016_inv_adjust_closing_rls.sql` — Supabase RLS policies

Tables: `inventory_adjustments`, `adjustment_lines`, `closing_inventory`,
`closing_inventory_lines`, `cut_off_registry`.

Approval chain entity type `'inventory_adjustment'` added via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

---

## Task 4.2 — Service Methods

**Commit:** a0ab5de — "Wave 4.2: service methods — recordAdjustment/confirm/cancel + closing inventory"

**Files modified:**
- `apps/api/src/services/inventory.service.ts` — 9 new methods
- `apps/api/src/errors/business-rule-error.ts` — 2 new concrete error classes
- `apps/api/src/errors/index.ts` — exports for new error classes

### Methods implemented

| Method | Spec reference | Key behaviour |
|--------|---------------|---------------|
| `recordAdjustment` | §4.3, FR37 | reasonCode mandatory on all lines; ADJ TRN allocation; approval engine routing with ValidationError catch → draft fallback |
| `confirmAdjustment` | §4.3 | Pattern 3 status-guarded UPDATE; positive delta → incrementStock; negative delta → FEFO deduction + stock_levels recompute |
| `cancelAdjustment` | §4.3 | Lifecycle guards (no cancel after confirmed); Pattern 3 UPDATE |
| `getExpectedClosingStock` | §4.3 | SUM(quantity_delta) from stock_movements per product; TODO(Epics 6/9) sold/recipe stub |
| `recordClosingInventory` | §4.3, FR114, FR37 | FR114 warn if countedQty > 1.5× expected; FR37 error if variance≠0 and no reasonCode; CI TRN |
| `confirmClosing` | §4.3 | Pattern 3 guard; closing_variance movements; status = variance_flagged|confirmed; GREATEST(0,...) prevents negative stock constraint |
| `markVarianceAcceptable` | §4.3 | Guard: must be variance_flagged; sets varianceAcceptable=true |
| `getClosingInventorySummary` | §4.3 | Counts by status for a date/location/dept scope |
| `checkCutOffCompliance` | §4.3, FR36 | Dept-specific then location-level cut_off_registry lookup; on_time|late|not_submitted|no_cutoff_configured |

### New error classes

- `AdjustmentLifecycleError` — HTTP 422, code `business.adjustment_lifecycle_violation`
- `ClosingInventoryLifecycleError` — HTTP 422, code `business.closing_lifecycle_violation`

---

## Task 4.3 — Routes + Integration Tests

**Commit:** 127eafe — "Wave 4.3: routes + integration tests — adjustments + closing inventory"

**Files created:**
- `apps/api/src/routes/inventory-adjustments.ts`
- `apps/api/src/routes/closing-inventory.ts`
- `apps/api/tests/integration/inventory-adjustment.test.ts`
- `apps/api/tests/integration/closing-inventory.test.ts`

**Files modified:**
- `apps/api/src/routes/index.ts` — registered both new routers
- `apps/api/src/services/inventory.service.ts` — bug fix in `confirmClosing` (GREATEST(0,...) for stock_levels)

### Routes

**`/api/v1/inventory-adjustments`**
- `POST /` → recordAdjustment → 201 + { data: { adjustmentId, adjTrn, status }, meta?: { approvalRequestId } }
- `POST /:id/confirm` → confirmAdjustment → 200 + { data: { status: confirmed } }
- `POST /:id/cancel` → cancelAdjustment → 200 + { data: { status: cancelled } }
- `GET /` → list (paged, status filter)
- `GET /:id` → document with lines

**`/api/v1/closing-inventory`**
- `POST /` → recordClosingInventory → 201 + { data: { closingId, ciTrn }, meta?: { warnings } }
- `POST /:id/confirm` → confirmClosing → 200 + { data: { status } }
- `POST /:id/mark-variance-ok` → markVarianceAcceptable → 200 + { data: { varianceAcceptable: true } }
- `GET /summary?businessDate=...` → getClosingInventorySummary
- `GET /cut-off-compliance?businessDate=...` → checkCutOffCompliance (FR36)
- `GET /` → list (paged, status filter)
- `GET /:id` → document with lines

### Test matrix — inventory-adjustment.test.ts (15 tests)

| # | Test | Result |
|---|------|--------|
| T1 | recordAdjustment positive delta → draft (no chain) | ✅ |
| T2 | FR37 reasonCode missing → ValidationError | ✅ |
| T3 | Approval chain exists → pending_approval | ✅ |
| T4 | confirmAdjustment positive delta → stock incremented | ✅ |
| T5 | confirmAdjustment negative delta → FEFO deduction | ✅ |
| T6 | cancelAdjustment draft → cancelled | ✅ |
| T7 | cancelAdjustment confirmed → AdjustmentLifecycleError | ✅ |
| T8 | cancelAdjustment already cancelled → AdjustmentLifecycleError | ✅ |
| T9 | HTTP POST / → 201 + envelope | ✅ |
| T9b | HTTP POST / missing reasonCode → 400 | ✅ |
| T10 | HTTP POST /:id/confirm → 200 | ✅ |
| T11 | HTTP POST /:id/cancel → 200 | ✅ |
| T12 | HTTP GET / → 200 + paged list | ✅ |
| T13 | HTTP GET /:id → 200 + lines | ✅ |
| T13b | HTTP GET /:id unknown → 404 | ✅ |

### Test matrix — closing-inventory.test.ts (14 tests)

| # | Test | Result |
|---|------|--------|
| T1 | recordClosingInventory zero variance → no warnings | ✅ |
| T2 | FR114 implausibility → warnings populated | ✅ |
| T3 | FR37 variance≠0 + no reasonCode → ValidationError | ✅ |
| T4 | confirmClosing zero variance → confirmed | ✅ |
| T5 | confirmClosing with variance → variance_flagged | ✅ |
| T6 | markVarianceAcceptable → varianceAcceptable=true | ✅ |
| T7 | markVarianceAcceptable on confirmed → ClosingInventoryLifecycleError | ✅ |
| T8 | getClosingInventorySummary → counts per status | ✅ |
| T9 | checkCutOffCompliance no registry → no_cutoff_configured | ✅ |
| T10 | HTTP POST / → 201 + envelope | ✅ |
| T11 | HTTP POST /:id/confirm → 200 | ✅ |
| T12 | HTTP POST /:id/mark-variance-ok → 200 | ✅ |
| T13 | HTTP GET /summary → 200 + summary | ✅ |
| T14 | HTTP GET /:id → 200 + lines | ✅ |

---

## Final Verification

```
git log --oneline -6:
127eafe Wave 4.3: routes + integration tests — adjustments + closing inventory
a0ab5de Wave 4.2: service methods — recordAdjustment/confirm/cancel + closing inventory
(prior commits: W1-W3 on epic-4 branch)

npx vitest run | tail -5:
 Test Files  37 passed (37)
      Tests  510 passed | 1 skipped (511)
   Start at  08:51:45
   Duration  37.80s
```

---

## Deviations / Decisions

- **DL-TBD**: `closing_status_enum` has no `variance_accepted` variant. `markVarianceAcceptable`
  uses the `varianceAcceptable: boolean` field instead of adding a new enum value. This matches
  the actual schema in `0016_inv_adjust_closing.sql`.

- **DL-TBD**: `confirmAdjustment` for positive deltas creates a new batch via `incrementStock`
  (same as a GR receipt). The batch number is derived from `{adjTrn}-{productId.slice(0,8)}`.

- **DL-TBD**: `confirmClosing` variance stock_levels update uses `GREATEST(0, quantity + variance)`
  for the ON CONFLICT path and `GREATEST(0, variance)` for the INSERT path to prevent violating
  the `stock_levels_qty_non_negative` constraint. Closing should not drive stock below zero —
  this is a write-off to 0, not a negative stock state.

- **Cross-epic stubs**: `getExpectedClosingStock` stubs sold/recipe-deduction inputs at 0 per
  spec. TODO(Epics 6/9) comments placed at all 3 stub sites.
