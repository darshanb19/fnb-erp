/**
 * Inventory domain schema — Phase 4 Epic 1 Arc (a) Task A6 + Epic 4 Arc (a) W1 + W2 + W3
 *
 * Tables: uoms, products, product_uoms, categories, product_categories, enablement_matrix
 *         (Epic 4 W1) trn_sequences, journal_events, stock_levels, stock_batches, stock_movements
 *         (Epic 4 W2) gr_status_enum, goods_receipts, gr_lines, gr_attachments, gr_rejection_records
 *         (Epic 4 W3) transfer_status_enum, bundle_status_enum, leg_status_enum,
 *                     stock_transfers, stock_transfer_lines,
 *                     transfer_bundles, transfer_bundle_legs,
 *                     transfer_suggestion_dismissals
 *
 * Decisions bound:
 * - DL-023: Two-layer UOM — global registry (uoms) + per-product alternates (product_uoms)
 * - DL-026: Trigram index on products.name + categories.name for CC-DUPLICATE-WARN
 * - DL-013: enablement_matrix is a critical audit-trigger table
 * - DL-044: Arc (a) widened to full Epic 4 inventory backend
 * - DL-016: Pattern 1 (row-lock + FEFO) for deduction; FEFO composite index on stock_batches
 * - DL-043: Raw-material dept→dept transfers permitted within cluster
 * - W2: goods_receipts.po_id nullable uuid, NO FK (no purchase_orders table — Epic 5)
 * - W2: goods_receipts.transfer_id nullable uuid, NO FK here (stock_transfers defined in W3)
 * - W3: stock_transfers.bundle_leg_id ↔ transfer_bundle_legs mutual reference:
 *       both columns declared plain uuid (no Drizzle FK); FKs added via hand-edit in migration.
 */

import { text, boolean, numeric, integer, uuid, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';
import { departments, clusters, stores } from './org.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const productTypeEnum = pgEnum('product_type_enum', ['raw', 'semi_product', 'final']);
export const uomBaseEnum = pgEnum('uom_base_enum', ['mass', 'volume', 'count']);

// ---------------------------------------------------------------------------
// uoms — DL-023 layer 1: global UOM registry per brand
// Unique per (brand_id, code) — composite unique constraint added in 0004_inventory_constraints.sql
// ---------------------------------------------------------------------------

export const uoms = brandScopedTable('uoms', {
  code: text('code').notNull(),              // 'kg', 'g', 'l', 'ml', 'piece', 'dozen'
  displayName: text('display_name').notNull(),
  base: uomBaseEnum('base').notNull(),
  conversionToBaseFactor: numeric('conversion_to_base_factor', { precision: 18, scale: 9 }).notNull(),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// products
// Unique per (brand_id, sku) — composite unique constraint added in 0004_inventory_constraints.sql
// Trigram index on name — added in 0004_inventory_constraints.sql (DL-026 CC-DUPLICATE-WARN)
// ---------------------------------------------------------------------------

export const products = brandScopedTable('products', {
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  type: productTypeEnum('type').notNull(),
  defaultUomId: uuid('default_uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  standardYieldFactor: numeric('standard_yield_factor', { precision: 5, scale: 4 })
    .notNull()
    .default('1.0000'),
  shelfLifeDays: integer('shelf_life_days'),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// product_uoms — DL-023 layer 2: per-product alternate UOMs
// Unique per (brand_id, product_id, uom_id) — constraint in 0004_inventory_constraints.sql
// Partial unique index (is_default=true per product) — in 0004_inventory_constraints.sql
// Exactly one is_default=true per product is enforced in Task A7 service code.
// ---------------------------------------------------------------------------

export const productUoms = brandScopedTable('product_uoms', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  uomId: uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  factorToDefaultUom: numeric('factor_to_default_uom', { precision: 18, scale: 9 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});

// ---------------------------------------------------------------------------
// categories — two-level depth, M:N to products via product_categories
// Self-FK (parent_id → categories.id) added in 0004_inventory_constraints.sql
// Two-level depth enforced by trigger in 0004_inventory_constraints.sql
// Trigram index on name — added in 0004_inventory_constraints.sql (DL-026)
// ---------------------------------------------------------------------------

export const categories = brandScopedTable('categories', {
  parentId: uuid('parent_id'),  // self-FK; null = top-level; FK added in migration hand-edit
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// product_categories — M:N (FR7)
// Unique per (brand_id, product_id, category_id) — constraint in 0004_inventory_constraints.sql
// ---------------------------------------------------------------------------

export const productCategories = brandScopedTable('product_categories', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
});

// ---------------------------------------------------------------------------
// enablement_matrix — DL-013 critical table; auditTrigger: true
// UNIQUE per (brand_id, product_id, department_id) — constraint in 0004_inventory_constraints.sql
// Composite index on (brandId, productId, departmentId) for checkEnablement hot-path
// ---------------------------------------------------------------------------

export const enablementMatrix = brandScopedTable(
  'enablement_matrix',
  {
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    reason: text('reason'),
    lastModifiedBy: uuid('last_modified_by').references(() => users.id),
    lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  {
    auditTrigger: true,
    indexes: { brandProductDept: ['brandId', 'productId', 'departmentId'] },
  },
);

// ---------------------------------------------------------------------------
// Inferred types — Epic 1 tables
// ---------------------------------------------------------------------------

export type Uom = typeof uoms.$inferSelect;
export type NewUom = typeof uoms.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductUom = typeof productUoms.$inferSelect;
export type NewProductUom = typeof productUoms.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;

export type EnablementMatrixRow = typeof enablementMatrix.$inferSelect;
export type NewEnablementMatrixRow = typeof enablementMatrix.$inferInsert;

// ===========================================================================
// Epic 4 W1 — Core stock engine foundations
// ===========================================================================

// ---------------------------------------------------------------------------
// movement_type_enum — §3.1
// ---------------------------------------------------------------------------

export const movementTypeEnum = pgEnum('movement_type_enum', [
  'receipt',
  'consumption',
  'transfer_in',
  'transfer_out',
  'adjustment',
  'closing_variance',
]);

// ---------------------------------------------------------------------------
// trn_sequences — §3.7; atomic TRN allocator backing trnService
// Unique (brand_id, transaction_type, location_code, year) — hand-edited in migration
// ---------------------------------------------------------------------------

export const trnSequences = brandScopedTable('trn_sequences', {
  transactionType: text('transaction_type').notNull(),
  locationCode:   text('location_code').notNull(),
  year:           integer('year').notNull(),
  nextValue:      integer('next_value').notNull().default(1),
});

// ---------------------------------------------------------------------------
// journal_events — §3.7; accounting stub (Epic 10 consumes)
// ---------------------------------------------------------------------------

export const journalEvents = brandScopedTable('journal_events', {
  trnReference:    text('trn_reference'),
  eventType:       text('event_type').notNull(),
  debitAccount:    text('debit_account'),
  creditAccount:   text('credit_account'),
  amount:          numeric('amount', { precision: 18, scale: 4 }),
  sourceMovementId: uuid('source_movement_id'),  // no FK — movement may not exist yet at write time
  posted:          boolean('posted').notNull().default(false),
});

// ---------------------------------------------------------------------------
// stock_levels — §3.1; on-hand rollup; one row per (product, department)
// Unique (brand_id, product_id, department_id) — hand-edited in migration
// Index (brand_id, product_id, department_id) via options.indexes
// ---------------------------------------------------------------------------

export const stockLevels = brandScopedTable(
  'stock_levels',
  {
    productId:     uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    departmentId:  uuid('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    quantity:      numeric('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
    uomId:         uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  {
    indexes: { brandProductDept: ['brandId', 'productId', 'departmentId'] },
  },
);

// ---------------------------------------------------------------------------
// stock_batches — §3.1; FEFO source of truth
// Unique (brand_id, product_id, department_id, batch_number) — hand-edited in migration
// FEFO composite index (brand_id, product_id, department_id, expiry_date)
// Partial index WHERE quantity_remaining > 0 — hand-edited in migration
// ---------------------------------------------------------------------------

export const stockBatches = brandScopedTable(
  'stock_batches',
  {
    productId:         uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    departmentId:      uuid('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    batchNumber:       text('batch_number').notNull(),
    quantityRemaining: numeric('quantity_remaining', { precision: 18, scale: 4 }).notNull(),
    expiryDate:        date('expiry_date'),                  // nullable for non-perishables
    receivedDate:      date('received_date').notNull(),
    yieldFactor:       numeric('yield_factor', { precision: 5, scale: 4 }).notNull().default('1.0000'),
    costPerUnit:       numeric('cost_per_unit', { precision: 18, scale: 4 }).notNull().default('0'),
    uomId:             uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
    sourceType:        text('source_type').notNull(),        // 'goods_receipt|transfer|adjustment|opening'
    sourceRef:         uuid('source_ref'),                   // nullable FK to source doc
    provisional:       boolean('provisional').notNull().default(false),  // FR66
  },
  {
    // FEFO composite index — partial WHERE quantity_remaining > 0 is hand-edited in migration
    indexes: { fefo: ['brandId', 'productId', 'departmentId', 'expiryDate'] },
  },
);

// ---------------------------------------------------------------------------
// stock_movements — §3.1; append-only ledger (auditTrigger: false)
// Index (brand_id, product_id, department_id, created_at) for movement history (SI-INV-002)
// ---------------------------------------------------------------------------

export const stockMovements = brandScopedTable(
  'stock_movements',
  {
    productId:      uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    departmentId:   uuid('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    batchId:        uuid('batch_id').references(() => stockBatches.id, { onDelete: 'restrict' }),  // nullable for rollup-only
    movementType:   movementTypeEnum('movement_type').notNull(),
    quantityDelta:  numeric('quantity_delta', { precision: 18, scale: 4 }).notNull(),  // signed: + in, − out
    uomId:          uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
    sourceType:     text('source_type').notNull(),
    sourceId:       uuid('source_id').notNull(),
    destType:       text('dest_type'),
    destId:         uuid('dest_id'),
    reason:         text('reason'),
    reasonCode:     text('reason_code'),
    trnReference:   text('trn_reference'),
    journalEventId: uuid('journal_event_id').references(() => journalEvents.id, { onDelete: 'restrict' }),  // nullable
    actorUserId:    uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
  },
  {
    // Movement history index (SI-INV-002)
    indexes: { brandProductDeptCreatedAt: ['brandId', 'productId', 'departmentId', 'createdAt'] },
  },
);

// ---------------------------------------------------------------------------
// Inferred types — Epic 4 W1 tables
// ---------------------------------------------------------------------------

export type TrnSequence = typeof trnSequences.$inferSelect;
export type NewTrnSequence = typeof trnSequences.$inferInsert;

export type JournalEvent = typeof journalEvents.$inferSelect;
export type NewJournalEvent = typeof journalEvents.$inferInsert;

export type StockLevel = typeof stockLevels.$inferSelect;
export type NewStockLevel = typeof stockLevels.$inferInsert;

export type StockBatch = typeof stockBatches.$inferSelect;
export type NewStockBatch = typeof stockBatches.$inferInsert;

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

// ===========================================================================
// Epic 4 W2 — Goods Receipt tables
// ===========================================================================

// ---------------------------------------------------------------------------
// gr_status_enum — §3.2
// ---------------------------------------------------------------------------

export const grStatusEnum = pgEnum('gr_status_enum', [
  'draft',
  'confirmed',
  'pending_approval',
  'rejected',
]);

// ---------------------------------------------------------------------------
// goods_receipts — §3.2
// Unique (brand_id, gr_trn) — hand-edited in migration
// po_id: nullable uuid, NO FK (no purchase_orders table — Epic 5)
// transfer_id: nullable uuid, NO FK (stock_transfers defined in W3)
// ---------------------------------------------------------------------------

export const goodsReceipts = brandScopedTable(
  'goods_receipts',
  {
    grTrn:                    text('gr_trn').notNull(),
    poId:                     uuid('po_id'),                         // nullable; no FK — Epic 5
    transferId:               uuid('transfer_id'),                   // nullable; no FK — W3 adds FK
    destinationDepartmentId:  uuid('destination_department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    status:                   grStatusEnum('status').notNull().default('draft'),
    receivedByUserId:         uuid('received_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    receivedAt:               timestamp('received_at', { withTimezone: true }),
    warningCount:             integer('warning_count').notNull().default(0),  // I1: warnings recorded at receipt time; > 0 → reasonCode required on confirm
  },
  {
    indexes: { brandGrTrn: ['brandId', 'grTrn'] },
  },
);

// ---------------------------------------------------------------------------
// gr_lines — §3.2 (one row per product per GR)
// usableQty computed = receivedQty × yieldFactor (stored, computed in service)
// wastageQty computed = receivedQty − usableQty (stored, computed in service)
// adjustedCostPerUnit = unitCost / yieldFactor
// ---------------------------------------------------------------------------

export const grLines = brandScopedTable('gr_lines', {
  goodsReceiptId:        uuid('goods_receipt_id').notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  productId:             uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  receivedQty:           numeric('received_qty', { precision: 18, scale: 4 }).notNull(),
  yieldFactor:           numeric('yield_factor', { precision: 5, scale: 4 }).notNull().default('1.0000'),
  usableQty:             numeric('usable_qty', { precision: 18, scale: 4 }).notNull(),   // stored; received × yield
  wastageQty:            numeric('wastage_qty', { precision: 18, scale: 4 }).notNull(),  // stored; received − usable
  unitCost:              numeric('unit_cost', { precision: 18, scale: 4 }),
  adjustedCostPerUnit:   numeric('adjusted_cost_per_unit', { precision: 18, scale: 4 }), // unitCost / yieldFactor
  expiryDate:            date('expiry_date'),
  batchNumber:           text('batch_number'),
  varianceQty:           numeric('variance_qty', { precision: 18, scale: 4 }),            // transfer-driven variance
  reasonCode:            text('reason_code'),
});

// ---------------------------------------------------------------------------
// gr_attachments — §3.2 (FR39 file attachments)
// ---------------------------------------------------------------------------

export const grAttachments = brandScopedTable('gr_attachments', {
  goodsReceiptId:  uuid('goods_receipt_id').notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  fileId:          uuid('file_id'),   // Epic 3 files surface — no FK constraint yet
  kind:            text('kind').notNull(),  // 'photo' | 'document'
});

// ---------------------------------------------------------------------------
// gr_rejection_records — §3.2 (FR47a)
// vcnDeferred = true marks that VCN auto-draft is deferred to Epic 5
// ---------------------------------------------------------------------------

export const grRejectionRecords = brandScopedTable('gr_rejection_records', {
  goodsReceiptId:        uuid('goods_receipt_id').notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  rejectionReasonCode:   text('rejection_reason_code').notNull(),
  notes:                 text('notes'),
  rejectedByUserId:      uuid('rejected_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  rejectedAt:            timestamp('rejected_at', { withTimezone: true }).notNull(),
  vcnDeferred:           boolean('vcn_deferred').notNull().default(true),  // TODO(Epic 5): VCN auto-draft
});

// ---------------------------------------------------------------------------
// Inferred types — Epic 4 W2 tables
// ---------------------------------------------------------------------------

export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert;

export type GrLine = typeof grLines.$inferSelect;
export type NewGrLine = typeof grLines.$inferInsert;

export type GrAttachment = typeof grAttachments.$inferSelect;
export type NewGrAttachment = typeof grAttachments.$inferInsert;

export type GrRejectionRecord = typeof grRejectionRecords.$inferSelect;
export type NewGrRejectionRecord = typeof grRejectionRecords.$inferInsert;

// ===========================================================================
// Epic 4 W3 — Stock Transfer tables
// ===========================================================================

// ---------------------------------------------------------------------------
// transfer_status_enum — §3.3
// ---------------------------------------------------------------------------

export const transferStatusEnum = pgEnum('transfer_status_enum', [
  'draft',
  'pending_approval',
  'approved',
  'in_transit',
  'received',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// bundle_status_enum — §3.3
// ---------------------------------------------------------------------------

export const bundleStatusEnum = pgEnum('bundle_status_enum', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
]);

// ---------------------------------------------------------------------------
// leg_status_enum — §3.3
// ---------------------------------------------------------------------------

export const legStatusEnum = pgEnum('leg_status_enum', [
  'pending',
  'in_transit',
  'received',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// stock_transfers — §3.3
// Unique (brand_id, st_trn) — hand-edited in migration.
// bundle_leg_id: plain uuid (no Drizzle FK) — mutual reference with transfer_bundle_legs;
//   FK added via hand-edit in 0015_inv_transfers.sql after both tables exist.
// ---------------------------------------------------------------------------

export const stockTransfers = brandScopedTable(
  'stock_transfers',
  {
    stTrn:                    text('st_trn').notNull(),
    sourceDepartmentId:       uuid('source_department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    destinationDepartmentId:  uuid('destination_department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    status:                   transferStatusEnum('status').notNull().default('draft'),
    reasonCode:               text('reason_code'),
    bundleLegId:              uuid('bundle_leg_id'),   // plain uuid — FK added via hand-edit (mutual reference)
    requestedByUserId:        uuid('requested_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    requestedAt:              timestamp('requested_at', { withTimezone: true }),
    approvalRequestId:        uuid('approval_request_id'),   // nullable — Epic 3 link; no Drizzle FK (cross-domain)
  },
  {
    indexes: { brandStTrn: ['brandId', 'stTrn'] },
  },
);

// ---------------------------------------------------------------------------
// stock_transfer_lines — §3.3
// ---------------------------------------------------------------------------

export const stockTransferLines = brandScopedTable('stock_transfer_lines', {
  stockTransferId:  uuid('stock_transfer_id').notNull().references(() => stockTransfers.id, { onDelete: 'cascade' }),
  productId:        uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  requestedQty:     numeric('requested_qty', { precision: 18, scale: 4 }).notNull(),
  fulfilledQty:     numeric('fulfilled_qty', { precision: 18, scale: 4 }),
  sourceBatchId:    uuid('source_batch_id').references(() => stockBatches.id, { onDelete: 'restrict' }),
  reasonCode:       text('reason_code'),
});

// ---------------------------------------------------------------------------
// transfer_bundles — §3.3 (SI-INV-007, P2B-002)
// Unique (brand_id, bundle_ref) — hand-edited in migration.
// ---------------------------------------------------------------------------

export const transferBundles = brandScopedTable(
  'transfer_bundles',
  {
    bundleRef:              text('bundle_ref').notNull(),
    originatingClusterId:   uuid('originating_cluster_id').notNull().references(() => clusters.id, { onDelete: 'restrict' }),
    destinationClusterId:   uuid('destination_cluster_id').notNull().references(() => clusters.id, { onDelete: 'restrict' }),
    status:                 bundleStatusEnum('status').notNull().default('draft'),
    approvalRequestId:      uuid('approval_request_id'),   // nullable — Epic 3 link; no Drizzle FK
  },
  {
    indexes: { brandBundleRef: ['brandId', 'bundleRef'] },
  },
);

// ---------------------------------------------------------------------------
// transfer_bundle_legs — §3.3
// transferBundleId FK defined normally; stockTransferId plain uuid (filled when bundle decomposes).
// ---------------------------------------------------------------------------

export const transferBundleLegs = brandScopedTable('transfer_bundle_legs', {
  transferBundleId:  uuid('transfer_bundle_id').notNull().references(() => transferBundles.id, { onDelete: 'cascade' }),
  legNo:             integer('leg_no').notNull(),  // 1 = source→brand store return, 2 = brand store→dest draw
  fromStoreId:       uuid('from_store_id').references(() => stores.id, { onDelete: 'restrict' }),
  toStoreId:         uuid('to_store_id').references(() => stores.id, { onDelete: 'restrict' }),
  status:            legStatusEnum('status').notNull().default('pending'),
});

// ---------------------------------------------------------------------------
// transfer_suggestion_dismissals — §3.3 (FR32)
// Suggestions are computed live; only dismissals persist.
// ---------------------------------------------------------------------------

export const transferSuggestionDismissals = brandScopedTable('transfer_suggestion_dismissals', {
  productId:           uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  batchId:             uuid('batch_id').references(() => stockBatches.id, { onDelete: 'restrict' }),
  dismissedByUserId:   uuid('dismissed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  dismissedAt:         timestamp('dismissed_at', { withTimezone: true }).notNull(),
  reasonCode:          text('reason_code'),
});

// ---------------------------------------------------------------------------
// Inferred types — Epic 4 W3 tables
// ---------------------------------------------------------------------------

export type StockTransfer = typeof stockTransfers.$inferSelect;
export type NewStockTransfer = typeof stockTransfers.$inferInsert;

export type StockTransferLine = typeof stockTransferLines.$inferSelect;
export type NewStockTransferLine = typeof stockTransferLines.$inferInsert;

export type TransferBundle = typeof transferBundles.$inferSelect;
export type NewTransferBundle = typeof transferBundles.$inferInsert;

export type TransferBundleLeg = typeof transferBundleLegs.$inferSelect;
export type NewTransferBundleLeg = typeof transferBundleLegs.$inferInsert;

export type TransferSuggestionDismissal = typeof transferSuggestionDismissals.$inferSelect;
export type NewTransferSuggestionDismissal = typeof transferSuggestionDismissals.$inferInsert;
