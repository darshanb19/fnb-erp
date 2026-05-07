/**
 * usr.ts — Zod request/response DTOs for Epic 2 USR endpoints.
 *
 * Imported by apps/api route handlers via `import { ... } from '@fnberp/shared'`.
 * Kept in packages/shared so apps/web can reuse the same schemas for client-side
 * form validation in Arc (c).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const userRoleValues = [
  'brand_owner',
  'cluster_manager',
  'kitchen_manager',
  'store_manager',
  'procurement_manager',
  'finance_manager',
  'dispatch_staff',
  'pos_staff',
  'superadmin',
] as const;

export const userCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  role: z.enum(userRoleValues),
  clusterId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  reasonCode: z.string().min(3),
});

/**
 * Mutable user fields on PATCH.
 * role is immutable post-creation (requires a separate privileged operation).
 * reasonCode is required on every mutation (audit trail).
 */
export const userUpdateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  clusterId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  reason: z.string().min(3),
});

// ---------------------------------------------------------------------------
// Permission overrides
// ---------------------------------------------------------------------------

export const permissionOverrideGrantSchema = z.object({
  permissionId: z.string().uuid(),
  mode: z.enum(['grant', 'revoke']),
  reasonCode: z.string().min(3),
  expiresAt: z.string().datetime().optional(),
});

export const permissionOverrideEditSchema = z.object({
  reasonCode: z.string().min(3).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  accessToken: z.string().min(1),
  newPassword: z.string().min(8),
});

// ---------------------------------------------------------------------------
// Inferred types (convenience exports for consumers)
// ---------------------------------------------------------------------------

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PermissionOverrideGrantInput = z.infer<typeof permissionOverrideGrantSchema>;
export type PermissionOverrideEditInput = z.infer<typeof permissionOverrideEditSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
