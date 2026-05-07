/**
 * user-service.test.ts — Task A6/3
 *
 * Integration tests for userService (CRUD + FR14 BO-pending-approval + scope filtering).
 *
 * Global tables (permissions, role_permissions) NOT truncated.
 * Brand-scoped tables truncated in afterEach.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { userService } from '../../src/services/user.service.js';
import { unscopedDb } from '../../src/db/client.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { NotFoundError } from '../../src/errors/index.js';

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
// Tests
// ---------------------------------------------------------------------------

describe('userService', () => {
  it('create() with brand_owner role sets approval_status = "pending_approval"', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const user = await userService.create(
      db,
      {
        email: 'bo@example.com',
        fullName: 'Brand Owner',
        role: 'brand_owner',
        reasonCode: 'initial_setup',
      },
      { actorUserId: null },
    );
    expect(user.approvalStatus).toBe('pending_approval');
    expect(user.email).toBe('bo@example.com');
    expect(user.brandId).toBe(testBrandId);
  });

  it('create() with non-BO role sets approval_status = "approved"', async () => {
    const { db } = getTestBrandedDb();
    const user = await userService.create(
      db,
      {
        email: 'mgr@example.com',
        fullName: 'Store Manager',
        role: 'store_manager',
        reasonCode: 'initial_setup',
      },
      { actorUserId: null },
    );
    expect(user.approvalStatus).toBe('approved');
  });

  it('create() writes an audit row with reason', async () => {
    const { db } = getTestBrandedDb();
    const user = await userService.create(
      db,
      {
        email: 'audit@example.com',
        fullName: 'Audit Test',
        role: 'finance_manager',
        reasonCode: 'test_reason',
      },
      { actorUserId: null },
    );
    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where((await import('drizzle-orm')).eq(auditLog.rowId, user.id));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.action).toBe('insert');
    expect(auditRows[0]!.tableName).toBe('users');
    expect(auditRows[0]!.reason).toBe('test_reason');
  });

  it('list() brand scope returns all users for the brand', async () => {
    const { db } = getTestBrandedDb();
    await userService.create(
      db,
      { email: 'u1@example.com', fullName: 'User 1', role: 'pos_staff', reasonCode: 'r' },
      { actorUserId: null },
    );
    await userService.create(
      db,
      { email: 'u2@example.com', fullName: 'User 2', role: 'dispatch_staff', reasonCode: 'r' },
      { actorUserId: null },
    );
    const users = await userService.list(db, { scope: { kind: 'brand' } });
    expect(users.length).toBeGreaterThanOrEqual(2);
    const emails = users.map((u) => u.email);
    expect(emails).toContain('u1@example.com');
    expect(emails).toContain('u2@example.com');
  });

  it('list() cluster scope filters by cluster_id', async () => {
    const { db } = getTestBrandedDb();
    const clusterId = '00000000-0000-0000-0000-000000000c01';
    const otherClusterId = '00000000-0000-0000-0000-000000000c02';

    await userService.create(
      db,
      { email: 'cl1@example.com', fullName: 'Cluster 1 User', role: 'store_manager', clusterId, reasonCode: 'r' },
      { actorUserId: null },
    );
    await userService.create(
      db,
      { email: 'cl2@example.com', fullName: 'Other Cluster User', role: 'store_manager', clusterId: otherClusterId, reasonCode: 'r' },
      { actorUserId: null },
    );

    const users = await userService.list(db, {
      scope: { kind: 'cluster', clusterId },
    });
    expect(users.every((u) => u.clusterId === clusterId)).toBe(true);
    const emails = users.map((u) => u.email);
    expect(emails).toContain('cl1@example.com');
    expect(emails).not.toContain('cl2@example.com');
  });

  it('update() writes an audit row with changedFields', async () => {
    const { db } = getTestBrandedDb();
    const user = await userService.create(
      db,
      { email: 'upd@example.com', fullName: 'Original Name', role: 'pos_staff', reasonCode: 'r' },
      { actorUserId: null },
    );

    await userService.update(
      db,
      user.id,
      { fullName: 'Updated Name' },
      { reasonCode: 'name_correction', actorUserId: null },
    );

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where((await import('drizzle-orm')).eq(auditLog.rowId, user.id));

    // Should have insert + update rows
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    const updateRow = auditRows.find((r) => r.action === 'update');
    expect(updateRow).toBeDefined();
    expect(updateRow!.changedFields).toContain('fullName');
    expect(updateRow!.reason).toBe('name_correction');
  });

  it('deactivate() sets active=false', async () => {
    const { db } = getTestBrandedDb();
    const user = await userService.create(
      db,
      { email: 'deact@example.com', fullName: 'Deactivate Me', role: 'pos_staff', reasonCode: 'r' },
      { actorUserId: null },
    );
    expect(user.active).toBe(true);

    await userService.deactivate(db, user.id, { reasonCode: 'offboarding', actorUserId: null });

    const all = await userService.list(db, { scope: { kind: 'brand' } });
    const found = all.find((u) => u.id === user.id);
    expect(found?.active).toBe(false);
  });

  it('update() throws NotFoundError for unknown user', async () => {
    const { db } = getTestBrandedDb();
    await expect(
      userService.update(
        db,
        '00000000-0000-0000-0000-000000000bad',
        { fullName: 'Ghost' },
        { reasonCode: 'r', actorUserId: null },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
