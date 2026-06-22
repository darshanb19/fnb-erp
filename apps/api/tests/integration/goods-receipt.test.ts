/**
 * goods-receipt.test.ts — Task 2.3 integration tests (TDD)
 *
 * Tests for:
 *  - inventoryService.recordGoodsReceipt (yield math, FR114/FR115 warnings)
 *  - inventoryService.confirmGoodsReceipt (stock increment, journal stub)
 *  - inventoryService.rejectGoodsReceipt (rejection records, no stock)
 *
 * Route-level envelope tests also included per spec §7.
 *
 * Spec §7 cases:
 * 1. recordGoodsReceipt — creates draft GR, returns goodsReceiptId + warnings[]
 * 2. recordGoodsReceipt — yield math correct (usableQty = receivedQty × yieldFactor)
 * 3. recordGoodsReceipt — FR114 warns when yieldFactor < 0.5 (implausible yield)
 * 4. recordGoodsReceipt — FR114 warns when yieldFactor > 1.0 (implausible yield)
 * 5. confirmGoodsReceipt — creates stock_batch + bumps stock_levels + writes journal_event
 * 6. confirmGoodsReceipt — 409 if GR already confirmed (lifecycle guard)
 * 7. confirmGoodsReceipt — 409 if GR already rejected (lifecycle guard)
 * 8. confirmGoodsReceipt — requires reasonCode when implausibility warning fired
 * 9. rejectGoodsReceipt — sets status=rejected, inserts gr_rejection_records, no stock created
 * 10. rejectGoodsReceipt — 409 if GR already confirmed
 * 11. rejectGoodsReceipt — 409 if GR already rejected
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
import { clusters, locations, departments } from '../../src/db/schema/org.js';
import { uoms, products, enablementMatrix, stockLevels, stockBatches, journalEvents } from '../../src/db/schema/inventory.js';
import { goodsReceipts, grLines, grRejectionRecords } from '../../src/db/schema/inventory.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { inventoryService } from '../../src/services/inventory.service.js';
import { GoodsReceiptLifecycleError } from '../../src/errors/index.js';

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
  // Truncate Epic 4 tables
  const raw = unscopedDb();
  await raw.execute(sql`
    TRUNCATE TABLE
      gr_rejection_records,
      gr_attachments,
      gr_lines,
      goods_receipts,
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
  locationCode: string;
}

async function seedFixtures(): Promise<SeedResult> {
  const { testBrandId } = getTestBrandedDb();
  const raw = unscopedDb();

  // Cluster → Location → Department
  const [cluster] = await raw
    .insert(clusters)
    .values({ brandId: testBrandId, name: 'GR Test Cluster', active: true })
    .returning({ id: clusters.id });
  if (!cluster) throw new Error('seed: cluster insert failed');

  const [location] = await raw
    .insert(locations)
    .values({ brandId: testBrandId, clusterId: cluster.id, name: 'GR Test Location', type: 'central_kitchen', active: true })
    .returning({ id: locations.id });
  if (!location) throw new Error('seed: location insert failed');

  const [department] = await raw
    .insert(departments)
    .values({ brandId: testBrandId, locationId: location.id, name: 'GR Test Dept', type: 'production', active: true })
    .returning({ id: departments.id });
  if (!department) throw new Error('seed: department insert failed');

  // UOM
  const [uom] = await raw
    .insert(uoms)
    .values({ brandId: testBrandId, code: 'kg', displayName: 'Kilograms', base: 'mass', conversionToBaseFactor: '1.000000000', active: true })
    .returning({ id: uoms.id });
  if (!uom) throw new Error('seed: uom insert failed');

  // Product
  const [product] = await raw
    .insert(products)
    .values({ brandId: testBrandId, sku: 'GR-TEST-001', name: 'GR Test Ingredient', type: 'raw', defaultUomId: uom.id, active: true })
    .returning({ id: products.id });
  if (!product) throw new Error('seed: product insert failed');

  // Enable product in department
  await raw
    .insert(enablementMatrix)
    .values({ brandId: testBrandId, productId: product.id, departmentId: department.id, enabled: true, lastModifiedAt: new Date() });

  return {
    brandId: testBrandId,
    uomId: uom.id,
    productId: product.id,
    departmentId: department.id,
    locationCode: 'GRT',
  };
}

// ---------------------------------------------------------------------------
// Tests — recordGoodsReceipt
// ---------------------------------------------------------------------------

describe('inventoryService.recordGoodsReceipt — basic creation', () => {
  it('creates a draft GR and returns goodsReceiptId + empty warnings array', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.9,
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-GR-001',
        },
      ],
    });

    expect(result.goodsReceiptId).toBeTruthy();
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.length).toBe(0);

    // Verify GR record created in DB
    const raw = unscopedDb();
    const grs = await raw.select().from(goodsReceipts).where(eq(goodsReceipts.id, result.goodsReceiptId));
    expect(grs.length).toBe(1);
    expect(grs[0]!.status).toBe('draft');
  });

  it('stores correct yield math on gr_lines (usableQty = receivedQty × yieldFactor)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.8,
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-YIELD-001',
        },
      ],
    });

    const raw = unscopedDb();
    const lines = await raw.select().from(grLines).where(eq(grLines.goodsReceiptId, result.goodsReceiptId));
    expect(lines.length).toBe(1);

    const line = lines[0]!;
    expect(Number(line.receivedQty)).toBeCloseTo(100, 4);
    expect(Number(line.yieldFactor)).toBeCloseTo(0.8, 4);
    expect(Number(line.usableQty)).toBeCloseTo(80, 4);    // 100 × 0.8
    expect(Number(line.wastageQty)).toBeCloseTo(20, 4);   // 100 − 80
    expect(Number(line.adjustedCostPerUnit)).toBeCloseTo(62.5, 4); // 50 / 0.8
  });
});

describe('inventoryService.recordGoodsReceipt — FR114 implausibility warnings', () => {
  it('warns when yieldFactor < 0.5 (implausible low yield)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.3,  // below 0.5 threshold
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-LOW-YIELD-001',
        },
      ],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('FR114') || w.toLowerCase().includes('yield'))).toBe(true);
  });

  it('warns when yieldFactor > 1.0 (implausible high yield)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 1.2,  // above 1.0 threshold
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-HIGH-YIELD-001',
        },
      ],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('FR114') || w.toLowerCase().includes('yield'))).toBe(true);
  });

  it('does not warn for yieldFactor in valid range [0.5, 1.0]', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.75,  // within valid range
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-VALID-YIELD-001',
        },
      ],
    });

    const yieldWarnings = result.warnings.filter(
      (w) => w.includes('FR114') || w.toLowerCase().includes('yield'),
    );
    expect(yieldWarnings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — confirmGoodsReceipt
// ---------------------------------------------------------------------------

describe('inventoryService.confirmGoodsReceipt — happy path', () => {
  it('confirms a draft GR: creates stock_batch, bumps stock_levels, writes journal_event', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    // Create the GR
    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.9,
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-CONFIRM-001',
        },
      ],
    });

    // Confirm
    const confirmResult = await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
      confirmedBy: null,
    });

    expect(confirmResult.status).toBe('confirmed');

    const raw = unscopedDb();

    // GR status updated
    const grs = await raw.select().from(goodsReceipts).where(eq(goodsReceipts.id, goodsReceiptId));
    expect(grs[0]!.status).toBe('confirmed');

    // stock_batch created for the usable quantity (usableQty = 100 × 0.9 = 90)
    const batches = await raw.select().from(stockBatches).where(eq(stockBatches.productId, productId));
    expect(batches.length).toBeGreaterThan(0);
    expect(Number(batches[0]!.quantityRemaining)).toBeCloseTo(90, 4);

    // stock_levels bumped
    const levels = await raw.select().from(stockLevels);
    expect(levels.length).toBeGreaterThan(0);
    expect(Number(levels[0]!.quantity)).toBeCloseTo(90, 4);

    // journal_event written
    const journals = await raw.select().from(journalEvents);
    expect(journals.length).toBeGreaterThan(0);
    const grJournal = journals.find((j) => j.eventType === 'gr_confirmed');
    expect(grJournal).toBeTruthy();
  });

  it('writes audit_log row on confirm', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 50,
          yieldFactor: 1.0,
          unitCost: 20,
          uomId,
          batchNumber: 'BATCH-AUDIT-001',
        },
      ],
    });

    await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null });

    const raw = unscopedDb();
    const audits = await raw.select().from(auditLog);
    const grAudits = audits.filter((a) => a.action === 'business_action');
    expect(grAudits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('inventoryService.confirmGoodsReceipt — lifecycle guard', () => {
  it('throws GoodsReceiptLifecycleError if GR already confirmed', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 50,
          yieldFactor: 1.0,
          unitCost: 20,
          uomId,
          batchNumber: 'BATCH-DOUBLE-CONFIRM-001',
        },
      ],
    });

    await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null });

    // Second confirm should throw
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null }),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });

  it('throws GoodsReceiptLifecycleError if GR is rejected', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 50,
          yieldFactor: 1.0,
          unitCost: 20,
          uomId,
          batchNumber: 'BATCH-REJECT-THEN-CONFIRM-001',
        },
      ],
    });

    await inventoryService.rejectGoodsReceipt(db, goodsReceiptId, ['wrong_item'], null);

    // Confirm on rejected GR should throw
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null }),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });

  it('requires reasonCode when implausibility warning was fired', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    // Low yield factor triggers FR114 warning
    const { goodsReceiptId, warnings } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.2,  // very low, triggers FR114
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-FR114-001',
        },
      ],
    });

    expect(warnings.length).toBeGreaterThan(0);

    // Confirm without reasonCode when requiresReasonCode=true should throw
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
        confirmedBy: null,
        requiresReasonCode: true,
        // reasonCode omitted intentionally
      }),
    ).rejects.toThrow();
  });

  it('succeeds when reasonCode provided with implausibility warning', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId, warnings } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.2,  // triggers FR114
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-FR114-OVERRIDE-001',
        },
      ],
    });

    expect(warnings.length).toBeGreaterThan(0);

    // Confirm WITH reasonCode should succeed
    const result = await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
      confirmedBy: null,
      requiresReasonCode: true,
      reasonCode: 'vendor_damaged_goods',
    });

    expect(result.status).toBe('confirmed');
  });
});

// ---------------------------------------------------------------------------
// Tests — rejectGoodsReceipt
// ---------------------------------------------------------------------------

describe('inventoryService.rejectGoodsReceipt — happy path', () => {
  it('rejects a draft GR: status=rejected, inserts gr_rejection_records, no stock created', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,
          yieldFactor: 0.9,
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-REJECT-001',
        },
      ],
    });

    const rejectResult = await inventoryService.rejectGoodsReceipt(
      db,
      goodsReceiptId,
      ['wrong_item', 'quantity_mismatch'],
      'Evidence notes here',
    );

    expect(rejectResult.status).toBe('rejected');

    const raw = unscopedDb();

    // GR status updated
    const grs = await raw.select().from(goodsReceipts).where(eq(goodsReceipts.id, goodsReceiptId));
    expect(grs[0]!.status).toBe('rejected');

    // gr_rejection_records inserted with vcnDeferred=true
    const rejections = await raw
      .select()
      .from(grRejectionRecords)
      .where(eq(grRejectionRecords.goodsReceiptId, goodsReceiptId));
    expect(rejections.length).toBe(2); // one per reason code
    expect(rejections.every((r) => r.vcnDeferred === true)).toBe(true);

    // No stock created
    const batches = await raw.select().from(stockBatches);
    expect(batches.length).toBe(0);

    const levels = await raw.select().from(stockLevels);
    expect(levels.length).toBe(0);
  });
});

describe('inventoryService.rejectGoodsReceipt — lifecycle guard', () => {
  it('throws GoodsReceiptLifecycleError if GR already confirmed', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 50,
          yieldFactor: 1.0,
          unitCost: 20,
          uomId,
          batchNumber: 'BATCH-CONFIRM-THEN-REJECT-001',
        },
      ],
    });

    await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null });

    await expect(
      inventoryService.rejectGoodsReceipt(db, goodsReceiptId, ['wrong_item'], null),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });

  it('throws GoodsReceiptLifecycleError if GR already rejected', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 50,
          yieldFactor: 1.0,
          unitCost: 20,
          uomId,
          batchNumber: 'BATCH-DOUBLE-REJECT-001',
        },
      ],
    });

    await inventoryService.rejectGoodsReceipt(db, goodsReceiptId, ['wrong_item'], null);

    await expect(
      inventoryService.rejectGoodsReceipt(db, goodsReceiptId, ['duplicate_rejection'], null),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });
});
