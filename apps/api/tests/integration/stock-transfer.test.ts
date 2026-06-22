/**
 * stock-transfer.test.ts — Task 3.2 / 3.3 integration tests (TDD)
 *
 * Tests for:
 *   transferService.createDraft
 *   transferService.submitTransfer
 *   transferService.confirmReceipt
 *   transferService.cancelTransfer
 *   transferService.getTransferDetail
 *   transferService.createBundledTransfer
 *   transferService.confirmBundleApproval
 *   transferService.suggestTransfers / rankTransferSuggestions
 *   transferService.dismissSuggestion
 *   (private) validateTransferFlow — tested via public methods
 *
 * Flow-rule test matrix (spec §7 + DL-043):
 *   1. Semi-product lateral within cluster → OK
 *   2. Raw dept→dept within cluster → OK (DL-043 deviation)
 *   3. Cross-cluster transfer → ClusterBoundaryError
 *   4. Final product production→dispatch→POS → OK
 *   5. Final product POS→POS lateral → FlowDirectionError
 *   6. Final product backward (dispatch→production) → FlowDirectionError
 *   7. Destination not enabled → EnablementViolationError
 *   8. confirmReceipt increments destination stock
 *   9. cancelTransfer pre-approval → cleans up (draft/pending_approval → cancelled)
 *  10. cancelTransfer post-approval → TransferLifecycleError (compensating doc required)
 *  11. Bundle decomposition into two distinct st_trns on confirmBundleApproval
 *  12. dismissSuggestion persists dismissal record
 *  13. suggestTransfers returns live computed suggestions (not dismissed)
 *  14. HTTP route — POST /stock-transfers returns { data } envelope
 *  15. HTTP route — POST /stock-transfers/:id/cancel returns { data }
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
import { clusters, locations, departments, stores } from '../../src/db/schema/org.js';
import {
  uoms,
  products,
  enablementMatrix,
  stockLevels,
  stockBatches,
  stockTransfers,
  stockTransferLines,
  transferBundles,
  transferSuggestionDismissals,
} from '../../src/db/schema/inventory.js';
import { users } from '../../src/db/schema/auth.js';
import { transferService } from '../../src/services/transfer.service.js';
import {
  ClusterBoundaryError,
  FlowDirectionError,
  EnablementViolationError,
  TransferLifecycleError,
} from '../../src/errors/index.js';
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
  const raw = unscopedDb();
  await raw.execute(sql`
    TRUNCATE TABLE
      transfer_suggestion_dismissals,
      transfer_bundle_legs,
      transfer_bundles,
      stock_transfer_lines,
      stock_transfers,
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
  clusterId: string;
  cluster2Id: string;
  locationId: string;
  location2Id: string;
  // Departments in cluster 1 (same location = central_kitchen)
  productionDeptId: string;
  dispatchDeptId: string;
  rawDept1Id: string;
  // Department in cluster 2 (different location)
  remoteDeptId: string;
  // POS location + department (for final product tests)
  posLocationId: string;
  posDeptId: string;
  // Raw product
  rawProductId: string;
  // Semi product
  semiProductId: string;
  // Final product
  finalProductId: string;
  // Cluster-level store (for bundles)
  storeId: string;
  locationCode: string;
}

async function seedFixtures(): Promise<SeedResult> {
  const { testBrandId } = getTestBrandedDb();
  const raw = unscopedDb();

  // Seed test user (needed for FK constraints on requested_by_user_id etc.)
  await raw.execute(sql`
    INSERT INTO users (id, brand_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${TEST_USER_ID}::uuid,
      ${testBrandId}::uuid,
      'test-transfer-user@fnberp.test',
      'Test Transfer User',
      'brand_owner',
      true,
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);

  // Cluster 1 (source cluster)
  const [cluster1] = await raw
    .insert(clusters)
    .values({ brandId: testBrandId, name: 'ST Test Cluster 1', active: true })
    .returning({ id: clusters.id });
  if (!cluster1) throw new Error('seed: cluster1 insert failed');

  // Cluster 2 (destination cluster — for cross-cluster tests)
  const [cluster2] = await raw
    .insert(clusters)
    .values({ brandId: testBrandId, name: 'ST Test Cluster 2', active: true })
    .returning({ id: clusters.id });
  if (!cluster2) throw new Error('seed: cluster2 insert failed');

  // Location 1 — central_kitchen in cluster 1
  const [location1] = await raw
    .insert(locations)
    .values({
      brandId: testBrandId,
      clusterId: cluster1.id,
      name: 'ST Test Location 1',
      type: 'central_kitchen',
      active: true,
    })
    .returning({ id: locations.id });
  if (!location1) throw new Error('seed: location1 insert failed');

  // Location 2 — cluster_store in cluster 2
  const [location2] = await raw
    .insert(locations)
    .values({
      brandId: testBrandId,
      clusterId: cluster2.id,
      name: 'ST Test Location 2',
      type: 'cluster_store',
      active: true,
    })
    .returning({ id: locations.id });
  if (!location2) throw new Error('seed: location2 insert failed');

  // POS location in cluster 1
  const [posLocation] = await raw
    .insert(locations)
    .values({
      brandId: testBrandId,
      clusterId: cluster1.id,
      name: 'ST POS Location',
      type: 'pos_outlet',
      active: true,
    })
    .returning({ id: locations.id });
  if (!posLocation) throw new Error('seed: posLocation insert failed');

  // Departments in cluster 1 location
  const [productionDept] = await raw
    .insert(departments)
    .values({
      brandId: testBrandId,
      locationId: location1.id,
      name: 'Production Dept',
      type: 'production',
      active: true,
    })
    .returning({ id: departments.id });
  if (!productionDept) throw new Error('seed: productionDept insert failed');

  const [dispatchDept] = await raw
    .insert(departments)
    .values({
      brandId: testBrandId,
      locationId: location1.id,
      name: 'Dispatch Dept',
      type: 'dispatch',
      active: true,
    })
    .returning({ id: departments.id });
  if (!dispatchDept) throw new Error('seed: dispatchDept insert failed');

  const [rawDept1] = await raw
    .insert(departments)
    .values({
      brandId: testBrandId,
      locationId: location1.id,
      name: 'Raw Dept 1',
      type: 'non_production',
      active: true,
    })
    .returning({ id: departments.id });
  if (!rawDept1) throw new Error('seed: rawDept1 insert failed');

  // Department in cluster 2
  const [remoteDept] = await raw
    .insert(departments)
    .values({
      brandId: testBrandId,
      locationId: location2.id,
      name: 'Remote Dept (Cluster 2)',
      type: 'non_production',
      active: true,
    })
    .returning({ id: departments.id });
  if (!remoteDept) throw new Error('seed: remoteDept insert failed');

  // POS department (pos_outlet location)
  const [posDept] = await raw
    .insert(departments)
    .values({
      brandId: testBrandId,
      locationId: posLocation.id,
      name: 'POS Dept',
      type: 'store',
      active: true,
    })
    .returning({ id: departments.id });
  if (!posDept) throw new Error('seed: posDept insert failed');

  // UOM
  const [uom] = await raw
    .insert(uoms)
    .values({
      brandId: testBrandId,
      code: 'kg',
      displayName: 'Kilograms',
      base: 'mass',
      conversionToBaseFactor: '1.000000000',
      active: true,
    })
    .returning({ id: uoms.id });
  if (!uom) throw new Error('seed: uom insert failed');

  // Raw product
  const [rawProduct] = await raw
    .insert(products)
    .values({
      brandId: testBrandId,
      sku: 'ST-RAW-001',
      name: 'ST Raw Ingredient',
      type: 'raw',
      defaultUomId: uom.id,
      active: true,
    })
    .returning({ id: products.id });
  if (!rawProduct) throw new Error('seed: rawProduct insert failed');

  // Semi product
  const [semiProduct] = await raw
    .insert(products)
    .values({
      brandId: testBrandId,
      sku: 'ST-SEMI-001',
      name: 'ST Semi Product',
      type: 'semi_product',
      defaultUomId: uom.id,
      active: true,
    })
    .returning({ id: products.id });
  if (!semiProduct) throw new Error('seed: semiProduct insert failed');

  // Final product
  const [finalProduct] = await raw
    .insert(products)
    .values({
      brandId: testBrandId,
      sku: 'ST-FINAL-001',
      name: 'ST Final Product',
      type: 'final',
      defaultUomId: uom.id,
      active: true,
    })
    .returning({ id: products.id });
  if (!finalProduct) throw new Error('seed: finalProduct insert failed');

  // Enable all products in all relevant departments
  const enablementPairs = [
    // raw product in production, dispatch, rawDept1
    { productId: rawProduct.id, departmentId: productionDept.id },
    { productId: rawProduct.id, departmentId: dispatchDept.id },
    { productId: rawProduct.id, departmentId: rawDept1.id },
    // semi product in production + dispatch
    { productId: semiProduct.id, departmentId: productionDept.id },
    { productId: semiProduct.id, departmentId: dispatchDept.id },
    // final product in production, dispatch, pos
    { productId: finalProduct.id, departmentId: productionDept.id },
    { productId: finalProduct.id, departmentId: dispatchDept.id },
    { productId: finalProduct.id, departmentId: posDept.id },
  ];

  for (const pair of enablementPairs) {
    await raw
      .insert(enablementMatrix)
      .values({
        brandId: testBrandId,
        productId: pair.productId,
        departmentId: pair.departmentId,
        enabled: true,
        lastModifiedAt: new Date(),
      });
  }

  // Cluster-level store (for bundle tests)
  const [store] = await raw
    .insert(stores)
    .values({ brandId: testBrandId, level: 'cluster', clusterId: cluster1.id, name: 'Test Store', active: true })
    .returning({ id: stores.id });
  if (!store) throw new Error('seed: store insert failed');

  return {
    brandId: testBrandId,
    uomId: uom.id,
    clusterId: cluster1.id,
    cluster2Id: cluster2.id,
    locationId: location1.id,
    location2Id: location2.id,
    productionDeptId: productionDept.id,
    dispatchDeptId: dispatchDept.id,
    rawDept1Id: rawDept1.id,
    remoteDeptId: remoteDept.id,
    posLocationId: posLocation.id,
    posDeptId: posDept.id,
    rawProductId: rawProduct.id,
    semiProductId: semiProduct.id,
    finalProductId: finalProduct.id,
    storeId: store.id,
    locationCode: 'TEST',
  };
}

/** Seed stock into a department (inserts directly into stock_batches + stock_levels) */
async function seedStock(
  brandId: string,
  productId: string,
  departmentId: string,
  uomId: string,
  qty: number,
  batchSuffix = '001',
): Promise<void> {
  const raw = unscopedDb();
  const today = new Date().toISOString().split('T')[0]!;
  await raw.execute(sql`
    INSERT INTO stock_batches (brand_id, product_id, department_id, batch_number, quantity_remaining, received_date, uom_id, source_type, provisional)
    VALUES (${brandId}, ${productId}, ${departmentId}, ${'SEED-BATCH-' + batchSuffix}, ${qty}, ${today}, ${uomId}, 'opening', false)
  `);
  await raw.execute(sql`
    INSERT INTO stock_levels (brand_id, product_id, department_id, quantity, uom_id)
    VALUES (${brandId}, ${productId}, ${departmentId}, ${qty}, ${uomId})
    ON CONFLICT (brand_id, product_id, department_id) DO UPDATE
    SET quantity = stock_levels.quantity + EXCLUDED.quantity
  `);
}

// ---------------------------------------------------------------------------
// Tests — Flow-rule validation
// ---------------------------------------------------------------------------

describe('transferService.validateTransferFlow', () => {

  it('1. semi-product lateral within cluster → createDraft succeeds', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    // Seed stock of semi product at production dept
    await seedStock(seed.brandId, seed.semiProductId, seed.productionDeptId, seed.uomId, 10);

    const result = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.dispatchDeptId,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.semiProductId, requestedQty: 5 }],
    });

    expect(result.transferId).toBeTruthy();
    expect(result.stTrn).toMatch(/^ST-\d{4}-TEST-\d{6}$/);
  });

  it('2. raw dept→dept within cluster → createDraft succeeds (DL-043)', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 20);

    // Raw from production → rawDept1 (both within cluster 1)
    const result = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
    });

    expect(result.transferId).toBeTruthy();
  });

  it('3. cross-cluster transfer → ClusterBoundaryError', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    await expect(
      transferService.createDraft(db, {
        sourceDepartmentId: seed.productionDeptId,   // cluster 1
        destinationDepartmentId: seed.remoteDeptId,  // cluster 2
        locationCode: seed.locationCode,
        requestedByUserId: TEST_USER_ID,
        lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
      }),
    ).rejects.toThrow(ClusterBoundaryError);
  });

  it('4. final product production→dispatch → createDraft succeeds', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.finalProductId, seed.productionDeptId, seed.uomId, 10);

    const result = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.dispatchDeptId,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.finalProductId, requestedQty: 3 }],
    });

    expect(result.transferId).toBeTruthy();
  });

  it('4b. final product dispatch→POS → createDraft succeeds', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.finalProductId, seed.dispatchDeptId, seed.uomId, 10);

    const result = await transferService.createDraft(db, {
      sourceDepartmentId: seed.dispatchDeptId,
      destinationDepartmentId: seed.posDeptId,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.finalProductId, requestedQty: 3 }],
    });

    expect(result.transferId).toBeTruthy();
  });

  it('5. final product POS→POS lateral → FlowDirectionError', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    const raw = unscopedDb();

    // Create a second POS location + dept in same cluster
    const [posLoc2] = await raw.insert(locations).values({
      brandId: seed.brandId, clusterId: seed.clusterId,
      name: 'POS Location 2', type: 'pos_outlet', active: true,
    }).returning({ id: locations.id });
    if (!posLoc2) throw new Error('seed: posLoc2 failed');

    const [posDept2] = await raw.insert(departments).values({
      brandId: seed.brandId, locationId: posLoc2.id,
      name: 'POS Dept 2', type: 'store', active: true,
    }).returning({ id: departments.id });
    if (!posDept2) throw new Error('seed: posDept2 failed');

    // Enable final product in both POS depts
    await raw.insert(enablementMatrix).values({
      brandId: seed.brandId, productId: seed.finalProductId,
      departmentId: posDept2.id, enabled: true, lastModifiedAt: new Date(),
    });

    await seedStock(seed.brandId, seed.finalProductId, seed.posDeptId, seed.uomId, 10);

    await expect(
      transferService.createDraft(db, {
        sourceDepartmentId: seed.posDeptId,     // POS → POS = lateral = blocked
        destinationDepartmentId: posDept2.id,
        locationCode: seed.locationCode,
        requestedByUserId: TEST_USER_ID,
        lines: [{ productId: seed.finalProductId, requestedQty: 3 }],
      }),
    ).rejects.toThrow(FlowDirectionError);
  });

  it('6. final product backward (dispatch→production) → FlowDirectionError', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.finalProductId, seed.dispatchDeptId, seed.uomId, 10);

    await expect(
      transferService.createDraft(db, {
        sourceDepartmentId: seed.dispatchDeptId,    // backward direction
        destinationDepartmentId: seed.productionDeptId,
        locationCode: seed.locationCode,
        requestedByUserId: TEST_USER_ID,
        lines: [{ productId: seed.finalProductId, requestedQty: 3 }],
      }),
    ).rejects.toThrow(FlowDirectionError);
  });

  it('7. destination not enabled → EnablementViolationError', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    // rawDept1 is not enabled for finalProduct
    await seedStock(seed.brandId, seed.finalProductId, seed.productionDeptId, seed.uomId, 10);

    await expect(
      transferService.createDraft(db, {
        sourceDepartmentId: seed.productionDeptId,
        destinationDepartmentId: seed.rawDept1Id,  // not enabled for final product
        locationCode: seed.locationCode,
        requestedByUserId: TEST_USER_ID,
        lines: [{ productId: seed.finalProductId, requestedQty: 3 }],
      }),
    ).rejects.toThrow(EnablementViolationError);
  });
});

// ---------------------------------------------------------------------------
// Tests — Lifecycle transitions
// ---------------------------------------------------------------------------

describe('transferService lifecycle', () => {

  it('8. confirmReceipt increments destination stock', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 20);

    // Create + approve (bypass approval by calling submitTransfer which auto-approves
    // when no threshold chain is configured)
    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 10 }],
    });

    await transferService.submitTransfer(db, transferId, TEST_USER_ID);

    // Check source was deducted
    const srcLevel = await unscopedDb().execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.productionDeptId}
    `);
    const srcQty = Number((srcLevel as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(srcQty).toBe(10);  // 20 - 10 = 10

    // Confirm receipt at destination
    await transferService.confirmReceipt(db, transferId, { [seed.rawProductId]: 10 }, TEST_USER_ID);

    // Check destination was incremented
    const destLevel = await unscopedDb().execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.rawDept1Id}
    `);
    const destQty = Number((destLevel as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(destQty).toBe(10);
  });

  it('9. cancelTransfer pre-approval (draft) → cleans up (→ cancelled)', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
    });

    const result = await transferService.cancelTransfer(db, transferId, TEST_USER_ID);
    expect(result.status).toBe('cancelled');

    const detail = await transferService.getTransferDetail(db, transferId);
    expect(detail.status).toBe('cancelled');
  });

  it('10. cancelTransfer post-approval → TransferLifecycleError', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
    });

    // Submit → auto-approved (no threshold chain) → deducts source
    await transferService.submitTransfer(db, transferId, TEST_USER_ID);

    // Now try to cancel an in_transit/approved transfer
    await expect(
      transferService.cancelTransfer(db, transferId, TEST_USER_ID),
    ).rejects.toThrow(TransferLifecycleError);
  });

  it('getTransferDetail returns transfer with lines', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 7 }],
    });

    const detail = await transferService.getTransferDetail(db, transferId);
    expect(detail.id).toBe(transferId);
    expect(detail.status).toBe('draft');
    expect(detail.lines).toHaveLength(1);
    expect(Number(detail.lines[0]!.requestedQty)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Tests — Bundles
// ---------------------------------------------------------------------------

describe('transferService bundles', () => {

  it('11. bundle approval decomposes into two stock_transfers with distinct st_trns', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();

    // Create a bundle (cross-cluster)
    const { bundleId } = await transferService.createBundledTransfer(db, {
      originatingClusterId: seed.clusterId,
      destinationClusterId: seed.cluster2Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      productId: seed.rawProductId,
      qty: 5,
      uomId: seed.uomId,
      fromStoreId: seed.storeId,
      toStoreId: seed.storeId,  // reuse for test simplicity
    });

    expect(bundleId).toBeTruthy();

    // Confirm the bundle approval (which decomposes it)
    const result = await transferService.confirmBundleApproval(db, bundleId);
    expect(result.transferIds).toHaveLength(2);
    expect(result.transferIds[0]).not.toBe(result.transferIds[1]);

    // Each transfer should have a distinct st_trn
    const raw = unscopedDb();
    const [t1Id, t2Id] = result.transferIds;
    const transferRows = await raw.execute(sql`
      SELECT st_trn FROM stock_transfers WHERE id IN (${t1Id!}::uuid, ${t2Id!}::uuid)
    `);
    const trns = (transferRows as unknown as Array<{ st_trn: string }>).map((r) => r.st_trn);
    expect(trns).toHaveLength(2);
    expect(trns[0]).not.toBe(trns[1]);
    expect(trns[0]).toMatch(/^ST-/);
    expect(trns[1]).toMatch(/^ST-/);
  });
});

// ---------------------------------------------------------------------------
// Tests — Suggestions
// ---------------------------------------------------------------------------

describe('transferService suggestions', () => {

  it('12. dismissSuggestion persists dismissal record', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();

    // Build a fake suggestion ID (product + optional batch)
    const result = await transferService.dismissSuggestion(db, {
      productId: seed.rawProductId,
      batchId: null,
      dismissedByUserId: TEST_USER_ID,
      reasonCode: 'not_needed',
    });

    expect(result.dismissed).toBe(true);

    // Verify dismissal persisted
    const raw = unscopedDb();
    const rows = await raw.execute(sql`
      SELECT * FROM transfer_suggestion_dismissals
      WHERE product_id = ${seed.rawProductId}
        AND brand_id = ${seed.brandId}
    `);
    expect((rows as unknown as unknown[]).length).toBe(1);
  });

  it('13. suggestTransfers returns batches not in dismissals', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 50, '001');

    // Before dismissal — should see a suggestion
    const before = await transferService.suggestTransfers(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
    });
    expect(before.suggestions.length).toBeGreaterThan(0);

    // Dismiss the product
    await transferService.dismissSuggestion(db, {
      productId: seed.rawProductId,
      batchId: null,
      dismissedByUserId: TEST_USER_ID,
      reasonCode: 'no_demand',
    });

    // After dismissal — product should be excluded
    const after = await transferService.suggestTransfers(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
    });
    const stillPresent = after.suggestions.some((s) => s.productId === seed.rawProductId);
    expect(stillPresent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — HTTP Routes
// ---------------------------------------------------------------------------

describe('HTTP routes /stock-transfers', () => {

  it('14. POST /stock-transfers returns { data } envelope', async () => {
    const { testBrandId } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    token = signTestJwt({ userId: TEST_USER_ID, brandId: testBrandId });

    const res = await request(app)
      .post('/api/v1/stock-transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceDepartmentId: seed.productionDeptId,
        destinationDepartmentId: seed.rawDept1Id,
        locationCode: seed.locationCode,
        lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.transferId).toBeTruthy();
    expect(res.body.data.stTrn).toMatch(/^ST-/);
  });

  it('15. POST /stock-transfers/:id/cancel returns { data }', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 10);

    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 5 }],
    });

    token = signTestJwt({ userId: TEST_USER_ID, brandId: testBrandId });

    const res = await request(app)
      .post(`/api/v1/stock-transfers/${transferId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});
