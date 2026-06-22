# Phase 4 Epic 4 INV — Arc (a) Backend Design

**Date:** 2026-06-23
**Branch:** `phase-4/epic-4-inv-arc-a-backend`
**Scope:** Backend only (schema + service layer + REST routes + integration tests) for the **full** Epic 4 Inventory Management surface. No UI/mockups/production frontend (Arcs b/c). No commits to `main`; land via PR. Dev + tests run against local `fnberp_dev`.

This spec is the binding contract for the Arc (a) build. Build agents follow it exactly. Field-level precision lives here; the chat design summary is the altitude view.

---

## 0. Decisions captured this session

- **DL-043 — Raw-material department-to-department transfers permitted (within cluster).** Deviation from Master Spec §2.2 ("raw materials downward only, never lateral"). Founder decision 2026-06-23. Guardrails that REMAIN enforced: (a) same-cluster only — cross-cluster raw transfers rejected; (b) destination department must have the item enabled (`checkEnablement`); (c) never upward into a store (a `transferStock` destination is always a department, never a store); (d) source must hold sufficient FEFO stock. Semi-product (lateral within cluster) and final-product (production→dispatch→POS) rules are unchanged.
- **DL-044 — Arc (a) widened to the full Epic 4 inventory backend.** The session brief named the three core stock tables; the founder elected to build the complete epic backend (GR, transfers, adjustments, closing inventory, PAR, expiry, suggestions) using subagent-driven development, with cross-epic touchpoints implemented as minimal stubs/foundations (see §2). Arc (a) per the phase invariant = "backend schema + service-layer + integration tests" for the epic; this realises that fully.

(Both get formal entries appended to `decision-log.md` during the build.)

---

## 1. Architecture invariants honoured

- **TypeScript strict, zero `any`.** Narrowing casts only, mirroring existing service files.
- **`brandScopedTable` for every table** (DL-015) — injects `id, brand_id, created_at, updated_at, created_by, updated_by`, brand index, RLS, optional audit-trigger.
- **`brandedDb` scoped methods** (DL-012/DL-027) — `scopedFrom/scopedInsert/scopedUpdate/scopedDelete`; `db.raw` only for cross-table joins (with explicit `brand_id` predicates) and `SELECT … FOR UPDATE`.
- **`withTransaction`** wraps every mutation; sets `app.user_id`; audit + journal-stub + movement rows commit atomically with the business write.
- **Audit** (DL-013/DL-028) — `auditLogService.record(txDb, …)` inside the same transaction for every mutation; `action: 'business_action'` for stock movements, `insert/update` for config rows.
- **Concurrency** (DL-016) — Pattern 1 (row-lock + FEFO) for deduction/transfer-out; Pattern 3 (status-guarded UPDATE) for every lifecycle transition.
- **REST** — flat route files in `apps/api/src/routes/`, registered in `routes/index.ts`; §17.4 success envelope `{ data, meta? }`, §17.5 error envelope via existing error classes; warn-and-log advisories ride in `meta.warnings`.
- **No raw SQL strings** except via the `sql` template tag (FEFO `FOR UPDATE`, cross-table joins) — mirrors `inventory.service.ts` `listEnablementForLocation`.
- **Migration 0013** — `npm run db:generate` then hand-edit for constraints/RLS/partial indexes following the `0004_inventory_*` precedent; apply via `npm run db:migrate`.

---

## 2. Cross-epic stub boundary

Epic 4 is self-contained and testable; the owning epic completes each seam later.

| Touchpoint | Owner | Arc (a) implementation |
|---|---|---|
| Purchase Orders (GR↔PO link) | Epic 5 | `goods_receipts.po_id uuid` nullable, **no FK** (no `purchase_orders` table exists). `recordGoodsReceipt` accepts optional `poId`. PO status progression = no-op stub function `poProgressionStub()` with a `// TODO(Epic 5)` marker. |
| Vendor Credit Notes (GR rejection) | Epic 5 | Rejection fully recorded in `gr_rejection_records`; VCN auto-draft = deferred stub (record intent only, `// TODO(Epic 5)`). |
| Accounting journal entries | Epic 10 | `journal_events` stub ledger row written in-tx; its id returned as `journalEntryId`/`journalEventId`. Real posting + balanced-entry validation deferred. |
| Production-order trigger for `deductStock` | Epic 7 | `deductStock` built and tested **directly** (no production order needed). In-Progress caller is Epic 7. |
| Recipe/POS-driven "expected" closing counts | Epics 6/9 | `getExpectedClosingStock` computes expected from inventory's own movement ledger (opening + receipts + transfers-in − consumption − transfers-out − adjustments). "Sold"/recipe-deduction inputs stubbed to 0 with `// TODO(Epics 6/9)`. |
| Approval Engine + Notification Center | Epic 3 (**built**) | Used for real. Transfer/adjustment over-threshold routing → `approvalEngine.createApprovalRequest`. Cut-off + low-stock alerts → `notificationCenter.send`. |

---

## 3. Schema (`apps/api/src/db/schema/inventory.ts`, extended)

All tables via `brandScopedTable`. Columns below are **in addition** to the standard six. Money/qty are `numeric(18,4)` unless noted; yield `numeric(5,4)`; factors `numeric(18,9)`.

### 3.1 Core stock engine
**`stock_levels`** — on-hand rollup; one row per (product, department). Backs `getAvailableStock` + real-time view (FR25).
- `productId uuid NN → products(id)`, `departmentId uuid NN → departments(id)`, `quantity numeric(18,4) NN default 0`, `uomId uuid NN → uoms(id)`, `lastUpdatedAt timestamptz NN default now()`.
- Unique `(brand_id, product_id, department_id)`. Index `(brand_id, product_id, department_id)`.

**`stock_batches`** — FEFO source of truth.
- `productId`, `departmentId`, `batchNumber text NN`, `quantityRemaining numeric(18,4) NN`, `expiryDate date` (nullable for non-perishables), `receivedDate date NN`, `yieldFactor numeric(5,4) NN default 1.0000`, `costPerUnit numeric(18,4) NN default 0`, `uomId uuid NN → uoms`, `sourceType text NN` (`goods_receipt|transfer|adjustment|opening`), `sourceRef uuid` (nullable), `provisional boolean NN default false` (FR66).
- **FEFO index** `(brand_id, product_id, department_id, expiry_date)`; partial index `WHERE quantity_remaining > 0`. Unique `(brand_id, product_id, department_id, batch_number)`.

**`stock_movements`** — append-only ledger (`auditTrigger: false`; audit_log carries the business row).
- `productId`, `departmentId`, `batchId uuid → stock_batches(id)` (nullable for rollup-only), `movementType movement_type_enum NN`, `quantityDelta numeric(18,4) NN` (signed: + in, − out), `uomId`, `sourceType text NN`, `sourceId uuid`, `destType text`, `destId uuid`, `reason text`, `reasonCode text`, `trnReference text`, `journalEventId uuid → journal_events(id)` (nullable), `actorUserId uuid → users(id)`.
- `movement_type_enum = ['receipt','consumption','transfer_in','transfer_out','adjustment','closing_variance']`.
- Index `(brand_id, product_id, department_id, created_at)` for movement history (SI-INV-002).

### 3.2 Goods receipt
**`goods_receipts`** — `grTrn text NN`, `poId uuid` (nullable, no FK — Epic 5), `transferId uuid → stock_transfers(id)` (nullable; transfer-driven GR SI-INV-011), `destinationDepartmentId uuid NN → departments`, `status gr_status_enum NN default 'draft'`, `receivedByUserId uuid → users`, `receivedAt timestamptz`. Enum `gr_status_enum = ['draft','confirmed','pending_approval','rejected']`. Unique `(brand_id, gr_trn)`.

**`gr_lines`** — `goodsReceiptId NN → goods_receipts`, `productId NN`, `receivedQty numeric(18,4) NN`, `yieldFactor numeric(5,4) NN default 1.0000`, `usableQty numeric(18,4) NN` (computed = received×yield), `wastageQty numeric(18,4) NN` (computed = received−usable), `adjustedCostPerUnit numeric(18,4)`, `expiryDate date`, `batchNumber text`, `varianceQty numeric(18,4)` (transfer-driven), `reasonCode text`.

**`gr_attachments`** — `goodsReceiptId NN`, `fileId uuid` (Epic 3 files surface), `kind text` (`photo|document`). (FR39.)

**`gr_rejection_records`** — `goodsReceiptId NN`, `rejectionReasonCode text NN`, `notes text`, `rejectedByUserId uuid → users`, `rejectedAt timestamptz NN`, `vcnDeferred boolean NN default true` (Epic 5 stub marker). (FR47a.)

### 3.3 Transfers
**`stock_transfers`** — `stTrn text NN`, `sourceDepartmentId NN → departments`, `destinationDepartmentId NN → departments`, `status transfer_status_enum NN default 'draft'`, `reasonCode text`, `bundleLegId uuid → transfer_bundle_legs(id)` (nullable; set when this transfer was decomposed from a bundle), `requestedByUserId`, `requestedAt`, `approvalRequestId uuid` (nullable; Epic 3 link). Enum `transfer_status_enum = ['draft','pending_approval','approved','in_transit','received','cancelled']`. Unique `(brand_id, st_trn)`.

**`stock_transfer_lines`** — `stockTransferId NN`, `productId NN`, `requestedQty numeric(18,4) NN`, `fulfilledQty numeric(18,4)`, `sourceBatchId uuid → stock_batches`, `reasonCode text`.

**`transfer_bundles`** (SI-INV-007, P2B-002) — `bundleRef text NN`, `originatingClusterId NN → clusters`, `destinationClusterId NN → clusters`, `status bundle_status_enum NN default 'draft'`, `approvalRequestId uuid`. Enum `bundle_status_enum = ['draft','pending_approval','approved','rejected']`. Unique `(brand_id, bundle_ref)`.

**`transfer_bundle_legs`** — `transferBundleId NN`, `legNo int NN` (1=source→brand store return, 2=brand store→dest draw), `fromStoreId uuid → stores`, `toStoreId uuid → stores`, `status leg_status_enum NN default 'pending'` (`pending|in_transit|received|cancelled`).

**`transfer_suggestion_dismissals`** (FR32) — `productId NN`, `batchId uuid → stock_batches`, `dismissedByUserId`, `dismissedAt timestamptz NN`, `reasonCode text`. (Suggestions themselves are computed live; only dismissals persist.)

### 3.4 Adjustments
**`inventory_adjustments`** — `adjTrn text NN`, `departmentId NN → departments`, `status adjustment_status_enum NN default 'draft'`, `aggregateValueImpact numeric(18,4)`, `approvalRequestId uuid`, `requestedByUserId`, `requestedAt`, `confirmedAt`. Enum `adjustment_status_enum = ['draft','pending_approval','confirmed','cancelled']`. Unique `(brand_id, adj_trn)`.

**`adjustment_lines`** — `inventoryAdjustmentId NN`, `productId NN`, `batchId uuid → stock_batches`, `currentOnHand numeric(18,4)`, `delta numeric(18,4) NN` (signed), `reasonCode text NN`. (FR37 — reason mandatory.)

### 3.5 Closing inventory
**`closing_inventory`** — `ciTrn text NN`, `locationId NN → locations`, `departmentId NN → departments`, `businessDate date NN`, `status closing_status_enum NN default 'draft'`, `submissionTimestamp timestamptz`, `cutOffStatus text` (`on_time|late|not_submitted`), `totalVarianceValue numeric(18,4)`, `varianceItemsCount int`, `varianceAcceptable boolean NN default false`. Enum `closing_status_enum = ['draft','confirmed','variance_flagged']`. Unique `(brand_id, location_id, department_id, business_date)`.

**`closing_inventory_lines`** — `closingInventoryId NN`, `productId NN`, `expectedQty numeric(18,4) NN`, `countedQty numeric(18,4) NN`, `variance numeric(18,4) NN` (computed = counted−expected), `reasonCode text` (mandatory when variance ≠ 0 — enforced in service).

**`cut_off_registry`** — `locationId NN → locations`, `departmentId uuid → departments` (nullable = location default), `cutOffTime text NN` (HH:MM). Unique `(brand_id, location_id, department_id)`. (FR36.)

### 3.6 PAR
**`par_levels`** (FR33/FR34) — `productId NN`, `locationId uuid → locations` (nullable), `departmentId uuid → departments` (nullable), `basePar numeric(18,4) NN`, `dayOfWeekOverrides jsonb` (typed `{ mon?:number, …, sun?:number }`), `lastModifiedByUserId`, `lastModifiedAt timestamptz NN default now()`. Unique `(brand_id, product_id, location_id, department_id)`. `auditTrigger: true` (PAR changes are audit-significant per SI-INV-004 CC-AUDIT-LINK).

### 3.7 Foundations
**`trn_sequences`** (architecture §6.2.4; first minted here) — plain `brandScopedTable`: `transactionType text NN`, `locationCode text NN`, `year int NN`, `nextValue int NN default 1`. Unique `(brand_id, transaction_type, location_code, year)`.

**`journal_events`** (accounting stub, Epic 10 consumes) — `trnReference text`, `eventType text NN` (e.g. `gr_confirmed`, `production_consumption`, `closing_variance`), `debitAccount text`, `creditAccount text`, `amount numeric(18,4)`, `sourceMovementId uuid`, `posted boolean NN default false`.

---

## 4. Service layer

Files: extend `apps/api/src/services/inventory.service.ts`; new `transfer.service.ts`, `trn.service.ts`, `journal-stub.service.ts`. Each method prepends `db: BrandedDb` per architecture §6.1. Object-literal export pattern (mirror `product.service.ts` / `approval-engine.service.ts`).

### 4.1 `trnService`
- `allocate(db, type, locationCode): Promise<string>` — atomic `UPDATE trn_sequences SET next_value = next_value + 1 … RETURNING next_value` (upsert row if absent), formats `{TYPE}-{YYYY}-{LOC}-{SEQ}` with zero-padded sequence (6 digits). Year passed in / derived from a caller-supplied "now" (Date injected; no `Date.now()` ban issue here — service code may use `new Date()`; only Workflow scripts are restricted). Serializes on the row lock.

### 4.2 `journalStubService`
- `record(db, input): Promise<string>` — inserts one `journal_events` row, returns id. Called inside the caller's transaction.

### 4.3 `inventoryService` (extended; existing `checkEnablement`/`setEnablement`/`listEnablementForLocation` untouched)
- **`getAvailableStock(db, itemId, departmentId): Promise<StockLevel>`** — read `stock_levels`; `{ itemId, departmentId, quantity, unit, lastUpdatedAt }`. Absent row → quantity 0.
- **`deductStock(db, itemId, departmentId, quantity, reason, trnReference): Promise<DeductionResult>`** — DL-016 Pattern 1, all in one `withTransaction`:
  1. `checkEnablement`; throw `EnablementViolationError` if false.
  2. `db.raw … SELECT … FROM stock_batches WHERE … AND quantity_remaining > 0 FOR UPDATE ORDER BY expiry_date ASC NULLS LAST` (brand_id predicate explicit).
  3. FEFO walk; if Σ < quantity → throw `InsufficientStockError` (rolls back).
  4. Per-batch `UPDATE quantity_remaining`; insert `stock_movements` (`consumption`, negative); update `stock_levels`.
  5. `journalStubService.record` (DR COGS — Raw Material Consumption, CR Inventory — Raw Materials; FR89) → `journalEventId`.
  6. `auditLogService.record` (`business_action`).
  7. Return `{ success:true, newBalance, journalEntryId }`.
- **`incrementStock(db, departmentId, batches[], opts): Promise<void>`** — create/extend `stock_batches`, insert `transfer_in`/`receipt` movements, bump `stock_levels`. Shared by GR confirm + transfer receipt.
- **`recordGoodsReceipt(db, input): Promise<{ goodsReceiptId, warnings }>`** — create GR (draft) + lines; **apply yield** per line (FR27: `usable = received×yield`, `wastage = received−usable`, `adjustedCostPerUnit`); **FR114** implausibility (received > 150% of PO line qty when poId present) → require `reasonCode` else surface warning; **FR115** duplicate (same PO, same items/qty, same day) → warning with conflicting `grTrn`. Allocate `grTrn` via `trnService`.
- **`confirmGoodsReceipt(db, grId): Promise<…>`** — status-guarded `draft→confirmed`; for each line create a `stock_batch` (provisional=false) via `incrementStock`; `journalStubService.record` (DR Inventory — Raw Materials, CR Accounts Payable; FR89); `poProgressionStub`; audit.
- **`rejectGoodsReceipt(db, grId, reasons, evidence): Promise<…>`** — status-guarded `→rejected`; insert `gr_rejection_records` (mandatory reason); VCN deferred stub; audit. (FR47a.)
- **`recordAdjustment(db, input)` / `confirmAdjustment(db, adjId)`** — allocate `adjTrn`; compute `aggregateValueImpact`; if over threshold → `approvalEngine.createApprovalRequest` and status `pending_approval`; confirm applies per-line `delta` (positive → new batch / negative → FEFO decrement via the same lock path), writes `adjustment` movements + journal-stub (variance/write-off) + audit. (FR37, FR114.)
- **`recordClosingInventory(db, input)` / `confirmClosing(db, ciId)`** — `getExpectedClosingStock` (inventory-ledger-derived; cross-epic inputs stubbed 0); per-line variance; **reason mandatory when variance ≠ 0**; **FR114** implausibility (counted > opening+receipts−dispatches); cut-off status via `cut_off_registry`; confirm writes `closing_variance` movements + journal-stub + audit; status `confirmed`/`variance_flagged`. (FR35, FR36, FR77.)
- **`markVarianceAcceptable(db, ciId)`**, **`getClosingInventorySummary(db, scope, businessDate)`**, **`checkCutOffCompliance(db, scope, businessDate)`** (FR36; may enqueue `notificationCenter.send`).
- **`getExpiringBatches(db, scope, opts): Promise<…>`** — group `stock_batches` by 24h/48h/72h/>72h bands; counts + value-at-risk. (FR30.)
- **PAR:** `setParLevel(db, …)` / `bulkSetParLevel(db, …)` / `listBelowPar(db, scope)` (FR34: shortfall + suggested reorder = par − onhand; day-of-week-adjusted PAR from `dayOfWeekOverrides`). (FR33/FR34.)

### 4.4 `transferService`
- **`createDraft(db, input)`**, **`submitTransfer(db, transferId)`** — validates flow + enablement + cluster boundary (see §5); over-threshold → approval routing (`pending_approval`), else `approved`; on dispatch deducts source via the §4.3 FEFO lock path and writes `transfer_out` movement. Allocate `stTrn`.
- **`confirmReceipt(db, transferId, quantities, varianceReasons)`** — status-guarded `→received`; `incrementStock` at destination; `transfer_in` movement; audit. (Also serves transfer-driven GR SI-INV-011.)
- **`getTransferDetail(db, transferId)`**.
- **`createBundledTransfer(db, input)` / `confirmBundleApproval(db, bundleId)`** — `validateCrossClusterFlow` (raw materials route via Brand Store, §2.2); single bundled approval object (P2B-002); on approval decompose into two `stock_transfers`, each with its own `stTrn`.
- **`rankTransferSuggestions(db, batchId, scope)` / `suggestTransfers` / `dismissSuggestion`** — FR32, computed live; dismissals persisted.
- **`cancelTransfer(db, transferId)`** — pre-confirmation (`draft`/`pending_approval`) cancels cleanly; post-approval requires compensating doc (deferred to Arc-c `CCReverseCancelDialog` consumer / Epic 4 frontend; service exposes the guard). (FR117.)

---

## 5. Flow-rule enforcement (FR28 + §2.2 + DL-043)

`transferStock`/`submitTransfer` validate, in order, throwing `BusinessRuleError` subclasses on violation:
1. **Resolve cluster** of source & destination departments (department → location → cluster). **Cross-cluster → reject** (`ClusterBoundaryError`) — applies to all product types via `transferStock` (cross-cluster goes through the bundle workflow).
2. **Enablement** — destination department must have the item enabled (`checkEnablement`) → else `EnablementViolationError`.
3. **Product-type direction:**
   - **Raw** — **allowed dept→dept within cluster (DL-043)**; never to a store destination (N/A — destinations are departments); never cross-cluster (caught in step 1).
   - **Semi-product** — lateral within cluster only (same as step 1 guard; allowed).
   - **Final product** — only production→dispatch and dispatch→POS directions (validate `departments.type`/`locations.type` ordering); reject POS→POS lateral and any backward direction (`FlowDirectionError`).
4. **Sufficient FEFO stock** at source (checked during the locked deduction).

New error subclasses in `apps/api/src/errors/business-rule-error.ts`: `FlowDirectionError`, `ClusterBoundaryError` (both `extends BusinessRuleError`, HTTP 422). `EnablementViolationError`/`InsufficientStockError` already exist (add `InsufficientStockError` if absent — it is referenced by the §8.1 contract; verify and create under `business-rule-error.ts` or a dedicated file).

---

## 6. REST routes (`apps/api/src/routes/`, registered in `index.ts`)

Flat files, zod-validated, `req.db`/`req.user` guarded, `toValidationError` on ZodError (mirror `enablements.ts`). Success → `{ data }`; warn-and-log → `{ data, meta: { warnings:[…] } }`.
- `stock.ts` — `GET /stock/available?itemId&departmentId`, `GET /stock/expiring?scope`, `GET /stock/movements?…`.
- `goods-receipts.ts` — `POST /goods-receipts`, `POST /goods-receipts/:id/confirm`, `POST /goods-receipts/:id/reject`.
- `stock-transfers.ts` — `POST /stock-transfers`, `POST /stock-transfers/:id/submit`, `POST /stock-transfers/:id/confirm-receipt`, `POST /stock-transfers/:id/cancel`, `GET /stock-transfers/:id`; bundles under `/stock-transfers/bundles`; suggestions `GET /stock-transfers/suggestions?scope`, `POST /stock-transfers/suggestions/:id/dismiss`.
- `inventory-adjustments.ts` — `POST`, `POST /:id/confirm`, `POST /:id/cancel`.
- `closing-inventory.ts` — `POST`, `POST /:id/confirm`, `POST /:id/mark-variance-acceptable`, `GET /summary?scope&date`.
- `par-levels.ts` — `GET /par-levels?scope`, `POST /par-levels`, `POST /par-levels/bulk`, `GET /par-levels/below`.

(Action endpoints are POST per architecture §17.1; `deductStock` has **no public route** — it is an internal service method called by Epic 7.)

---

## 7. Integration tests (`apps/api/tests/integration/`, vitest)

Harness mirrors `approval-engine.test.ts`/`org.test.ts` (`tests/integration/setup.ts`, seeded brand/org/products/enablement). One file per area; required cases:
- **`inventory-deduct.test.ts`** — enablement gate blocks disabled deduct; FEFO picks earliest-expiry first; multi-batch walk; insufficient-stock throws + full rollback (no movement/journal/audit rows); concurrent deduct does not oversell (two parallel deducts on one batch → one succeeds / one `InsufficientStockError`); audit + journal-stub rows written same-tx; `newBalance` correct.
- **`goods-receipt.test.ts`** — yield math (received×yield = usable, wastage); confirm creates batch + bumps `stock_levels` + journal-stub; FR114 over-150% warning + reason override; FR115 same-day duplicate warning; reject records rejection + no stock created.
- **`stock-transfer.test.ts`** — semi-product lateral within cluster OK; **raw dept→dept within cluster OK (DL-043)**; cross-cluster rejected; final-product production→dispatch→POS OK, POS→POS rejected, backward rejected; destination-not-enabled rejected; receipt increments destination; cancel pre/post-approval guard; bundle decomposition into two TRNs.
- **`inventory-adjustment.test.ts`** — reason mandatory; over-threshold routes to approval; confirm applies signed delta; negative delta uses FEFO lock.
- **`closing-inventory.test.ts`** — expected from ledger; variance computed; reason mandatory when variance≠0; cut-off status; confirm writes variance movement + journal-stub; `markVarianceAcceptable`.
- **`par-levels.test.ts`** — base + day-of-week override resolution; below-PAR shortfall + suggested reorder.
- **`trn.test.ts`** — format `{TYPE}-{YYYY}-{LOC}-{SEQ}`; uniqueness; concurrent allocation yields distinct sequential values.

Runner: `npm test` (= `vitest run`) in `apps/api`. Tests require `fnberp_dev` migrated to 0013.

---

## 8. Build sequence (waves; commit per wave on the branch)

1. **W1 — Foundations + core engine:** enums; `trn_sequences`, `journal_events`, `stock_levels`, `stock_batches`, `stock_movements`; migration 0013 (constraints + RLS + FEFO/partial indexes hand-edited); `trnService`, `journalStubService`; `inventoryService.getAvailableStock/deductStock/incrementStock/getExpiringBatches`; error classes; `stock.ts` routes; deduct + trn tests.
2. **W2 — Goods receipt:** GR tables; record/confirm/reject (+ yield, FR114/FR115); `goods-receipts.ts`; GR tests.
3. **W3 — Transfers:** transfer + bundle + dismissal tables; `transferService` (flow rules §5, DL-043, bundles, suggestions); `stock-transfers.ts`; transfer tests.
4. **W4 — Adjustments + closing inventory:** tables; services (approval routing, variance, cut-off); routes; tests.
5. **W5 — PAR + below-PAR:** `par_levels`; service; routes; tests. Append DL-043/DL-044 to `decision-log.md`; update `codebase-inventory.md`.

Within a wave, independent table/service/test units fan out to parallel subagents under TDD; schema + migration land first (shared dependency).

**Migration discipline:** one migration `0013_epic4_inv.sql` (+ `0013_inv_rls.sql` if the precedent splits RLS) generated at W1 and amended as later waves add tables — OR per-wave migrations 0013–0017 if cleaner. Decide at W1 from the drizzle-kit output; record the choice in `decision-log.md`.

## 9. Definition of done
- `npm run typecheck` silent (zero `any`); `npm test` green; `npm run lint` clean; `npm run build` clean (all in `apps/api`).
- `decision-log.md` updated (DL-043, DL-044, + any build-time decisions DL-045+); `codebase-inventory.md` updated.
- PR opened from `phase-4/epic-4-inv-arc-a-backend` → `main` (no direct main commits). `## Current phase` in CLAUDE.md updated in the PR.
