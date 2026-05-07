/**
 * Inventory domain schema — Phase 4 Epic 1 Arc (a) Task A6
 *
 * Tables: uoms, products, product_uoms, categories, product_categories, enablement_matrix
 *
 * Decisions bound:
 * - DL-023: Two-layer UOM — global registry (uoms) + per-product alternates (product_uoms)
 * - DL-026: Trigram index on products.name + categories.name for CC-DUPLICATE-WARN
 * - DL-013: enablement_matrix is a critical audit-trigger table
 *
 * Deferred to Epic 4: stock_levels, batches, expiry tracking.
 */

import { text, boolean, numeric, integer, uuid, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';
import { departments } from './org.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const productTypeEnum = pgEnum('product_type_enum', ['raw', 'semi_product', 'final']);
export const uomBaseEnum = pgEnum('uom_base_enum', ['mass', 'volume', 'count']);

// ---------------------------------------------------------------------------
// uoms — DL-023 layer 1: global UOM registry per brand
// Unique per (brand_id, code) — composite unique constraint added in 0004_inventory_constraints.sql
// ---------------------------------------------------------------------------

export const uoms = brandScopedTable('uoms', {
  code: text('code').notNull(),              // 'kg', 'g', 'l', 'ml', 'piece', 'dozen'
  displayName: text('display_name').notNull(),
  base: uomBaseEnum('base').notNull(),
  conversionToBaseFactor: numeric('conversion_to_base_factor', { precision: 18, scale: 9 }).notNull(),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// products
// Unique per (brand_id, sku) — composite unique constraint added in 0004_inventory_constraints.sql
// Trigram index on name — added in 0004_inventory_constraints.sql (DL-026 CC-DUPLICATE-WARN)
// ---------------------------------------------------------------------------

export const products = brandScopedTable('products', {
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  type: productTypeEnum('type').notNull(),
  defaultUomId: uuid('default_uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  standardYieldFactor: numeric('standard_yield_factor', { precision: 5, scale: 4 })
    .notNull()
    .default('1.0000'),
  shelfLifeDays: integer('shelf_life_days'),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// product_uoms — DL-023 layer 2: per-product alternate UOMs
// Unique per (brand_id, product_id, uom_id) — constraint in 0004_inventory_constraints.sql
// Partial unique index (is_default=true per product) — in 0004_inventory_constraints.sql
// Exactly one is_default=true per product is enforced in Task A7 service code.
// ---------------------------------------------------------------------------

export const productUoms = brandScopedTable('product_uoms', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  uomId: uuid('uom_id').notNull().references(() => uoms.id, { onDelete: 'restrict' }),
  factorToDefaultUom: numeric('factor_to_default_uom', { precision: 18, scale: 9 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});

// ---------------------------------------------------------------------------
// categories — two-level depth, M:N to products via product_categories
// Self-FK (parent_id → categories.id) added in 0004_inventory_constraints.sql
// Two-level depth enforced by trigger in 0004_inventory_constraints.sql
// Trigram index on name — added in 0004_inventory_constraints.sql (DL-026)
// ---------------------------------------------------------------------------

export const categories = brandScopedTable('categories', {
  parentId: uuid('parent_id'),  // self-FK; null = top-level; FK added in migration hand-edit
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// product_categories — M:N (FR7)
// Unique per (brand_id, product_id, category_id) — constraint in 0004_inventory_constraints.sql
// ---------------------------------------------------------------------------

export const productCategories = brandScopedTable('product_categories', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
});

// ---------------------------------------------------------------------------
// enablement_matrix — DL-013 critical table; auditTrigger: true
// UNIQUE per (brand_id, product_id, department_id) — constraint in 0004_inventory_constraints.sql
// Composite index on (brandId, productId, departmentId) for checkEnablement hot-path
// ---------------------------------------------------------------------------

export const enablementMatrix = brandScopedTable(
  'enablement_matrix',
  {
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    reason: text('reason'),
    lastModifiedBy: uuid('last_modified_by').references(() => users.id),
    lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  {
    auditTrigger: true,
    indexes: { brandProductDept: ['brandId', 'productId', 'departmentId'] },
  },
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Uom = typeof uoms.$inferSelect;
export type NewUom = typeof uoms.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductUom = typeof productUoms.$inferSelect;
export type NewProductUom = typeof productUoms.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;

export type EnablementMatrixRow = typeof enablementMatrix.$inferSelect;
export type NewEnablementMatrixRow = typeof enablementMatrix.$inferInsert;
