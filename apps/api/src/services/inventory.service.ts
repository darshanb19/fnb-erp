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
  type EnablementMatrixRow,
} from '../db/schema/inventory.js';
import { departments } from '../db/schema/org.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
};
