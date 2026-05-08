/**
 * permission-service.test.ts — Task A6/2
 *
 * Integration tests for permissionService (effective-permission resolver).
 * Tests: listPermissions, getEffectivePermissions, userHasPermission.
 *
 * Global tables (permissions, role_permissions) are NOT truncated.
 * Brand-scoped tables (users, user_permission_overrides, audit_log) are truncated
 * in afterEach via truncateTestTables().
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupIntegration, teardownIntegration, truncateTestTables, getTestBrandedDb } from './setup.js';
import { permissionService } from '../../src/services/permission.service.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { permissions } from '../../src/db/schema/permissions.js';
import { userPermissionOverrides } from '../../src/db/schema/user-permission-overrides.js';

beforeAll(async () => {
  await setupIntegration();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestUser(opts: {
  testBrandId: string;
  email?: string;
  role?: (typeof users)['role']['enumValues'][number];
}): Promise<string> {
  const db = unscopedDb();
  const [u] = await db
    .insert(users)
    .values({
      brandId: opts.testBrandId,
      email: opts.email ?? `test-${Date.now()}@example.com`,
      fullName: 'Test User',
      role: opts.role ?? 'store_manager',
      approvalStatus: 'approved',
    })
    .returning({ id: users.id });
  if (!u) throw new Error('Failed to create test user');
  return u.id;
}

async function getPermissionId(key: string): Promise<string> {
  const db = unscopedDb();
  const rows = await db.select({ id: permissions.id }).from(permissions).where(
    (await import('drizzle-orm')).eq(permissions.key, key),
  );
  if (!rows[0]) throw new Error(`Permission key not found: ${key}`);
  return rows[0].id;
}

describe('permissionService', () => {
  it('listPermissions() returns 18 rows', async () => {
    const result = await permissionService.listPermissions();
    expect(result).toHaveLength(18);
    // Spot check a known key
    const keys = result.map((p) => p.key);
    expect(keys).toContain('mdm.org.read');
    expect(keys).toContain('usr.accounts.approve');
  });

  it('getEffectivePermissions() for user with no overrides returns role baseline only', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser({ testBrandId, role: 'store_manager' });

    const keys = await permissionService.getEffectivePermissions(db, userId);

    // store_manager baseline: mdm.org.read, mdm.products.read, mdm.categories.read, mdm.enablement.read
    expect(keys).toContain('mdm.org.read');
    expect(keys).toContain('mdm.products.read');
    expect(keys).toContain('mdm.categories.read');
    expect(keys).toContain('mdm.enablement.read');
    // Should NOT have write permissions
    expect(keys).not.toContain('mdm.org.write');
    expect(keys).not.toContain('usr.users.write');
  });

  it('getEffectivePermissions() active grant adds a key to effective set', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser({ testBrandId, role: 'store_manager' });

    // Grant a permission the role does NOT have
    const permId = await getPermissionId('mdm.org.write');
    const rawDb = unscopedDb();
    await rawDb.insert(userPermissionOverrides).values({
      brandId: testBrandId,
      userId,
      permissionId: permId,
      mode: 'grant',
      reasonCode: 'temp_coverage',
      expiresAt: null, // permanent
    });

    const keys = await permissionService.getEffectivePermissions(db, userId);
    expect(keys).toContain('mdm.org.write');
  });

  it('getEffectivePermissions() active revoke removes a key from effective set', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser({ testBrandId, role: 'store_manager' });

    // Revoke mdm.org.read which store_manager has in baseline
    const permId = await getPermissionId('mdm.org.read');
    const rawDb = unscopedDb();
    await rawDb.insert(userPermissionOverrides).values({
      brandId: testBrandId,
      userId,
      permissionId: permId,
      mode: 'revoke',
      reasonCode: 'security_lockout',
      expiresAt: null,
    });

    const keys = await permissionService.getEffectivePermissions(db, userId);
    expect(keys).not.toContain('mdm.org.read');
    // Other baseline keys should still be present
    expect(keys).toContain('mdm.products.read');
  });

  it('getEffectivePermissions() expired override does NOT affect effective set', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser({ testBrandId, role: 'store_manager' });

    // Grant mdm.org.write but with an expired expiresAt
    const permId = await getPermissionId('mdm.org.write');
    const rawDb = unscopedDb();
    const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
    await rawDb.insert(userPermissionOverrides).values({
      brandId: testBrandId,
      userId,
      permissionId: permId,
      mode: 'grant',
      reasonCode: 'expired_grant',
      expiresAt: pastDate,
    });

    const keys = await permissionService.getEffectivePermissions(db, userId);
    // Expired grant should NOT add the key
    expect(keys).not.toContain('mdm.org.write');
  });

  it('userHasPermission() true/false matrix consistent with getEffectivePermissions', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser({ testBrandId, role: 'pos_staff' });

    // pos_staff baseline: mdm.products.read, mdm.categories.read
    const hasProducts = await permissionService.userHasPermission(userId, 'mdm.products.read');
    const hasOrgWrite = await permissionService.userHasPermission(userId, 'mdm.org.write');

    expect(hasProducts).toBe(true);
    expect(hasOrgWrite).toBe(false);
  });
});
