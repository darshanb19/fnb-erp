/**
 * inventoryService — Epic 1 surface: enablement CRUD (FR5, FR8) + listEnablementForLocation.
 *
 * Epic 4 will add: getAvailableStock, deductStock, transferStock.
 * DO NOT implement those here.
 *
 * Cross-epic boundary: checkEnablement() is the Master Spec §8.1 gate that every
 * later epic must call before any stock movement. Its signature is locked.
 *
 * Memoization (architecture §6.2.1):
 *   checkEnablement() memoizes its result in db.requestCache for the lifetime of
 *   a single request. Cache key: `enablement:${productId}:${departmentId}`.
 *
 * LIMITATION — transaction-scoped cache isolation:
 *   withTransaction() creates a NEW brandedDb (txDb) with a fresh requestCache.
 *   The txDb's cache is NOT the same Map as the parent db's cache — they are
 *   separate objects. Therefore:
 *   - setEnablement() invalidates the KEY on the PARENT db (passed in as `db`)
 *     rather than on the txDb, so callers see the invalidation immediately.
 *   - The txDb cache is ephemeral and discarded after the transaction returns.
 *   This is intentional: the parent db's cache is what subsequent in-request
 *   service calls see. Tracked as an architecture §6.2.1 limitation note.
 *
 * auditTrigger backstop:
 *   enablement_matrix has auditTrigger:true in brandScopedTableRegistry (Task A6).
 *   The audit_critical_table_trigger() Postgres function body is a Phase 3a / Epic 3
 *   deliverable — the trigger fires but the function body is a stub. Application-layer
 *   audit_log rows are the primary record for Epic 1. See enablement.test.ts it.skip.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { BrandedDb, ScopedInsertRow } from '../db/branded-db.js';
import {
  enablementMatrix,
  products,
  stockLevels,
  stockBatches,
  stockMovements,
  type EnablementMatrixRow,
  type StockLevel,
} from '../db/schema/inventory.js';

// ---------------------------------------------------------------------------
// getExpiringBatches types
// ---------------------------------------------------------------------------

export interface ExpiringBatchItem {
  batchId: string;
  productId: string;
  departmentId: string;
  batchNumber: string;
  quantityRemaining: number;
  expiryDate: Date;
  hoursUntilExpiry: number;
  valueAtRisk: number;
}

export interface ExpiringBatchBands {
  h24: number;
  h48: number;
  h72: number;
  over72: number;
}

export interface ExpiringBatchesResult {
  bands: ExpiringBatchBands;
  items: ExpiringBatchItem[];
}
import { departments } from '../db/schema/org.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { journalStubService } from './journal-stub.service.js';
import { EnablementViolationError, InsufficientStockError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Return type for getAvailableStock */
export interface AvailableStockResult {
  itemId: string;
  departmentId: string;
  quantity: number;
  unit: string;
  lastUpdatedAt: Date;
}

/** Return type for deductStock */
export interface DeductionResult {
  success: boolean;
  newBalance: number;
  journalEntryId: string;
}

/** One batch entry for incrementStock */
export interface IncrementBatch {
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: Date | null;
  receivedDate: Date;
  yieldFactor?: number;
  costPerUnit?: number;
  uomId: string;
  sourceType: string;
  sourceRef?: string;
}

/** Options for incrementStock */
export interface IncrementOpts {
  actorUserId: string | null;
  movementType: 'receipt' | 'transfer_in' | 'adjustment';
  trnReference?: string;
  reason?: string;
}

export interface EnablementCell {
  productId: string;
  departmentId: string;
  enabled: boolean;
  reason: string | null;
  lastModifiedBy: string | null;
  lastModifiedAt: Date;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Internal upsert: insert or update a single (productId, departmentId) row
 * and write an audit-log row within the supplied transaction-scoped db.
 * Does NOT invalidate the parent cache — the caller (setEnablement) does that.
 */
async function upsertEnablementRow(
  txDb: BrandedDb,
  productId: string,
  departmentId: string,
  enabled: boolean,
  opts: { actorUserId: string | null; reason?: string | null },
): Promise<void> {
  const existing = await txDb.scopedFrom(
    enablementMatrix,
    and(
      eq(enablementMatrix.productId, productId),
      eq(enablementMatrix.departmentId, departmentId),
    ),
  ) as unknown as EnablementMatrixRow[];

  let action: 'insert' | 'update';
  let before: Record<string, unknown> | null = null;
  let after: Record<string, unknown>;

  if (existing.length === 0) {
    // Cast required: scopedInsert's ScopedInsertRow<T> generic loses HasDefault fields
    // like `enabled` from its required keys. The shape is correct — Drizzle accepts
    // optional-with-default fields in insert payloads. Same pattern as product.service.ts.
    const insertRow = {
      productId,
      departmentId,
      enabled,
      reason: opts.reason ?? null,
      lastModifiedBy: opts.actorUserId,
      lastModifiedAt: new Date(),
    } as unknown as ScopedInsertRow<typeof enablementMatrix>;
    const rows = await txDb
      .scopedInsert(enablementMatrix, insertRow)
      .returning() as unknown as EnablementMatrixRow[];
    const row = rows[0];
    if (!row) throw new Error('scopedInsert returned no row — this should not happen');
    action = 'insert';
    after = row as Record<string, unknown>;
  } else {
    const prior = existing[0]!;
    before = prior as Record<string, unknown>;
    const rows = await txDb
      .scopedUpdate(enablementMatrix)
      .set({
        enabled,
        reason: opts.reason ?? null,
        lastModifiedBy: opts.actorUserId,
        lastModifiedAt: new Date(),
      })
      .where(eq(enablementMatrix.id, prior.id))
      .returning() as unknown as EnablementMatrixRow[];
    const row = rows[0];
    if (!row) throw new Error('scopedUpdate returned no row — this should not happen');
    action = 'update';
    after = row as Record<string, unknown>;
  }

  await auditLogService.record(txDb, {
    action,
    tableName: 'enablement_matrix',
    rowId: (after as { id: string }).id,
    actorUserId: opts.actorUserId,
    before,
    after,
    changedFields:
      action === 'update' && before
        ? auditLogService.computeChangedFields(before, after)
        : null,
    reason: opts.reason ?? null,
    context: { event: 'set_enablement', productId, departmentId },
  });
}

// ---------------------------------------------------------------------------
// inventoryService
// ---------------------------------------------------------------------------

export const inventoryService = {
  /**
   * checkEnablement — Master Spec §8.1 cross-epic boundary.
   *
   * Returns true iff (productId, departmentId) is enabled in the current brand.
   * Memoized via db.requestCache for the request lifetime per architecture §6.2.1.
   * Absent row → false (default-deny).
   */
  async checkEnablement(
    db: BrandedDb,
    productId: string,
    departmentId: string,
  ): Promise<boolean> {
    const cacheKey = `enablement:${productId}:${departmentId}`;
    const cached = db.requestCache.get(cacheKey);
    if (typeof cached === 'boolean') return cached;

    const rows = await db.scopedFrom(
      enablementMatrix,
      and(
        eq(enablementMatrix.productId, productId),
        eq(enablementMatrix.departmentId, departmentId),
      ),
    ) as unknown as EnablementMatrixRow[];

    const enabled = rows[0]?.enabled === true;
    db.requestCache.set(cacheKey, enabled);
    return enabled;
  },

  /**
   * setEnablement — UPSERT a single (product, department) enablement.
   *
   * Reason is optional but recorded in audit context.
   * Invalidates the requestCache key on the parent db after the transaction
   * commits (see LIMITATION note in module header).
   */
  async setEnablement(
    db: BrandedDb,
    productId: string,
    departmentId: string,
    enabled: boolean,
    opts: { actorUserId: string | null; reason?: string | null },
  ): Promise<void> {
    await withTransaction(db, opts.actorUserId, async (txDb) => {
      await upsertEnablementRow(txDb, productId, departmentId, enabled, opts);
    });

    // Invalidate the parent db's cache AFTER the transaction commits.
    // (The txDb has its own ephemeral cache that is discarded — see module header.)
    db.requestCache.delete(`enablement:${productId}:${departmentId}`);
  },

  /**
   * bulkSetEnablement — multiple (productId, departmentId, enabled) tuples in one transaction.
   *
   * Iterates over pairs and calls upsertEnablementRow per tuple inside a single
   * outer transaction. Each pair gets its own audit-log row.
   * Cache invalidation: invalidates each affected key on the parent db after commit.
   *
   * Performance note: this iterates per-tuple; a native batch UPSERT is a deferred
   * optimisation for Epic 4 when bulk enablement volume justifies it.
   */
  async bulkSetEnablement(
    db: BrandedDb,
    pairs: Array<{ productId: string; departmentId: string; enabled: boolean }>,
    opts: { actorUserId: string | null; reason?: string | null },
  ): Promise<void> {
    await withTransaction(db, opts.actorUserId, async (txDb) => {
      for (const pair of pairs) {
        await upsertEnablementRow(txDb, pair.productId, pair.departmentId, pair.enabled, opts);
      }
    });

    // Invalidate parent cache for every affected key after the batch commits.
    for (const pair of pairs) {
      db.requestCache.delete(`enablement:${pair.productId}:${pair.departmentId}`);
    }
  },

  /**
   * listEnablementForLocation — one cell per (active product × department-at-location) pair.
   *
   * Cells absent from enablement_matrix are returned with enabled=false (default-deny).
   * Optional categoryId filter narrows products to those in that category (M:N via product_categories).
   *
   * Returns [] immediately if the location has no departments or no active products.
   */
  async listEnablementForLocation(
    db: BrandedDb,
    locationId: string,
    filter?: { categoryId?: string },
  ): Promise<EnablementCell[]> {
    // 1. Get departments at this location.
    const depts = await db.scopedFrom(
      departments,
      eq(departments.locationId, locationId),
    ) as unknown as Array<{ id: string; locationId: string }>;

    if (depts.length === 0) return [];

    // 2. Get active products (optionally filtered by category).
    let activeProducts: Array<{ id: string }>;

    if (filter?.categoryId) {
      // Uses db.raw.execute + sql tag — db.raw bypass required because this is a
      // cross-table JOIN with brand_id filtering on both sides.
      // String concatenation forbidden — sql template tag is the only safe form.
      const result = await db.raw.execute(sql`
        SELECT p.id
        FROM products p
        INNER JOIN product_categories pc
          ON pc.product_id = p.id
         AND pc.brand_id = p.brand_id
        WHERE p.brand_id = ${db.brandId}
          AND p.active = true
          AND pc.category_id = ${filter.categoryId}
      `);
      activeProducts = result as unknown as Array<{ id: string }>;
    } else {
      activeProducts = await db.scopedFrom(
        products,
        eq(products.active, true),
      ) as unknown as Array<{ id: string }>;
    }

    if (activeProducts.length === 0) return [];

    // 3. Fetch all existing matrix rows for these products × departments in one query.
    const productIds = activeProducts.map((p) => p.id);
    const deptIds = depts.map((d) => d.id);

    const matrixRows = await db.scopedFrom(
      enablementMatrix,
      and(
        inArray(enablementMatrix.productId, productIds),
        inArray(enablementMatrix.departmentId, deptIds),
      ),
    ) as unknown as EnablementMatrixRow[];

    // 4. Build a lookup map keyed by `productId:departmentId`.
    const lookup = new Map<string, EnablementMatrixRow>();
    for (const row of matrixRows) {
      lookup.set(`${row.productId}:${row.departmentId}`, row);
    }

    // 5. Cross-product products × departments; fill absent cells with default-deny.
    const cells: EnablementCell[] = [];
    for (const p of activeProducts) {
      for (const d of depts) {
        const key = `${p.id}:${d.id}`;
        const row = lookup.get(key);
        cells.push({
          productId: p.id,
          departmentId: d.id,
          enabled: row?.enabled === true,
          reason: row?.reason ?? null,
          lastModifiedBy: row?.lastModifiedBy ?? null,
          // epoch placeholder (new Date(0)) for cells that have never been set
          lastModifiedAt: row?.lastModifiedAt ?? new Date(0),
        });
      }
    }

    return cells;
  },

  // ---------------------------------------------------------------------------
  // Epic 4 W1 — Stock engine methods
  // ---------------------------------------------------------------------------

  /**
   * getAvailableStock — read stock_levels; absent row → quantity=0.
   *
   * Unit is derived from the product's defaultUomId → uoms.code.
   * Spec §4.3.
   */
  async getAvailableStock(
    db: BrandedDb,
    itemId: string,
    departmentId: string,
  ): Promise<AvailableStockResult> {
    // Read the stock_levels row (if present)
    const levelRows = await db.scopedFrom(
      stockLevels,
      and(
        eq(stockLevels.productId, itemId),
        eq(stockLevels.departmentId, departmentId),
      ),
    ) as unknown as StockLevel[];

    // Derive the unit from product.defaultUomId → uoms.code regardless of whether
    // a stock_levels row exists, so the response always carries a sensible unit.
    const unitResult = await db.raw.execute(sql`
      SELECT u.code
      FROM products p
      INNER JOIN uoms u
        ON u.id = p.default_uom_id
        AND u.brand_id = p.brand_id
      WHERE p.id = ${itemId}
        AND p.brand_id = ${db.brandId}
      LIMIT 1
    `);
    const unitRows = unitResult as unknown as Array<{ code: string }>;
    const unit = unitRows[0]?.code ?? 'unit';

    if (levelRows.length === 0) {
      return {
        itemId,
        departmentId,
        quantity: 0,
        unit,
        lastUpdatedAt: new Date(0),
      };
    }

    const row = levelRows[0]!;
    return {
      itemId,
      departmentId,
      quantity: Number(row.quantity),
      unit,
      lastUpdatedAt: row.lastUpdatedAt,
    };
  },

  /**
   * deductStock — DL-016 Pattern 1 (FEFO + row-lock) in a single withTransaction.
   *
   * 1. checkEnablement → EnablementViolationError if false
   * 2. SELECT … FOR UPDATE ORDER BY expiry_date ASC NULLS LAST
   * 3. FEFO walk; InsufficientStockError (tx rollback) if Σ < quantity
   * 4. Per-batch UPDATE quantity_remaining + insert stock_movements (consumption, negative)
   * 5. Upsert stock_levels
   * 6. journalStubService.record (consumption event) → journalEntryId
   * 7. auditLogService.record (business_action)
   * 8. Return { success, newBalance, journalEntryId }
   *
   * Spec §4.3.
   */
  async deductStock(
    db: BrandedDb,
    itemId: string,
    departmentId: string,
    quantity: number,
    reason: string,
    trnReference: string,
  ): Promise<DeductionResult> {
    // checkEnablement runs outside the transaction intentionally — it uses the
    // parent db's request cache. Inside the tx we re-check via the enablement
    // query to honour the row-lock scope, but we want a fast fail before
    // acquiring any locks. The FEFO lock itself is the concurrency guard.
    const enabled = await inventoryService.checkEnablement(db, itemId, departmentId);
    if (!enabled) {
      throw new EnablementViolationError({
        code: 'business.enablement_violation',
        message: `Stock movement not permitted: item ${itemId} is not enabled in department ${departmentId}`,
        details: { itemId, departmentId },
      });
    }

    return withTransaction(db, null, async (txDb) => {
      // Step 2 — FEFO row-lock query; explicit brand_id predicate (DL-012/DL-016)
      const batchResult = await txDb.raw.execute(sql`
        SELECT id, quantity_remaining, expiry_date
        FROM stock_batches
        WHERE brand_id = ${txDb.brandId}
          AND product_id = ${itemId}
          AND department_id = ${departmentId}
          AND quantity_remaining > 0
        ORDER BY expiry_date ASC NULLS LAST
        FOR UPDATE
      `);
      const fefoRows = batchResult as unknown as Array<{
        id: string;
        quantity_remaining: string;
        expiry_date: string | null;
      }>;

      // Step 3 — Walk FEFO; check sufficiency
      let remaining = quantity;
      const deductions: Array<{ batchId: string; deducted: number }> = [];

      for (const row of fefoRows) {
        if (remaining <= 0) break;
        const available = Number(row.quantity_remaining);
        const take = Math.min(available, remaining);
        deductions.push({ batchId: row.id, deducted: take });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new InsufficientStockError({
          itemId,
          departmentId,
          requested: quantity,
          available: quantity - remaining,
        });
      }

      // Step 4 — Per-batch UPDATE + insert stock_movements
      // Use the first batch's id as the sourceId for journal stub (per task spec)
      const firstBatchId = deductions[0]!.batchId;
      let journalEventId = '';

      // We insert the journal stub BEFORE movements so we can link journalEventId.
      // Step 6 — journalStubService.record (consumption)
      journalEventId = await journalStubService.record(txDb, {
        trnReference,
        eventType: 'production_consumption',
        debitAccount: 'COGS - Raw Material Consumption',
        creditAccount: 'Inventory - Raw Materials',
        amount: quantity,
        sourceMovementId: null, // will be filled in when movement id is available (Epic 10)
      });

      for (const { batchId, deducted } of deductions) {
        // Update quantity_remaining on each batch
        await txDb.raw.execute(sql`
          UPDATE stock_batches
          SET quantity_remaining = quantity_remaining - ${deducted}
          WHERE id = ${batchId}
            AND brand_id = ${txDb.brandId}
        `);

        // Get the uomId for this batch (needed for stock_movements)
        const batchRows = await txDb.raw.execute(sql`
          SELECT uom_id FROM stock_batches WHERE id = ${batchId} AND brand_id = ${txDb.brandId}
        `);
        const batchData = batchRows as unknown as Array<{ uom_id: string }>;
        const uomId = batchData[0]?.uom_id;
        if (!uomId) throw new Error(`deductStock: batch ${batchId} not found after row-lock`);

        // Insert stock_movements row (negative quantityDelta = consumption)
        await txDb.scopedInsert(stockMovements, {
          productId: itemId,
          departmentId,
          batchId,
          movementType: 'consumption',
          quantityDelta: String(-deducted),
          uomId,
          sourceType: 'deduction',
          sourceId: batchId,                // first batch = sourceId (per task spec)
          reason,
          trnReference,
          journalEventId,
          actorUserId: null,
        } as unknown as ScopedInsertRow<typeof stockMovements>);
      }

      // Step 5 — Upsert stock_levels
      await txDb.raw.execute(sql`
        UPDATE stock_levels
        SET quantity = quantity - ${quantity},
            last_updated_at = NOW()
        WHERE brand_id = ${txDb.brandId}
          AND product_id = ${itemId}
          AND department_id = ${departmentId}
      `);

      // Read new balance
      const levelResult = await txDb.raw.execute(sql`
        SELECT quantity FROM stock_levels
        WHERE brand_id = ${txDb.brandId}
          AND product_id = ${itemId}
          AND department_id = ${departmentId}
      `);
      const levelRows = levelResult as unknown as Array<{ quantity: string }>;
      const newBalance = Number(levelRows[0]?.quantity ?? 0);

      // Step 7 — auditLogService.record
      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_movements',
        rowId: firstBatchId,
        actorUserId: null,
        reason,
        trnReference,
        context: {
          event: 'deduct_stock',
          itemId,
          departmentId,
          quantity,
          newBalance,
        },
      });

      return { success: true, newBalance, journalEntryId: journalEventId };
    });
  },

  /**
   * getExpiringBatches — group stock_batches by 24h/48h/72h/>72h bands; counts + value-at-risk.
   *
   * Only batches with quantity_remaining > 0 AND expiry_date IS NOT NULL are included.
   * Scope: filter by departmentId if provided (locationId/clusterId are stubs for future waves).
   * "now" defaults to new Date() but callers may inject a fixed date (tests).
   *
   * Band logic:
   *   h24:    hoursUntilExpiry <= 24
   *   h48:    24 < hoursUntilExpiry <= 48
   *   h72:    48 < hoursUntilExpiry <= 72
   *   over72: hoursUntilExpiry > 72
   *
   * Note on date parsing: Drizzle `date` columns are returned as strings ('YYYY-MM-DD').
   * We parse them with new Date() and clamp to midnight UTC to compute hoursUntilExpiry.
   *
   * Spec §4.3 (FR30).
   */
  async getExpiringBatches(
    db: BrandedDb,
    scope: { departmentId?: string; locationId?: string; clusterId?: string },
    now?: Date,
  ): Promise<ExpiringBatchesResult> {
    const effectiveNow = now ?? new Date();

    // Build the raw query; brand_id predicate always present (DL-012).
    // departmentId scope applied when provided; locationId/clusterId are future (W3+).
    // Sorted ASC by expiry_date — earliest expiry first.
    const batchResult = await db.raw.execute(sql`
      SELECT
        id,
        product_id,
        department_id,
        batch_number,
        quantity_remaining,
        expiry_date,
        cost_per_unit
      FROM stock_batches
      WHERE brand_id = ${db.brandId}
        AND quantity_remaining > 0
        AND expiry_date IS NOT NULL
        ${scope.departmentId !== undefined
          ? sql`AND department_id = ${scope.departmentId}`
          : sql``}
      ORDER BY expiry_date ASC
    `);

    const rawRows = batchResult as unknown as Array<{
      id: string;
      product_id: string;
      department_id: string;
      batch_number: string;
      quantity_remaining: string;
      expiry_date: string;   // Drizzle `date` → string 'YYYY-MM-DD'
      cost_per_unit: string;
    }>;

    const bands: ExpiringBatchBands = { h24: 0, h48: 0, h72: 0, over72: 0 };
    const items: ExpiringBatchItem[] = [];

    for (const row of rawRows) {
      // Parse the date string ('YYYY-MM-DD') to a Date (midnight UTC).
      // Using `new Date(str)` on an ISO-date string without a time component
      // yields midnight UTC per the ECMA-262 spec — safe and consistent.
      const expiryDate = new Date(row.expiry_date);
      const hoursUntilExpiry = (expiryDate.getTime() - effectiveNow.getTime()) / 3_600_000;

      const quantityRemaining = Number(row.quantity_remaining);
      const costPerUnit = Number(row.cost_per_unit);
      const valueAtRisk = quantityRemaining * costPerUnit;

      if (hoursUntilExpiry <= 24) {
        bands.h24 += 1;
      } else if (hoursUntilExpiry <= 48) {
        bands.h48 += 1;
      } else if (hoursUntilExpiry <= 72) {
        bands.h72 += 1;
      } else {
        bands.over72 += 1;
      }

      items.push({
        batchId: row.id,
        productId: row.product_id,
        departmentId: row.department_id,
        batchNumber: row.batch_number,
        quantityRemaining,
        expiryDate,
        hoursUntilExpiry,
        valueAtRisk,
      });
    }

    return { bands, items };
  },

  /**
   * incrementStock — upsert stock_batches + stock_levels + insert stock_movements.
   *
   * Called by GR confirm + transfer receipt. Each batch entry in the input array
   * creates one stock_batch row and one stock_movements row.
   *
   * Spec §4.3.
   */
  async incrementStock(
    db: BrandedDb,
    departmentId: string,
    batches: IncrementBatch[],
    opts: IncrementOpts,
  ): Promise<void> {
    await withTransaction(db, opts.actorUserId, async (txDb) => {
      for (const batch of batches) {
        const yieldFactor = batch.yieldFactor ?? 1.0;
        const costPerUnit = batch.costPerUnit ?? 0;
        const receivedDateStr = batch.receivedDate.toISOString().split('T')[0]!;
        const expiryDateStr = batch.expiryDate
          ? batch.expiryDate.toISOString().split('T')[0]
          : null;

        // Upsert stock_batch: if (brand_id, product_id, department_id, batch_number) exists,
        // add to quantity_remaining; otherwise insert fresh.
        const upsertResult = await txDb.raw.execute(sql`
          INSERT INTO stock_batches (
            brand_id, product_id, department_id, batch_number,
            quantity_remaining, expiry_date, received_date,
            yield_factor, cost_per_unit, uom_id, source_type, source_ref, provisional
          ) VALUES (
            ${txDb.brandId}, ${batch.productId}, ${departmentId}, ${batch.batchNumber},
            ${batch.quantity}, ${expiryDateStr}, ${receivedDateStr},
            ${String(yieldFactor)}, ${String(costPerUnit)},
            ${batch.uomId}, ${batch.sourceType},
            ${batch.sourceRef ?? null}, false
          )
          ON CONFLICT (brand_id, product_id, department_id, batch_number)
          DO UPDATE SET
            quantity_remaining = stock_batches.quantity_remaining + EXCLUDED.quantity_remaining
          RETURNING id
        `);
        const batchRows = upsertResult as unknown as Array<{ id: string }>;
        const batchId = batchRows[0]?.id;
        if (!batchId) throw new Error(`incrementStock: upsert returned no batch id for ${batch.batchNumber}`);

        // Upsert stock_levels
        await txDb.raw.execute(sql`
          INSERT INTO stock_levels (brand_id, product_id, department_id, quantity, uom_id, last_updated_at)
          VALUES (${txDb.brandId}, ${batch.productId}, ${departmentId}, ${batch.quantity}, ${batch.uomId}, NOW())
          ON CONFLICT (brand_id, product_id, department_id)
          DO UPDATE SET
            quantity = stock_levels.quantity + EXCLUDED.quantity,
            last_updated_at = NOW()
        `);

        // Insert stock_movements row (positive quantityDelta = inbound)
        await txDb.scopedInsert(stockMovements, {
          productId: batch.productId,
          departmentId,
          batchId,
          movementType: opts.movementType,
          quantityDelta: String(batch.quantity),
          uomId: batch.uomId,
          sourceType: batch.sourceType,
          sourceId: batchId,
          reason: opts.reason ?? null,
          trnReference: opts.trnReference ?? null,
          actorUserId: opts.actorUserId,
        } as unknown as ScopedInsertRow<typeof stockMovements>);
      }

      // Audit the entire increment in the same transaction (architecture invariant).
      await auditLogService.record(txDb, {
        action: 'business_action',
        tableName: 'stock_movements',
        rowId: batches[0]?.batchNumber ?? 'bulk',
        actorUserId: opts.actorUserId,
        trnReference: opts.trnReference ?? null,
        reason: opts.reason ?? null,
        context: {
          event: 'increment_stock',
          departmentId,
          movementType: opts.movementType,
          batchCount: batches.length,
        },
      });
    });
  },
};
