/**
 * user_permission_overrides — Phase 4 Epic 2 USR Arc (a) Task A3.
 *
 * BRAND-SCOPED. Per-user grants/revocations on top of the role baseline.
 *
 * - mode = 'grant'  → grants a permission the user's role does NOT have
 * - mode = 'revoke' → revokes a permission the user's role DOES have
 *
 * Effective permission set per user (FR15c):
 *   role_permissions[user.role] ∪ overrides(grant) \ overrides(revoke)
 * Computed in the service layer (Task A6 userService.getEffectivePermissions).
 *
 * `reasonCode` is mandatory on every override (FR15c) — e.g.
 * 'temporary_coverage', 'pii_access_for_compliance', 'security_lockout'.
 * Free-text rationale lives in the audit log (DL-013); reasonCode is a
 * lightweight categorical tag for filtering and reporting.
 *
 * `expiresAt` nullable — null means permanent. Service layer filters out
 * expired overrides at compute time; a periodic job (post-MVP) can prune
 * stale rows.
 *
 * Audit-trigger ON because overrides are a security-sensitive surface:
 * granting/revoking access should always leave a permanent trail.
 */

import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';
import { permissions } from './permissions.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const overrideModeEnum = pgEnum('override_mode', ['grant', 'revoke']);

// ---------------------------------------------------------------------------
// user_permission_overrides
// ---------------------------------------------------------------------------

export const userPermissionOverrides = brandScopedTable(
  'user_permission_overrides',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'restrict' }),
    mode: overrideModeEnum('mode').notNull(),
    reasonCode: text('reason_code').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  {
    auditTrigger: true,
  },
);

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type NewUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;
export type OverrideMode = (typeof overrideModeEnum.enumValues)[number];
