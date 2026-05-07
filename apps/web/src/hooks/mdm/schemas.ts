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

const baseSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
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
