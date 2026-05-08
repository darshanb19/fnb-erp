/**
 * role_permissions — Phase 4 Epic 2 USR Arc (a) Task A3.
 *
 * !! GLOBAL (NON-BRAND-SCOPED) TABLE !!
 *
 * Rationale: same as permissions.ts — role→permission mapping is an
 * application-level matrix (FR15b). Every brand uses the same baseline
 * mapping; per-user deviations live in user_permission_overrides (which IS
 * brand-scoped). Roles are an enum (userRoleEnum); permissions are global —
 * the join table inherits global-ness.
 *
 * Composite PK on (role, permissionId) — a (role, permission) pair appears
 * at most once. Cascade on permissions delete keeps the matrix consistent if
 * a permission is ever retired (rare, but possible).
 *
 * Seeding: NOT done in this task. Task A4 seeds the Epic 1 + Epic 2 baseline
 * matrix per DL-033.
 */

import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './auth.js';
import { permissions } from './permissions.js';

export const rolePermissions = pgTable(
  'role_permissions',
  {
    role: userRoleEnum('role').notNull(),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.role, table.permissionId] }),
  ],
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
