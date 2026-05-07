/**
 * Integration tests for categoryService.
 *
 * Covers:
 *  - Category CRUD (create, list, get, update, deactivate)
 *  - Two-level depth enforcement
 *  - FR7: M:N product–category (assign, remove, list)
 *  - Soft-delete behavior (deactivated category; links preserved)
 *  - Audit-log on mutations
 *
 * Uses fnberp_test database.
 * Each test runs against a clean slate — truncateTestTables() in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { categoryService } from '../../src/services/category.service.js';
import { productService } from '../../src/services/product.service.js';
import { auditLog } from '../../src/db/schema/audit.js';
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

async function createKgUom(db: ReturnType<typeof getTestBrandedDb>['db']): Promise<string> {
  const { uoms } = await import('../../src/db/schema/inventory.js');
  const rows = await db.scopedInsert(uoms, { code: 'kg', displayName: 'Kilogram', base: 'mass', conversionToBaseFactor: '1.0' }).returning() as unknown as { id: string }[];
  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// Category CRUD
// ---------------------------------------------------------------------------

describe('categoryService — category CRUD', () => {
  it('creates a top-level category', async () => {
    const { db } = getTestBrandedDb();
    const cat = await categoryService.createCategory(
      db,
      { name: 'Dairy', parentId: null },
      { actorUserId: null },
    );
    expect(cat.name).toBe('Dairy');
    expect(cat.parentId).toBeNull();
    expect(cat.active).toBe(true);
    expect(cat.id).toBeTruthy();
  });

  it('creates a sub-category under a top-level parent', async () => {
    const { db } = getTestBrandedDb();
    const parent = await categoryService.createCategory(db, { name: 'Dairy', parentId: null }, { actorUserId: null });
    const child = await categoryService.createCategory(db, { name: 'Milk', parentId: parent.id }, { actorUserId: null });
    expect(child.parentId).toBe(parent.id);
  });

  it('rejects 3-level nesting (DB trigger or service-layer validation)', async () => {
    const { db } = getTestBrandedDb();
    const level1 = await categoryService.createCategory(db, { name: 'Level1', parentId: null }, { actorUserId: null });
    const level2 = await categoryService.createCategory(db, { name: 'Level2', parentId: level1.id }, { actorUserId: null });

    await expect(
      categoryService.createCategory(db, { name: 'Level3', parentId: level2.id }, { actorUserId: null }),
    ).rejects.toThrow(); // ValidationError or DB trigger error
  });

  it('lists top-level categories (parentId IS NULL)', async () => {
    const { db } = getTestBrandedDb();
    const top1 = await categoryService.createCategory(db, { name: 'Dairy', parentId: null }, { actorUserId: null });
    const top2 = await categoryService.createCategory(db, { name: 'Bakery', parentId: null }, { actorUserId: null });
    await categoryService.createCategory(db, { name: 'Milk', parentId: top1.id }, { actorUserId: null });

    const topLevel = await categoryService.listCategories(db, { parentId: null });
    expect(topLevel.length).toBe(2);
    expect(topLevel.every((c) => c.parentId === null)).toBe(true);
  });

  it('lists sub-categories of a parent', async () => {
    const { db } = getTestBrandedDb();
    const parent = await categoryService.createCategory(db, { name: 'Dairy', parentId: null }, { actorUserId: null });
    await categoryService.createCategory(db, { name: 'Milk', parentId: parent.id }, { actorUserId: null });
    await categoryService.createCategory(db, { name: 'Cheese', parentId: parent.id }, { actorUserId: null });
    await categoryService.createCategory(db, { name: 'Other Top', parentId: null }, { actorUserId: null });

    const subs = await categoryService.listCategories(db, { parentId: parent.id });
    expect(subs.length).toBe(2);
    expect(subs.every((c) => c.parentId === parent.id)).toBe(true);
  });

  it('updates a category with reason captured in audit', async () => {
    const { db } = getTestBrandedDb();
    const cat = await categoryService.createCategory(db, { name: 'Dairy', parentId: null }, { actorUserId: null });
    const updated = await categoryService.updateCategory(
      db,
      cat.id,
      { name: 'Dairy Products' },
      { actorUserId: null, reason: 'expand name' },
    );
    expect(updated.name).toBe('Dairy Products');

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, cat.id)) as unknown as Promise<(typeof auditLog.$inferSelect)[]>);
    const updateRow = auditRows.find((r) => r.action === 'update');
    expect(updateRow).toBeDefined();
    expect(updateRow?.reason).toBe('expand name');
  });

  it('deactivates a category (soft delete)', async () => {
    const { db } = getTestBrandedDb();
    const cat = await categoryService.createCategory(db, { name: 'Dairy', parentId: null }, { actorUserId: null });
    const deactivated = await categoryService.deactivateCategory(db, cat.id, { actorUserId: null, reason: 'deprecated' });
    expect(deactivated.active).toBe(false);

    // Row still retrievable
    const fetched = await categoryService.getCategory(db, cat.id);
    expect(fetched.id).toBe(cat.id);
    expect(fetched.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FR7 — M:N product–category
// ---------------------------------------------------------------------------

describe('categoryService — FR7 product–category M:N', () => {
  it('FR7: assigns a product to a category', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const cat = await categoryService.createCategory(db, { name: 'Dry Goods', parentId: null }, { actorUserId: null });

    const link = await categoryService.assignProductToCategory(db, product.id, cat.id, { actorUserId: null });
    expect(link.productId).toBe(product.id);
    expect(link.categoryId).toBe(cat.id);
  });

  it('FR7: removes a product from a category and writes audit-log row', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const cat = await categoryService.createCategory(db, { name: 'Dry Goods', parentId: null }, { actorUserId: null });
    await categoryService.assignProductToCategory(db, product.id, cat.id, { actorUserId: null });

    await categoryService.removeProductFromCategory(db, product.id, cat.id, { actorUserId: null, reason: 'reclassify' });

    const cats = await categoryService.listCategoriesForProduct(db, product.id);
    expect(cats.length).toBe(0);
  });

  it('FR7: listCategoriesForProduct returns the M:N set', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const cat1 = await categoryService.createCategory(db, { name: 'Dry Goods', parentId: null }, { actorUserId: null });
    const cat2 = await categoryService.createCategory(db, { name: 'Bakery Inputs', parentId: null }, { actorUserId: null });

    await categoryService.assignProductToCategory(db, product.id, cat1.id, { actorUserId: null });
    await categoryService.assignProductToCategory(db, product.id, cat2.id, { actorUserId: null });

    const cats = await categoryService.listCategoriesForProduct(db, product.id);
    expect(cats.length).toBe(2);
    expect(cats.some((c) => c.id === cat1.id)).toBe(true);
    expect(cats.some((c) => c.id === cat2.id)).toBe(true);
  });

  it('FR7: listProductsInCategory returns the M:N set', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const p1 = await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const p2 = await productService.createProduct(db, { sku: 'P-002', name: 'Sugar', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const cat = await categoryService.createCategory(db, { name: 'Dry Goods', parentId: null }, { actorUserId: null });

    await categoryService.assignProductToCategory(db, p1.id, cat.id, { actorUserId: null });
    await categoryService.assignProductToCategory(db, p2.id, cat.id, { actorUserId: null });

    const products = await categoryService.listProductsInCategory(db, cat.id);
    expect(products.length).toBe(2);
    expect(products.some((p) => p.id === p1.id)).toBe(true);
    expect(products.some((p) => p.id === p2.id)).toBe(true);
  });

  it('deactivated category still shows links via listProductsInCategory', async () => {
    const { db } = getTestBrandedDb();
    const kgId = await createKgUom(db);
    const product = await productService.createProduct(db, { sku: 'P-001', name: 'Flour', type: 'raw', defaultUomId: kgId }, { actorUserId: null });
    const cat = await categoryService.createCategory(db, { name: 'Dry Goods', parentId: null }, { actorUserId: null });
    await categoryService.assignProductToCategory(db, product.id, cat.id, { actorUserId: null });

    await categoryService.deactivateCategory(db, cat.id, { actorUserId: null, reason: 'deprecated' });

    // Links are preserved — soft-delete does not cascade to M:N
    const products = await categoryService.listProductsInCategory(db, cat.id);
    expect(products.length).toBe(1);
    expect(products[0]?.id).toBe(product.id);
  });
});
