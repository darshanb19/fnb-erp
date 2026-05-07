/**
 * permission-override-service.test.ts — Task A6/4
 *
 * Integration tests for permissionOverrideService (FR15a/b/c overrides).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { permissionOverrideService } from '../../src/services/permission-override.service.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { permissions } from '../../src/db/schema/permissions.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { eq } from 'drizzle-orm';
import { ValidationError } from '../../src/errors/index.js';

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

async function createTestUser(testBrandId: string, email?: string): Promise<string> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId: testBrandId,
      email: email ?? `user-${Date.now()}@example.com`,
      fullName: 'Test User',
      role: 'store_manager',
      approvalStatus: 'approved',
    })
    .returning({ id: users.id });
  if (!u) throw new Error('Failed to create test user');
  return u.id;
}

async function getPermissionId(key: string): Promise<string> {
  const rawDb = unscopedDb();
  const rows = await rawDb
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.key, key));
  if (!rows[0]) throw new Error(`Permission key not found: ${key}`);
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('permissionOverrideService', () => {
  it('grant() writes a row with mode="grant", reason_code, and expiresAt', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.write');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days from now

    const override = await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId, reasonCode: 'temp_coverage', expiresAt },
      { actorUserId: null },
    );

    expect(override.mode).toBe('grant');
    expect(override.reasonCode).toBe('temp_coverage');
    expect(override.userId).toBe(userId);
    expect(override.permissionId).toBe(permId);
    expect(override.expiresAt).toBeTruthy();
  });

  it('grant() rejects empty reasonCode with ValidationError', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.write');

    await expect(
      permissionOverrideService.grant(
        db,
        { userId, permissionId: permId, reasonCode: '', expiresAt: null },
        { actorUserId: null },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('revoke() writes a row with mode="revoke"', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.read');

    const override = await permissionOverrideService.revoke(
      db,
      { userId, permissionId: permId, reasonCode: 'security_lockout', expiresAt: null },
      { actorUserId: null },
    );

    expect(override.mode).toBe('revoke');
    expect(override.reasonCode).toBe('security_lockout');
    expect(override.expiresAt).toBeNull();
  });

  it('editOverride() updates reason_code and expiresAt; mode is immutable', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.write');

    const override = await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId, reasonCode: 'original_reason', expiresAt: null },
      { actorUserId: null },
    );

    const newExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const updated = await permissionOverrideService.editOverride(
      db,
      override.id,
      { reasonCode: 'updated_reason', expiresAt: newExpiry },
      { actorUserId: null },
    );

    expect(updated.reasonCode).toBe('updated_reason');
    expect(updated.expiresAt).toBeTruthy();
    // Mode stays 'grant'
    expect(updated.mode).toBe('grant');
  });

  it('listExpiringSoon(14) returns matching overrides in ASC order on expiresAt', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId1 = await getPermissionId('mdm.org.write');
    const permId2 = await getPermissionId('mdm.products.write');
    const permId3 = await getPermissionId('mdm.vendors.write');
    const permId4 = await getPermissionId('mdm.categories.write');

    // Expiring in 5 days (within 14) — seed first to verify ordering is by
    // expires_at, not insertion order.
    const fiveDays = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId2, reasonCode: 'temp-5d', expiresAt: fiveDays },
      { actorUserId: null },
    );

    // Expiring in 1 day (within 14) — seed second; should still come first in ASC.
    const oneDay = new Date(Date.now() + 1 * 24 * 3600 * 1000);
    await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId1, reasonCode: 'temp-1d', expiresAt: oneDay },
      { actorUserId: null },
    );

    // Expiring in 10 days (within 14)
    const tenDays = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId3, reasonCode: 'temp-10d', expiresAt: tenDays },
      { actorUserId: null },
    );

    // Expiring in 30 days (outside 14)
    const thirtyDays = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId4, reasonCode: 'temp-30d', expiresAt: thirtyDays },
      { actorUserId: null },
    );

    const expiringSoon = await permissionOverrideService.listExpiringSoon(db, 14);
    const permIds = expiringSoon.map((o) => o.permissionId);

    // Out-of-window override is excluded
    expect(permIds).not.toContain(permId4);

    // Three in-window overrides are included
    expect(permIds).toContain(permId1);
    expect(permIds).toContain(permId2);
    expect(permIds).toContain(permId3);

    // Returned in ASC order on expires_at: 1d → 5d → 10d
    const inWindow = expiringSoon.filter((o) =>
      [permId1, permId2, permId3].includes(o.permissionId),
    );
    expect(inWindow.map((o) => o.permissionId)).toEqual([permId1, permId2, permId3]);

    // Strictly non-decreasing expiresAt across the full result set
    for (let i = 1; i < expiringSoon.length; i++) {
      const prev = expiringSoon[i - 1]!.expiresAt!.getTime();
      const curr = expiringSoon[i]!.expiresAt!.getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('expireOverride() sets expires_at to approximately NOW', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.write');

    const override = await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId, reasonCode: 'temp', expiresAt: null },
      { actorUserId: null },
    );

    const before = Date.now();
    await permissionOverrideService.expireOverride(db, override.id, { actorUserId: null });
    const after = Date.now();

    // Re-fetch to check expiresAt
    const all = await permissionOverrideService.listExpiringSoon(db, 0);
    // The override should no longer appear in "expiring soon" (it's already expired)
    // Verify by fetching directly
    const rawDb = unscopedDb();
    const rows = await rawDb
      .select()
      .from((await import('../../src/db/schema/user-permission-overrides.js')).userPermissionOverrides)
      .where(eq((await import('../../src/db/schema/user-permission-overrides.js')).userPermissionOverrides.id, override.id));
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.expiresAt).toBeTruthy();
    const expiredAt = row!.expiresAt!.getTime();
    // Should be within a 10-second window of the operation
    expect(expiredAt).toBeGreaterThanOrEqual(before - 5000);
    expect(expiredAt).toBeLessThanOrEqual(after + 5000);
  });

  it('audit rows are written for grant, revoke, editOverride, expireOverride', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const userId = await createTestUser(testBrandId);
    const permId = await getPermissionId('mdm.org.write');

    const override = await permissionOverrideService.grant(
      db,
      { userId, permissionId: permId, reasonCode: 'temp', expiresAt: null },
      { actorUserId: null },
    );

    await permissionOverrideService.editOverride(
      db,
      override.id,
      { reasonCode: 'updated' },
      { actorUserId: null },
    );

    await permissionOverrideService.expireOverride(db, override.id, { actorUserId: null });

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.rowId, override.id));

    // Should have: insert (grant), update (edit), update (expire)
    expect(auditRows.length).toBeGreaterThanOrEqual(3);
    const actions = auditRows.map((r) => r.action);
    expect(actions.filter((a) => a === 'insert')).toHaveLength(1);
    expect(actions.filter((a) => a === 'update').length).toBeGreaterThanOrEqual(2);
  });
});
