/**
 * closing-inventory.test.ts — Wave 4.3 integration tests (TDD)
 *
 * Test matrix:
 *   1.  recordClosingInventory → { closingId, ciTrn, warnings: [] }
 *   2.  recordClosingInventory FR114 implausibility → warnings[] populated
 *   3.  recordClosingInventory FR37 — reasonCode required when variance != 0
 *   4.  confirmClosing no variance → status = confirmed
 *   5.  confirmClosing with variance → status = variance_flagged
 *   6.  markVarianceAcceptable → varianceAcceptable = true
 *   7.  markVarianceAcceptable when status != variance_flagged → ClosingInventoryLifecycleError
 *   8.  getClosingInventorySummary → returns counts per status
 *   9.  checkCutOffCompliance no cut-off → status = no_cutoff_configured
 *  10.  HTTP POST /closing-inventory → 201 + { data: { closingId, ciTrn } }
 *  11.  HTTP POST /closing-inventory/:id/confirm → 200 + { data: { status } }
 *  12.  HTTP POST /closing-inventory/:id/mark-variance-ok → 200
 *  13.  HTTP GET  /closing-inventory/summary?businessDate=... → 200 + summary
 *  14.  HTTP GET  /closing-inventory/:id → 200 + document with lines
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
import {
  uoms,
  products,
  enablementMatrix,
  stockLevels,
  stockBatches,
  closingInventory,
  closingInventoryLines,
} from '../../src/db/schema/inventory.js';
// users seeded via raw SQL in seedFixtures
import { inventoryService } from '../../src/services/inventory.service.js';
import { ClosingInventoryLifecycleError } from '../../src/errors/index.js';
import { ValidationError } from '../../src/errors/index.js';
import { createApp } from '../../src/index.js';
import { signTestJwt } from '../../src/lib/test-jwt.js';
import type { Application } from 'express';

// ---------------------------------------------------------------------------
// Global setup
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
let app: Application;
let token: string;
let testBrandId: string;

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
  app = createApp();
  const { testBrandId: bid } = getTestBrandedDb();
  testBrandId = bid;
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
  const raw = unscopedDb();
  await raw.execute(sql`
    TRUNCATE TABLE
      closing_inventory_lines,
      closing_inventory,
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
  locationCode: string;
  clusterId: string;
  locationId: string;
  deptId: string;
  productId: string;
  uomId: string;
}

async function seedFixtures(): Promise<SeedResult> {
  const { testBrandId: bid } = getTestBrandedDb();
  const raw = unscopedDb();

  // Test user
  await raw.execute(sql`
    INSERT INTO users (id, brand_id, email, full_name, role, active, created_at, updated_at)
    VALUES (${TEST_USER_ID}::uuid, ${bid}::uuid, 'test-ci-user@fnberp.test', 'Test CI User', 'brand_owner', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  token = signTestJwt({ userId: TEST_USER_ID, brandId: bid, role: 'brand_owner' });

  // Cluster
  const [cluster] = await raw
    .insert(clusters)
    .values({ brandId: bid, name: 'CI Test Cluster', active: true })
    .returning({ id: clusters.id });
  if (!cluster) throw new Error('cluster seed failed');

  // Location
  const [location] = await raw
    .insert(locations)
    .values({
      brandId: bid,
      clusterId: cluster.id,
      name: 'CI Test Location',
      type: 'central_kitchen' as const,
      active: true,
    })
    .returning({ id: locations.id });
  if (!location) throw new Error('location seed failed');

  // Department
  const [dept] = await raw
    .insert(departments)
    .values({
      brandId: bid,
      locationId: location.id,
      name: 'CI Test Dept',
      type: 'production' as const,
      active: true,
    })
    .returning({ id: departments.id });
  if (!dept) throw new Error('dept seed failed');

  // UOM
  const [uom] = await raw
    .insert(uoms)
    .values({
      brandId: bid,
      code: 'ltr',
      displayName: 'Litres',
      base: 'volume',
      conversionToBaseFactor: '1.000000000',
      active: true,
    })
    .returning({ id: uoms.id });
  if (!uom) throw new Error('uom seed failed');

  // Product
  const [product] = await raw
    .insert(products)
    .values({
      brandId: bid,
      name: 'Milk CI',
      sku: 'CI-MILK-001',
      type: 'raw',
      defaultUomId: uom.id,
      active: true,
    })
    .returning({ id: products.id });
  if (!product) throw new Error('product seed failed');

  // Enablement
  await raw.insert(enablementMatrix).values({
    brandId: bid,
    productId: product.id,
    departmentId: dept.id,
    enabled: true,
  });

  return {
    brandId: bid,
    locationCode: 'TST',
    clusterId: cluster.id,
    locationId: location.id,
    deptId: dept.id,
    productId: product.id,
    uomId: uom.id,
  };
}

async function seedStock(
  brandId: string,
  productId: string,
  departmentId: string,
  uomId: string,
  qty: number,
): Promise<void> {
  const raw = unscopedDb();
  const today = new Date().toISOString().split('T')[0]!;
  await raw.execute(sql`
    INSERT INTO stock_batches (brand_id, product_id, department_id, batch_number, quantity_remaining, received_date, uom_id, source_type, provisional)
    VALUES (${brandId}::uuid, ${productId}::uuid, ${departmentId}::uuid, ${'SEED-CI-' + Date.now()}, ${qty}, ${today}, ${uomId}::uuid, 'opening', false)
  `);
  await raw.execute(sql`
    INSERT INTO stock_levels (brand_id, product_id, department_id, quantity, uom_id)
    VALUES (${brandId}::uuid, ${productId}::uuid, ${departmentId}::uuid, ${qty}, ${uomId}::uuid)
    ON CONFLICT (brand_id, product_id, department_id) DO UPDATE
    SET quantity = stock_levels.quantity + EXCLUDED.quantity
  `);
}

// ---------------------------------------------------------------------------
// Service-layer tests
// ---------------------------------------------------------------------------

describe('inventoryService.recordClosingInventory', () => {
  it('T1 — creates draft closing document with no warnings for zero-variance count', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    // No stock movements → expected = 0; count 0 → variance = 0, no warning

    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [
        { itemId: seed.productId, countedQty: 0 },
      ],
    });

    expect(result.closingId).toBeTruthy();
    expect(result.ciTrn).toMatch(/^CI-\d{4}-TST-\d{6}$/);
    expect(result.warnings).toHaveLength(0);
  });

  it('T2 — FR114: populates warnings when countedQty implausibly high vs expected', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    await seedStock(seed.brandId, seed.productId, seed.deptId, seed.uomId, 10);

    // We need stock_movements to exist for expectedQty to be non-zero.
    // Seed a movement directly (simulates a receipt of 10 units)
    const raw = unscopedDb();
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL)
    `);

    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [
        { itemId: seed.productId, countedQty: 20, reasonCode: 'OVERSTOCK' }, // 20 > 10 * 1.5 = FR114 trigger
      ],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('FR114');
  });

  it('T3 — FR37: throws ValidationError when variance != 0 and reasonCode missing', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Seed expected qty of 10 via movement
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL)
    `);

    // Count 5 (variance = -5) but no reasonCode → FR37 violation
    await expect(
      inventoryService.recordClosingInventory(db, {
        locationId: seed.locationId,
        departmentId: seed.deptId,
        businessDate: '2026-06-23',
        locationCode: seed.locationCode,
        actorUserId: null,
        lines: [
          { itemId: seed.productId, countedQty: 5 }, // reasonCode omitted
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('T3b — m3: movements AFTER businessDate are excluded from expected qty', async () => {
    // This test verifies the m3 fix: getExpectedClosingStock filters by
    // created_at::date <= businessDate. A movement dated after the business date
    // must NOT influence the expected qty for that date.
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Insert a movement on businessDate '2026-06-20' (BEFORE our target date)
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id, created_at)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL, '2026-06-20 10:00:00+00')
    `);

    // Insert a movement AFTER the businessDate '2026-06-22' (should be excluded when querying for '2026-06-21')
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id, created_at)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '5', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL, '2026-06-22 10:00:00+00')
    `);

    // Query expected stock for businessDate '2026-06-21' — should only include the 10-unit movement, not the 5-unit post-date movement
    const expectedMap = await inventoryService.getExpectedClosingStock(
      db,
      seed.locationId,
      seed.deptId,
      '2026-06-21',
    );

    // Only the movement on 2026-06-20 (qty=10) should be included; the 2026-06-22 movement (qty=5) excluded
    expect(expectedMap.get(seed.productId)).toBe(10);
  });
});

describe('inventoryService.confirmClosing', () => {
  it('T4 — zero variance → status = confirmed', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });

    const closeResult = await inventoryService.confirmClosing(db, result.closingId, null);
    expect(closeResult.status).toBe('confirmed');

    const raw = unscopedDb();
    const rows = await raw
      .select()
      .from(closingInventory)
      .where(eq(closingInventory.id, result.closingId));
    expect(rows[0]!.status).toBe('confirmed');
  });

  it('T5 — non-zero variance → status = variance_flagged, variance_items_count > 0', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    await seedStock(seed.brandId, seed.productId, seed.deptId, seed.uomId, 10);

    const raw = unscopedDb();
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL)
    `);

    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 8, reasonCode: 'SHRINKAGE' }],
    });

    const closeResult5 = await inventoryService.confirmClosing(db, result.closingId, null);
    expect(closeResult5.status).toBe('variance_flagged');

    const rows = await raw
      .select()
      .from(closingInventory)
      .where(eq(closingInventory.id, result.closingId));
    expect(rows[0]!.status).toBe('variance_flagged');
    expect(Number(rows[0]!.varianceItemsCount ?? 0)).toBeGreaterThan(0);
  });
});

describe('inventoryService.markVarianceAcceptable', () => {
  it('T6 — sets varianceAcceptable = true on variance_flagged document', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Seed movement to create expected qty
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL)
    `);
    await seedStock(seed.brandId, seed.productId, seed.deptId, seed.uomId, 10);

    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 7, reasonCode: 'ACCEPTED_SHRINKAGE' }],
    });

    await inventoryService.confirmClosing(db, result.closingId, null);
    await inventoryService.markVarianceAcceptable(db, result.closingId, null);

    const rows = await raw
      .select()
      .from(closingInventory)
      .where(eq(closingInventory.id, result.closingId));
    expect(rows[0]!.varianceAcceptable).toBe(true);
  });

  it('T7 — throws ClosingInventoryLifecycleError when status != variance_flagged', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    // Create a confirmed (no-variance) document
    const result = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-23',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });

    await inventoryService.confirmClosing(db, result.closingId, null);

    // Now try markVarianceAcceptable on a 'confirmed' (no-variance) document → error
    await expect(
      inventoryService.markVarianceAcceptable(db, result.closingId, null),
    ).rejects.toBeInstanceOf(ClosingInventoryLifecycleError);
  });
});

describe('inventoryService.getClosingInventorySummary', () => {
  it('T8 — returns counts per status for a given date', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    // Create one confirmed document
    const r1 = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-24',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });
    await inventoryService.confirmClosing(db, r1.closingId, null);

    const summary = await inventoryService.getClosingInventorySummary(
      db,
      { locationId: seed.locationId },
      '2026-06-24',
    );

    expect(summary.businessDate).toBe('2026-06-24');
    expect(summary.totalRecords).toBeGreaterThanOrEqual(1);
    expect(summary.confirmedCount).toBeGreaterThanOrEqual(1);
  });
});

describe('inventoryService.checkCutOffCompliance', () => {
  it('T9 — returns no_cutoff_configured when no cut_off_registry row', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.checkCutOffCompliance(
      db,
      { locationId: seed.locationId, departmentId: seed.deptId },
      '2026-06-23',
    );

    expect(result.status).toBe('no_cutoff_configured');
  });

  it('T9b — DL-046: compares the submission time in IST (Asia/Kolkata), not server-local UTC', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Cut-off 22:00 IST for this department.
    await raw.execute(sql`
      INSERT INTO cut_off_registry (brand_id, location_id, department_id, cut_off_time)
      VALUES (${seed.brandId}, ${seed.locationId}, ${seed.deptId}, '22:00')
    `);

    const ci = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-30',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });

    // 17:00Z == 22:30 IST → AFTER the 22:00 IST cut-off → late.
    // (Pre-fix, a UTC server read 17:00 < 22:00 and wrongly reported on_time.)
    await raw.execute(sql`
      UPDATE closing_inventory SET submission_timestamp = '2026-06-30T17:00:00Z' WHERE id = ${ci.closingId}
    `);
    const late = await inventoryService.checkCutOffCompliance(
      db,
      { locationId: seed.locationId, departmentId: seed.deptId },
      '2026-06-30',
    );
    expect(late.status).toBe('late');

    // 16:00Z == 21:30 IST → BEFORE the 22:00 IST cut-off → on_time.
    await raw.execute(sql`
      UPDATE closing_inventory SET submission_timestamp = '2026-06-30T16:00:00Z' WHERE id = ${ci.closingId}
    `);
    const onTime = await inventoryService.checkCutOffCompliance(
      db,
      { locationId: seed.locationId, departmentId: seed.deptId },
      '2026-06-30',
    );
    expect(onTime.status).toBe('on_time');
  });
});

// ---------------------------------------------------------------------------
// HTTP route tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/closing-inventory', () => {
  it('T10 — returns 201 with { data: { closingId, ciTrn } }', async () => {
    const seed = await seedFixtures();

    const res = await request(app)
      .post('/api/v1/closing-inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: seed.locationId,
        departmentId: seed.deptId,
        businessDate: '2026-06-25',
        locationCode: seed.locationCode,
        lines: [
          { itemId: seed.productId, countedQty: 0 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      closingId: expect.any(String),
      ciTrn: expect.stringMatching(/^CI-/),
    });
  });
});

describe('POST /api/v1/closing-inventory/:id/confirm', () => {
  it('T11 — returns 200 with { data: { status } }', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const ci = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-26',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });

    const res = await request(app)
      .post(`/api/v1/closing-inventory/${ci.closingId}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
  });
});

describe('POST /api/v1/closing-inventory/:id/mark-variance-ok', () => {
  it('T12 — returns 200 with { data: { varianceAcceptable: true } }', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Seed a movement for expected qty
    await raw.execute(sql`
      INSERT INTO stock_movements (brand_id, product_id, department_id, movement_type, quantity_delta, uom_id, source_type, source_id, actor_user_id)
      VALUES (${seed.brandId}, ${seed.productId}, ${seed.deptId}, 'receipt', '10', ${seed.uomId}, 'goods_receipt', gen_random_uuid(), NULL)
    `);
    await seedStock(seed.brandId, seed.productId, seed.deptId, seed.uomId, 10);

    const ci = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-27',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 8, reasonCode: 'SHRINKAGE' }],
    });

    await inventoryService.confirmClosing(db, ci.closingId, null);

    const res = await request(app)
      .post(`/api/v1/closing-inventory/${ci.closingId}/mark-variance-ok`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ varianceAcceptable: true });
  });
});

describe('GET /api/v1/closing-inventory/summary', () => {
  it('T13 — returns 200 with summary object', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-28',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 0 }],
    });

    const res = await request(app)
      .get('/api/v1/closing-inventory/summary')
      .query({ businessDate: '2026-06-28' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      businessDate: '2026-06-28',
      totalRecords: expect.any(Number),
    });
  });
});

describe('GET /api/v1/closing-inventory/:id', () => {
  it('T14 — returns 200 with document + lines', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const ci = await inventoryService.recordClosingInventory(db, {
      locationId: seed.locationId,
      departmentId: seed.deptId,
      businessDate: '2026-06-29',
      locationCode: seed.locationCode,
      actorUserId: null,
      lines: [{ itemId: seed.productId, countedQty: 5, reasonCode: 'COUNT' }],
    });

    const res = await request(app)
      .get(`/api/v1/closing-inventory/${ci.closingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: ci.closingId });
    expect(Array.isArray(res.body.data.lines)).toBe(true);
  });
});
