/**
 * Integration tests for orgService.
 *
 * Covers:
 *  - FR1: cluster CRUD (create, list, get, update, deactivate)
 *  - FR2: department classification (all 4 types)
 *  - DL-022: parent-lock (clusterId on location; locationId on department)
 *  - DL-013: audit_log row written on every create + update
 *
 * Uses fnberp_test database (set via TEST_DATABASE_URL / DATABASE_URL env).
 * Each test runs against a clean slate — truncateTestTables() in afterEach
 * removes all rows except the test brand row.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { orgService } from '../../src/services/org.service.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { ParentRelinkAttemptError } from '../../src/errors/index.js';

beforeAll(async () => {
  await setupIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// FR1 — Cluster CRUD
// ---------------------------------------------------------------------------

describe('orgService — FR1 cluster CRUD', () => {
  it('creates a cluster under the brand', async () => {
    const { db } = getTestBrandedDb();
    const cluster = await orgService.createCluster(
      db,
      { name: 'Mumbai Hub' },
      { actorUserId: null },
    );
    expect(cluster.name).toBe('Mumbai Hub');
    expect(cluster.brandId).toBe(db.brandId);
    expect(cluster.active).toBe(true);
    expect(cluster.id).toBeTruthy();
  });

  it('lists clusters scoped to caller brand', async () => {
    const { db } = getTestBrandedDb();
    await orgService.createCluster(db, { name: 'A' }, { actorUserId: null });
    await orgService.createCluster(db, { name: 'B' }, { actorUserId: null });
    const list = await orgService.listClusters(db);
    expect(list.length).toBe(2);
    expect(list.every((c) => c.brandId === db.brandId)).toBe(true);
  });

  it('gets a cluster by id', async () => {
    const { db } = getTestBrandedDb();
    const created = await orgService.createCluster(db, { name: 'GetMe' }, { actorUserId: null });
    const fetched = await orgService.getCluster(db, created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('GetMe');
  });

  it('updates cluster name', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'Old Name' }, { actorUserId: null });
    const updated = await orgService.updateCluster(
      db,
      c.id,
      { name: 'New Name' },
      { actorUserId: null, reason: 'Rename cluster' },
    );
    expect(updated.name).toBe('New Name');
    expect(updated.id).toBe(c.id);
  });

  it('deactivates a cluster (soft delete; active=false)', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'X' }, { actorUserId: null });
    const updated = await orgService.deactivateCluster(db, c.id, {
      actorUserId: null,
      reason: 'Closing the hub',
    });
    expect(updated.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DL-022 — Parent-lock
// ---------------------------------------------------------------------------

describe('orgService — DL-022 parent-lock', () => {
  it('rejects re-parenting a Location to a different Cluster', async () => {
    const { db } = getTestBrandedDb();
    const c1 = await orgService.createCluster(db, { name: 'A' }, { actorUserId: null });
    const c2 = await orgService.createCluster(db, { name: 'B' }, { actorUserId: null });
    const loc = await orgService.createLocation(
      db,
      { clusterId: c1.id, name: 'POS-AA', type: 'pos_outlet' },
      { actorUserId: null },
    );
    // The TS type already excludes clusterId from LocationUpdate.
    // Runtime guard catches an end-run via `as any` cast:
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgService.updateLocation(db, loc.id, { clusterId: c2.id } as any, {
        actorUserId: null,
        reason: 'try to relink',
      }),
    ).rejects.toBeInstanceOf(ParentRelinkAttemptError);
  });

  it('rejects re-parenting a Department to a different Location', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'C' }, { actorUserId: null });
    const l1 = await orgService.createLocation(
      db,
      { clusterId: c.id, name: 'L1', type: 'pos_outlet' },
      { actorUserId: null },
    );
    const l2 = await orgService.createLocation(
      db,
      { clusterId: c.id, name: 'L2', type: 'pos_outlet' },
      { actorUserId: null },
    );
    const dept = await orgService.createDepartment(
      db,
      { locationId: l1.id, name: 'Production', type: 'production' },
      { actorUserId: null },
    );
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgService.updateDepartment(db, dept.id, { locationId: l2.id } as any, {
        actorUserId: null,
        reason: 'relink',
      }),
    ).rejects.toBeInstanceOf(ParentRelinkAttemptError);
  });

  it('soft-deactivate cluster does NOT cascade to locations', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'C' }, { actorUserId: null });
    const loc = await orgService.createLocation(
      db,
      { clusterId: c.id, name: 'L', type: 'pos_outlet' },
      { actorUserId: null },
    );
    await orgService.deactivateCluster(db, c.id, { actorUserId: null, reason: 'closing' });
    const stillActive = await orgService.getLocation(db, loc.id);
    expect(stillActive.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FR2 — Department classification
// ---------------------------------------------------------------------------

describe('orgService — FR2 department classification', () => {
  it('classifies departments as production / dispatch / non_production / store', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'C' }, { actorUserId: null });
    const l = await orgService.createLocation(
      db,
      { clusterId: c.id, name: 'L', type: 'central_kitchen' },
      { actorUserId: null },
    );

    for (const t of ['production', 'dispatch', 'non_production', 'store'] as const) {
      await orgService.createDepartment(
        db,
        { locationId: l.id, name: `${t} dept`, type: t },
        { actorUserId: null },
      );
    }

    const all = await orgService.listDepartments(db, { locationId: l.id });
    expect(all.length).toBe(4);

    const byType = await orgService.listDepartments(db, { locationId: l.id, type: 'production' });
    expect(byType.length).toBe(1);
    expect(byType[0]?.type).toBe('production');
  });
});

// ---------------------------------------------------------------------------
// DL-013 — Application-layer audit
// ---------------------------------------------------------------------------

describe('orgService — DL-013 application-layer audit', () => {
  it('writes audit_log rows on create and update with reason captured', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'audit-test' }, { actorUserId: null });
    await orgService.updateCluster(
      db,
      c.id,
      { name: 'audit-test-renamed' },
      { actorUserId: null, reason: 'typo fix' },
    );

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, c.id)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    expect(auditRows.length).toBe(2);

    const insertRow = auditRows.find((r) => r.action === 'insert');
    const updateRow = auditRows.find((r) => r.action === 'update');
    expect(insertRow).toBeDefined();
    expect(updateRow).toBeDefined();
    expect(updateRow?.reason).toBe('typo fix');

    // changedFields should include 'name' at minimum
    const changedFields = updateRow?.changedFields as string[] | null;
    expect(Array.isArray(changedFields)).toBe(true);
    expect(changedFields).toContain('name');
  });

  it('writes audit_log row on deactivate', async () => {
    const { db } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'deactivate-audit' }, { actorUserId: null });
    await orgService.deactivateCluster(db, c.id, { actorUserId: null, reason: 'shutting down' });

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, c.id)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    const deactivateRow = auditRows.find((r) => r.action === 'update');
    expect(deactivateRow).toBeDefined();
    expect(deactivateRow?.reason).toBe('shutting down');
    const afterData = deactivateRow?.after as Record<string, unknown> | null;
    expect(afterData?.['active']).toBe(false);
  });

  it('audit_log rows are scoped to brand (brand_id matches)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const c = await orgService.createCluster(db, { name: 'brand-scope-test' }, { actorUserId: null });

    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, c.id)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((r) => r.brandId === testBrandId)).toBe(true);
  });
});
