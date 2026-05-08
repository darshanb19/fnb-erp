/**
 * users — Phase 4 Epic 2 USR Arc (a) Task A3 expansion.
 *
 * `users` is a DL-013 critical table (audit trigger required) AND carries brand_id
 * (multi-brand user accounts are distinguished by brand_id, not just email).
 *
 * Epic 2 expansion:
 * - userRoleEnum: canonical 9-role RBAC (FR15 + Master Spec §1.5).
 * - approvalStatusEnum: brand-owner self-creation lifecycle (FR14 — pending_approval
 *   default for self-signups; existing seeded users default to 'approved').
 * - clusterId / departmentId / locationId: nullable scope columns; per-role validation
 *   (e.g., cluster_manager requires clusterId) lives in the service layer per
 *   Epic 2 plan §9 R4 — not as DB CHECK constraints, since rules vary by role.
 * - lastLoginAt: populated by login flow; nullable until first login.
 *
 * Permissions catalog + role→permission mapping + per-user overrides live in:
 *   - permissions.ts (GLOBAL — see header)
 *   - role-permissions.ts (GLOBAL — see header)
 *   - user-permission-overrides.ts (BRAND-SCOPED)
 *
 * NOTE: created_by / updated_by FKs to users.id cannot be declared inline here
 * because users IS the target table. The circular FK remains deferred — the FK
 * constraint can be added by a later migration once we have a clear use case for
 * audit-time enforcement at DB level. For now, application code populates these
 * UUIDs without DB-level FK validation.
 */

import { text, boolean, uuid, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Canonical 9 roles per FR15 + Master Spec §1.5.
 * Order matters for migrations — appending only is safe; reordering or removing
 * values requires a manual migration step.
 */
export const userRoleEnum = pgEnum('user_role', [
  'brand_owner',
  'cluster_manager',
  'kitchen_manager',
  'store_manager',
  'procurement_manager',
  'finance_manager',
  'dispatch_staff',
  'pos_staff',
  'superadmin',
]);

/**
 * approval_status — FR14 brand-owner self-creation flow.
 * - pending_approval: awaiting Superadmin approval (or Approval Engine routing in Epic 3)
 * - approved: active user, can log in and use the system
 * - rejected: terminal state for declined self-signups
 * - suspended: temporary block (e.g., security incident, offboarding hold)
 */
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending_approval',
  'approved',
  'rejected',
  'suspended',
]);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = brandScopedTable(
  'users',
  {
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    role: userRoleEnum('role').notNull(),
    approvalStatus: approvalStatusEnum('approval_status').notNull().default('approved'),
    // Scope columns — nullable; per-role validity enforced in service layer (plan §9 R4).
    clusterId: uuid('cluster_id'),
    departmentId: uuid('department_id'),
    locationId: uuid('location_id'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
  },
  {
    auditTrigger: true,
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ApprovalStatus = (typeof approvalStatusEnum.enumValues)[number];
