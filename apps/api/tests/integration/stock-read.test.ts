/**
 * stock-read.test.ts — Task 1.7 integration tests (TDD)
 *
 * Tests for inventoryService.getExpiringBatches:
 * 1. Band distribution — 4 batches at +12h (h24), +36h (h48), +60h (h72), +96h (over72)
 *    → bands: { h24:1, h48:1, h72:1, over72:1 }, 4 items sorted by expiry_date ASC
 * 2. valueAtRisk = quantityRemaining * costPerUnit
 * 3. Only batches with quantity_remaining > 0 AND expiry_date IS NOT NULL
 * 4. scope filter by departmentId
 * 5. hoursUntilExpiry computed correctly (ms→hours)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { clusters, locations, departments } from '../../src/db/schema/org.js';
import { uoms, products, enablementMatrix, stockBatches } from '../../src/db/schema/inventory.js';
import { inventoryService } from '../../src/services/inventory.service.js';

// ---------------------------------------------------------------------------
// Global setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
  const raw = unscopedDb();
  await raw.execute(sql`
    TRUNCATE TABLE
      stock_movements,
      stock_levels,
      stock_batches,
      journal_events,
      trn_sequences
    RESTART IDENTITY CASCADE
  `);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  brandId: string;
  uomId: string;
  productId: string;
  departmentId: string;
}

async function seedFixtures(): Promise<SeedResult> {
  const { testBrandId } = getTestBrandedDb();
  const raw = unscopedDb();

  const [cluster] = await raw
    .insert(clusters)
    .values({ brandId: testBrandId, name: 'Expiry Cluster', active: true })
    .returning({ id: clusters.id });
  if (!cluster) throw new Error('seed: cluster insert failed');

  const [location] = await raw
    .insert(locations)
    .values({ brandId: testBrandId, clusterId: cluster.id, name: 'Expiry Location', type: 'central_kitchen', active: true })
    .returning({ id: locations.id });
  if (!location) throw new Error('seed: location insert failed');

  const [department] = await raw
    .insert(departments)
    .values({ brandId: testBrandId, locationId: location.id, name: 'Expiry Dept', type: 'production', active: true })
    .returning({ id: departments.id });
  if (!department) throw new Error('seed: department insert failed');

  const [uom] = await raw
    .insert(uoms)
    .values({ brandId: testBrandId, code: 'kg', displayName: 'Kilograms', base: 'mass', conversionToBaseFactor: '1.000000000', active: true })
    .returning({ id: uoms.id });
  if (!uom) throw new Error('seed: uom insert failed');

  const [product] = await raw
    .insert(products)
    .values({ brandId: testBrandId, sku: 'EXP-001', name: 'Expiry Product', type: 'raw', defaultUomId: uom.id, active: true })
    .returning({ id: products.id });
  if (!product) throw new Error('seed: product insert failed');

  return {
    brandId: testBrandId,
    uomId: uom.id,
    productId: product.id,
    departmentId: department.id,
  };
}

/**
 * Seed a stock_batch with a given expiry date (as Date) and optional costPerUnit.
 * Does NOT insert stock_levels — getExpiringBatches reads stock_batches directly.
 */
async function seedExpiringBatch(opts: {
  brandId: string;
  productId: string;
  departmentId: string;
  uomId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: Date | null;
  costPerUnit?: number;
}): Promise<string> {
  const raw = unscopedDb();

  const expiryDateStr = opts.expiryDate
    ? opts.expiryDate.toISOString().split('T')[0]
    : null;

  const [batch] = await raw
    .insert(stockBatches)
    .values({
      brandId: opts.brandId,
      productId: opts.productId,
      departmentId: opts.departmentId,
      batchNumber: opts.batchNumber,
      quantityRemaining: String(opts.quantity),
      expiryDate: expiryDateStr,
      receivedDate: new Date().toISOString().split('T')[0]!,
      yieldFactor: '1.0000',
      costPerUnit: String(opts.costPerUnit ?? 0),
      uomId: opts.uomId,
      sourceType: 'opening',
      provisional: false,
    })
    .returning({ id: stockBatches.id });
  if (!batch) throw new Error('seedExpiringBatch: insert failed');
  return batch.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inventoryService.getExpiringBatches — band distribution', () => {
  it('distributes 4 batches into the correct h24/h48/h72/over72 bands', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    // Fixed "now" — all offsets computed from this
    const now = new Date('2026-01-01T12:00:00.000Z');

    const addHours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

    // h24: +12h → hoursUntilExpiry=12
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H24', quantity: 10, expiryDate: addHours(12) });
    // h48: +36h → hoursUntilExpiry=36
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H48', quantity: 8, expiryDate: addHours(36) });
    // h72: +60h → hoursUntilExpiry=60
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H72', quantity: 6, expiryDate: addHours(60) });
    // over72: +96h → hoursUntilExpiry=96
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-O72', quantity: 4, expiryDate: addHours(96) });

    const result = await inventoryService.getExpiringBatches(
      db,
      { departmentId },
      now,
    );

    expect(result.bands.h24).toBe(1);
    expect(result.bands.h48).toBe(1);
    expect(result.bands.h72).toBe(1);
    expect(result.bands.over72).toBe(1);
    expect(result.items).toHaveLength(4);
  });

  it('returns items sorted by expiry_date ASC', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const addHours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H48', quantity: 8, expiryDate: addHours(36) });
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H24', quantity: 10, expiryDate: addHours(12) });
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-O72', quantity: 4, expiryDate: addHours(96) });
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EXP-H72', quantity: 6, expiryDate: addHours(60) });

    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(4);
    // Items must be sorted ascending by expiryDate
    for (let i = 0; i < result.items.length - 1; i++) {
      expect(result.items[i]!.expiryDate.getTime())
        .toBeLessThanOrEqual(result.items[i + 1]!.expiryDate.getTime());
    }
    // First item should be the earliest expiry (h24 batch, +12h)
    expect(result.items[0]!.batchNumber).toBe('EXP-H24');
  });

  it('computes hoursUntilExpiry correctly', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiryAt36h = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    await seedExpiringBatch({
      brandId, productId, departmentId, uomId,
      batchNumber: 'EXP-36H', quantity: 5,
      expiryDate: expiryAt36h,
    });

    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(1);
    // hoursUntilExpiry should be approximately 36 (allow ±1h for date rounding)
    expect(result.items[0]!.hoursUntilExpiry).toBeGreaterThanOrEqual(35);
    expect(result.items[0]!.hoursUntilExpiry).toBeLessThanOrEqual(37);
  });
});

describe('inventoryService.getExpiringBatches — valueAtRisk', () => {
  it('computes valueAtRisk = quantityRemaining * costPerUnit', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiryIn12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    await seedExpiringBatch({
      brandId, productId, departmentId, uomId,
      batchNumber: 'VAR-001', quantity: 5,
      expiryDate: expiryIn12h,
      costPerUnit: 5.0,
    });

    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.valueAtRisk).toBeCloseTo(25, 2); // 5 * 5.0 = 25
  });
});

describe('inventoryService.getExpiringBatches — filtering', () => {
  it('excludes batches with quantity_remaining = 0', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiryIn12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // One with quantity > 0, one depleted
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'ACTIVE', quantity: 10, expiryDate: expiryIn12h });
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EMPTY', quantity: 0, expiryDate: expiryIn12h });

    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.batchNumber).toBe('ACTIVE');
  });

  it('excludes batches with null expiry_date (non-perishables)', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiryIn12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'PERISHABLE', quantity: 10, expiryDate: expiryIn12h });
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'NON-PERISHABLE', quantity: 10, expiryDate: null });

    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.batchNumber).toBe('PERISHABLE');
  });

  it('filters by departmentId when scope.departmentId is provided', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const raw = unscopedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    // Create a second department in the same location
    const [cluster2] = await raw
      .insert(clusters)
      .values({ brandId: testBrandId, name: 'Cluster 2', active: true })
      .returning({ id: clusters.id });
    const [location2] = await raw
      .insert(locations)
      .values({ brandId: testBrandId, clusterId: cluster2!.id, name: 'Location 2', type: 'central_kitchen', active: true })
      .returning({ id: locations.id });
    const [department2] = await raw
      .insert(departments)
      .values({ brandId: testBrandId, locationId: location2!.id, name: 'Dept 2', type: 'production', active: true })
      .returning({ id: departments.id });

    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiryIn12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Batch in dept 1
    await seedExpiringBatch({ brandId, productId, departmentId, uomId, batchNumber: 'DEPT1-BATCH', quantity: 10, expiryDate: expiryIn12h });
    // Batch in dept 2
    await seedExpiringBatch({ brandId, productId, departmentId: department2!.id, uomId, batchNumber: 'DEPT2-BATCH', quantity: 10, expiryDate: expiryIn12h });

    // Query scoped to dept 1 only
    const result = await inventoryService.getExpiringBatches(db, { departmentId }, now);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.departmentId).toBe(departmentId);
    expect(result.items[0]!.batchNumber).toBe('DEPT1-BATCH');
  });
});

describe('inventoryService.getExpiringBatches — empty result', () => {
  it('returns empty bands and items when no matching batches exist', async () => {
    const { db } = getTestBrandedDb();
    await seedFixtures();

    const now = new Date('2026-01-01T12:00:00.000Z');
    const result = await inventoryService.getExpiringBatches(db, {}, now);

    expect(result.bands).toEqual({ h24: 0, h48: 0, h72: 0, over72: 0 });
    expect(result.items).toHaveLength(0);
  });
});
