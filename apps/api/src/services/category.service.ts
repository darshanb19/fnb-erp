/**
 * categoryService — FR7 (category CRUD + M:N product–category) + DL-026 / DL-034
 * (findSimilarByName trigram).
 *
 * Two-level depth rule:
 *   The DB trigger `categories_two_level_depth_trigger` enforces max depth = 2.
 *   The service pre-validates at the application layer to throw a typed
 *   ValidationError({ code: 'category.parent_must_be_top_level' }) before hitting
 *   the trigger — friendlier error for callers.
 *
 * Soft-delete pattern:
 *   deactivateCategory sets active=false. product_categories M:N rows are NOT
 *   removed — links to deactivated categories are preserved. Consumer-side filters
 *   (e.g. listCategoriesForProduct with activeOnly) handle exclusion at read time.
 *
 * DL-026 / DL-034 — findSimilarByName:
 *   Uses pg_trgm similarity() function via db.raw.execute + sql tag template.
 *   The db.raw bypass is necessary because similarity() is a pg_trgm function
 *   not modelled by Drizzle. String concatenation is forbidden; sql tag is used.
 *   Closes the deferred gap from the Epic 1 chrome-freeze review — this is the
 *   third CC-DUPLICATE-WARN consumer (Categories), parity with productService
 *   and vendorService.
 *
 * Type-cast note: same rationale as org.service.ts / product.service.ts.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import {
  categories,
  productCategories,
  products,
  type Category,
  type NewCategory,
  type ProductCategory,
  type NewProductCategory,
  type Product,
} from '../db/schema/inventory.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Update types — exclude immutable + injected fields
// ---------------------------------------------------------------------------

export type CategoryUpdate = Partial<
  Omit<NewCategory, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

interface MutationOpts {
  actorUserId: string | null;
}

interface UpdateOpts extends MutationOpts {
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal typed helpers
// ---------------------------------------------------------------------------

async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

async function updateReturning<R>(
  promise: ReturnType<ReturnType<ReturnType<ReturnType<BrandedDb['scopedUpdate']>['set']>['where']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

// ---------------------------------------------------------------------------
// categoryService
// ---------------------------------------------------------------------------

export const categoryService = {
  // -------------------------------------------------------------------------
  // Category CRUD
  // -------------------------------------------------------------------------

  /**
   * FR7: Create a category scoped to the caller's brand.
   * Service pre-validates two-level depth if parentId is supplied.
   * Writes audit_log row.
   */
  async createCategory(
    db: BrandedDb,
    input: Omit<NewCategory, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Category> {
    // Application-layer two-level depth check (friendlier than DB trigger error)
    if (input.parentId) {
      const parentRows = await (db.scopedFrom(categories, eq(categories.id, input.parentId)) as unknown as Promise<Category[]>);
      const parent = parentRows[0];
      if (!parent) {
        throw new NotFoundError({ code: 'not_found.category', message: `Parent category ${input.parentId} not found` });
      }
      // If the parent itself has a parentId, then creating a child under it would be level 3
      if (parent.parentId !== null) {
        throw new ValidationError({
          code: 'category.parent_must_be_top_level',
          message: 'Categories support at most two levels. The parent category must be a top-level category (parentId = null).',
        });
      }
    }

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<Category>(tx.scopedInsert(categories, input).returning());
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');
      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'categories',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /**
   * FR7: List categories for the caller's brand.
   * Supports filtering by parentId (null = top-level, a UUID = children of that parent).
   * Supports filtering by active status.
   */
  async listCategories(
    db: BrandedDb,
    filter?: { parentId?: string | null; active?: boolean },
  ): Promise<Category[]> {
    const conds = [];

    // parentId filter: undefined = no filter; null = top-level; string = children of that parent
    if (filter !== undefined && 'parentId' in filter) {
      if (filter.parentId === null) {
        // Use sql condition for IS NULL
        const { sql, isNull } = await import('drizzle-orm');
        void sql; // imported for potential future use; isNull is used below
        conds.push(isNull(categories.parentId));
      } else if (filter.parentId !== undefined) {
        conds.push(eq(categories.parentId, filter.parentId));
      }
    }

    if (filter?.active !== undefined) conds.push(eq(categories.active, filter.active));

    const condition = conds.length > 0 ? and(...conds) : undefined;
    return db.scopedFrom(categories, condition) as unknown as Promise<Category[]>;
  },

  /**
   * FR7: Get a single category by id, scoped to caller's brand.
   */
  async getCategory(db: BrandedDb, id: string): Promise<Category> {
    const rows = await (db.scopedFrom(categories, eq(categories.id, id)) as unknown as Promise<Category[]>);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({ code: 'not_found.category', message: `Category ${id} not found` });
    }
    return row;
  },

  /**
   * FR7: Update mutable category fields. Writes audit_log row.
   */
  async updateCategory(
    db: BrandedDb,
    id: string,
    input: CategoryUpdate,
    opts: UpdateOpts,
  ): Promise<Category> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await categoryService.getCategory(tx, id);
      const rows = await updateReturning<Category>(
        tx.scopedUpdate(categories).set(input).where(eq(categories.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.category', message: `Category ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'categories',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reason,
      });
      return after;
    });
  },

  /**
   * FR7: Soft-deactivate a category.
   * M:N product_categories rows are preserved — per soft-delete contract.
   */
  async deactivateCategory(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Category> {
    return categoryService.updateCategory(db, id, { active: false }, opts);
  },

  // -------------------------------------------------------------------------
  // M:N helpers (FR7)
  // -------------------------------------------------------------------------

  /**
   * FR7: Assign a product to a category.
   * Writes audit_log row.
   */
  async assignProductToCategory(
    db: BrandedDb,
    productId: string,
    categoryId: string,
    opts: MutationOpts,
  ): Promise<ProductCategory> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<ProductCategory>(
        tx.scopedInsert(productCategories, { productId, categoryId }).returning(),
      );
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');
      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'product_categories',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /**
   * FR7: Remove a product from a category. Writes audit_log row.
   */
  async removeProductFromCategory(
    db: BrandedDb,
    productId: string,
    categoryId: string,
    opts: UpdateOpts,
  ): Promise<void> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Find the link row
      const existing = await (tx.scopedFrom(
        productCategories,
        and(eq(productCategories.productId, productId), eq(productCategories.categoryId, categoryId)),
      ) as unknown as Promise<ProductCategory[]>);
      const row = existing[0];
      if (!row) {
        throw new NotFoundError({
          code: 'not_found.product_category',
          message: `Product ${productId} is not assigned to category ${categoryId}`,
        });
      }

      await tx.scopedDelete(productCategories).where(
        and(eq(productCategories.productId, productId), eq(productCategories.categoryId, categoryId)),
      );

      await auditLogService.record(tx, {
        action: 'delete',
        tableName: 'product_categories',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        before: row as Record<string, unknown>,
        reason: opts.reason,
      });
    });
  },

  /**
   * FR7: List all categories that a product belongs to.
   */
  async listCategoriesForProduct(db: BrandedDb, productId: string): Promise<Category[]> {
    const links = await (db.scopedFrom(
      productCategories,
      eq(productCategories.productId, productId),
    ) as unknown as Promise<ProductCategory[]>);
    const catIds = links.map((l) => l.categoryId);
    if (catIds.length === 0) return [];
    return db.scopedFrom(categories, inArray(categories.id, catIds)) as unknown as Promise<Category[]>;
  },

  /**
   * FR7: List all products in a category.
   * NOTE: Returns products even if the category is soft-deleted — the link is intact.
   */
  async listProductsInCategory(db: BrandedDb, categoryId: string): Promise<Product[]> {
    const links = await (db.scopedFrom(
      productCategories,
      eq(productCategories.categoryId, categoryId),
    ) as unknown as Promise<ProductCategory[]>);
    const productIds = links.map((l) => l.productId);
    if (productIds.length === 0) return [];
    return db.scopedFrom(products, inArray(products.id, productIds)) as unknown as Promise<Product[]>;
  },

  // -------------------------------------------------------------------------
  // DL-026 / DL-034 fuzzy-name lookup (CC-DUPLICATE-WARN consumer)
  // -------------------------------------------------------------------------

  /**
   * DL-026 / DL-034: Return categories for the caller's brand whose name has
   * trigram similarity >= threshold to `name`, ordered by descending similarity.
   *
   * Uses pg_trgm similarity() via db.raw.execute + sql tag template.
   * The db.raw bypass is required because similarity() is a pg_trgm function not
   * modelled by Drizzle. String concatenation is forbidden — sql template tag only.
   */
  async findSimilarByName(
    db: BrandedDb,
    name: string,
    opts?: { threshold?: number; excludeId?: string; limit?: number },
  ): Promise<Array<Category & { sim: number }>> {
    const threshold = opts?.threshold ?? 0.85;
    const excludeId = opts?.excludeId ?? null;
    const limit = opts?.limit ?? 5;

    const rows = await db.raw.execute(sql`
      SELECT c.*, similarity(c.name, ${name}) AS sim
      FROM categories c
      WHERE c.brand_id = ${db.brandId}
        AND c.active = true
        AND (${excludeId}::uuid IS NULL OR c.id <> ${excludeId}::uuid)
        AND similarity(c.name, ${name}) >= ${threshold}
      ORDER BY sim DESC
      LIMIT ${limit}
    `);

    // postgres-js returns rows as an array of objects; cast to the expected shape
    return rows as unknown as Array<Category & { sim: number }>;
  },
};
