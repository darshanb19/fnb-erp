/**
 * roleService — Task A6/1
 *
 * Read-only catalog for the 9-role enum + per-role permission baseline.
 *
 * These methods query GLOBAL tables (permissions, role_permissions) — no brand_id
 * scoping required. Uses unscopedDb() directly.
 *
 * No transactions needed — reads only.
 */

import { eq } from 'drizzle-orm';
import { unscopedDb } from '../db/client.js';
import { userRoleEnum, type UserRole } from '../db/schema/auth.js';
import { permissions } from '../db/schema/permissions.js';
import { rolePermissions } from '../db/schema/role-permissions.js';

export const roleService = {
  /**
   * Returns all 9 UserRole enum values from the canonical enum definition.
   * No DB query needed — the enum values are statically known.
   */
  async listRoles(): Promise<UserRole[]> {
    return [...userRoleEnum.enumValues] as UserRole[];
  },

  /**
   * Returns the baseline permission keys assigned to a role.
   * Joins role_permissions ⋈ permissions to get permission keys.
   */
  async getRole(role: UserRole): Promise<{ role: UserRole; permissionKeys: string[] }> {
    const db = unscopedDb();
    const rows = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.role, role));

    return {
      role,
      permissionKeys: rows.map((r) => r.key),
    };
  },
};
