/**
 * schemas — Zod response schemas for MDM org-hierarchy resources.
 *
 * These mirror the Drizzle-inferred types from apps/api/src/db/schema/org.ts
 * plus the standard brand-scoped columns from brand-scoped-table.ts.
 *
 * Canonical column set for every brand-scoped row:
 *   id, brandId, createdAt, updatedAt, createdBy, updatedBy
 *   + resource-specific columns.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared base
// ---------------------------------------------------------------------------

/** Brand-scoped base without active (for tables that don't have an active column). */
const baseNoActiveSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

/** Brand-scoped base with active column (most tables). */
const baseSchema = baseNoActiveSchema.extend({
  active: z.boolean(),
});

// ---------------------------------------------------------------------------
// Cluster
// ---------------------------------------------------------------------------

export const clusterSchema = baseSchema.extend({
  name: z.string(),
  contactPerson: z.string().nullable(),
  contactPhone: z.string().nullable(),
  address: z.string().nullable(),
});

export type ClusterRow = z.infer<typeof clusterSchema>;

export const clustersListSchema = z.array(clusterSchema);

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export const locationTypeSchema = z.enum([
  'central_kitchen',
  'pos_outlet',
  'brand_store',
  'cluster_store',
]);

export type LocationType = z.infer<typeof locationTypeSchema>;

export const locationSchema = baseSchema.extend({
  clusterId: z.string().uuid(),
  name: z.string(),
  type: locationTypeSchema,
  address: z.string().nullable(),
  contactPerson: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
});

export type LocationRow = z.infer<typeof locationSchema>;

export const locationsListSchema = z.array(locationSchema);

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export const departmentTypeSchema = z.enum([
  'production',
  'dispatch',
  'non_production',
  'store',
]);

export type DepartmentType = z.infer<typeof departmentTypeSchema>;

export const departmentSchema = baseSchema.extend({
  locationId: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  type: departmentTypeSchema,
});

export type DepartmentRow = z.infer<typeof departmentSchema>;

export const departmentsListSchema = z.array(departmentSchema);

// ---------------------------------------------------------------------------
// Product type enum
// ---------------------------------------------------------------------------

export const productTypeSchema = z.enum(['raw', 'semi_product', 'final']);
export type ProductType = z.infer<typeof productTypeSchema>;

// ---------------------------------------------------------------------------
// UOM (global registry layer 1)
// ---------------------------------------------------------------------------

export const uomBaseSchema = z.enum(['mass', 'volume', 'count']);
export type UomBase = z.infer<typeof uomBaseSchema>;

export const uomSchema = baseSchema.extend({
  code: z.string(),
  displayName: z.string(),
  base: uomBaseSchema,
  conversionToBaseFactor: z.string(),
});

export type UomRow = z.infer<typeof uomSchema>;
export const uomsListSchema = z.array(uomSchema);

// ---------------------------------------------------------------------------
// ProductUom (per-product alternate UOM layer 2)
// product_uoms table does NOT have an active column — use baseNoActiveSchema
// ---------------------------------------------------------------------------

export const productUomSchema = baseNoActiveSchema.extend({
  productId: z.string().uuid(),
  uomId: z.string().uuid(),
  factorToDefaultUom: z.string(),
  isDefault: z.boolean(),
});

export type ProductUomRow = z.infer<typeof productUomSchema>;
export const productUomsListSchema = z.array(productUomSchema);

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const categorySchema = baseSchema.extend({
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  displayOrder: z.number().int(),
});

export type CategoryRow = z.infer<typeof categorySchema>;
export const categoriesListSchema = z.array(categorySchema);

// ---------------------------------------------------------------------------
// Product (base + with UOMs + categories)
// ---------------------------------------------------------------------------

export const productSchema = baseSchema.extend({
  sku: z.string(),
  name: z.string(),
  type: productTypeSchema,
  defaultUomId: z.string().uuid(),
  standardYieldFactor: z.string(),
  shelfLifeDays: z.number().int().nullable(),
});

export type ProductRow = z.infer<typeof productSchema>;
export const productsListSchema = z.array(productSchema);

// Product with embedded UOMs and categories (returned by GET /products/:id)
export const productDetailSchema = productSchema.extend({
  uoms: productUomsListSchema,
  categories: categoriesListSchema,
});

export type ProductDetailRow = z.infer<typeof productDetailSchema>;

// ---------------------------------------------------------------------------
// FindSimilar result
// ---------------------------------------------------------------------------

export const similarProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  similarity: z.number().optional(),
  active: z.boolean().optional(),
  sku: z.string().optional(),
});

export type SimilarProductRow = z.infer<typeof similarProductSchema>;
export const similarProductsListSchema = z.array(similarProductSchema);
