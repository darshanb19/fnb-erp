/**
 * Integration tests for the permissions seed (0008_seed_permissions.sql).
 *
 * Verifies the catalog + role baseline applied to fnberp_test matches the
 * TypeScript source-of-truth in apps/api/src/db/seed/permissions-catalog.ts.
 *
 * Reads only — does not mutate. permissions + role_permissions are NOT
 * included in setup.ts truncateTestTables(), so the seed persists across
 * test files. This file therefore does not need afterEach truncation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { setupIntegration, teardownIntegration } from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { permissions } from '../../src/db/schema/permissions.js';
import { PERMISSIONS_CATALOG, ROLE_BASELINE } from '../../src/db/seed/permissions-catalog.js';
import type { UserRole } from '../../src/db/schema/auth.js';

beforeAll(async () => {
  await setupIntegration();
});

afterAll(async () => {
  await teardownIntegration();
});

describe('permissions seed (0008_seed_permissions.sql)', () => {
  it('catalog has all 18 keys from PERMISSIONS_CATALOG', async () => {
    const db = unscopedDb();
    const rows = await db.select({ key: permissions.key }).from(permissions);
    const dbKeys = new Set(rows.map((r) => r.key));
    expect(PERMISSIONS_CATALOG).toHaveLength(18);
    for (const def of PERMISSIONS_CATALOG) {
      expect(dbKeys.has(def.key), `permission ${def.key} missing from DB`).toBe(true);
    }
  });

  it('role_permissions match ROLE_BASELINE counts per role', async () => {
    const db = unscopedDb();
    for (const [role, expectedKeys] of Object.entries(ROLE_BASELINE) as [UserRole, string[]][]) {
      const result = await db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM role_permissions WHERE role = ${role}::user_role
      `);
      const rows = result as unknown as Array<{ count: number }>;
      const count = rows[0]?.count ?? -1;
      expect(count, `role ${role} count mismatch`).toBe(expectedKeys.length);
    }
  });

  it('every ROLE_BASELINE key references an existing permission key (catalog integrity)', () => {
    const catalogKeys = new Set(PERMISSIONS_CATALOG.map((p) => p.key));
    for (const [role, keys] of Object.entries(ROLE_BASELINE)) {
      for (const key of keys) {
        expect(catalogKeys.has(key), `${role} references unknown permission ${key}`).toBe(true);
      }
    }
  });

  it('role_permissions in DB exactly equal ROLE_BASELINE keys per role', async () => {
    const db = unscopedDb();
    const result = await db.execute<{ role: UserRole; key: string }>(sql`
      SELECT rp.role::text AS role, p.key AS key
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
    `);
    const rows = result as unknown as Array<{ role: UserRole; key: string }>;
    const dbByRole = new Map<UserRole, Set<string>>();
    for (const r of rows) {
      let bucket = dbByRole.get(r.role);
      if (!bucket) {
        bucket = new Set();
        dbByRole.set(r.role, bucket);
      }
      bucket.add(r.key);
    }
    for (const [role, expectedKeys] of Object.entries(ROLE_BASELINE) as [UserRole, string[]][]) {
      const dbSet = dbByRole.get(role) ?? new Set();
      const expectedSet = new Set(expectedKeys);
      expect(dbSet, `role ${role} key set mismatch`).toEqual(expectedSet);
    }
  });
});
