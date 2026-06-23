/**
 * stock-transfer.test.ts — Task 3.2 / 3.3 integration tests (TDD)
 *
 * Tests for:
 *   transferService.createDraft
 *   transferService.submitTransfer
 *   transferService.approveTransfer (NEW — C2)
 *   transferService.dispatchTransfer (NEW — C1)
 *   transferService.confirmReceipt
 *   transferService.cancelTransfer
 *   transferService.getTransferDetail
 *   transferService.createBundledTransfer (I1/I2)
 *   transferService.confirmBundleApproval
 *   transferService.suggestTransfers / rankTransferSuggestions
 *   transferService.dismissSuggestion
 *   (private) validateTransferFlow — tested via public methods
 *   (private) validateCrossClusterFlow — tested via createBundledTransfer (I1)
 *
 * Flow-rule test matrix (spec §7 + DL-043):
 *   1. Semi-product lateral within cluster → OK
 *   2. Raw dept→dept within cluster → OK (DL-043 deviation)
 *   3. Cross-cluster transfer → ClusterBoundaryError
 *   4. Final product production→dispatch→POS → OK
 *   5. Final product POS→POS lateral → FlowDirectionError
 *   6. Final product backward (dispatch→production) → FlowDirectionError
 *   7. Destination not enabled → EnablementViolationError
 *   8. Full lifecycle: draft→submit(→approved)→dispatch(→in_transit, deducts)→confirmReceipt(→received)
 *   9. cancelTransfer pre-dispatch (draft) → cleans up (→ cancelled)
 *  10. cancelTransfer post-dispatch (approved) → TransferLifecycleError (compensating doc required)
 *  11. Bundle with brandStoreId: I2 leg stores correct; I1 validateCrossClusterFlow enforced
 *  12. Bundle decomposition into two distinct st_trns on confirmBundleApproval
 *  13. dismissSuggestion persists dismissal record
 *  14. suggestTransfers returns live computed suggestions (not dismissed)
 *  15. HTTP route — POST /stock-transfers returns { data } envelope
 *  16. HTTP route — POST /stock-transfers/:id/cancel returns { data }
 *  17. C2 regression: over-threshold path submit→pending_approval→approveTransfer→approved→dispatch→in_transit
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
import { approvalChains, type ApprovalChainStep } from '../../src/db/schema/approval-chains.js';
import { approvalRequests } from '../../src/db/schema/approval-requests.js';
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
  // Cluster-level store (for bundles — leg source/dest)
  storeId: string;
  // Brand-level store (for bundles — intermediary, I2)
  brandStoreId: string;
  locationCode: string;
}

async function seedFixtures(): Promise<SeedResult> {
  const { testBrandId } = getTestBrandedDb();
  const raw = unscopedDb();

  // Seed test user
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
    { productId: rawProduct.id, departmentId: productionDept.id },
    { productId: rawProduct.id, departmentId: dispatchDept.id },
    { productId: rawProduct.id, departmentId: rawDept1.id },
    { productId: semiProduct.id, departmentId: productionDept.id },
    { productId: semiProduct.id, departmentId: dispatchDept.id },
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

  // Cluster-level store (for bundle legs source/dest)
  const [store] = await raw
    .insert(stores)
    .values({ brandId: testBrandId, level: 'cluster', clusterId: cluster1.id, name: 'Cluster Store 1', active: true })
    .returning({ id: stores.id });
  if (!store) throw new Error('seed: store insert failed');

  // Cluster-level store in cluster 2 (for bundle leg 2 destination)
  const [store2] = await raw
    .insert(stores)
    .values({ brandId: testBrandId, level: 'cluster', clusterId: cluster2.id, name: 'Cluster Store 2', active: true })
    .returning({ id: stores.id });
  if (!store2) throw new Error('seed: store2 insert failed');

  // Brand-level store (intermediary for bundle, I2)
  const [brandStore] = await raw
    .insert(stores)
    .values({ brandId: testBrandId, level: 'brand', clusterId: null, name: 'Brand Store', active: true })
    .returning({ id: stores.id });
  if (!brandStore) throw new Error('seed: brandStore insert failed');

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
    brandStoreId: brandStore.id,
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

    await raw.insert(enablementMatrix).values({
      brandId: seed.brandId, productId: seed.finalProductId,
      departmentId: posDept2.id, enabled: true, lastModifiedAt: new Date(),
    });

    await seedStock(seed.brandId, seed.finalProductId, seed.posDeptId, seed.uomId, 10);

    await expect(
      transferService.createDraft(db, {
        sourceDepartmentId: seed.posDeptId,
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
        sourceDepartmentId: seed.dispatchDeptId,
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

  it('8. full lifecycle: draft→submit(→approved)→dispatch(→in_transit, deducts source)→confirmReceipt(→received)', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 20);

    // Step 1: create draft
    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 10 }],
    });

    // Step 2: submit → auto-approved (no threshold chain configured)
    const submitResult = await transferService.submitTransfer(db, transferId, TEST_USER_ID);
    expect(submitResult.status).toBe('approved');

    // Source stock should NOT be deducted yet (deduction at dispatch)
    const srcLevelAfterSubmit = await unscopedDb().execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.productionDeptId}
    `);
    const srcQtyAfterSubmit = Number((srcLevelAfterSubmit as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(srcQtyAfterSubmit).toBe(20); // unchanged — no deduction at submit

    // Step 3: dispatch → in_transit + FEFO deduction
    const dispatchResult = await transferService.dispatchTransfer(db, transferId, TEST_USER_ID);
    expect(dispatchResult.status).toBe('in_transit');

    // Source stock NOW deducted
    const srcLevelAfterDispatch = await unscopedDb().execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.productionDeptId}
    `);
    const srcQtyAfterDispatch = Number((srcLevelAfterDispatch as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(srcQtyAfterDispatch).toBe(10); // 20 - 10 = 10

    // Step 4: confirmReceipt → received + destination increment
    const receiptResult = await transferService.confirmReceipt(db, transferId, { [seed.rawProductId]: 10 }, TEST_USER_ID);
    expect(receiptResult.status).toBe('received');

    const destLevel = await unscopedDb().execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.rawDept1Id}
    `);
    const destQty = Number((destLevel as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(destQty).toBe(10);

    // Final state
    const detail = await transferService.getTransferDetail(db, transferId);
    expect(detail.status).toBe('received');
  });

  it('9. cancelTransfer pre-dispatch (draft) → cleans up (→ cancelled)', async () => {
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

  it('10. cancelTransfer post-submit (approved) → TransferLifecycleError (compensating doc required)', async () => {
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

    // Submit → approved (below threshold)
    const submitResult = await transferService.submitTransfer(db, transferId, TEST_USER_ID);
    expect(submitResult.status).toBe('approved');

    // Try to cancel an 'approved' transfer → TransferLifecycleError (FR117)
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

  it('17. C2 regression: over-threshold submit→pending_approval, approveTransfer→approved, dispatch→in_transit', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const seed = await seedFixtures();
    const raw = unscopedDb();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 20);

    // Create an active 'stock_transfer' approval chain so submitTransfer routes to pending_approval
    await raw.insert(approvalChains).values({
      brandId: testBrandId,
      entityType: 'stock_transfer',
      name: 'ST Approval Chain',
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

    const { transferId } = await transferService.createDraft(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      lines: [{ productId: seed.rawProductId, requestedQty: 10 }],
    });

    // Submit → pending_approval (chain is active, qty=10 falls within band)
    const submitResult = await transferService.submitTransfer(db, transferId, TEST_USER_ID);
    expect(submitResult.status).toBe('pending_approval');

    // Verify source NOT deducted
    const srcLevelAfterSubmit = await raw.execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.productionDeptId}
    `);
    const srcQtyAfterSubmit = Number((srcLevelAfterSubmit as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(srcQtyAfterSubmit).toBe(20); // no deduction at submit

    // Simulate approval engine approval: directly UPDATE approval_request status to 'approved'
    // (in a real flow the approver calls approvalEngine.decide())
    await raw.execute(sql`
      UPDATE approval_requests
      SET status = 'approved', decided_at = NOW(), updated_at = NOW()
      WHERE brand_id = ${testBrandId}
        AND entity_ref = ${transferId}
        AND status = 'pending'
    `);

    // approveTransfer: pending_approval → approved
    const approveResult = await transferService.approveTransfer(db, transferId, TEST_USER_ID);
    expect(approveResult.status).toBe('approved');

    // dispatch: approved → in_transit + FEFO deduction
    const dispatchResult = await transferService.dispatchTransfer(db, transferId, TEST_USER_ID);
    expect(dispatchResult.status).toBe('in_transit');

    const srcLevelAfterDispatch = await raw.execute(sql`
      SELECT quantity FROM stock_levels
      WHERE product_id = ${seed.rawProductId} AND department_id = ${seed.productionDeptId}
    `);
    const srcQtyAfterDispatch = Number((srcLevelAfterDispatch as unknown as Array<{ quantity: string }>)[0]?.quantity ?? 0);
    expect(srcQtyAfterDispatch).toBe(10); // 20 - 10

    // Confirm the over-threshold path is no longer stranded
    const detail = await transferService.getTransferDetail(db, transferId);
    expect(detail.status).toBe('in_transit');
  });
});

// ---------------------------------------------------------------------------
// Tests — Bundles (I1/I2)
// ---------------------------------------------------------------------------

describe('transferService bundles', () => {

  it('11. bundle with correct brandStoreId: I2 leg stores correct; I1 validateCrossClusterFlow passes', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    const raw = unscopedDb();

    // Cluster-level store in cluster 2 for leg 2 destination
    const [clusterStore2] = await raw
      .insert(stores)
      .values({ brandId: seed.brandId, level: 'cluster', clusterId: seed.cluster2Id, name: 'Cluster Store 2', active: true })
      .returning({ id: stores.id });
    if (!clusterStore2) throw new Error('seed: clusterStore2 insert failed');

    const { bundleId } = await transferService.createBundledTransfer(db, {
      originatingClusterId: seed.clusterId,
      destinationClusterId: seed.cluster2Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      productId: seed.rawProductId,
      qty: 5,
      uomId: seed.uomId,
      fromStoreId: seed.storeId,       // cluster-level in cluster 1
      brandStoreId: seed.brandStoreId, // brand-level intermediary
      toStoreId: clusterStore2.id,     // cluster-level in cluster 2
    });

    expect(bundleId).toBeTruthy();

    // Verify leg stores are correct (I2)
    const legs = await raw.execute(sql`
      SELECT leg_no, from_store_id, to_store_id
      FROM transfer_bundle_legs
      WHERE transfer_bundle_id = ${bundleId}
        AND brand_id = ${seed.brandId}
      ORDER BY leg_no ASC
    `);
    const legRows = legs as unknown as Array<{ leg_no: number; from_store_id: string; to_store_id: string }>;
    expect(legRows).toHaveLength(2);

    // Leg 1: source cluster store → brand store
    expect(legRows[0]!.leg_no).toBe(1);
    expect(legRows[0]!.from_store_id).toBe(seed.storeId);
    expect(legRows[0]!.to_store_id).toBe(seed.brandStoreId);

    // Leg 2: brand store → destination cluster store
    expect(legRows[1]!.leg_no).toBe(2);
    expect(legRows[1]!.from_store_id).toBe(seed.brandStoreId);
    expect(legRows[1]!.to_store_id).toBe(clusterStore2.id);
  });

  it('11b. I1: validateCrossClusterFlow rejects wrong store levels', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();

    // Pass the cluster store as brandStoreId (wrong level — should be brand-level)
    await expect(
      transferService.createBundledTransfer(db, {
        originatingClusterId: seed.clusterId,
        destinationClusterId: seed.cluster2Id,
        locationCode: seed.locationCode,
        requestedByUserId: TEST_USER_ID,
        productId: seed.rawProductId,
        qty: 5,
        uomId: seed.uomId,
        fromStoreId: seed.storeId,
        brandStoreId: seed.storeId, // WRONG: cluster-level, not brand-level
        toStoreId: seed.storeId,
      }),
    ).rejects.toThrow(ClusterBoundaryError);
  });

  it('12. bundle approval decomposes into two stock_transfers with distinct st_trns', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    const raw = unscopedDb();

    // Cluster-level store in cluster 2
    const [clusterStore2] = await raw
      .insert(stores)
      .values({ brandId: seed.brandId, level: 'cluster', clusterId: seed.cluster2Id, name: 'CS2 for bundle', active: true })
      .returning({ id: stores.id });
    if (!clusterStore2) throw new Error('seed: clusterStore2 insert failed');

    const { bundleId } = await transferService.createBundledTransfer(db, {
      originatingClusterId: seed.clusterId,
      destinationClusterId: seed.cluster2Id,
      locationCode: seed.locationCode,
      requestedByUserId: TEST_USER_ID,
      productId: seed.rawProductId,
      qty: 5,
      uomId: seed.uomId,
      fromStoreId: seed.storeId,
      brandStoreId: seed.brandStoreId,
      toStoreId: clusterStore2.id,
    });

    expect(bundleId).toBeTruthy();

    const result = await transferService.confirmBundleApproval(db, bundleId);
    expect(result.transferIds).toHaveLength(2);
    expect(result.transferIds[0]).not.toBe(result.transferIds[1]);

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

  it('13. dismissSuggestion persists dismissal record', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();

    const result = await transferService.dismissSuggestion(db, {
      productId: seed.rawProductId,
      batchId: null,
      dismissedByUserId: TEST_USER_ID,
      reasonCode: 'not_needed',
    });

    expect(result.dismissed).toBe(true);

    const raw = unscopedDb();
    const rows = await raw.execute(sql`
      SELECT * FROM transfer_suggestion_dismissals
      WHERE product_id = ${seed.rawProductId}
        AND brand_id = ${seed.brandId}
    `);
    expect((rows as unknown as unknown[]).length).toBe(1);
  });

  it('14. suggestTransfers returns batches not in dismissals', async () => {
    const { db } = getTestBrandedDb();
    const seed = await seedFixtures();
    await seedStock(seed.brandId, seed.rawProductId, seed.productionDeptId, seed.uomId, 50, '001');

    const before = await transferService.suggestTransfers(db, {
      sourceDepartmentId: seed.productionDeptId,
      destinationDepartmentId: seed.rawDept1Id,
    });
    expect(before.suggestions.length).toBeGreaterThan(0);

    await transferService.dismissSuggestion(db, {
      productId: seed.rawProductId,
      batchId: null,
      dismissedByUserId: TEST_USER_ID,
      reasonCode: 'no_demand',
    });

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

  it('15. POST /stock-transfers returns { data } envelope', async () => {
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

  it('16. POST /stock-transfers/:id/cancel returns { data }', async () => {
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
