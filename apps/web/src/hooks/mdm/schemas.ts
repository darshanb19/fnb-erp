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

// ---------------------------------------------------------------------------
// Enablement Matrix (FR5 — §8.1 cross-epic gate)
// ---------------------------------------------------------------------------

/**
 * One cell in the material enablement matrix.
 * Mirrors the EnablementCell interface from apps/api/src/services/inventory.service.ts.
 * Absent rows are returned with enabled=false by the API (default-deny).
 */
export const enablementCellSchema = z.object({
  productId: z.string().uuid(),
  departmentId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().nullable(),
  lastModifiedBy: z.string().nullable(),
  lastModifiedAt: z.string(), // ISO string from JSON serialisation
});

export type EnablementCell = z.infer<typeof enablementCellSchema>;
export const enablementCellsListSchema = z.array(enablementCellSchema);

/** Response from POST /enablements/check */
export const enablementCheckSchema = z.object({
  enabled: z.boolean(),
});

// ---------------------------------------------------------------------------
// Vendor (procurement.ts)
// ---------------------------------------------------------------------------

export const vendorScopeSchema = z.enum(['brand', 'cluster', 'pos']);
export type VendorScope = z.infer<typeof vendorScopeSchema>;

export const vendorPaymentModeSchema = z.enum(['cash', 'bank_transfer', 'cheque']);
export type VendorPaymentMode = z.infer<typeof vendorPaymentModeSchema>;

export const vendorSchema = baseSchema.extend({
  code: z.string(),
  name: z.string(),
  scope: vendorScopeSchema,
  scopeClusterId: z.string().uuid().nullable(),
  scopeLocationId: z.string().uuid().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  contactPerson: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  state: z.string().nullable(),
  creditTermsDays: z.number().int().nullable(),
  paymentMode: vendorPaymentModeSchema.nullable(),
  preferred: z.boolean(),
  qualityRating: z.string().nullable(),
});

export type VendorRow = z.infer<typeof vendorSchema>;
export const vendorsListSchema = z.array(vendorSchema);

// ---------------------------------------------------------------------------
// Company (brands table — FR9 + DL-024)
// ---------------------------------------------------------------------------

/**
 * Status enum for the brand row (DL-024 one-way gate).
 * Only two states exist in MVP: setup_pending → setup_complete.
 */
export const companyStatusSchema = z.enum(['setup_pending', 'setup_complete']);
export type CompanyStatus = z.infer<typeof companyStatusSchema>;

/**
 * Full brand row as returned by GET /api/v1/company.
 * Mirrors apps/api/src/db/schema/brand.ts $inferSelect.
 */
export const companySchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  tradingName: z.string().nullable(),
  registeredAddress: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankIfsc: z.string().nullable(),
  bankAccountHolder: z.string().nullable(),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  fiscalYearStartDay: z.number().int().min(1).max(31),
  accountingCurrency: z.string(),
  timezone: z.string(),
  logoUrl: z.string().nullable(),
  status: companyStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type CompanyRow = z.infer<typeof companySchema>;

/** Mutable fields for PATCH /api/v1/company. Status excluded (DL-024 one-way gate). */
export interface UpdateCompanyInput {
  legalName?: string;
  tradingName?: string | null;
  registeredAddress?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string;
  gstin?: string | null;
  pan?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankAccountHolder?: string | null;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  timezone?: string;
  logoUrl?: string | null;
}

// FindSimilar result for categories (DL-026 / DL-034 — Task C9)
export const similarCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  similarity: z.number().optional(),
  active: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export type SimilarCategoryRow = z.infer<typeof similarCategorySchema>;
export const similarCategoriesListSchema = z.array(similarCategorySchema);

// FindSimilar result for vendors (DL-026)
export const similarVendorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  similarity: z.number().optional(),
  active: z.boolean().optional(),
  gstin: z.string().nullable().optional(),
});

export type SimilarVendorRow = z.infer<typeof similarVendorSchema>;
export const similarVendorsListSchema = z.array(similarVendorSchema);
