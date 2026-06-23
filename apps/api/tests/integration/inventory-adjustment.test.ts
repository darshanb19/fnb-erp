/**
 * inventory-adjustment.test.ts — Wave 4.3 integration tests (TDD)
 *
 * Test matrix:
 *   1.  recordAdjustment with positive delta → draft status (no approval chain)
 *   2.  recordAdjustment with all reasonCodes → ValidationError if reasonCode missing (FR37)
 *   3.  recordAdjustment with approval chain (over threshold) → pending_approval
 *   4.  confirmAdjustment positive delta → stock incremented, movement recorded
 *   5.  confirmAdjustment negative delta → FEFO deduction, stock decremented
 *   6.  cancelAdjustment draft → status = cancelled
 *   7.  cancelAdjustment confirmed → AdjustmentLifecycleError
 *   8.  cancelAdjustment already cancelled → AdjustmentLifecycleError
 *   9.  HTTP POST /inventory-adjustments → 201 + { data: { adjustmentId, adjTrn, status } }
 *  10.  HTTP POST /inventory-adjustments/:id/confirm → 200 + { data: { status } }
 *  11.  HTTP POST /inventory-adjustments/:id/cancel → 200 + { data: { status } }
 *  12.  HTTP GET  /inventory-adjustments → 200 + paged list
 *  13.  HTTP GET  /inventory-adjustments/:id → 200 + document with lines
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
  inventoryAdjustments,
  adjustmentLines,
} from '../../src/db/schema/inventory.js';
import { approvalChains, type ApprovalChainStep } from '../../src/db/schema/approval-chains.js';
// users seeded via raw SQL in seedFixtures
import { inventoryService } from '../../src/services/inventory.service.js';
import { AdjustmentLifecycleError } from '../../src/errors/index.js';
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
      adjustment_lines,
      inventory_adjustments,
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

  // Test user (needed for approval chain + JWT)
  await raw.execute(sql`
    INSERT INTO users (id, brand_id, email, full_name, role, active, created_at, updated_at)
    VALUES (${TEST_USER_ID}::uuid, ${bid}::uuid, 'test-adj-user@fnberp.test', 'Test Adj User', 'brand_owner', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  token = signTestJwt({ userId: TEST_USER_ID, brandId: bid, role: 'brand_owner' });

  // Cluster
  const [cluster] = await raw
    .insert(clusters)
    .values({ brandId: bid, name: 'ADJ Test Cluster', active: true })
    .returning({ id: clusters.id });
  if (!cluster) throw new Error('cluster seed failed');

  // Location (no locationCode on the table; code lives in a trn, not location record)
  const [location] = await raw
    .insert(locations)
    .values({
      brandId: bid,
      clusterId: cluster.id,
      name: 'ADJ Test Location',
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
      name: 'ADJ Test Dept',
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
      code: 'kg',
      displayName: 'Kilograms',
      base: 'mass',
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
      name: 'ADJ Ingredient',
      sku: 'ADJ-ING-001',
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
    VALUES (${brandId}::uuid, ${productId}::uuid, ${departmentId}::uuid, ${'SEED-ADJ-' + Date.now()}, ${qty}, ${today}, ${uomId}::uuid, 'opening', false)
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

describe('inventoryService.recordAdjustment', () => {
  it('T1 — creates draft adjustment with positive delta (no approval chain)', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [
        { productId: seed.productId, delta: 5, reasonCode: 'STOCK_COUNT_GAIN' },
      ],
    });

    expect(result.adjustmentId).toBeTruthy();
    expect(result.adjTrn).toMatch(/^ADJ-\d{4}-TST-\d{6}$/);
    expect(result.status).toBe('draft');
    expect(result.approvalRequestId).toBeNull();

    // Verify row in DB
    const raw = unscopedDb();
    const rows = await raw
      .select()
      .from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.id, result.adjustmentId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('draft');
  });

  it('T2 — throws ValidationError if reasonCode missing on any line (FR37)', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    await expect(
      inventoryService.recordAdjustment(db, {
        departmentId: seed.deptId,
        locationCode: seed.locationCode,
        requestedByUserId: null,
        lines: [
          { productId: seed.productId, delta: 5, reasonCode: '' },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('T3 — routes to pending_approval when approval chain exists (over threshold)', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    const raw = unscopedDb();

    // Seed an active inventory_adjustment approval chain
    await raw.insert(approvalChains).values({
      brandId: seed.brandId,
      entityType: 'inventory_adjustment',
      name: 'ADJ Approval Chain',
      steps: JSON.stringify([
        {
          stepIndex: 0,
          role: 'brand_owner',
          valueBandMin: 0,
          escalationTimeoutMinutes: 60,
        } satisfies ApprovalChainStep,
      ]) as unknown as ApprovalChainStep[],
      status: 'active',
      createdBy: TEST_USER_ID,
      lastModifiedBy: TEST_USER_ID,
      lastModifiedAt: new Date(),
    });

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [
        { productId: seed.productId, delta: 10, reasonCode: 'AUDIT_CORRECTION', costPerUnit: 100 },
      ],
    });

    // With an active chain and a real userId, should route to pending_approval
    expect(result.status).toBe('pending_approval');
    expect(result.approvalRequestId).toBeTruthy();
  });
});

describe('inventoryService.confirmAdjustment', () => {
  it('T4 — positive delta increments stock', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [
        { productId: seed.productId, delta: 5, reasonCode: 'GAIN' },
      ],
    });

    await inventoryService.confirmAdjustment(db, result.adjustmentId, {
      confirmedBy: null,
    });

    // Check adjustment status
    const raw = unscopedDb();
    const rows = await raw
      .select()
      .from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.id, result.adjustmentId));
    expect(rows[0]!.status).toBe('confirmed');

    // Check stock was created (new batch for positive delta)
    const batchRows = await raw
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.productId, seed.productId));
    expect(batchRows.length).toBeGreaterThan(0);
    const totalQty = batchRows.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    expect(totalQty).toBeGreaterThanOrEqual(5);
  });

  it('T5 — negative delta deducts via FEFO', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();
    await seedStock(seed.brandId, seed.productId, seed.deptId, seed.uomId, 20);

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [
        { productId: seed.productId, delta: -5, reasonCode: 'WRITE_OFF' },
      ],
    });

    await inventoryService.confirmAdjustment(db, result.adjustmentId, {
      confirmedBy: null,
    });

    const raw = unscopedDb();
    const batchRows = await raw
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.productId, seed.productId));
    const totalQty = batchRows.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    expect(totalQty).toBe(15); // 20 - 5
  });
});

describe('inventoryService.cancelAdjustment', () => {
  it('T6 — cancels a draft adjustment', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 5, reasonCode: 'TEST' }],
    });

    await inventoryService.cancelAdjustment(db, result.adjustmentId, {
      cancelledBy: null,
    });

    const raw = unscopedDb();
    const rows = await raw
      .select()
      .from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.id, result.adjustmentId));
    expect(rows[0]!.status).toBe('cancelled');
  });

  it('T7 — throws AdjustmentLifecycleError when cancelling a confirmed adjustment', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 5, reasonCode: 'GAIN' }],
    });

    await inventoryService.confirmAdjustment(db, result.adjustmentId, { confirmedBy: null });

    await expect(
      inventoryService.cancelAdjustment(db, result.adjustmentId, { cancelledBy: null }),
    ).rejects.toBeInstanceOf(AdjustmentLifecycleError);
  });

  it('T8 — throws AdjustmentLifecycleError when cancelling an already-cancelled adjustment', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const result = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 5, reasonCode: 'TEST' }],
    });

    await inventoryService.cancelAdjustment(db, result.adjustmentId, { cancelledBy: null });

    await expect(
      inventoryService.cancelAdjustment(db, result.adjustmentId, { cancelledBy: null }),
    ).rejects.toBeInstanceOf(AdjustmentLifecycleError);
  });
});

// ---------------------------------------------------------------------------
// HTTP route tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/inventory-adjustments', () => {
  it('T9 — returns 201 with { data: { adjustmentId, adjTrn, status } }', async () => {
    const seed = await seedFixtures();

    const res = await request(app)
      .post('/api/v1/inventory-adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId: seed.deptId,
        locationCode: seed.locationCode,
        lines: [
          { productId: seed.productId, delta: 3, reasonCode: 'STOCK_COUNT_GAIN' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      adjustmentId: expect.any(String),
      adjTrn: expect.stringMatching(/^ADJ-/),
      status: expect.stringMatching(/^(draft|pending_approval)$/),
    });
  });

  it('T9b — returns 400 when reasonCode is missing (FR37)', async () => {
    const seed = await seedFixtures();

    const res = await request(app)
      .post('/api/v1/inventory-adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        departmentId: seed.deptId,
        locationCode: seed.locationCode,
        lines: [
          { productId: seed.productId, delta: 3, reasonCode: '' },
        ],
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/inventory-adjustments/:id/confirm', () => {
  it('T10 — returns 200 with { data: { status: confirmed } }', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const adj = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 2, reasonCode: 'GAIN' }],
    });

    const res = await request(app)
      .post(`/api/v1/inventory-adjustments/${adj.adjustmentId}/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'confirmed' });
  });
});

describe('POST /api/v1/inventory-adjustments/:id/cancel', () => {
  it('T11 — returns 200 with { data: { status: cancelled } }', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const adj = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 2, reasonCode: 'CANCEL_TEST' }],
    });

    const res = await request(app)
      .post(`/api/v1/inventory-adjustments/${adj.adjustmentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'cancelled' });
  });
});

describe('GET /api/v1/inventory-adjustments', () => {
  it('T12 — returns 200 with paged list', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    // Create two adjustments
    await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 1, reasonCode: 'R1' }],
    });
    await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [{ productId: seed.productId, delta: 2, reasonCode: 'R2' }],
    });

    const res = await request(app)
      .get('/api/v1/inventory-adjustments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta).toMatchObject({ total: expect.any(Number), limit: expect.any(Number), offset: expect.any(Number) });
  });
});

describe('GET /api/v1/inventory-adjustments/:id', () => {
  it('T13 — returns 200 with document + lines', async () => {
    const seed = await seedFixtures();
    const { db } = getTestBrandedDb();

    const adj = await inventoryService.recordAdjustment(db, {
      departmentId: seed.deptId,
      locationCode: seed.locationCode,
      requestedByUserId: null,
      lines: [
        { productId: seed.productId, delta: 4, reasonCode: 'COUNT_GAIN' },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/inventory-adjustments/${adj.adjustmentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: adj.adjustmentId,
      adjTrn: adj.adjTrn,
    });
    expect(Array.isArray(res.body.data.lines)).toBe(true);
    expect(res.body.data.lines.length).toBe(1);
  });

  it('T13b — returns 404 for unknown id', async () => {
    await seedFixtures();
    const res = await request(app)
      .get('/api/v1/inventory-adjustments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
