/**
 * inventory-deduct.test.ts — Task 1.6 integration tests (TDD)
 *
 * Tests for:
 *  - inventoryService.getAvailableStock
 *  - inventoryService.deductStock (DL-016 Pattern 1 FEFO+row-lock)
 *  - inventoryService.incrementStock
 *
 * Spec §7 cases:
 * 1. enablement gate — deductStock on disabled product throws EnablementViolationError
 * 2. FEFO order — two batches with different expiry dates; earlier-expiry consumed first
 * 3. multi-batch walk — total needed spans both batches; both partially/fully consumed
 * 4. insufficient throws + full rollback — no movement/journal/audit rows inserted
 * 5. newBalance correctness — returned newBalance matches new stock_levels.quantity
 * 6. audit+journal same-tx — exactly 1 journal_events row and ≥1 audit_log row
 * 7. incrementStock — creates batches + stock_levels + movements
 * 8. getAvailableStock — returns 0 when no stock_levels row; correct quantity after increment
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { clusters, locations, departments } from '../../src/db/schema/org.js';
import { uoms, products, enablementMatrix, stockLevels, stockBatches, stockMovements, journalEvents } from '../../src/db/schema/inventory.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { inventoryService } from '../../src/services/inventory.service.js';
import { EnablementViolationError, InsufficientStockError } from '../../src/errors/index.js';

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
  // Also truncate Epic 4 W1 tables (not yet in truncateTestTables)
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
  const { db, testBrandId } = getTestBrandedDb();
  const raw = unscopedDb();

  // 1. Cluster → Location → Department
  const [cluster] = await raw
    .insert(clusters)
    .values({ brandId: testBrandId, name: 'Test Cluster', active: true })
    .returning({ id: clusters.id });
  if (!cluster) throw new Error('seed: cluster insert failed');

  const [location] = await raw
    .insert(locations)
    .values({ brandId: testBrandId, clusterId: cluster.id, name: 'Test Location', type: 'central_kitchen', active: true })
    .returning({ id: locations.id });
  if (!location) throw new Error('seed: location insert failed');

  const [department] = await raw
    .insert(departments)
    .values({ brandId: testBrandId, locationId: location.id, name: 'Test Dept', type: 'production', active: true })
    .returning({ id: departments.id });
  if (!department) throw new Error('seed: department insert failed');

  // 2. UOM
  const [uom] = await raw
    .insert(uoms)
    .values({ brandId: testBrandId, code: 'kg', displayName: 'Kilograms', base: 'mass', conversionToBaseFactor: '1.000000000', active: true })
    .returning({ id: uoms.id });
  if (!uom) throw new Error('seed: uom insert failed');

  // 3. Product
  const [product] = await raw
    .insert(products)
    .values({ brandId: testBrandId, sku: 'TEST-001', name: 'Test Ingredient', type: 'raw', defaultUomId: uom.id, active: true })
    .returning({ id: products.id });
  if (!product) throw new Error('seed: product insert failed');

  return {
    brandId: testBrandId,
    uomId: uom.id,
    productId: product.id,
    departmentId: department.id,
  };
}

/** Enable product in the enablement_matrix for the given department */
async function enableProduct(brandId: string, productId: string, departmentId: string): Promise<void> {
  const raw = unscopedDb();
  await raw
    .insert(enablementMatrix)
    .values({ brandId, productId, departmentId, enabled: true, lastModifiedAt: new Date() });
}

/** Seed stock_batches + stock_levels directly (bypasses incrementStock) */
async function seedBatch(opts: {
  brandId: string;
  productId: string;
  departmentId: string;
  uomId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: Date | null;
}): Promise<string> {
  const raw = unscopedDb();
  const [batch] = await raw
    .insert(stockBatches)
    .values({
      brandId: opts.brandId,
      productId: opts.productId,
      departmentId: opts.departmentId,
      batchNumber: opts.batchNumber,
      quantityRemaining: String(opts.quantity),
      expiryDate: opts.expiryDate ? opts.expiryDate.toISOString().split('T')[0] : null,
      receivedDate: new Date().toISOString().split('T')[0]!,
      uomId: opts.uomId,
      sourceType: 'opening',
      provisional: false,
    })
    .returning({ id: stockBatches.id });
  if (!batch) throw new Error('seedBatch: insert failed');

  // Upsert stock_levels
  await raw.execute(sql`
    INSERT INTO stock_levels (brand_id, product_id, department_id, quantity, uom_id, last_updated_at)
    VALUES (
      ${opts.brandId}, ${opts.productId}, ${opts.departmentId},
      ${opts.quantity}, ${opts.uomId}, NOW()
    )
    ON CONFLICT (brand_id, product_id, department_id)
    DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity, last_updated_at = NOW()
  `);

  return batch.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inventoryService.getAvailableStock', () => {
  it('returns quantity=0 when no stock_levels row exists', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId } = await seedFixtures();

    // Use the uomId for the fake unit lookup — no stock_levels row exists
    // getAvailableStock should derive unit from the product's default UOM
    const result = await inventoryService.getAvailableStock(db, productId, departmentId);

    expect(result.itemId).toBe(productId);
    expect(result.departmentId).toBe(departmentId);
    expect(result.quantity).toBe(0);
    expect(typeof result.unit).toBe('string');
  });

  it('returns correct quantity after batch is seeded', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'B001', quantity: 25.5 });

    const result = await inventoryService.getAvailableStock(db, productId, departmentId);
    expect(result.quantity).toBe(25.5);
  });
});

describe('inventoryService.deductStock — enablement gate', () => {
  it('throws EnablementViolationError when product is not enabled for department', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    // Seed stock but do NOT enable in enablement_matrix
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'B001', quantity: 10 });

    await expect(
      inventoryService.deductStock(db, productId, departmentId, 5, 'Test deduction', 'TRN-001'),
    ).rejects.toThrow(EnablementViolationError);
  });
});

describe('inventoryService.deductStock — FEFO order', () => {
  it('consumes earliest-expiry batch first (FEFO)', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    const earlyExpiry = new Date('2025-01-15');
    const lateExpiry = new Date('2025-06-30');

    // Insert late batch first (to confirm ordering is by expiry_date, not insert order)
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'LATE-001', quantity: 20, expiryDate: lateExpiry });
    const earlyBatchId = await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EARLY-001', quantity: 20, expiryDate: earlyExpiry });

    // Deduct 5 — should come entirely from EARLY-001
    await inventoryService.deductStock(db, productId, departmentId, 5, 'FEFO test', 'TRN-FEFO-001');

    const raw = unscopedDb();
    const movements = await raw.select().from(stockMovements).where(eq(stockMovements.batchId, earlyBatchId));
    expect(movements.length).toBe(1);
    expect(Number(movements[0]!.quantityDelta)).toBe(-5);

    // Late batch untouched
    const batches = await raw.select().from(stockBatches).where(eq(stockBatches.batchNumber, 'LATE-001'));
    expect(Number(batches[0]!.quantityRemaining)).toBe(20);
  });
});

describe('inventoryService.deductStock — multi-batch walk', () => {
  it('spans both batches when first batch is insufficient alone', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    const earlyExpiry = new Date('2025-01-15');
    const lateExpiry = new Date('2025-06-30');

    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'EARLY-001', quantity: 8, expiryDate: earlyExpiry });
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'LATE-001', quantity: 10, expiryDate: lateExpiry });

    // Request 12 — needs 8 from EARLY and 4 from LATE
    const result = await inventoryService.deductStock(db, productId, departmentId, 12, 'Multi-batch test', 'TRN-MB-001');

    expect(result.success).toBe(true);
    expect(result.newBalance).toBeCloseTo(6, 4); // 18 total - 12 = 6

    const raw = unscopedDb();
    const movements = await raw.select().from(stockMovements);
    // 2 movements — one per batch
    expect(movements.length).toBe(2);

    const earlyMovement = movements.find((m) => Number(m.quantityDelta) === -8);
    const lateMovement = movements.find((m) => Number(m.quantityDelta) === -4);
    expect(earlyMovement).toBeTruthy();
    expect(lateMovement).toBeTruthy();
  });
});

describe('inventoryService.deductStock — insufficient stock + rollback', () => {
  it('throws InsufficientStockError and leaves no movement/journal/audit rows', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'B001', quantity: 5 });

    // Request more than available
    await expect(
      inventoryService.deductStock(db, productId, departmentId, 100, 'Over deduct', 'TRN-OVER-001'),
    ).rejects.toThrow(InsufficientStockError);

    const raw = unscopedDb();
    const movements = await raw.select().from(stockMovements);
    expect(movements.length).toBe(0);

    const journals = await raw.select().from(journalEvents);
    expect(journals.length).toBe(0);

    const audits = await raw.select().from(auditLog);
    // No business_action audit rows from this failed deduction
    const deductAudits = audits.filter((a) => a.action === 'business_action');
    expect(deductAudits.length).toBe(0);
  });
});

describe('inventoryService.deductStock — newBalance correctness', () => {
  it('returned newBalance matches stock_levels.quantity after deduction', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'B001', quantity: 30 });

    const result = await inventoryService.deductStock(db, productId, departmentId, 10, 'Balance test', 'TRN-BAL-001');
    expect(result.newBalance).toBeCloseTo(20, 4);

    const raw = unscopedDb();
    const levels = await raw.select().from(stockLevels);
    expect(Number(levels[0]!.quantity)).toBeCloseTo(20, 4);
  });
});

describe('inventoryService.deductStock — audit + journal same-tx', () => {
  it('writes exactly 1 journal_events row and ≥1 audit_log row on success', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'B001', quantity: 20 });

    const result = await inventoryService.deductStock(db, productId, departmentId, 5, 'Audit test', 'TRN-AUD-001');

    expect(result.journalEntryId).toBeTruthy();

    const raw = unscopedDb();
    const journals = await raw.select().from(journalEvents);
    expect(journals.length).toBe(1);
    expect(journals[0]!.id).toBe(result.journalEntryId);

    const audits = await raw.select().from(auditLog);
    const businessAudits = audits.filter((a) => a.action === 'business_action');
    expect(businessAudits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('inventoryService.incrementStock', () => {
  it('creates stock_batches, updates stock_levels, and writes stock_movements', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    await inventoryService.incrementStock(
      db,
      departmentId,
      [
        {
          productId,
          batchNumber: 'INC-BATCH-001',
          quantity: 50,
          receivedDate: new Date('2025-01-01'),
          uomId,
          sourceType: 'goods_receipt',
        },
      ],
      {
        actorUserId: null,
        movementType: 'receipt',
        trnReference: 'TRN-INC-001',
      },
    );

    const raw = unscopedDb();

    // Batch created
    const batches = await raw
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.batchNumber, 'INC-BATCH-001'));
    expect(batches.length).toBe(1);
    expect(Number(batches[0]!.quantityRemaining)).toBe(50);

    // Stock level bumped
    const levels = await raw.select().from(stockLevels);
    expect(levels.length).toBe(1);
    expect(Number(levels[0]!.quantity)).toBe(50);

    // Movement written
    const movements = await raw.select().from(stockMovements);
    expect(movements.length).toBe(1);
    expect(Number(movements[0]!.quantityDelta)).toBe(50);
    expect(movements[0]!.movementType).toBe('receipt');
  });

  it('creates an audit_log row in the same transaction', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    await inventoryService.incrementStock(
      db,
      departmentId,
      [
        {
          productId,
          batchNumber: 'INC-AUDIT-001',
          quantity: 15,
          receivedDate: new Date('2025-01-01'),
          uomId,
          sourceType: 'goods_receipt',
        },
      ],
      {
        actorUserId: null,
        movementType: 'receipt',
        trnReference: 'TRN-AUDIT-001',
      },
    );

    const raw = unscopedDb();
    const audits = await raw.select().from(auditLog);
    const businessAudits = audits.filter((a) => a.action === 'business_action');
    expect(businessAudits.length).toBeGreaterThanOrEqual(1);
  });

  it('upserts stock_levels when called twice for same product+department', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();

    const batchInput = {
      productId,
      batchNumber: 'INC-BATCH-A',
      quantity: 20,
      receivedDate: new Date('2025-01-01'),
      uomId,
      sourceType: 'goods_receipt' as const,
    };

    await inventoryService.incrementStock(db, departmentId, [batchInput], {
      actorUserId: null,
      movementType: 'receipt',
    });

    await inventoryService.incrementStock(
      db,
      departmentId,
      [{ ...batchInput, batchNumber: 'INC-BATCH-B', quantity: 30 }],
      { actorUserId: null, movementType: 'receipt' },
    );

    const raw = unscopedDb();
    const levels = await raw.select().from(stockLevels);
    expect(levels.length).toBe(1);
    expect(Number(levels[0]!.quantity)).toBe(50); // 20 + 30
  });
});

describe('inventoryService.deductStock — stock_levels absent (Fix I-2)', () => {
  it('returns correct newBalance and creates stock_levels row when no levels row pre-exists', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    // Seed batches directly WITHOUT creating a stock_levels row.
    // seedBatch always upserts stock_levels, so we seed then delete the levels row.
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'NL-001', quantity: 15 });
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'NL-002', quantity: 10 });

    // Delete the stock_levels row that seedBatch created — simulate the "no row" path.
    const raw = unscopedDb();
    await raw.execute(sql`
      DELETE FROM stock_levels
      WHERE brand_id = ${brandId}
        AND product_id = ${productId}
        AND department_id = ${departmentId}
    `);

    // Confirm no levels row exists before we call deductStock.
    const levelsBefore = await raw.select().from(stockLevels);
    expect(levelsBefore.length).toBe(0);

    // Deduct 8 — leaves 15+10-8 = 17 across batches.
    const result = await inventoryService.deductStock(
      db, productId, departmentId, 8, 'no-levels test', 'TRN-NL-001',
    );

    expect(result.success).toBe(true);
    // True remaining = (15 - 8) + 10 = 17 (FEFO takes from NL-001 first)
    expect(result.newBalance).toBeCloseTo(17, 4);

    // A stock_levels row must now exist with the correct quantity.
    const levelsAfter = await raw.select().from(stockLevels);
    expect(levelsAfter.length).toBe(1);
    expect(Number(levelsAfter[0]!.quantity)).toBeCloseTo(17, 4);
  });
});

describe('inventoryService.deductStock — concurrent oversell prevention', () => {
  it('concurrent deduct does not oversell (DL-016 Pattern 1 correctness)', async () => {
    const { db } = getTestBrandedDb();
    const { brandId, productId, departmentId, uomId } = await seedFixtures();
    await enableProduct(brandId, productId, departmentId);

    // Seed a single batch with quantity 5
    await seedBatch({ brandId, productId, departmentId, uomId, batchNumber: 'CONC-001', quantity: 5 });

    // Two concurrent deductions each requesting 4 (total 8 > 5 available)
    const results = await Promise.allSettled([
      inventoryService.deductStock(db, productId, departmentId, 4, 'concurrent test A', 'TRN-CONC-A'),
      inventoryService.deductStock(db, productId, departmentId, 4, 'concurrent test B', 'TRN-CONC-B'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one succeeds, exactly one fails with InsufficientStockError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(InsufficientStockError);

    // Remaining quantity should be exactly 1 (5 - 4 = 1)
    const raw = unscopedDb();
    const batches = await raw.select().from(stockBatches).where(eq(stockBatches.batchNumber, 'CONC-001'));
    expect(Number(batches[0]!.quantityRemaining)).toBe(1);
  });
});
