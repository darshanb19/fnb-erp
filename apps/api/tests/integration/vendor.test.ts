/**
 * Integration tests for vendorService.
 *
 * Covers:
 *  - FR6: vendor CRUD with scope (brand / cluster / pos)
 *  - Master Spec §2.7: scope mutation — widening, narrowing, lateral rejection
 *  - DL-026: findSimilarByName (trigram similarity)
 *
 * Uses fnberp_test database.
 * Each test runs against a clean slate — truncateTestTables() in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { vendorService } from '../../src/services/vendor.service.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { ScopeMutationError, ValidationError } from '../../src/errors/index.js';

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
// Shared helpers
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof getTestBrandedDb>['db'];

async function createCluster(db: TestDb): Promise<string> {
  const { clusters } = await import('../../src/db/schema/org.js');
  // Cast required: HasDefault fields (active) trip TS excess-property check on ScopedInsertRow.
  // Shape is correct — same workaround as productService.createProduct (see service header).
  const rows = await db.scopedInsert(
    clusters,
    { name: 'Test Cluster', active: true } as unknown as Parameters<typeof db.scopedInsert<typeof clusters>>[1],
  ).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

async function createLocation(db: TestDb, clusterId: string): Promise<string> {
  const { locations } = await import('../../src/db/schema/org.js');
  // Cast required: HasDefault fields (active) trip TS excess-property check on ScopedInsertRow.
  const rows = await db.scopedInsert(
    locations,
    { clusterId, name: 'Test Location', type: 'pos_outlet' as const, active: true } as unknown as Parameters<typeof db.scopedInsert<typeof locations>>[1],
  ).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// FR6 vendor CRUD with scope
// ---------------------------------------------------------------------------

describe('vendorService — FR6 vendor CRUD with scope', () => {
  it('creates a brand-scope vendor', async () => {
    const { db } = getTestBrandedDb();

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Acme Supplies', scope: 'brand' },
      { actorUserId: null },
    );

    expect(vendor.code).toBe('VEND-001');
    expect(vendor.name).toBe('Acme Supplies');
    expect(vendor.scope).toBe('brand');
    expect(vendor.scopeClusterId).toBeNull();
    expect(vendor.scopeLocationId).toBeNull();
    expect(vendor.active).toBe(true);
    expect(vendor.preferred).toBe(false);
    expect(vendor.id).toBeTruthy();
  });

  it('creates a cluster-scope vendor with a clusterId', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-002', name: 'Cluster Vendor', scope: 'cluster', scopeClusterId: clusterId },
      { actorUserId: null },
    );

    expect(vendor.scope).toBe('cluster');
    expect(vendor.scopeClusterId).toBe(clusterId);
    expect(vendor.scopeLocationId).toBeNull();
  });

  it('creates a pos-scope vendor with a locationId', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    const locationId = await createLocation(db, clusterId);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-003', name: 'POS Vendor', scope: 'pos', scopeLocationId: locationId },
      { actorUserId: null },
    );

    expect(vendor.scope).toBe('pos');
    expect(vendor.scopeLocationId).toBe(locationId);
    expect(vendor.scopeClusterId).toBeNull();
  });

  it('rejects createVendor with inconsistent scope (scope=brand but clusterId provided) — service ValidationError', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);

    await expect(
      vendorService.createVendor(
        db,
        { code: 'VEND-BAD', name: 'Bad Vendor', scope: 'brand', scopeClusterId: clusterId },
        { actorUserId: null },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects createVendor with scope=cluster but no clusterId — service ValidationError', async () => {
    const { db } = getTestBrandedDb();

    await expect(
      vendorService.createVendor(
        db,
        { code: 'VEND-BAD', name: 'Bad Vendor', scope: 'cluster' },
        { actorUserId: null },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lists vendors filtered by scope=cluster + clusterId', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);

    await vendorService.createVendor(db, { code: 'VEND-001', name: 'Brand Vendor', scope: 'brand' }, { actorUserId: null });
    await vendorService.createVendor(db, { code: 'VEND-002', name: 'Cluster Vendor', scope: 'cluster', scopeClusterId: clusterId }, { actorUserId: null });

    const clusterVendors = await vendorService.listVendors(db, { scope: 'cluster', clusterId });
    expect(clusterVendors.length).toBe(1);
    expect(clusterVendors[0]?.code).toBe('VEND-002');
  });

  it('updates a vendor name with reason captured in audit', async () => {
    const { db } = getTestBrandedDb();

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Old Name', scope: 'brand' },
      { actorUserId: null },
    );

    const updated = await vendorService.updateVendor(
      db,
      vendor.id,
      { name: 'New Name' },
      { actorUserId: null, reason: 'corrected trading name' },
    );
    expect(updated.name).toBe('New Name');

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, vendor.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const updateRow = auditRows.find((r) => r.action === 'update');
    expect(updateRow).toBeDefined();
    expect(updateRow?.reason).toBe('corrected trading name');
    const changedFields = updateRow?.changedFields as string[] | null;
    expect(Array.isArray(changedFields)).toBe(true);
    expect(changedFields).toContain('name');
  });

  it('deactivates a vendor (active=false)', async () => {
    const { db } = getTestBrandedDb();

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Active Vendor', scope: 'brand' },
      { actorUserId: null },
    );

    const deactivated = await vendorService.deactivateVendor(db, vendor.id, { actorUserId: null, reason: 'no longer used' });
    expect(deactivated.active).toBe(false);

    // Row must still exist
    const fetched = await vendorService.getVendor(db, vendor.id);
    expect(fetched.id).toBe(vendor.id);
    expect(fetched.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §2.7 widening
// ---------------------------------------------------------------------------

describe('vendorService — §2.7 widening', () => {
  it('pos → cluster widening succeeds + audit business_action recorded with from/to', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    const locationId = await createLocation(db, clusterId);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'POS Vendor', scope: 'pos', scopeLocationId: locationId },
      { actorUserId: null },
    );

    const widened = await vendorService.changeVendorScope(
      db,
      vendor.id,
      { scope: 'cluster', clusterId },
      { actorUserId: null, reason: 'expanding to cluster' },
    );

    expect(widened.scope).toBe('cluster');
    expect(widened.scopeClusterId).toBe(clusterId);
    expect(widened.scopeLocationId).toBeNull();

    // Audit business_action row with from/to context
    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, vendor.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const businessRow = auditRows.find((r) => r.action === 'business_action');
    expect(businessRow).toBeDefined();
    const ctx = businessRow?.context as Record<string, unknown> | null;
    expect(ctx?.['event']).toBe('scope_widening');
    expect(ctx?.['from']).toBe('pos');
    expect(ctx?.['to']).toBe('cluster');
  });

  it('cluster → brand widening succeeds + audit recorded', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Cluster Vendor', scope: 'cluster', scopeClusterId: clusterId },
      { actorUserId: null },
    );

    const widened = await vendorService.changeVendorScope(
      db,
      vendor.id,
      { scope: 'brand' },
      { actorUserId: null, reason: 'expanding to brand' },
    );

    expect(widened.scope).toBe('brand');
    expect(widened.scopeClusterId).toBeNull();
    expect(widened.scopeLocationId).toBeNull();

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, vendor.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const businessRow = auditRows.find((r) => r.action === 'business_action');
    expect(businessRow).toBeDefined();
    const ctx = businessRow?.context as Record<string, unknown> | null;
    expect(ctx?.['event']).toBe('scope_widening');
  });

  it('pos → brand widening succeeds', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    const locationId = await createLocation(db, clusterId);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'POS Vendor', scope: 'pos', scopeLocationId: locationId },
      { actorUserId: null },
    );

    const widened = await vendorService.changeVendorScope(
      db,
      vendor.id,
      { scope: 'brand' },
      { actorUserId: null, reason: 'expanding to brand' },
    );

    expect(widened.scope).toBe('brand');
    expect(widened.scopeClusterId).toBeNull();
    expect(widened.scopeLocationId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §2.7 narrowing
// ---------------------------------------------------------------------------

describe('vendorService — §2.7 narrowing', () => {
  it('brand → cluster narrowing succeeds when no open transactions (Epic 1 stub returns false)', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Brand Vendor', scope: 'brand' },
      { actorUserId: null },
    );

    const narrowed = await vendorService.changeVendorScope(
      db,
      vendor.id,
      { scope: 'cluster', clusterId },
      { actorUserId: null, reason: 'restricting to cluster A' },
    );

    expect(narrowed.scope).toBe('cluster');
    expect(narrowed.scopeClusterId).toBe(clusterId);
  });

  it('brand → cluster narrowing blocked by ScopeMutationError when hasOpenTransactionsAt is monkey-patched to return true', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    // Create another cluster to ensure there are locations that fall out of scope
    const otherClusterId = await createCluster(db);
    const locationId = await createLocation(db, otherClusterId);

    // Suppress unused variable warning — locationId is created so it exists in DB,
    // giving the narrowing check something to work with.
    void locationId;

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Brand Vendor', scope: 'brand' },
      { actorUserId: null },
    );

    // Monkey-patch hasOpenTransactionsAt to simulate Epic 5 open transactions
    const spy = vi.spyOn(vendorService, 'hasOpenTransactionsAt').mockResolvedValueOnce(true);

    await expect(
      vendorService.changeVendorScope(
        db,
        vendor.id,
        { scope: 'cluster', clusterId },
        { actorUserId: null, reason: 'restrict to cluster' },
      ),
    ).rejects.toBeInstanceOf(ScopeMutationError);

    spy.mockRestore();
  });

  it('cluster → pos narrowing audit captures dropped-location-ids context on success', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    const locationId = await createLocation(db, clusterId);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Cluster Vendor', scope: 'cluster', scopeClusterId: clusterId },
      { actorUserId: null },
    );

    const narrowed = await vendorService.changeVendorScope(
      db,
      vendor.id,
      { scope: 'pos', locationId },
      { actorUserId: null, reason: 'restricting to specific POS' },
    );

    expect(narrowed.scope).toBe('pos');
    expect(narrowed.scopeLocationId).toBe(locationId);

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, vendor.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const businessRow = auditRows.find((r) => r.action === 'business_action');
    expect(businessRow).toBeDefined();
    const ctx = businessRow?.context as Record<string, unknown> | null;
    expect(ctx?.['event']).toBe('scope_narrowing');
    // droppedLocationIds is present in context (may be empty if no other locations in cluster)
    expect(ctx).toHaveProperty('droppedLocationIds');
  });
});

// ---------------------------------------------------------------------------
// §2.7 lateral rejected
// ---------------------------------------------------------------------------

describe('vendorService — §2.7 lateral rejected', () => {
  it('cluster (A) → cluster (B) throws ScopeMutationError(scope_lateral_not_supported)', async () => {
    const { db } = getTestBrandedDb();
    const clusterAId = await createCluster(db);
    const clusterBId = await createCluster(db);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Cluster Vendor', scope: 'cluster', scopeClusterId: clusterAId },
      { actorUserId: null },
    );

    const err = await vendorService
      .changeVendorScope(db, vendor.id, { scope: 'cluster', clusterId: clusterBId }, { actorUserId: null, reason: 'lateral move' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ScopeMutationError);
    expect((err as ScopeMutationError).code).toBe('vendor.scope_lateral_not_supported');
  });

  it('pos (A) → pos (B) throws lateral error', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = await createCluster(db);
    const locAId = await createLocation(db, clusterId);
    const locBId = await createLocation(db, clusterId);

    const vendor = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'POS Vendor', scope: 'pos', scopeLocationId: locAId },
      { actorUserId: null },
    );

    const err = await vendorService
      .changeVendorScope(db, vendor.id, { scope: 'pos', locationId: locBId }, { actorUserId: null, reason: 'lateral move' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ScopeMutationError);
    expect((err as ScopeMutationError).code).toBe('vendor.scope_lateral_not_supported');
  });
});

// ---------------------------------------------------------------------------
// DL-026 findSimilarByName for vendors
// ---------------------------------------------------------------------------

describe('vendorService — DL-026 findSimilarByName', () => {
  it('returns vendors above trigram threshold ordered by similarity DESC', async () => {
    const { db } = getTestBrandedDb();

    const v = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Fresh Farms Supplier', scope: 'brand' },
      { actorUserId: null },
    );
    await vendorService.createVendor(
      db,
      { code: 'VEND-002', name: 'Totally Unrelated XYZ', scope: 'brand' },
      { actorUserId: null },
    );

    const results = await vendorService.findSimilarByName(db, 'Fresh Farms Supplier', { threshold: 0.85 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === v.id)).toBe(true);
    expect(results.every((r) => r.sim >= 0.85)).toBe(true);
    // Ordered by sim DESC
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.sim).toBeGreaterThanOrEqual(results[i]!.sim);
    }
  });

  it('excludes the candidate row when excludeId supplied', async () => {
    const { db } = getTestBrandedDb();

    const v = await vendorService.createVendor(
      db,
      { code: 'VEND-001', name: 'Fresh Farms Supplier', scope: 'brand' },
      { actorUserId: null },
    );

    const results = await vendorService.findSimilarByName(db, 'Fresh Farms Supplier', { threshold: 0.85, excludeId: v.id });
    expect(results.every((r) => r.id !== v.id)).toBe(true);
  });
});
