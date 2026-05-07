/**
 * permission.service — Task A6/2 (replaces A5 stub)
 *
 * Effective-permission resolver.
 *
 * Formula (FR15c):
 *   effective = role_baseline ∪ active_grants − active_revokes
 *   "active" = expires_at IS NULL OR expires_at > NOW()
 *
 * `userHasPermission(userId, key)` keeps the 2-arg signature used by rbac.ts
 * (authMiddleware context doesn't pass a branded db). Internally it looks up
 * the user's brandId and constructs a branded db to call getEffectivePermissions.
 *
 * `getEffectivePermissions(db, userId)` is the brand-scoped variant for service
 * code that already has a BrandedDb in scope.
 */

import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { unscopedDb } from '../db/client.js';
import { brandedDb, type BrandedDb } from '../db/branded-db.js';
import { permissions, type Permission } from '../db/schema/permissions.js';
import { rolePermissions } from '../db/schema/role-permissions.js';
import { users } from '../db/schema/auth.js';
import { userPermissionOverrides } from '../db/schema/user-permission-overrides.js';

export const permissionService = {
  /**
   * Returns all 18 permission catalog rows (global table — no brand scope).
   */
  async listPermissions(): Promise<Permission[]> {
    const db = unscopedDb();
    return db.select().from(permissions);
  },

  /**
   * Returns the user's effective permission key set.
   * Formula: role_baseline ∪ active_grants − active_revokes.
   *
   * @param db     Brand-scoped db (for reading user_permission_overrides).
   * @param userId Target user's id.
   */
  async getEffectivePermissions(db: BrandedDb, userId: string): Promise<string[]> {
    const rawDb = unscopedDb();

    // 1. Look up user to get their role
    const userRows = await rawDb
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    const user = userRows[0];
    if (!user) {
      return [];
    }

    // 2. Fetch role baseline keys
    const baselineRows = await rawDb
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.role, user.role));
    const baselineKeys = new Set(baselineRows.map((r) => r.key));

    // 3. Fetch active overrides (grant and revoke) for this user
    //    "active" = expires_at IS NULL OR expires_at > NOW()
    const now = new Date();
    const overrideRows = await (db.scopedFrom(
      userPermissionOverrides,
      and(
        eq(userPermissionOverrides.userId, userId),
        or(
          isNull(userPermissionOverrides.expiresAt),
          gt(userPermissionOverrides.expiresAt, now),
        ),
      ),
    ) as unknown as Promise<Array<{ permissionId: string; mode: 'grant' | 'revoke' }>>);

    // 4. Collect grant/revoke permission ids
    const grantIds = overrideRows.filter((o) => o.mode === 'grant').map((o) => o.permissionId);
    const revokeIds = overrideRows.filter((o) => o.mode === 'revoke').map((o) => o.permissionId);

    // 5. Resolve grant ids → keys (if any)
    let grantKeys: Set<string> = new Set();
    if (grantIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const grantRows = await rawDb
        .select({ key: permissions.key })
        .from(permissions)
        .where(inArray(permissions.id, grantIds));
      grantKeys = new Set(grantRows.map((r) => r.key));
    }

    // 6. Resolve revoke ids → keys (if any)
    let revokeKeys: Set<string> = new Set();
    if (revokeIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const revokeRows = await rawDb
        .select({ key: permissions.key })
        .from(permissions)
        .where(inArray(permissions.id, revokeIds));
      revokeKeys = new Set(revokeRows.map((r) => r.key));
    }

    // 7. Apply formula: (baseline ∪ grants) − revokes
    const effective = new Set([...baselineKeys, ...grantKeys]);
    for (const k of revokeKeys) {
      effective.delete(k);
    }

    return [...effective];
  },

  /**
   * Whether the user has the named permission key.
   *
   * Signature kept as 2-arg (userId, key) so rbac.ts can call without
   * needing to pass a BrandedDb. The brandId is resolved internally
   * via a user lookup on the global users table.
   *
   * This matches the A5 rbac.ts call site: `userHasPermission(req.user.id, key)`.
   */
  async userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
    // Resolve brandId for this user
    const rawDb = unscopedDb();
    const userRows = await rawDb
      .select({ brandId: users.brandId })
      .from(users)
      .where(eq(users.id, userId));
    const user = userRows[0];
    if (!user) return false;

    const db = brandedDb(user.brandId);
    const effective = await permissionService.getEffectivePermissions(db, userId);
    return effective.includes(permissionKey);
  },
};
