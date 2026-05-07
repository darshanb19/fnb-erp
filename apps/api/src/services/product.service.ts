/**
 * productService — FR3 (product CRUD) + FR4 / DL-023 (UOM two-layer resolution)
 *                  + DL-026 (findSimilarByName trigram).
 *
 * All mutations run inside withTransaction() which:
 *   1. Opens a Postgres transaction on db.raw.
 *   2. Sets `app.user_id` session variable for audit trigger backstop.
 *   3. Provides a transaction-scoped BrandedDb to service methods.
 *   4. Writes an audit_log row atomically with the mutation.
 *
 * DL-023 — Two-layer UOM system:
 *   Layer 1 (registry): global `uoms` table per brand with `conversionToBaseFactor`
 *   Layer 2 (per-product): `product_uoms` with `factorToDefaultUom`
 *
 *   convertQuantity resolution algorithm:
 *   - If fromUomId === toUomId: return qty unchanged.
 *   - Resolve each UOM to an equivalent in "default UOM units" (fromFactor, toFactor):
 *       a) IS the product's defaultUomId → factor = 1
 *       b) Is in product_uoms for this product → factor = product_uoms.factorToDefaultUom
 *       c) Is in uom registry with SAME base as product's default UOM → factor = from.conversionToBase / default.conversionToBase
 *       d) None → throw ValidationError({ code: 'uom.incompatible_base' })
 *   - result = qty * fromFactor / toFactor
 *
 *   NOTE: This implementation uses standard JS number arithmetic. UOM factors are stored
 *   as numeric(18,9) in Postgres which postgres-js returns as strings; we parse them via
 *   parseFloat(). For typical food-quantity ranges (grams, kg, liters) the float precision
 *   (53-bit mantissa ≈ 15–16 decimal digits) is sufficient and avoids a bigdecimal dependency.
 *   If sub-milligram / sub-microliter precision becomes a requirement, migrate to a
 *   BigDecimal library. Tracked in DL-023 footnote.
 *
 * DL-026 — findSimilarByName:
 *   Uses pg_trgm similarity() function via db.raw.execute + sql tag template.
 *   The db.raw bypass is necessary because similarity() is a pg_trgm function
 *   not modelled by Drizzle. String concatenation is forbidden; sql tag is used.
 *
 * Type-cast note:
 *   brandedDb's scopedInsert / scopedUpdate return generic Drizzle builder types
 *   that lose specific table column information. Each .returning() result is cast
 *   to the concrete row type via `as unknown as`. This is safe because Drizzle
 *   always returns fully-populated rows when .returning() is called with no selection.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import {
  products,
  productUoms,
  categories,
  productCategories,
  uoms,
  type Product,
  type NewProduct,
  type ProductUom,
  type NewProductUom,
  type Category,
} from '../db/schema/inventory.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Update types — exclude immutable + injected fields
// ---------------------------------------------------------------------------

export type ProductUpdate = Partial<
  Omit<NewProduct, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

export type ProductUomInput = Omit<NewProductUom, 'id' | 'brandId' | 'productId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

export interface ProductFilter {
  type?: 'raw' | 'semi_product' | 'final';
  active?: boolean;
  // M:N filters (e.g., categoryId) deferred to Arc (c) UI work
}

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
// Internal typed helpers (mirroring org.service.ts pattern)
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
// productService
// ---------------------------------------------------------------------------

export const productService = {
  // -------------------------------------------------------------------------
  // Product CRUD
  // -------------------------------------------------------------------------

  /**
   * FR3: Create a product scoped to the caller's brand.
   * DL-023: Also inserts one self-referential product_uoms row (defaultUomId → defaultUomId,
   * factor=1, isDefault=true) to anchor the two-layer UOM system. This is the "default UOM
   * is itself" entry needed for convertQuantity symmetry.
   * Writes audit_log row.
   */
  async createProduct(
    db: BrandedDb,
    input: Omit<NewProduct, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Product> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<Product>(tx.scopedInsert(products, input).returning());
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');

      // DL-023: insert the self-row (default UOM maps to itself, factor=1).
      // Cast is required: scopedInsert's generic collapses ScopedInsertRow<T> to a
      // union that TypeScript's excess-property check rejects for optional-but-present
      // fields like isDefault (HasDefault<NotNull<boolean>>). The shape is correct.
      const selfUomRow = {
        productId: row.id,
        uomId: row.defaultUomId,
        factorToDefaultUom: '1' as string,
        isDefault: true,
      } as unknown as import('../db/branded-db.js').ScopedInsertRow<typeof productUoms>;
      await insertReturning<ProductUom>(
        tx.scopedInsert(productUoms, selfUomRow).returning(),
      );

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'products',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /**
   * FR3: List all products for the caller's brand with optional filtering.
   */
  async listProducts(db: BrandedDb, filter?: ProductFilter): Promise<Product[]> {
    const conds = [];
    if (filter?.type !== undefined) conds.push(eq(products.type, filter.type));
    if (filter?.active !== undefined) conds.push(eq(products.active, filter.active));
    const condition = conds.length > 0 ? and(...conds) : undefined;
    return db.scopedFrom(products, condition) as unknown as Promise<Product[]>;
  },

  /**
   * FR3: Get a single product by id with its UOM rows and categories.
   * Two extra queries — avoids complex Drizzle join type plumbing.
   */
  async getProduct(
    db: BrandedDb,
    id: string,
  ): Promise<Product & { uoms: ProductUom[]; categories: Category[] }> {
    const rows = await (db.scopedFrom(products, eq(products.id, id)) as unknown as Promise<Product[]>);
    const p = rows[0];
    if (!p) {
      throw new NotFoundError({ code: 'not_found.product', message: `Product ${id} not found` });
    }

    const uomRows = await (db.scopedFrom(productUoms, eq(productUoms.productId, id)) as unknown as Promise<ProductUom[]>);
    const catLinks = await (db.scopedFrom(productCategories, eq(productCategories.productId, id)) as unknown as Promise<{ productId: string; categoryId: string }[]>);
    const catIds = catLinks.map((l) => l.categoryId);
    const cats =
      catIds.length > 0
        ? await (db.scopedFrom(categories, inArray(categories.id, catIds)) as unknown as Promise<Category[]>)
        : [];

    return { ...p, uoms: uomRows, categories: cats };
  },

  /**
   * FR3: Update mutable product fields. Writes audit_log row.
   */
  async updateProduct(
    db: BrandedDb,
    id: string,
    input: ProductUpdate,
    opts: UpdateOpts,
  ): Promise<Product> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await productService.getProduct(tx, id);
      const rows = await updateReturning<Product>(
        tx.scopedUpdate(products).set(input).where(eq(products.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.product', message: `Product ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'products',
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
   * FR3: Soft-deactivate a product. Row and all related M:N links are preserved.
   */
  async deactivateProduct(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Product> {
    return productService.updateProduct(db, id, { active: false }, opts);
  },

  // -------------------------------------------------------------------------
  // Per-product UOM management (DL-023 layer 2)
  // -------------------------------------------------------------------------

  /**
   * DL-023: Add an alternate UOM for a product.
   * If isDefault=true, atomically clears any existing default before inserting
   * the new row (ergonomic API; callers don't need to call setDefaultProductUom separately).
   * Writes audit_log row.
   */
  async addProductUom(
    db: BrandedDb,
    productId: string,
    input: ProductUomInput,
    opts: MutationOpts,
  ): Promise<ProductUom> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Validate product exists
      await productService.getProduct(tx, productId);

      if (input.isDefault) {
        // Atomically clear any existing defaults in the same txn
        await tx
          .scopedUpdate(productUoms)
          .set({ isDefault: false })
          .where(eq(productUoms.productId, productId))
          .returning();
      }

      const rows = await insertReturning<ProductUom>(
        tx.scopedInsert(productUoms, { ...input, productId }).returning(),
      );
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'product_uoms',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /**
   * DL-023: Remove a product UOM row by id. Writes audit_log row.
   */
  async removeProductUom(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<void> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const existing = await (tx.scopedFrom(productUoms, eq(productUoms.id, id)) as unknown as Promise<ProductUom[]>);
      const row = existing[0];
      if (!row) throw new NotFoundError({ code: 'not_found.product_uom', message: `ProductUom ${id} not found` });

      await tx.scopedDelete(productUoms).where(eq(productUoms.id, id));

      await auditLogService.record(tx, {
        action: 'delete',
        tableName: 'product_uoms',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: row as Record<string, unknown>,
        reason: opts.reason,
      });
    });
  },

  /**
   * DL-023: Set a specific product_uoms row as the default for a product.
   * Two updates in one transaction:
   *   1. Clear all existing defaults for the product.
   *   2. Set the target row as default.
   * Writes business_action audit-log row.
   */
  async setDefaultProductUom(
    db: BrandedDb,
    productId: string,
    productUomId: string,
    opts: MutationOpts,
  ): Promise<void> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Validate the productUomId belongs to this product
      const existing = await (tx.scopedFrom(productUoms, and(eq(productUoms.id, productUomId), eq(productUoms.productId, productId))) as unknown as Promise<ProductUom[]>);
      if (!existing[0]) {
        throw new NotFoundError({
          code: 'not_found.product_uom',
          message: `ProductUom ${productUomId} not found for product ${productId}`,
        });
      }

      // 1. Clear all existing defaults for the product
      await tx
        .scopedUpdate(productUoms)
        .set({ isDefault: false })
        .where(eq(productUoms.productId, productId))
        .returning();

      // 2. Set the target row as default
      await tx
        .scopedUpdate(productUoms)
        .set({ isDefault: true })
        .where(eq(productUoms.id, productUomId))
        .returning();

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'product_uoms',
        rowId: productUomId,
        actorUserId: opts.actorUserId,
        context: { event: 'set_default' },
      });
    });
  },

  // -------------------------------------------------------------------------
  // UOM conversion (DL-023 algorithm)
  // -------------------------------------------------------------------------

  /**
   * DL-023: Convert a quantity from one UOM to another for a specific product.
   *
   * Resolution order for each UOM:
   *   (a) IS the product's defaultUomId → factor = 1
   *   (b) Is in product_uoms for this product → factor = factorToDefaultUom
   *   (c) Is in uom registry with SAME base as default UOM → factor = from.conversionToBase / default.conversionToBase
   *   (d) None → throw ValidationError({ code: 'uom.incompatible_base' })
   *
   * NOTE: Uses JS float arithmetic (see module comment for trade-off rationale).
   */
  async convertQuantity(
    db: BrandedDb,
    productId: string,
    fromUomId: string,
    toUomId: string,
    qty: number,
  ): Promise<number> {
    if (fromUomId === toUomId) return qty;

    // Load the product to get its defaultUomId
    const productRows = await (db.scopedFrom(products, eq(products.id, productId)) as unknown as Promise<Product[]>);
    const product = productRows[0];
    if (!product) throw new NotFoundError({ code: 'not_found.product', message: `Product ${productId} not found` });

    // Load all product_uoms for this product
    const puomRows = await (db.scopedFrom(productUoms, eq(productUoms.productId, productId)) as unknown as Promise<ProductUom[]>);

    // Load all UOMs from registry that we might need
    // We need: default UOM, fromUomId registry entry, toUomId registry entry
    const neededIds = Array.from(new Set([product.defaultUomId, fromUomId, toUomId]));
    const uomRows = await (db.scopedFrom(uoms, inArray(uoms.id, neededIds)) as unknown as Promise<(typeof uoms.$inferSelect)[]>);
    const uomMap = new Map(uomRows.map((u) => [u.id, u]));

    const defaultUom = uomMap.get(product.defaultUomId);
    if (!defaultUom) throw new Error(`Default UOM ${product.defaultUomId} not found in registry`);

    /**
     * Resolve a UOM id to its factor relative to the product's default UOM.
     * Returns the numeric multiplier such that: qty_in_uom * factor = qty_in_default_uom
     */
    function resolveFactor(uomId: string): number {
      // (a) IS the default UOM → factor = 1
      if (uomId === product!.defaultUomId) return 1;

      // (b) Is in product_uoms for this product
      const puomRow = puomRows.find((r) => r.uomId === uomId);
      if (puomRow) return parseFloat(puomRow.factorToDefaultUom);

      // (c) Is in uom registry with SAME base as default UOM
      const registryUom = uomMap.get(uomId);
      if (registryUom && registryUom.base === defaultUom!.base) {
        // fromFactor = from.conversionToBaseFactor / default.conversionToBaseFactor
        // This gives "how many default UOM units is 1 unit of registryUom"
        return parseFloat(registryUom.conversionToBaseFactor) / parseFloat(defaultUom!.conversionToBaseFactor);
      }

      // (d) No path — incompatible base or unknown UOM
      throw new ValidationError({
        code: 'uom.incompatible_base',
        message: `No conversion path between UOM ${uomId} and the product's default UOM ${product!.defaultUomId}`,
      });
    }

    const fromFactor = resolveFactor(fromUomId);
    const toFactor = resolveFactor(toUomId);

    return (qty * fromFactor) / toFactor;
  },

  // -------------------------------------------------------------------------
  // DL-026 fuzzy-name lookup (CC-DUPLICATE-WARN consumer)
  // -------------------------------------------------------------------------

  /**
   * DL-026: Return products for the caller's brand whose name has trigram similarity
   * >= threshold to `name`, ordered by descending similarity.
   *
   * Uses pg_trgm similarity() via db.raw.execute + sql tag template.
   * The db.raw bypass is required because similarity() is a pg_trgm function not
   * modelled by Drizzle. String concatenation is forbidden — sql template tag only.
   */
  async findSimilarByName(
    db: BrandedDb,
    name: string,
    opts?: { threshold?: number; excludeId?: string; limit?: number },
  ): Promise<Array<Product & { sim: number }>> {
    const threshold = opts?.threshold ?? 0.85;
    const excludeId = opts?.excludeId ?? null;
    const limit = opts?.limit ?? 5;

    const rows = await db.raw.execute(sql`
      SELECT p.*, similarity(p.name, ${name}) AS sim
      FROM products p
      WHERE p.brand_id = ${db.brandId}
        AND p.active = true
        AND (${excludeId}::uuid IS NULL OR p.id <> ${excludeId}::uuid)
        AND similarity(p.name, ${name}) >= ${threshold}
      ORDER BY sim DESC
      LIMIT ${limit}
    `);

    // postgres-js returns rows as an array of objects; cast to the expected shape
    return rows as unknown as Array<Product & { sim: number }>;
  },
};
