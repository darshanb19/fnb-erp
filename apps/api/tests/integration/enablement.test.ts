/**
 * Integration tests for inventoryService — enablement CRUD surface.
 *
 * Covers:
 *  - FR5: setEnablement (UPSERT + audit-log)
 *  - FR8: checkEnablement (default-deny, true, false)
 *  - Architecture §6.2.1: request-lifetime memoization via db.requestCache
 *  - listEnablementForLocation: cross-product materialisation + default-deny
 *  - bulkSetEnablement: multiple pairs in one transaction
 *  - DL-013 trigger backstop: deferred to Epic 3 (it.skip)
 *
 * Uses fnberp_test database.
 * Each test runs against a clean slate — truncateTestTables() in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { inventoryService } from '../../src/services/inventory.service.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { uoms, products, enablementMatrix } from '../../src/db/schema/inventory.js';
import { clusters, locations, departments } from '../../src/db/schema/org.js';

beforeAll(async () => {
  await setupIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

async function createKgUom(db: ReturnType<typeof getTestBrandedDb>['db']): Promise<string> {
  const rows = await db.scopedInsert(uoms, {
    code: 'kg',
    displayName: 'Kilogram',
    base: 'mass',
    conversionToBaseFactor: '1.0',
  }).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

async function createProduct(
  db: ReturnType<typeof getTestBrandedDb>['db'],
  sku: string,
  kgId: string,
): Promise<string> {
  const rows = await db.scopedInsert(products, {
    sku,
    name: `Product ${sku}`,
    type: 'raw',
    defaultUomId: kgId,
  }).returning() as unknown as { id: string }[];
  // Also insert the required self-referential product_uoms row
  const pId = rows[0]!.id;
  const { productUoms } = await import('../../src/db/schema/inventory.js');
  await db.scopedInsert(productUoms, {
    productId: pId,
    uomId: kgId,
    factorToDefaultUom: '1',
    isDefault: true,
  } as unknown as Parameters<typeof db.scopedInsert>[1]);
  return pId;
}

async function createLocation(
  db: ReturnType<typeof getTestBrandedDb>['db'],
): Promise<{ clusterId: string; locationId: string }> {
  const clusterRows = await db.scopedInsert(clusters, {
    name: 'Test Cluster',
  }).returning() as unknown as { id: string }[];
  const clusterId = clusterRows[0]!.id;

  const locationRows = await db.scopedInsert(locations, {
    clusterId,
    name: 'Test Location',
    type: 'pos_outlet',
  }).returning() as unknown as { id: string }[];
  const locationId = locationRows[0]!.id;

  return { clusterId, locationId };
}

async function createDepartment(
  db: ReturnType<typeof getTestBrandedDb>['db'],
  locationId: string,
  name = 'Test Department',
): Promise<string> {
  const rows = await db.scopedInsert(departments, {
    locationId,
    name,
    type: 'production',
  }).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// FR5 / FR8 — checkEnablement + setEnablement
// ---------------------------------------------------------------------------

describe('inventoryService', () => {
  describe('FR5 / FR8 checkEnablement + setEnablement', () => {
    it('FR5: setEnablement(true) creates a new row and audit-log captures reason', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      await inventoryService.setEnablement(db, productId, departmentId, true, {
        actorUserId: null,
        reason: 'enabled for dispatch',
      });

      // Row must exist with enabled=true
      const rows = await db.scopedFrom(
        enablementMatrix,
        eq(enablementMatrix.productId, productId),
      ) as unknown as (typeof enablementMatrix.$inferSelect)[];

      expect(rows.length).toBe(1);
      expect(rows[0]!.enabled).toBe(true);
      expect(rows[0]!.reason).toBe('enabled for dispatch');

      // Audit-log must have an 'insert' row for enablement_matrix
      const auditRows = await db.scopedFrom(
        auditLog,
        eq(auditLog.tableName, 'enablement_matrix'),
      ) as unknown as (typeof auditLog.$inferSelect)[];

      const insertRow = auditRows.find((r) => r.action === 'insert');
      expect(insertRow).toBeDefined();
      expect(insertRow?.reason).toBe('enabled for dispatch');
    });

    it('FR5: setEnablement(false) on existing row updates and audit-log captures reason', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      // First enable it
      await inventoryService.setEnablement(db, productId, departmentId, true, {
        actorUserId: null,
        reason: 'initially enabled',
      });

      // Now disable it
      await inventoryService.setEnablement(db, productId, departmentId, false, {
        actorUserId: null,
        reason: 'seasonal shut-down',
      });

      const rows = await db.scopedFrom(
        enablementMatrix,
        eq(enablementMatrix.productId, productId),
      ) as unknown as (typeof enablementMatrix.$inferSelect)[];

      expect(rows.length).toBe(1);
      expect(rows[0]!.enabled).toBe(false);
      expect(rows[0]!.reason).toBe('seasonal shut-down');

      // Audit-log must have an 'update' row
      const auditRows = await db.scopedFrom(
        auditLog,
        eq(auditLog.tableName, 'enablement_matrix'),
      ) as unknown as (typeof auditLog.$inferSelect)[];

      const updateRow = auditRows.find((r) => r.action === 'update');
      expect(updateRow).toBeDefined();
      expect(updateRow?.reason).toBe('seasonal shut-down');
    });

    it('FR8: checkEnablement returns true when row enabled', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      await inventoryService.setEnablement(db, productId, departmentId, true, { actorUserId: null });

      // Clear cache so we test a fresh DB read
      db.requestCache.clear();

      const result = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(result).toBe(true);
    });

    it('FR8: checkEnablement returns false when row disabled', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      await inventoryService.setEnablement(db, productId, departmentId, false, { actorUserId: null });

      // Clear cache so we test a fresh DB read
      db.requestCache.clear();

      const result = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(result).toBe(false);
    });

    it('FR8: checkEnablement returns false when row absent (default-deny)', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      // No setEnablement call — row absent
      const result = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Architecture §6.2.1 — request-lifetime memoization
  // -------------------------------------------------------------------------

  describe('Architecture §6.2.1 — request-lifetime memoization', () => {
    it('subsequent checkEnablement calls within the same request hit cache, not DB', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      // Enable via service — this sets the DB row AND populates the cache
      // (setEnablement invalidates cache; next checkEnablement will re-read DB and cache)
      await inventoryService.setEnablement(db, productId, departmentId, true, { actorUserId: null });
      // First checkEnablement: reads DB, caches the result (true)
      const first = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(first).toBe(true);

      // Now hand-edit the CACHE to store a wrong value (false)
      // This simulates a subsequent in-request call that should use the cache
      const cacheKey = `enablement:${productId}:${departmentId}`;
      db.requestCache.set(cacheKey, false);

      // Second call should return the cached value (false), NOT the DB's true
      const second = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(second).toBe(false);  // cached value wins
    });

    it('setEnablement invalidates the cache key for that (productId, departmentId)', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const productId = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const departmentId = await createDepartment(db, locationId);

      // Step 1: enable via service
      await inventoryService.setEnablement(db, productId, departmentId, true, { actorUserId: null });
      // Step 2: first read — DB hit, caches true
      const first = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(first).toBe(true);

      // Step 3: poison the cache with false
      const cacheKey = `enablement:${productId}:${departmentId}`;
      db.requestCache.set(cacheKey, false);

      // Step 4: call setEnablement again — must invalidate the cache key
      await inventoryService.setEnablement(db, productId, departmentId, true, { actorUserId: null });
      expect(db.requestCache.has(cacheKey)).toBe(false);  // key must be gone

      // Step 5: checkEnablement re-reads DB → returns true (DB's actual value)
      const afterInvalidation = await inventoryService.checkEnablement(db, productId, departmentId);
      expect(afterInvalidation).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // listEnablementForLocation
  // -------------------------------------------------------------------------

  describe('listEnablementForLocation', () => {
    it('returns cells for every (active product × department-at-location) pair', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const p1Id = await createProduct(db, 'P-001', kgId);
      const p2Id = await createProduct(db, 'P-002', kgId);
      const { locationId } = await createLocation(db);
      const d1Id = await createDepartment(db, locationId, 'Dept A');
      const d2Id = await createDepartment(db, locationId, 'Dept B');

      // Enable P-001 × D1
      await inventoryService.setEnablement(db, p1Id, d1Id, true, { actorUserId: null });

      const cells = await inventoryService.listEnablementForLocation(db, locationId);
      // 2 products × 2 departments = 4 cells
      expect(cells.length).toBe(4);

      // All cells have the expected product/dept ids
      const productIds = [...new Set(cells.map((c) => c.productId))].sort();
      expect(productIds).toEqual([p1Id, p2Id].sort());
      const deptIds = [...new Set(cells.map((c) => c.departmentId))].sort();
      expect(deptIds).toEqual([d1Id, d2Id].sort());
    });

    it('cells absent from matrix carry enabled=false (default-deny)', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const p1Id = await createProduct(db, 'P-001', kgId);
      const { locationId } = await createLocation(db);
      const d1Id = await createDepartment(db, locationId, 'Dept A');

      // No setEnablement call — row absent
      const cells = await inventoryService.listEnablementForLocation(db, locationId);
      expect(cells.length).toBe(1);
      const cell = cells.find((c) => c.productId === p1Id && c.departmentId === d1Id);
      expect(cell).toBeDefined();
      expect(cell!.enabled).toBe(false);
      expect(cell!.reason).toBeNull();
    });

    it('categoryId filter narrows products to those in the category', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const p1Id = await createProduct(db, 'P-001', kgId);
      const p2Id = await createProduct(db, 'P-002', kgId);
      const { locationId } = await createLocation(db);
      const deptId = await createDepartment(db, locationId, 'Dept A');

      // Create a category and assign only P-001 to it
      const { categories, productCategories } = await import('../../src/db/schema/inventory.js');
      const catRows = await db.scopedInsert(categories, {
        name: 'Dairy',
        displayOrder: 0,
      } as unknown as Parameters<typeof db.scopedInsert<typeof categories>>[1]).returning() as unknown as { id: string }[];
      const categoryId = catRows[0]!.id;

      await db.scopedInsert(productCategories, {
        productId: p1Id,
        categoryId,
      });

      // listEnablementForLocation with categoryId filter — should only include P-001
      const cells = await inventoryService.listEnablementForLocation(db, locationId, { categoryId });

      // Only P-001 × D1 = 1 cell
      expect(cells.length).toBe(1);
      expect(cells[0]!.productId).toBe(p1Id);
      // P-002 must not appear
      expect(cells.some((c) => c.productId === p2Id)).toBe(false);
    });

    it('returns empty array when location has no departments', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      await createProduct(db, 'P-001', kgId);

      const clusterRows = await db.scopedInsert(clusters, {
        name: 'Empty Cluster',
      }).returning() as unknown as { id: string }[];
      const locationRows = await db.scopedInsert(locations, {
        clusterId: clusterRows[0]!.id,
        name: 'Empty Location',
        type: 'pos_outlet',
      }).returning() as unknown as { id: string }[];
      const emptyLocationId = locationRows[0]!.id;

      const cells = await inventoryService.listEnablementForLocation(db, emptyLocationId);
      expect(cells.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // bulkSetEnablement
  // -------------------------------------------------------------------------

  describe('bulkSetEnablement', () => {
    it('writes all pairs in one transaction; audit-log records one row per pair', async () => {
      const { db } = getTestBrandedDb();
      const kgId = await createKgUom(db);
      const p1Id = await createProduct(db, 'P-001', kgId);
      const p2Id = await createProduct(db, 'P-002', kgId);
      const { locationId } = await createLocation(db);
      const d1Id = await createDepartment(db, locationId, 'Dept A');
      const d2Id = await createDepartment(db, locationId, 'Dept B');

      await inventoryService.bulkSetEnablement(
        db,
        [
          { productId: p1Id, departmentId: d1Id, enabled: true },
          { productId: p2Id, departmentId: d2Id, enabled: false },
        ],
        { actorUserId: null, reason: 'bulk config' },
      );

      // Both rows must exist in enablement_matrix
      const p1Rows = await db.scopedFrom(
        enablementMatrix,
        eq(enablementMatrix.productId, p1Id),
      ) as unknown as (typeof enablementMatrix.$inferSelect)[];
      expect(p1Rows.length).toBe(1);
      expect(p1Rows[0]!.enabled).toBe(true);

      const p2Rows = await db.scopedFrom(
        enablementMatrix,
        eq(enablementMatrix.productId, p2Id),
      ) as unknown as (typeof enablementMatrix.$inferSelect)[];
      expect(p2Rows.length).toBe(1);
      expect(p2Rows[0]!.enabled).toBe(false);

      // Audit-log must have 2 rows for enablement_matrix (one per pair)
      const auditRows = await db.scopedFrom(
        auditLog,
        eq(auditLog.tableName, 'enablement_matrix'),
      ) as unknown as (typeof auditLog.$inferSelect)[];
      expect(auditRows.length).toBe(2);
      expect(auditRows.every((r) => r.reason === 'bulk config')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // DL-013 trigger backstop — deferred
  // -------------------------------------------------------------------------

  describe('DL-013 trigger backstop deferred', () => {
    it.skip('raw DB UPDATE bypassing service produces audit_log row via trigger — deferred to Epic 3 trigger function ship', () => {
      // The audit_critical_table_trigger() Postgres function is a Phase 3a / Epic 3 deliverable.
      // The auditTriggerRegistry contains 'enablement_matrix' (Task A6) but the function body
      // is not yet shipped. Skipping this test locally; will be enabled when the trigger function
      // migration lands.
    });
  });
});
