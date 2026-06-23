# Epic 4 INV — Arc (a) Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Every executing agent is given the companion spec `docs/superpowers/specs/2026-06-23-epic-4-inv-arc-a-backend-design.md` — it holds the exhaustive field lists, method bodies' rules, and per-area test cases this plan references by section (e.g. "spec §3.1"). Read the cited spec section before implementing a task.**

**Goal:** Build the complete Epic 4 Inventory Management backend (schema + service layer + REST routes + integration tests) for the F&B ERP, with cross-epic touchpoints as minimal stubs.

**Architecture:** Drizzle ORM over Postgres, all tables via `brandScopedTable`; service layer wraps mutations in `withTransaction` with atomic audit + journal-stub + movement rows; DL-016 row-lock+FEFO for deductions, status-guarded UPDATE for lifecycle transitions; Express flat route files with §17.4/§17.5 envelopes; vitest integration tests against local `fnberp_dev`.

**Tech Stack:** TypeScript (strict, zero `any`), Drizzle ORM 0.36, Express 4, zod, vitest, postgres.js, Supabase Postgres (local dev DB).

## Global Constraints

- TypeScript strict mode, **zero `any`** — narrowing casts only (`as unknown as T`), mirror existing service files.
- Every org-scoped query goes through `brandedDb` scoped methods; `db.raw` only for cross-table joins (explicit `brand_id` predicate) and `SELECT … FOR UPDATE`.
- No raw SQL strings — `sql` template tag only.
- Every table via `brandScopedTable` (DL-015); FEFO index on `stock_batches.expiry_date`.
- Every mutation: `withTransaction` + `auditLogService.record(txDb, …)` in the same tx (DL-013/DL-028).
- `inventoryService.checkEnablement()` before any stock movement (Master Spec §7.3).
- DL-016 concurrency: Pattern 1 (row-lock+FEFO) for deduction/transfer-out; Pattern 3 (status-guarded UPDATE) for transitions.
- REST: success `{ data, meta? }`; warn-and-log advisories in `meta.warnings`; errors via existing `AppError` subclasses; `toValidationError` on ZodError.
- TRN format: `{TYPE}-{YYYY}-{LOC}-{SEQ}` (6-digit zero-padded sequence).
- Migration starts at **0013**; generate via `npm run db:generate`, hand-edit constraints/RLS/partial indexes per the `0004_inventory_*` precedent, apply via `npm run db:migrate`. All commands run in `apps/api`.
- No commits to `main`; work on `phase-4/epic-4-inv-arc-a-backend`; commit per task.
- Verification per wave: `npm run typecheck` silent, `npm test` green, `npm run lint` clean.

---

## Wave 1 — Foundations + core stock engine

### Task 1.1: Enums + core stock tables (schema)

**Files:**
- Modify: `apps/api/src/db/schema/inventory.ts` (append; do not touch existing Epic 1 tables)
- Modify: `apps/api/src/db/schema/index.ts` (export new tables/types if it re-exports)

**Interfaces:**
- Produces: drizzle tables `trnSequences`, `journalEvents`, `stockLevels`, `stockBatches`, `stockMovements`; enum `movementTypeEnum`; inferred `$inferSelect`/`$inferInsert` types exported per existing convention.

- [ ] **Step 1:** Read spec §3.1 + §3.7. Add `movementTypeEnum` (`pgEnum('movement_type_enum', ['receipt','consumption','transfer_in','transfer_out','adjustment','closing_variance'])`) and the five tables via `brandScopedTable` with the exact columns in spec §3.1/§3.7. FK thunks to `products`, `departments`, `uoms`, `users`, `journalEvents`, `stockBatches`. Declare composite indexes via the `options.indexes` arg (FEFO: `{ fefo: ['brandId','productId','departmentId','expiryDate'] }`).
- [ ] **Step 2:** Export inferred types (`StockLevel`, `NewStockLevel`, `StockBatch`, …) mirroring lines 125-141 of the existing file.
- [ ] **Step 3:** Run `npm run typecheck` — expect silent (schema compiles).
- [ ] **Step 4:** Commit: `feat(inv): add core stock engine + foundation tables (W1 schema)`.

### Task 1.2: Migration 0013 (core tables + constraints + RLS + FEFO index)

**Files:**
- Create: `apps/api/src/db/migrations/0013_epic4_inv.sql` (+ `0013_inv_rls.sql` if the 0004 precedent splits RLS — inspect `0004_inventory_rls.sql` first)

**Interfaces:**
- Consumes: tables from Task 1.1.
- Produces: migrated `fnberp_dev` with core stock tables, unique constraints, partial FEFO index, RLS policies.

- [ ] **Step 1:** Run `npm run db:generate`; inspect generated SQL.
- [ ] **Step 2:** Hand-edit per spec §3.1/§3.7: unique constraints (`stock_levels (brand_id,product_id,department_id)`; `stock_batches (brand_id,product_id,department_id,batch_number)`; `trn_sequences (brand_id,transaction_type,location_code,year)`), partial index `CREATE INDEX … ON stock_batches (…) WHERE quantity_remaining > 0`, and RLS policies copying the `0004_inventory_rls.sql` 2-policy template for each new table.
- [ ] **Step 3:** Apply: `npm run db:migrate`. Expect success, no errors.
- [ ] **Step 4:** Decide single-vs-per-wave migration strategy (spec §8) and note it in a `decision-log.md` working note. Commit: `feat(inv): migration 0013 core stock tables + RLS + FEFO index`.

### Task 1.3: Error classes (`InsufficientStockError`, `FlowDirectionError`, `ClusterBoundaryError`)

**Files:**
- Modify: `apps/api/src/errors/business-rule-error.ts`, `apps/api/src/errors/index.ts`
- Test: `apps/api/tests/integration/inventory-errors.test.ts` (light — instantiation + httpStatus + code)

**Interfaces:**
- Produces: `InsufficientStockError`, `FlowDirectionError`, `ClusterBoundaryError` (all `extends BusinessRuleError`, httpStatus 422). `EnablementViolationError` already exists.

- [ ] **Step 1:** Write failing test asserting each new error has `httpStatus === 422` and a `business.*` code.
- [ ] **Step 2:** Run `npx vitest run tests/integration/inventory-errors.test.ts` — expect FAIL (undefined classes).
- [ ] **Step 3:** Add the three subclasses (mirror `EnablementViolationError` shape) + barrel exports.
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit: `feat(inv): add stock/flow business-rule error classes`.

### Task 1.4: `trnService` + `trn.test.ts`

**Files:**
- Create: `apps/api/src/services/trn.service.ts`
- Test: `apps/api/tests/integration/trn.test.ts`

**Interfaces:**
- Produces: `trnService.allocate(db: BrandedDb, type: string, locationCode: string, now?: Date): Promise<string>` → `{TYPE}-{YYYY}-{LOC}-{NNNNNN}`.

- [ ] **Step 1:** Write failing tests (see spec §7 `trn.test.ts`): format correctness; uniqueness across two calls (sequential); two concurrent allocations yield distinct values. Use the `tests/integration/setup.ts` seeded brand/db.
- [ ] **Step 2:** Run `npx vitest run tests/integration/trn.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement `allocate`: inside `withTransaction`, upsert+`UPDATE … SET next_value = next_value + 1 … RETURNING next_value` on `trn_sequences` (use `db.raw` with `sql` tag + explicit brand predicate, or scoped methods + row guard); format the string. Year from `now ?? new Date()`.
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit: `feat(inv): trnService atomic TRN allocator`.

### Task 1.5: `journalStubService`

**Files:**
- Create: `apps/api/src/services/journal-stub.service.ts`
- Test: covered via `inventory-deduct.test.ts` (Task 1.6) assertions; no standalone test needed.

**Interfaces:**
- Produces: `journalStubService.record(db: BrandedDb, input: { trnReference?: string|null; eventType: string; debitAccount?: string; creditAccount?: string; amount?: string|number; sourceMovementId?: string|null }): Promise<string>` (returns `journal_events.id`).

- [ ] **Step 1:** Implement `record` via `db.scopedInsert(journalEvents, …).returning()`; return id. Must be callable inside an existing transaction (accepts the txDb).
- [ ] **Step 2:** `npm run typecheck` — silent.
- [ ] **Step 3:** Commit: `feat(inv): journal-stub ledger service (Epic 10 seam)`.

### Task 1.6: `inventoryService.getAvailableStock` + `deductStock` + `incrementStock`

**Files:**
- Modify: `apps/api/src/services/inventory.service.ts`
- Test: `apps/api/tests/integration/inventory-deduct.test.ts`

**Interfaces:**
- Consumes: `trnService` (not required by deduct directly), `journalStubService.record`, `auditLogService.record`, `checkEnablement`.
- Produces:
  - `getAvailableStock(db, itemId, departmentId): Promise<{ itemId; departmentId; quantity: number; unit: string; lastUpdatedAt: Date }>`
  - `deductStock(db, itemId, departmentId, quantity, reason, trnReference): Promise<{ success: boolean; newBalance: number; journalEntryId: string }>` — throws `EnablementViolationError | InsufficientStockError`.
  - `incrementStock(db, departmentId, batches: Array<{ productId; batchNumber; quantity; expiryDate?; receivedDate; yieldFactor?; costPerUnit?; uomId; sourceType; sourceRef? }>, opts: { actorUserId; movementType: 'receipt'|'transfer_in'|'adjustment'; trnReference?; reason? }): Promise<void>`

- [ ] **Step 1:** Write failing tests per spec §7 `inventory-deduct.test.ts` (enablement gate; FEFO order; multi-batch walk; insufficient throws + full rollback — assert no `stock_movements`/`journal_events`/`audit_log` rows; concurrent no-oversell; `newBalance`; audit+journal same-tx). Seed batches with varied `expiryDate`.
- [ ] **Step 2:** Run `npx vitest run tests/integration/inventory-deduct.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement the three methods per spec §4.3 (deduct = DL-016 Pattern 1: `db.raw … FOR UPDATE ORDER BY expiry_date ASC NULLS LAST`; FEFO walk; per-batch UPDATE; movement; `stock_levels` upsert; journal-stub; audit). `incrementStock` upserts batch + `stock_levels` + movement. `getAvailableStock` reads `stock_levels` (absent → 0; resolve `unit` from product default UOM code).
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit: `feat(inv): getAvailableStock, deductStock (FEFO+row-lock), incrementStock`.

### Task 1.7: `getExpiringBatches` + `stock.ts` routes

**Files:**
- Modify: `apps/api/src/services/inventory.service.ts`
- Create: `apps/api/src/routes/stock.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test: extend `inventory-deduct.test.ts` or new `stock-read.test.ts` for `getExpiringBatches` banding.

**Interfaces:**
- Produces: `getExpiringBatches(db, scope: { departmentId?; locationId?; clusterId? }, now?: Date): Promise<{ bands: { h24; h48; h72; over72 }, items: [...] }>`; routes `GET /stock/available`, `GET /stock/expiring`, `GET /stock/movements`.

- [ ] **Step 1:** Write failing test for `getExpiringBatches` banding (seed batches at +12h/+36h/+60h/+96h → assert correct band counts + value-at-risk).
- [ ] **Step 2:** Run it — expect FAIL.
- [ ] **Step 3:** Implement `getExpiringBatches` (spec §4.3) + `stock.ts` routes (zod query params, `req.db` guard, `{ data }` envelope) + register `/stock` in `routes/index.ts`.
- [ ] **Step 4:** Run test — expect PASS. Run `npm run typecheck` + `npm run lint`.
- [ ] **Step 5:** Commit: `feat(inv): getExpiringBatches + stock read routes (W1 complete)`.

**Wave 1 gate:** `npm run typecheck` silent, `npm test` green, `npm run lint` clean.

---

## Wave 2 — Goods receipt

### Task 2.1: GR schema + migration

**Files:** Modify `inventory.ts`; create `apps/api/src/db/migrations/0014_inv_goods_receipt.sql` (or amend 0013 per the W1 strategy decision).

**Interfaces:** Produces `goodsReceipts`, `grLines`, `grAttachments`, `grRejectionRecords` + `grStatusEnum`; inferred types.

- [ ] **Step 1:** Read spec §3.2. Add the four tables + `gr_status_enum` via `brandScopedTable`; FKs per spec (`po_id` nullable no-FK; `transfer_id → stock_transfers` — declare as nullable `uuid` now, add FK in W3 migration to avoid ordering issue, OR thunk-ref if `stockTransfers` defined later in same file — note the forward dependency).
- [ ] **Step 2:** Generate + hand-edit migration (unique `(brand_id, gr_trn)`, RLS). Apply.
- [ ] **Step 3:** `npm run typecheck` silent. Commit: `feat(inv): goods-receipt schema + migration (W2)`.

### Task 2.2: GR service (record/confirm/reject + yield + FR114/FR115) + `poProgressionStub`

**Files:** Modify `inventory.service.ts`; Test `apps/api/tests/integration/goods-receipt.test.ts`.

**Interfaces:**
- Produces: `recordGoodsReceipt(db, input): Promise<{ goodsReceiptId: string; warnings: string[] }>`, `confirmGoodsReceipt(db, grId, opts): Promise<{ status: string }>`, `rejectGoodsReceipt(db, grId, reasons, evidence?): Promise<{ status: string }>`; private `poProgressionStub` (`// TODO(Epic 5)`).

- [ ] **Step 1:** Write failing tests per spec §7 `goods-receipt.test.ts` (yield math; confirm creates batch + bumps `stock_levels` + journal-stub via `incrementStock`; FR114 >150% warning needs reason; FR115 same-day duplicate warning; reject records rejection + creates no stock).
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Implement per spec §4.3: allocate `grTrn`; yield computation; warn-and-log into `warnings[]`; confirm = status-guarded `draft→confirmed` + `incrementStock` + journal-stub (DR Inventory, CR AP) + `poProgressionStub` + audit; reject = status-guarded + `gr_rejection_records` (mandatory reason, `vcnDeferred=true`) + audit.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit: `feat(inv): goods-receipt service (yield, FR114/115, confirm/reject)`.

### Task 2.3: `goods-receipts.ts` routes

**Files:** Create `apps/api/src/routes/goods-receipts.ts`; modify `routes/index.ts`; extend test for route-level envelope + `meta.warnings`.

- [ ] **Step 1:** Write failing route test (POST creates GR; confirm/ reject transitions; warning surfaces in `meta.warnings`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement routes (spec §6) + register `/goods-receipts`.
- [ ] **Step 4:** Run — PASS. `npm run typecheck`/`lint`.
- [ ] **Step 5:** Commit: `feat(inv): goods-receipt routes (W2 complete)`.

**Wave 2 gate:** typecheck/test/lint green.

---

## Wave 3 — Transfers + bundles + suggestions

### Task 3.1: Transfer schema + migration

**Files:** Modify `inventory.ts`; create `0015_inv_transfers.sql`.

**Interfaces:** Produces `stockTransfers`, `stockTransferLines`, `transferBundles`, `transferBundleLegs`, `transferSuggestionDismissals` + status enums; add deferred FK `goods_receipts.transfer_id → stock_transfers` in this migration.

- [ ] **Step 1:** Read spec §3.3. Add tables/enums; resolve the `stock_transfers.bundle_leg_id ↔ transfer_bundle_legs` mutual reference (declare columns as plain `uuid`, add both FKs in the migration hand-edit).
- [ ] **Step 2:** Generate + hand-edit (uniques `(brand_id, st_trn)`, `(brand_id, bundle_ref)`, RLS, the deferred GR→transfer FK). Apply.
- [ ] **Step 3:** typecheck silent. Commit: `feat(inv): transfer + bundle schema + migration (W3)`.

### Task 3.2: Flow-rule validator + `transferService` (createDraft/submit/confirmReceipt/cancel)

**Files:** Create `apps/api/src/services/transfer.service.ts`; Test `apps/api/tests/integration/stock-transfer.test.ts`.

**Interfaces:**
- Consumes: `inventoryService.deductStock`-style FEFO lock (reuse a shared internal helper or `deductStock` with `reason='transfer_out'`), `incrementStock`, `checkEnablement`, `trnService`, `approvalEngine.createApprovalRequest`.
- Produces: `transferService.createDraft(db, input)`, `submitTransfer(db, transferId)`, `confirmReceipt(db, transferId, quantities, varianceReasons?)`, `cancelTransfer(db, transferId)`, `getTransferDetail(db, transferId)`; private `validateTransferFlow(db, item, sourceDeptId, destDeptId)` implementing spec §5.

- [ ] **Step 1:** Write failing tests per spec §7 `stock-transfer.test.ts` (semi lateral OK; **raw dept→dept within cluster OK — DL-043**; cross-cluster rejected `ClusterBoundaryError`; final production→dispatch→POS OK, POS→POS + backward `FlowDirectionError`; dest-not-enabled `EnablementViolationError`; receipt increments dest; cancel pre-approval clean vs post-approval guarded).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `validateTransferFlow` (spec §5 order: cluster resolve → enablement → product-type direction → sufficiency) and the lifecycle methods (status-guarded transitions; over-threshold → approval routing; dispatch deducts source FEFO + `transfer_out` movement; receipt = `incrementStock` + `transfer_in`).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit: `feat(inv): transferService + flow-rule validation (DL-043)`.

### Task 3.3: Bundles + suggestions + `stock-transfers.ts` routes

**Files:** Modify `transfer.service.ts`; create `apps/api/src/routes/stock-transfers.ts`; modify `routes/index.ts`; extend test for bundle decomposition + suggestions.

**Interfaces:** Produces `createBundledTransfer`, `confirmBundleApproval`, `rankTransferSuggestions`, `suggestTransfers`, `dismissSuggestion`; routes per spec §6.

- [ ] **Step 1:** Write failing tests (bundle approval decomposes into two `stock_transfers` each with distinct `st_trn`; `rankTransferSuggestions` returns single-hop vs paired; dismissal persists).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement bundle + suggestion methods (spec §4.4) + routes + register `/stock-transfers`.
- [ ] **Step 4:** Run — PASS. typecheck/lint.
- [ ] **Step 5:** Commit: `feat(inv): transfer bundles + suggestions + routes (W3 complete)`.

**Wave 3 gate:** typecheck/test/lint green.

---

## Wave 4 — Adjustments + closing inventory

### Task 4.1: Adjustment + closing-inventory + cut-off schema + migration

**Files:** Modify `inventory.ts`; create `0016_inv_adjust_closing.sql`.

**Interfaces:** Produces `inventoryAdjustments`, `adjustmentLines`, `closingInventory`, `closingInventoryLines`, `cutOffRegistry` + status enums.

- [ ] **Step 1:** Read spec §3.4/§3.5. Add tables/enums; uniques per spec (`(brand_id, adj_trn)`, `(brand_id, location_id, department_id, business_date)`, `(brand_id, location_id, department_id)` for cut-off).
- [ ] **Step 2:** Generate + hand-edit (RLS) + apply.
- [ ] **Step 3:** typecheck silent. Commit: `feat(inv): adjustment + closing-inventory schema (W4)`.

### Task 4.2: Adjustment service + tests

**Files:** Modify `inventory.service.ts`; create `apps/api/src/routes/inventory-adjustments.ts`; modify `routes/index.ts`; Test `apps/api/tests/integration/inventory-adjustment.test.ts`.

**Interfaces:** Produces `recordAdjustment(db, input)`, `confirmAdjustment(db, adjId)`, `cancelAdjustment(db, adjId)` + routes.

- [ ] **Step 1:** Write failing tests (reason mandatory; over-threshold → `approvalEngine.createApprovalRequest` + `pending_approval`; confirm applies signed delta — positive new batch, negative FEFO decrement; movement + journal-stub + audit).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement per spec §4.3 + routes (spec §6) + register `/inventory-adjustments`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit: `feat(inv): inventory adjustments (approval-routed, FEFO delta)`.

### Task 4.3: Closing-inventory service + routes + tests

**Files:** Modify `inventory.service.ts`; create `apps/api/src/routes/closing-inventory.ts`; modify `routes/index.ts`; Test `apps/api/tests/integration/closing-inventory.test.ts`.

**Interfaces:** Produces `getExpectedClosingStock(db, locationId, departmentId, businessDate)`, `recordClosingInventory(db, input)`, `confirmClosing(db, ciId)`, `markVarianceAcceptable(db, ciId)`, `getClosingInventorySummary(db, scope, businessDate)`, `checkCutOffCompliance(db, scope, businessDate)` + routes.

- [ ] **Step 1:** Write failing tests per spec §7 (expected from ledger; variance computed; reason mandatory when variance≠0; FR114 implausibility; cut-off status from registry; confirm writes `closing_variance` movement + journal-stub; `markVarianceAcceptable`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement per spec §4.3 (cross-epic inputs — sold/recipe — stubbed 0 with `// TODO(Epics 6/9)`) + routes + register `/closing-inventory`.
- [ ] **Step 4:** Run — PASS. typecheck/lint.
- [ ] **Step 5:** Commit: `feat(inv): closing inventory + cut-off (W4 complete)`.

**Wave 4 gate:** typecheck/test/lint green.

---

## Wave 5 — PAR + below-PAR + close-out

### Task 5.1: PAR schema + migration

**Files:** Modify `inventory.ts`; create `0017_inv_par.sql`.

**Interfaces:** Produces `parLevels` (`auditTrigger: true`; `dayOfWeekOverrides` typed jsonb).

- [ ] **Step 1:** Read spec §3.6. Add `parLevels` with unique `(brand_id, product_id, location_id, department_id)`; typed jsonb column (`$type<{mon?:number;…;sun?:number}>()`).
- [ ] **Step 2:** Generate + hand-edit (RLS + audit trigger registration) + apply.
- [ ] **Step 3:** typecheck silent. Commit: `feat(inv): PAR-levels schema (W5)`.

### Task 5.2: PAR service + routes + tests

**Files:** Modify `inventory.service.ts`; create `apps/api/src/routes/par-levels.ts`; modify `routes/index.ts`; Test `apps/api/tests/integration/par-levels.test.ts`.

**Interfaces:** Produces `setParLevel(db, input)`, `bulkSetParLevel(db, rows)`, `listBelowPar(db, scope, businessDate?)` (returns shortfall + suggested reorder; day-of-week-adjusted PAR) + routes.

- [ ] **Step 1:** Write failing tests per spec §7 (base + day-of-week override resolution; below-PAR shortfall = adjustedPar − onhand; suggested reorder).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement per spec §4.3 + routes + register `/par-levels`.
- [ ] **Step 4:** Run — PASS. typecheck/lint.
- [ ] **Step 5:** Commit: `feat(inv): PAR levels + below-PAR flagging (W5 complete)`.

### Task 5.3: Decision log + codebase inventory + phase marker

**Files:** Modify `decision-log.md`, `codebase-inventory.md`, `CLAUDE.md` (`## Current phase`).

- [ ] **Step 1:** Append DL-043 (raw dept→dept transfers, spec §0), DL-044 (Arc-a widened), and any DL-045+ build-time decisions (migration strategy, deferred-FK choices).
- [ ] **Step 2:** Add the new inventory tables/services/routes to `codebase-inventory.md`.
- [ ] **Step 3:** Update `CLAUDE.md ## Current phase` to record Epic 4 Arc (a) status (in the PR, per phase-boundary discipline).
- [ ] **Step 4:** Commit: `docs(inv): DL-043/044 + codebase-inventory + phase marker`.

**Wave 5 gate / Definition of done:** `npm run typecheck` silent, `npm test` green, `npm run lint` clean, `npm run build` clean (all in `apps/api`). Open PR `phase-4/epic-4-inv-arc-a-backend → main`.

---

## Self-review notes
- **Spec coverage:** §3 tables → Tasks 1.1/2.1/3.1/4.1/5.1; §4 services → 1.4–1.7/2.2/3.2–3.3/4.2–4.3/5.2; §5 flow rules → 3.2; §6 routes → 1.7/2.3/3.3/4.2–4.3/5.2; §7 tests → each task's test step; §8 waves → wave headers; §0 decisions → 5.3. FR114/FR115 → 2.2 (+ closing 4.3). Cross-epic stubs → 2.2 (`poProgressionStub`), 1.5 (journal), 4.3 (expected-count stubs).
- **Placeholder scan:** the only `TODO`s are deliberate cross-epic stub markers (`// TODO(Epic N)`), required by spec §2.
- **Type consistency:** service method names/signatures match spec §4 verbatim; `deductStock` return `{ success, newBalance, journalEntryId }` matches §8.1 contract; `incrementStock` signature reused by GR (2.2) and transfers (3.2/3.3).
