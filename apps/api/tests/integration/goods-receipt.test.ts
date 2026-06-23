/**
 * goods-receipt.test.ts — Task 2.3 integration tests (TDD) + review-fix tests
 *
 * Tests for:
 *  - inventoryService.recordGoodsReceipt (yield math, FR114/FR115 warnings)
 *  - inventoryService.confirmGoodsReceipt (stock increment, journal stub)
 *  - inventoryService.rejectGoodsReceipt (rejection records, no stock)
 *
 * Route-level envelope tests also included (m1).
 *
 * Spec §7 cases (updated for review fixes):
 * 1. recordGoodsReceipt — creates draft GR, returns goodsReceiptId + warnings[]
 * 2. recordGoodsReceipt — yield math correct (usableQty = receivedQty × yieldFactor)
 * 3. recordGoodsReceipt — FR114 warns when receivedQty > 150% of orderedQty (C2)
 * 4. recordGoodsReceipt — FR114 no warning when within 150% of orderedQty (C2)
 * 5. recordGoodsReceipt — FR114 no warning when orderedQty absent (C2 seam)
 * 6. confirmGoodsReceipt — creates stock_batch + bumps stock_levels + writes journal_event
 * 7. confirmGoodsReceipt — 422 if GR already confirmed (lifecycle guard) (m4: was 409)
 * 8. confirmGoodsReceipt — 422 if GR already rejected (lifecycle guard) (m4: was 409)
 * 9. confirmGoodsReceipt — server-side: requires reasonCode when warningCount > 0 (I1)
 * 10. confirmGoodsReceipt — succeeds with reasonCode when warningCount > 0 (I1)
 * 11. rejectGoodsReceipt — sets status=rejected, inserts gr_rejection_records, no stock created
 * 12. rejectGoodsReceipt — 422 if GR already confirmed (m4: was 409)
 * 13. rejectGoodsReceipt — 422 if GR already rejected (m4: was 409)
 * 14. FR115 — duplicate detection: warns when same PO + matching line items same day (I2)
 * 15. FR115 — no warning when same PO but different items same day (I2)
 * 16. HTTP route — POST /goods-receipts returns { data } envelope (m1)
 * 17. HTTP route — POST /goods-receipts with FR114 warning returns { data, meta: { warnings } } (m1)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import request from 'supertest';
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
import { users } from '../../src/db/schema/auth.js';
import { inventoryService } from '../../src/services/inventory.service.js';
import { GoodsReceiptLifecycleError } from '../../src/errors/index.js';
import { createApp } from '../../src/index.js';
import { signTestJwt } from '../../src/lib/test-jwt.js';
import type { Application } from 'express';

// ---------------------------------------------------------------------------
// Global setup
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
let app: Application;
let token: string;

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
  app = createApp();
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
  product2Id: string;
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

  // Product 1
  const [product] = await raw
    .insert(products)
    .values({ brandId: testBrandId, sku: 'GR-TEST-001', name: 'GR Test Ingredient', type: 'raw', defaultUomId: uom.id, active: true })
    .returning({ id: products.id });
  if (!product) throw new Error('seed: product insert failed');

  // Product 2 (for FR115 line-level tests)
  const [product2] = await raw
    .insert(products)
    .values({ brandId: testBrandId, sku: 'GR-TEST-002', name: 'GR Test Ingredient 2', type: 'raw', defaultUomId: uom.id, active: true })
    .returning({ id: products.id });
  if (!product2) throw new Error('seed: product2 insert failed');

  // Enable both products in department
  await raw
    .insert(enablementMatrix)
    .values({ brandId: testBrandId, productId: product.id, departmentId: department.id, enabled: true, lastModifiedAt: new Date() });

  await raw
    .insert(enablementMatrix)
    .values({ brandId: testBrandId, productId: product2.id, departmentId: department.id, enabled: true, lastModifiedAt: new Date() });

  // Insert test user for HTTP route tests
  await raw
    .insert(users)
    .values({
      id: TEST_USER_ID,
      brandId: testBrandId,
      email: 'gr-test-actor@fnberp.test',
      fullName: 'GR Test Actor',
      role: 'brand_owner',
      active: true,
    })
    .onConflictDoNothing();

  token = signTestJwt({ userId: TEST_USER_ID, brandId: testBrandId });

  return {
    brandId: testBrandId,
    uomId: uom.id,
    productId: product.id,
    product2Id: product2.id,
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

// ---------------------------------------------------------------------------
// Tests — FR114 (C2: received qty > 150% of ordered qty)
// ---------------------------------------------------------------------------

describe('inventoryService.recordGoodsReceipt — FR114 implausibility warnings (C2)', () => {
  it('warns when receivedQty > 150% of orderedQty (FR114: over-receipt vs PO)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 160,
          orderedQty: 100,   // 160 > 1.5 × 100 = 150 → FR114 warning
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-FR114-OVER-001',
        },
      ],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('FR114'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('150%') || w.includes('ordered'))).toBe(true);
  });

  it('does not warn when receivedQty is within 150% of orderedQty', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 140,
          orderedQty: 100,   // 140 ≤ 1.5 × 100 = 150 → no FR114 warning
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-FR114-OK-001',
        },
      ],
    });

    const fr114Warnings = result.warnings.filter((w) => w.includes('FR114'));
    expect(fr114Warnings.length).toBe(0);
  });

  it('does not warn when orderedQty is absent (FR114 seam — no PO linked yet)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const result = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 9999,  // would fail if orderedQty check ran, but orderedQty absent
          // orderedQty: intentionally omitted — Epic 5 seam
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-FR114-SEAM-001',
        },
      ],
    });

    const fr114Warnings = result.warnings.filter((w) => w.includes('FR114'));
    expect(fr114Warnings.length).toBe(0);
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

describe('inventoryService.confirmGoodsReceipt — lifecycle guard (422, not 409)', () => {
  it('throws GoodsReceiptLifecycleError (422) if GR already confirmed', async () => {
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

    // Second confirm should throw (422 via BusinessRuleError base)
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null }),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });

  it('throws GoodsReceiptLifecycleError (422) if GR is rejected', async () => {
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

    // Confirm on rejected GR should throw (422 via BusinessRuleError base)
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, { confirmedBy: null }),
    ).rejects.toThrow(GoodsReceiptLifecycleError);
  });
});

// ---------------------------------------------------------------------------
// Tests — I1: server-side reasonCode gate (warningCount-driven)
// ---------------------------------------------------------------------------

describe('inventoryService.confirmGoodsReceipt — server-side reasonCode gate (I1)', () => {
  it('requires reasonCode when GR was recorded with FR114 warning (warningCount > 0)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    // Record with FR114 warning (receivedQty > 150% of orderedQty)
    const { goodsReceiptId, warnings } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 200,
          orderedQty: 100,   // 200 > 150% → FR114 warning
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-I1-001',
        },
      ],
    });

    expect(warnings.length).toBeGreaterThan(0);

    // Confirm WITHOUT reasonCode should throw (server-side gate reads warningCount from DB)
    await expect(
      inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
        confirmedBy: null,
        // reasonCode intentionally omitted
      }),
    ).rejects.toThrow();
  });

  it('succeeds when reasonCode provided and warningCount > 0', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId, warnings } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 200,
          orderedQty: 100,   // triggers FR114
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-I1-OVERRIDE-001',
        },
      ],
    });

    expect(warnings.length).toBeGreaterThan(0);

    // Confirm WITH reasonCode should succeed
    const result = await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
      confirmedBy: null,
      reasonCode: 'vendor_sent_extra_batch',
    });

    expect(result.status).toBe('confirmed');
  });

  it('does not require reasonCode when GR has no warnings (warningCount = 0)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const { goodsReceiptId, warnings } = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      receivedByUserId: null,
      lines: [
        {
          productId,
          receivedQty: 100,  // no orderedQty → no FR114; no poId → no FR115
          unitCost: 50,
          uomId,
          batchNumber: 'BATCH-I1-CLEAN-001',
        },
      ],
    });

    expect(warnings.length).toBe(0);

    // Confirm WITHOUT reasonCode should succeed when no warnings
    const result = await inventoryService.confirmGoodsReceipt(db, goodsReceiptId, {
      confirmedBy: null,
      // reasonCode intentionally absent
    });

    expect(result.status).toBe('confirmed');
  });
});

// ---------------------------------------------------------------------------
// Tests — FR115 extended duplicate detection (I2)
// ---------------------------------------------------------------------------

describe('inventoryService.recordGoodsReceipt — FR115 duplicate detection (I2)', () => {
  it('warns when same PO + matching line productId recorded on same day', async () => {
    const { db } = getTestBrandedDb();
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const fakePo = '00000000-0000-0000-0000-000000001234';

    // First GR (no warning expected)
    const first = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      poId: fakePo,
      receivedByUserId: null,
      lines: [
        { productId, receivedQty: 50, uomId, batchNumber: 'BATCH-FR115-FIRST' },
      ],
    });

    expect(first.warnings.filter((w) => w.includes('FR115')).length).toBe(0);

    // Second GR against same PO with same productId → FR115 warning
    const second = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      poId: fakePo,
      receivedByUserId: null,
      lines: [
        { productId, receivedQty: 50, uomId, batchNumber: 'BATCH-FR115-SECOND' },
      ],
    });

    const fr115Warnings = second.warnings.filter((w) => w.includes('FR115'));
    expect(fr115Warnings.length).toBeGreaterThan(0);
    // The conflicting GR TRN should appear in the warning message
    expect(fr115Warnings.some((w) => w.includes(first.grTrn))).toBe(true);
  });

  it('does not warn when same PO but different products (no line-level match)', async () => {
    const { db } = getTestBrandedDb();
    const { productId, product2Id, departmentId, uomId, locationCode } = await seedFixtures();

    const fakePo = '00000000-0000-0000-0000-000000005678';

    // First GR with product 1
    await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      poId: fakePo,
      receivedByUserId: null,
      lines: [
        { productId, receivedQty: 50, uomId, batchNumber: 'BATCH-FR115-P1' },
      ],
    });

    // Second GR with product 2 (different product) → no FR115 warning
    const second = await inventoryService.recordGoodsReceipt(db, {
      destinationDepartmentId: departmentId,
      locationCode,
      poId: fakePo,
      receivedByUserId: null,
      lines: [
        { productId: product2Id, receivedQty: 50, uomId, batchNumber: 'BATCH-FR115-P2' },
      ],
    });

    const fr115Warnings = second.warnings.filter((w) => w.includes('FR115'));
    expect(fr115Warnings.length).toBe(0);
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

describe('inventoryService.rejectGoodsReceipt — lifecycle guard (422, not 409)', () => {
  it('throws GoodsReceiptLifecycleError (422) if GR already confirmed', async () => {
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

  it('throws GoodsReceiptLifecycleError (422) if GR already rejected', async () => {
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

// ---------------------------------------------------------------------------
// Tests — HTTP route-level (m1)
// ---------------------------------------------------------------------------

describe('HTTP routes — goods-receipts (m1)', () => {
  it('POST /api/v1/goods-receipts returns { data } envelope on successful create', async () => {
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const res = await request(app)
      .post('/api/v1/goods-receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationDepartmentId: departmentId,
        locationCode,
        lines: [
          {
            productId,
            receivedQty: 100,
            uomId,
            batchNumber: 'BATCH-HTTP-001',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.goodsReceiptId).toBeTruthy();
    expect(res.body.data.grTrn).toBeTruthy();
    // No warnings → meta absent
    expect(res.body.meta).toBeUndefined();
  });

  it('POST /api/v1/goods-receipts returns { data, meta: { warnings } } when FR114 fires', async () => {
    const { productId, departmentId, uomId, locationCode } = await seedFixtures();

    const res = await request(app)
      .post('/api/v1/goods-receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationDepartmentId: departmentId,
        locationCode,
        lines: [
          {
            productId,
            receivedQty: 200,
            // orderedQty passed via line: 200 > 1.5 × 100 → FR114
            orderedQty: 100,
            uomId,
            batchNumber: 'BATCH-HTTP-FR114-001',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.goodsReceiptId).toBeTruthy();
    expect(res.body.meta).toBeDefined();
    expect(Array.isArray(res.body.meta.warnings)).toBe(true);
    expect(res.body.meta.warnings.length).toBeGreaterThan(0);
    expect(res.body.meta.warnings.some((w: string) => w.includes('FR114'))).toBe(true);
  });
});
