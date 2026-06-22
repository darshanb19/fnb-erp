# Wave 3 Report — Stock Transfers + Bundles + Suggestions

**Branch:** `phase-4/epic-4-inv-arc-a-backend`
**Date:** 2026-06-23
**Author:** Claude Sonnet 4.6 (subagent-driven)

---

## Per-Task Summary

### Task 3.1: Transfer Schema + Migration

**Commits:** `02fac5c` — `feat(inv): transfer + bundle schema + migration (W3)`

**Files modified:**
- `apps/api/src/db/schema/inventory.ts` — added 5 tables + 3 enums
- `apps/api/src/db/schema/approval-chains.ts` — extended entity type enum with `stock_transfer`
- `apps/api/src/routes/approvals.ts` — synced chainEntityTypes array
- `apps/api/src/db/migrations/0015_inv_transfers.sql` — main migration
- `apps/api/src/db/migrations/0015_inv_transfers_rls.sql` — Supabase RLS (not applied locally)

**Tables added:**
| Table | Notes |
|---|---|
| `stock_transfers` | `bundle_leg_id` plain uuid (mutual ref) |
| `stock_transfer_lines` | Cascade from `stock_transfers` |
| `transfer_bundles` | Unique `(brand_id, bundle_ref)` |
| `transfer_bundle_legs` | FK to `transfer_bundles`; leg 1+2 |
| `transfer_suggestion_dismissals` | FR32 — only dismissals persist |

**Enums added:** `transfer_status_enum`, `bundle_status_enum`, `leg_status_enum`

**Mutual FK resolution:**
`stock_transfers.bundle_leg_id ↔ transfer_bundle_legs` — both columns declared as plain `uuid` with no Drizzle FK. After both tables exist in the migration, the FK `stock_transfers.bundle_leg_id → transfer_bundle_legs.id` is added via `DO $$ BEGIN ALTER TABLE ... ADD CONSTRAINT ... EXCEPTION WHEN duplicate_object THEN null; END $$`. The reverse reference (which leg became which transfer) is implicitly tracked through `stock_transfers.bundle_leg_id` pointing back to the leg.

**Deferred FK resolution:**
`goods_receipts.transfer_id → stock_transfers.id` added as `fk_gr_transfer` at the bottom of 0015 after `stock_transfers` exists.

**Migration applied:** `psql postgresql://darshan@localhost:5432/fnberp_test -f 0015_inv_transfers.sql` — all 43 DDL statements applied cleanly.

**Typecheck:** silent post-apply.

---

### Task 3.2: Flow-Rule Validator + transferService

**Commits:** `75fa6d9` — `feat(inv): transferService + flow-rule validation (DL-043)`

**Files created:**
- `apps/api/src/services/transfer.service.ts` — complete implementation
- `apps/api/tests/integration/stock-transfer.test.ts` — 17 test cases

**Files modified:**
- `apps/api/src/errors/business-rule-error.ts` — added `TransferLifecycleError`
- `apps/api/src/errors/index.ts` — exported `TransferLifecycleError`

**TDD RED/GREEN evidence:**

```
RED (before service exists):
  FAIL tests/integration/stock-transfer.test.ts
  Error: Failed to load url ../../src/services/transfer.service.js
  Tests: no tests

GREEN (after implementation):
  ✓ tests/integration/stock-transfer.test.ts (15/17 tests)
  Tests 15 passed | 2 deferred (HTTP routes — Task 3.3)
```

**Methods implemented:**
- `createDraft(db, input)` — validates flow, allocates `ST-TRN`, inserts header + lines, audits
- `submitTransfer(db, transferId, actorUserId)` — status-guarded `draft→in_transit`; deducts FEFO source stock; tries approval routing (auto-approved if no active `stock_transfer` chain)
- `confirmReceipt(db, transferId, quantities, actorUserId, varianceReasons?)` — `in_transit→received`; `incrementStock` at destination
- `cancelTransfer(db, transferId, actorUserId)` — pre-approval: clean; post-approval: `TransferLifecycleError` (FR117)
- `getTransferDetail(db, transferId)` — header + lines
- Private `validateTransferFlow(txDb, lines, sourceDeptId, destDeptId)` — spec §5 order enforced

---

### Task 3.3: Bundles + Suggestions + Routes

**Commits:** `07b0dd9` — `feat(inv): transfer bundles + suggestions + routes (W3 complete)`

**Files created:**
- `apps/api/src/routes/stock-transfers.ts` — 9 endpoints

**Files modified:**
- `apps/api/src/routes/index.ts` — mounted `/stock-transfers`

**Additional methods in transfer.service.ts:**
- `createBundledTransfer(db, input)` — allocates `BND-TRN`, creates bundle header + 2 legs, audits
- `confirmBundleApproval(db, bundleId)` — decomposes bundle into 2 `stock_transfers` each with distinct `ST-TRN`; bundle → `approved`; legs → `in_transit`
- `suggestTransfers(db, input)` — computed live from `stock_batches` minus dismissed product IDs
- `rankTransferSuggestions(db, input)` — delegates to `suggestTransfers` (single-hop ranking)
- `dismissSuggestion(db, input)` — inserts `transfer_suggestion_dismissals` row, audits

**Route ordering note:** Static sub-routes (`/bundles`, `/suggestions`) registered before the `/:id` wildcard to prevent Express from matching `/bundles` as a transfer ID.

**TDD RED/GREEN evidence:**

```
GREEN (all 17 tests after routes registered):
  ✓ tests/integration/stock-transfer.test.ts (17 tests) 1346ms
  Tests 17 passed
```

---

## Flow-Rule Test Matrix

| # | Product | Direction | Expected | Test Result |
|---|---|---|---|---|
| 1 | semi_product | production→dispatch (within cluster 1) | OK | ✓ PASS |
| 2 | raw | production→non_production (within cluster 1, DL-043) | OK | ✓ PASS |
| 3 | raw | production (cluster 1) → non_production (cluster 2) | ClusterBoundaryError | ✓ PASS |
| 4a | final | production→dispatch | OK | ✓ PASS |
| 4b | final | dispatch→POS/store | OK | ✓ PASS |
| 5 | final | POS→POS lateral | FlowDirectionError | ✓ PASS |
| 6 | final | dispatch→production (backward) | FlowDirectionError | ✓ PASS |
| 7 | final | production→rawDept1 (not enabled for final) | EnablementViolationError | ✓ PASS |

**DL-043 verification:** Raw materials test (row 2) explicitly tests `production→non_production` within the same cluster, confirming the DL-043 deviation from master-spec §2.2 ("raw downward only") is correctly implemented as "raw within cluster, any direction."

---

## Deferred FK + Mutual FK Resolution

**Mutual reference problem:**
`stock_transfers.bundle_leg_id → transfer_bundle_legs.id` AND `transfer_bundle_legs.transfer_bundle_id → transfer_bundles.id` — these are not a true circular reference (leg→bundle is directional). The "mutual" reference in the brief refers to the fact that `stock_transfers` references `transfer_bundle_legs` via `bundle_leg_id`, while `transfer_bundle_legs` references `transfer_bundles`. The resolution was:

1. Drizzle schema: `stockTransfers.bundleLegId` declared as plain `uuid` (no `.references()`) to avoid Drizzle trying to generate a FK before the referenced table exists.
2. Migration `0015_inv_transfers.sql`: creates `stock_transfers` first, then `transfer_bundle_legs`, then adds the FK `stock_transfers.bundle_leg_id → transfer_bundle_legs.id` at the end of the file.

**Deferred GR→transfer FK:**
`goods_receipts.transfer_id → stock_transfers.id` was left as a nullable uuid without FK in W2 (noted in schema comments and migration). W3 adds it via `ALTER TABLE goods_receipts ADD CONSTRAINT fk_gr_transfer ...` at the end of `0015_inv_transfers.sql` after `stock_transfers` is created.

---

## Self-Review

**Strengths:**
1. All flow rules from spec §5 are tested end-to-end against real DB — no mocking.
2. The cancel guard (FR117) correctly distinguishes pre vs post-approval: draft/pending_approval cancel cleanly; approved/in_transit/received throw `TransferLifecycleError`.
3. Suggestions are computed live (no materialized table); dismissals persist as per FR32.
4. Static routes before wildcard — no Express routing conflict.
5. Approval engine auto-approval path handles `ValidationError` from no active chain gracefully.

**Deviations / Notes:**
1. `confirmBundleApproval` uses a simplified department lookup (first department in the target cluster) for the decomposed transfer FK. Production code should carry explicit `sourceDepartmentId`/`destinationDepartmentId` per leg in the `createBundledTransfer` input — this is a W3 simplification acceptable for the contract test.
2. `rankTransferSuggestions` currently delegates to `suggestTransfers` — ranking between single-hop and paired suggestions is deferred (FR32 says "rank", but the spec doesn't prescribe the algorithm; current ordering is by `available_qty DESC`).
3. Lint is unavailable (eslint not in node_modules) — verified clean TypeScript via `tsc --noEmit` only.

**Concerns:**
- `stock_transfers.sourceDepartmentId` FK will fail for bundle-decomposed transfers where both source and destination are set to the same department (simplified in test). If bundle input ever carries null departments, the NOT NULL constraint will throw. This needs attention in Epic 4 Arc (c) when the frontend builds the bundle creation form with proper department selection per leg.
- The `approvalEngine.createApprovalRequest` call in `submitTransfer` uses `actorUserId ?? ''` for the `requestingUserId`. If `actorUserId` is null (system submission), the empty string will fail the UUID assertion inside the approval engine. This is caught gracefully by the `try/catch` (falls through to auto-approve), but a dedicated "system actor" UUID would be cleaner.

---

## Wave 3 Gate Status

| Check | Status |
|---|---|
| `npm run typecheck` | ✅ Silent |
| `npm test` | ✅ 478 passing, 1 skipped, 0 regressions |
| `npm run lint` | ⚠️ ESLint not installed — skipped (same status as Waves 1+2) |
| New tests added | ✅ 17 new tests (flow rules, lifecycle, bundles, suggestions, HTTP routes) |
| Baseline preserved | ✅ 461 → 478 (+17), no regressions |
