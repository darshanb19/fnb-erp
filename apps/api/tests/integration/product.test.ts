/**
 * Integration tests for productService.
 *
 * Covers:
 *  - FR3: product CRUD (create, list, get, update, deactivate)
 *  - FR4 / DL-023: UOM resolution (registry path, per-product override, two-hop)
 *  - DL-023 invariant: exactly one default product_uom per product
 *  - DL-026: findSimilarByName (trigram similarity)
 *
 * Uses fnberp_test database.
 * Each test runs against a clean slate — truncateTestTables() in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { productService } from '../../src/services/product.service.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { productUoms } from '../../src/db/schema/inventory.js';
import { ValidationError } from '../../src/errors/index.js';

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

/** Create a kg UOM, return its id. */
async function createKgUom(db: ReturnType<typeof getTestBrandedDb>['db']): Promise<string> {
  const rows = await db.scopedInsert(
    (await import('../../src/db/schema/inventory.js')).uoms,
    { code: 'kg', displayName: 'Kilogram', base: 'mass', conversionToBaseFactor: '1.0' },
  ).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

async function createGUom(db: ReturnType<typeof getTestBrandedDb>['db']): Promise<string> {
  const rows = await db.scopedInsert(
    (await import('../../src/db/schema/inventory.js')).uoms,
    { code: 'g', displayName: 'Gram', base: 'mass', conversionToBaseFactor: '0.001' },
  ).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

async function createCaseUom(db: ReturnType<typeof getTestBrandedDb>['db']): Promise<string> {
  // Case is a count-base UOM — conversion bridged via product_uoms factor
  const rows = await db.scopedInsert(
    (await import('../../src/db/schema/inventory.js')).uoms,
    { code: 'case', displayName: 'Case', base: 'count', conversionToBaseFactor: '1.0' },
  ).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// FR3 product CRUD
// ---------------------------------------------------------------------------

describe('productService — FR3 product CRUD', () => {
  it('creates a product with a default UOM and an auto-inserted product_uoms self-row', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);

    const product = await productService.createProduct(
      db,
      { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId },
      { actorUserId: null },
    );

    expect(product.sku).toBe('RAW-001');
    expect(product.name).toBe('Flour');
    expect(product.type).toBe('raw');
    expect(product.defaultUomId).toBe(kgId);
    expect(product.active).toBe(true);
    expect(product.id).toBeTruthy();

    // A self-referential product_uoms row (default UOM → default UOM, factor 1) must exist
    const uomRows = await (db.scopedFrom(productUoms, eq(productUoms.productId, product.id)) as unknown as Promise<(typeof productUoms.$inferSelect)[]>);
    expect(uomRows.length).toBe(1);
    const selfRow = uomRows[0]!;
    expect(selfRow.uomId).toBe(kgId);
    expect(selfRow.isDefault).toBe(true);
    expect(Number(selfRow.factorToDefaultUom)).toBe(1);
  });

  it('lists products filtered by type', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);

    await productService.createProduct(db, { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    await productService.createProduct(db, { sku: 'SEMI-001', name: 'Dough', type: 'semi_product', defaultUomId: kgId }, { actorUserId: null });
    await productService.createProduct(db, { sku: 'FIN-001', name: 'Bread', type: 'final', defaultUomId: kgId }, { actorUserId: null });

    const rawOnly = await productService.listProducts(db, { type: 'raw' });
    expect(rawOnly.length).toBe(1);
    expect(rawOnly[0]?.type).toBe('raw');

    const semiOnly = await productService.listProducts(db, { type: 'semi_product' });
    expect(semiOnly.length).toBe(1);

    const all = await productService.listProducts(db);
    expect(all.length).toBe(3);
  });

  it('lists products filtered by active', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);

    const p1 = await productService.createProduct(db, { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    await productService.createProduct(db, { sku: 'RAW-002', name: 'Sugar', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    await productService.deactivateProduct(db, p1.id, { actorUserId: null, reason: 'discontinued' });

    const activeOnly = await productService.listProducts(db, { active: true });
    expect(activeOnly.length).toBe(1);
    expect(activeOnly[0]?.sku).toBe('RAW-002');

    const inactiveOnly = await productService.listProducts(db, { active: false });
    expect(inactiveOnly.length).toBe(1);
    expect(inactiveOnly[0]?.sku).toBe('RAW-001');
  });

  it('gets a product with its uoms and categories arrays populated', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const fetched = await productService.getProduct(db, product.id);
    expect(fetched.id).toBe(product.id);
    expect(Array.isArray(fetched.uoms)).toBe(true);
    expect(fetched.uoms.length).toBe(1); // self-row
    expect(Array.isArray(fetched.categories)).toBe(true);
    expect(fetched.categories.length).toBe(0); // none assigned yet
  });

  it('updates a product (name change) and writes audit-log row with reason and changedFields', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const updated = await productService.updateProduct(
      db,
      product.id,
      { name: 'Refined Flour' },
      { actorUserId: null, reason: 'rename per spec' },
    );
    expect(updated.name).toBe('Refined Flour');
    expect(updated.id).toBe(product.id);

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, product.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const updateRow = auditRows.find((r) => r.action === 'update');
    expect(updateRow).toBeDefined();
    expect(updateRow?.reason).toBe('rename per spec');
    const changedFields = updateRow?.changedFields as string[] | null;
    expect(Array.isArray(changedFields)).toBe(true);
    expect(changedFields).toContain('name');
  });

  it('deactivates a product (active=false; row preserved)', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'RAW-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const deactivated = await productService.deactivateProduct(db, product.id, { actorUserId: null, reason: 'discontinued' });
    expect(deactivated.active).toBe(false);

    // Row must still exist
    const fetched = await productService.getProduct(db, product.id);
    expect(fetched.id).toBe(product.id);
    expect(fetched.active).toBe(false);
  });

  it('rejects createProduct with same SKU in the same brand (uniqueness)', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    await productService.createProduct(db, { sku: 'DUP-001', name: 'Item A', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    await expect(
      productService.createProduct(db, { sku: 'DUP-001', name: 'Item B', type: 'raw', defaultUomId: kgId }, { actorUserId: null }),
    ).rejects.toThrow(); // Postgres unique violation
  });
});

// ---------------------------------------------------------------------------
// FR4 / DL-023 UOM resolution
// ---------------------------------------------------------------------------

describe('productService — FR4 / DL-023 UOM resolution', () => {
  it('convertQuantity returns input unchanged when from === to', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Salt', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const result = await productService.convertQuantity(db, product.id, kgId, kgId, 5);
    expect(result).toBe(5);
  });

  it('convertQuantity uses registry path: kg → g via conversion_to_base_factor', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const gId = await createGUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Salt', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // 1 kg → g: fromFactor=1 (default UOM), toFactor = 0.001/1 = 0.001 => result = 1 * 1 / 0.001 = 1000
    const result = await productService.convertQuantity(db, product.id, kgId, gId, 1);
    expect(result).toBeCloseTo(1000, 5);
  });

  it('convertQuantity uses per-product override path: case → kg via product_uoms.factor_to_default_uom', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const caseId = await createCaseUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // 1 case = 10 kg
    await productService.addProductUom(db, product.id, { uomId: caseId, factorToDefaultUom: '10', isDefault: false }, { actorUserId: null });

    // convertQuantity(case, kg, 2): fromFactor=10, toFactor=1 => 2*10/1 = 20
    const result = await productService.convertQuantity(db, product.id, caseId, kgId, 2);
    expect(result).toBeCloseTo(20, 5);
  });

  it('convertQuantity does two-hop: case → kg → g', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const gId = await createGUom(db);
    const caseId = await createCaseUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // 1 case = 10 kg via product_uoms
    await productService.addProductUom(db, product.id, { uomId: caseId, factorToDefaultUom: '10', isDefault: false }, { actorUserId: null });

    // convertQuantity(case, g, 1):
    // fromFactor = 10 (from product_uoms, case→kg)
    // toFactor: g is in registry: conversionToBaseFactor(g)/conversionToBaseFactor(kg) = 0.001/1.0 = 0.001
    // result = 1 * 10 / 0.001 = 10000
    const result = await productService.convertQuantity(db, product.id, caseId, gId, 1);
    expect(result).toBeCloseTo(10000, 3);
  });

  it('convertQuantity throws uom.incompatible_base when no conversion path exists', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const caseId = await createCaseUom(db); // count base — no registry path to mass
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // case is NOT in product_uoms (no addProductUom call) and base != mass
    await expect(
      productService.convertQuantity(db, product.id, caseId, kgId, 1),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// DL-023 invariant — exactly one default product_uom
// ---------------------------------------------------------------------------

describe('productService — DL-023 invariant: exactly one default product_uom', () => {
  it('addProductUom with isDefault=true atomically clears the previous default', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const gId = await createGUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Salt', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // Initially: kg is default
    const before = await (db.scopedFrom(productUoms, eq(productUoms.productId, product.id)) as unknown as Promise<(typeof productUoms.$inferSelect)[]>);
    expect(before.filter((r) => r.isDefault).length).toBe(1);

    // Add g as new default — must atomically clear kg
    await productService.addProductUom(db, product.id, { uomId: gId, factorToDefaultUom: '0.001', isDefault: true }, { actorUserId: null });

    const after = await (db.scopedFrom(productUoms, eq(productUoms.productId, product.id)) as unknown as Promise<(typeof productUoms.$inferSelect)[]>);
    const defaults = after.filter((r) => r.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0]?.uomId).toBe(gId);
  });

  it('setDefaultProductUom switches the default and audit-logs business_action', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const gId = await createGUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Salt', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const gRow = await productService.addProductUom(db, product.id, { uomId: gId, factorToDefaultUom: '0.001', isDefault: false }, { actorUserId: null });

    await productService.setDefaultProductUom(db, product.id, gRow.id, { actorUserId: null });

    const all = await (db.scopedFrom(productUoms, eq(productUoms.productId, product.id)) as unknown as Promise<(typeof productUoms.$inferSelect)[]>);
    const defaults = all.filter((r) => r.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0]?.uomId).toBe(gId);

    // Audit log: business_action row for set_default
    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, gRow.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const businessActionRow = auditRows.find((r) => r.action === 'business_action');
    expect(businessActionRow).toBeDefined();
    const ctx = businessActionRow?.context as Record<string, unknown> | null;
    expect(ctx?.['event']).toBe('set_default');
  });
});

// ---------------------------------------------------------------------------
// DL-026 findSimilarByName
// ---------------------------------------------------------------------------

describe('productService — DL-026 findSimilarByName', () => {
  it('returns products whose name has trigram similarity >= threshold (default 0.85)', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const p = await productService.createProduct(db, { sku: 'P-001', name: 'Basmati Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    await productService.createProduct(db, { sku: 'P-002', name: 'Brown Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    // Search with a very similar name — should find 'Basmati Rice'
    const results = await productService.findSimilarByName(db, 'Basmati Rice', { threshold: 0.85 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === p.id)).toBe(true);
    // Each result has a sim score >= threshold
    expect(results.every((r) => r.sim >= 0.85)).toBe(true);
  });

  it('excludes the candidate row when excludeId is supplied', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const p = await productService.createProduct(db, { sku: 'P-001', name: 'Basmati Rice', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const results = await productService.findSimilarByName(db, 'Basmati Rice', { threshold: 0.85, excludeId: p.id });
    expect(results.every((r) => r.id !== p.id)).toBe(true);
  });

  it('returns empty array when no matches above threshold', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });

    const results = await productService.findSimilarByName(db, 'Totally Unrelated Name XYZ', { threshold: 0.85 });
    expect(results.length).toBe(0);
  });
});
