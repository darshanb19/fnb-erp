/**
 * audit-service.test.ts — Phase 4 Epic 3 INF Arc (a) Task A8.
 *
 * Integration tests for auditService (READ side):
 *   listEvents (filter combos, scope variants, cursor pagination),
 *   getEntityTimeline,
 *   exportSlice (csv, excel, pdf-stub).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { brands } from '../../src/db/schema/brand.js';
import { clusters } from '../../src/db/schema/org.js';
import { brandedDb } from '../../src/db/branded-db.js';
import { eq } from 'drizzle-orm';
import { auditService } from '../../src/services/audit.service.js';
import { ValidationError } from '../../src/errors/index.js';

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
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

async function createUser(
  brandId: string,
  opts: { clusterId?: string | null; email?: string } = {},
): Promise<{ id: string }> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: opts.email ?? `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      fullName: 'Test User',
      role: 'pos_staff',
      approvalStatus: 'approved',
      clusterId: opts.clusterId ?? null,
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id };
}

async function createCluster(brandId: string): Promise<{ id: string }> {
  const rawDb = unscopedDb();
  const [c] = await rawDb
    .insert(clusters)
    .values({ brandId, name: `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
    .returning();
  if (!c) throw new Error('Failed to create cluster');
  return { id: c.id };
}

interface SeedAuditOpts {
  brandId: string;
  actorUserId?: string | null;
  tableName?: string;
  rowId?: string;
  action?: string;
  trnReference?: string | null;
  occurredAt?: Date;
  reason?: string | null;
}

/** Insert a single audit_log row for testing. */
async function seedAudit(opts: SeedAuditOpts): Promise<{ id: string }> {
  const rawDb = unscopedDb();
  const [r] = await rawDb
    .insert(auditLog)
    .values({
      brandId: opts.brandId,
      actorUserId: opts.actorUserId ?? null,
      tableName: opts.tableName ?? 'users',
      rowId: opts.rowId ?? `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action: opts.action ?? 'insert',
      trnReference: opts.trnReference ?? null,
      occurredAt: opts.occurredAt ?? new Date(),
      reason: opts.reason ?? null,
    })
    .returning({ id: auditLog.id });
  if (!r) throw new Error('Failed to seed audit row');
  return { id: r.id };
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

describe('auditService.listEvents', () => {
  it('returns brand-scoped rows newest first', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const t0 = new Date(Date.now() - 10_000);
    const t1 = new Date(Date.now() - 5_000);
    const t2 = new Date();

    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: t0, rowId: 'a' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: t1, rowId: 'b' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: t2, rowId: 'c' });

    const result = await auditService.listEvents(db, {});
    expect(result.items.length).toBe(3);
    expect(result.items[0]!.rowId).toBe('c');
    expect(result.items[1]!.rowId).toBe('b');
    expect(result.items[2]!.rowId).toBe('a');
    expect(result.nextCursor).toBeNull();
  });

  it('with entityType filter narrows to that table_name', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    await seedAudit({ brandId: testBrandId, actorUserId: u.id, tableName: 'users', rowId: 'r-u-1' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, tableName: 'products', rowId: 'r-p-1' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, tableName: 'products', rowId: 'r-p-2' });

    const result = await auditService.listEvents(db, { filters: { entityType: 'products' } });
    expect(result.items.length).toBe(2);
    for (const r of result.items) expect(r.tableName).toBe('products');
  });

  it('with actorUserId filter narrows to that user', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u1 = await createUser(testBrandId);
    const u2 = await createUser(testBrandId);

    await seedAudit({ brandId: testBrandId, actorUserId: u1.id, rowId: 'r1' });
    await seedAudit({ brandId: testBrandId, actorUserId: u2.id, rowId: 'r2' });
    await seedAudit({ brandId: testBrandId, actorUserId: u1.id, rowId: 'r3' });

    const result = await auditService.listEvents(db, { filters: { actorUserId: u1.id } });
    expect(result.items.length).toBe(2);
    for (const r of result.items) expect(r.actorUserId).toBe(u1.id);
  });

  it('with date range narrows to that window', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const old = new Date('2026-01-01T00:00:00Z');
    const mid = new Date('2026-03-01T00:00:00Z');
    const fresh = new Date('2026-05-01T00:00:00Z');

    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: old, rowId: 'old' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: mid, rowId: 'mid' });
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, occurredAt: fresh, rowId: 'fresh' });

    const result = await auditService.listEvents(db, {
      filters: {
        startDate: new Date('2026-02-01T00:00:00Z'),
        endDate: new Date('2026-04-01T00:00:00Z'),
      },
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.rowId).toBe('mid');
  });

  it("scope='own' returns only the actor's rows", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const me = await createUser(testBrandId);
    const other = await createUser(testBrandId);

    await seedAudit({ brandId: testBrandId, actorUserId: me.id, rowId: 'mine-1' });
    await seedAudit({ brandId: testBrandId, actorUserId: other.id, rowId: 'theirs-1' });
    await seedAudit({ brandId: testBrandId, actorUserId: me.id, rowId: 'mine-2' });

    const result = await auditService.listEvents(db, {
      filters: { scope: { kind: 'own', currentUserId: me.id } },
    });
    expect(result.items.length).toBe(2);
    for (const r of result.items) expect(r.actorUserId).toBe(me.id);
  });

  it("scope='cluster' returns rows whose actor is in the same cluster", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const clusterA = await createCluster(testBrandId);
    const clusterB = await createCluster(testBrandId);

    const aliceA = await createUser(testBrandId, { clusterId: clusterA.id });
    const bobA = await createUser(testBrandId, { clusterId: clusterA.id });
    const carolB = await createUser(testBrandId, { clusterId: clusterB.id });

    await seedAudit({ brandId: testBrandId, actorUserId: aliceA.id, rowId: 'a' });
    await seedAudit({ brandId: testBrandId, actorUserId: bobA.id, rowId: 'b' });
    await seedAudit({ brandId: testBrandId, actorUserId: carolB.id, rowId: 'c' });

    const result = await auditService.listEvents(db, {
      filters: { scope: { kind: 'cluster', currentUserClusterId: clusterA.id } },
    });
    expect(result.items.length).toBe(2);
    const ids = result.items.map((r) => r.actorUserId).sort();
    expect(ids).toEqual([aliceA.id, bobA.id].sort());
  });

  it('cursor pagination steps through pages without duplicates', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await seedAudit({
        brandId: testBrandId,
        actorUserId: u.id,
        occurredAt: new Date(Date.now() - (5 - i) * 1000),
        rowId: `r${i}`,
      });
      ids.push(r.id);
    }

    // Newest-first: ids[4] first.
    const expectedOrder = [...ids].reverse();

    const page1 = await auditService.listEvents(db, { limit: 2 });
    expect(page1.items.map((r) => r.id)).toEqual([expectedOrder[0], expectedOrder[1]]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await auditService.listEvents(db, { limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((r) => r.id)).toEqual([expectedOrder[2], expectedOrder[3]]);

    const page3 = await auditService.listEvents(db, { limit: 2, cursor: page2.nextCursor });
    expect(page3.items.map((r) => r.id)).toEqual([expectedOrder[4]]);
    expect(page3.nextCursor).toBeNull();
  });

  it("scope='cluster' enforces brand isolation in the JOIN path (defense-in-depth vs RLS bypass)", async () => {
    // Regression test for review-fix C1: the cluster-scope path bypasses
    // scopedFrom (because it needs an innerJoin on users) and previously
    // depended on RLS for brand isolation. RLS is bypassed by superuser
    // (local dev) and service-role (Mumbai Supabase) connections — so the
    // service-layer must push an explicit brand_id WHERE.
    const { db: dbA, testBrandId: brandAId } = getTestBrandedDb();
    const rawDb = unscopedDb();

    // Create brand B + corresponding BrandedDb context.
    const [brandB] = await rawDb
      .insert(brands)
      .values({ legalName: `Brand B ${Date.now()}`, country: 'IN' })
      .returning();
    if (!brandB) throw new Error('Failed to create brand B');

    try {
      // Same cluster_id value used in both brands — but cluster rows live
      // in distinct brands. We deliberately reuse the brand A cluster row
      // for the WHERE comparison; what matters is the actor users' cluster_id.
      const sharedClusterIdValue = (await createCluster(brandAId)).id;
      const clusterB = await rawDb
        .insert(clusters)
        .values({ brandId: brandB.id, name: `cluster-shared-${Date.now()}` })
        .returning();
      if (!clusterB[0]) throw new Error('Failed to create cluster in brand B');

      // Actor users — one per brand, both report a cluster_id.
      const actorA = await createUser(brandAId, { clusterId: sharedClusterIdValue });
      const [actorB] = await rawDb
        .insert(users)
        .values({
          brandId: brandB.id,
          email: `actor-b-${Date.now()}@example.com`,
          fullName: 'Actor B',
          role: 'pos_staff',
          approvalStatus: 'approved',
          // Use the SAME cluster id value the cluster-scope filter targets.
          // This is what makes the test meaningful: without the brand_id WHERE,
          // the JOIN would surface this row.
          clusterId: sharedClusterIdValue,
        })
        .returning();
      if (!actorB) throw new Error('Failed to create actor B');

      // Audit rows in both brands.
      await seedAudit({ brandId: brandAId, actorUserId: actorA.id, rowId: 'a-row' });
      await seedAudit({ brandId: brandB.id, actorUserId: actorB.id, rowId: 'b-row' });

      // List from brand A's BrandedDb context with the shared cluster id.
      const result = await auditService.listEvents(dbA, {
        filters: { scope: { kind: 'cluster', currentUserClusterId: sharedClusterIdValue } },
      });

      // Only brand A's audit row must surface; brand B must be filtered out.
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.brandId).toBe(brandAId);
      expect(result.items[0]!.rowId).toBe('a-row');

      // And the inverse — querying from brand B's context returns only brand B.
      const dbB = brandedDb(brandB.id);
      const resultB = await auditService.listEvents(dbB, {
        filters: { scope: { kind: 'cluster', currentUserClusterId: sharedClusterIdValue } },
      });
      expect(resultB.items.length).toBe(1);
      expect(resultB.items[0]!.brandId).toBe(brandB.id);
    } finally {
      // Clean up brand B (truncateTestTables intentionally skips brands).
      // Children must be deleted first to satisfy FK constraints.
      await rawDb.delete(auditLog).where(eq(auditLog.brandId, brandB.id));
      await rawDb.delete(users).where(eq(users.brandId, brandB.id));
      await rawDb.delete(clusters).where(eq(clusters.brandId, brandB.id));
      await rawDb.delete(brands).where(eq(brands.id, brandB.id));
    }
  });

  it("scope='cluster' without currentUserClusterId throws ValidationError", async () => {
    const { db } = getTestBrandedDb();
    await expect(
      auditService.listEvents(db, { filters: { scope: { kind: 'cluster' } } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// getEntityTimeline
// ---------------------------------------------------------------------------

describe('auditService.getEntityTimeline', () => {
  it('returns chronological rows for one entity, matching trn_reference OR row_id', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const t0 = new Date(Date.now() - 10_000);
    const t1 = new Date(Date.now() - 5_000);
    const t2 = new Date();

    // Match by trn_reference.
    await seedAudit({
      brandId: testBrandId,
      actorUserId: u.id,
      tableName: 'purchase_orders',
      trnReference: 'PO-2026-1',
      occurredAt: t1,
      rowId: 'random-1',
    });
    // Match by row_id.
    await seedAudit({
      brandId: testBrandId,
      actorUserId: u.id,
      tableName: 'purchase_orders',
      trnReference: null,
      occurredAt: t0,
      rowId: 'PO-2026-1',
    });
    // Decoy: same row_id but different table.
    await seedAudit({
      brandId: testBrandId,
      actorUserId: u.id,
      tableName: 'users',
      trnReference: 'PO-2026-1',
      occurredAt: t2,
      rowId: 'whatever',
    });

    const rows = await auditService.getEntityTimeline(db, {
      entityType: 'purchase_orders',
      entityRef: 'PO-2026-1',
    });
    expect(rows.length).toBe(2);
    // Chronological ASC: t0 first, t1 second.
    const a = rows[0]!.occurredAt instanceof Date ? rows[0]!.occurredAt : new Date(rows[0]!.occurredAt as unknown as string);
    const b = rows[1]!.occurredAt instanceof Date ? rows[1]!.occurredAt : new Date(rows[1]!.occurredAt as unknown as string);
    expect(a.getTime()).toBeLessThanOrEqual(b.getTime());
  });
});

// ---------------------------------------------------------------------------
// exportSlice
// ---------------------------------------------------------------------------

describe('auditService.exportSlice', () => {
  it("format='csv' returns CSV string with header + escaped fields", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    await seedAudit({
      brandId: testBrandId,
      actorUserId: u.id,
      tableName: 'products',
      rowId: 'p1',
      reason: 'value with, comma and "quote"',
    });

    const result = await auditService.exportSlice(db, { format: 'csv' });
    expect(result.format).toBe('csv');
    if (result.format !== 'csv') throw new Error('unreachable');

    // BOM prefix.
    expect(result.data.charCodeAt(0)).toBe(0xfeff);
    // Header present.
    expect(result.data).toContain('id,brand_id,occurred_at,actor_user_id,table_name');
    // Escaped reason (quotes doubled, wrapped in quotes).
    expect(result.data).toContain('"value with, comma and ""quote"""');
  });

  it("format='excel' returns CSV-with-BOM (MVP fallback)", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    await seedAudit({ brandId: testBrandId, actorUserId: u.id, rowId: 'x' });

    const result = await auditService.exportSlice(db, { format: 'excel' });
    expect(result.format).toBe('excel');
    if (result.format !== 'excel') throw new Error('unreachable');
    expect(result.data.charCodeAt(0)).toBe(0xfeff);
  });

  it("format='pdf' returns a stub jobId (real pg-boss enqueue deferred to Epic 4 INV)", async () => {
    const { db } = getTestBrandedDb();
    const result = await auditService.exportSlice(db, { format: 'pdf' });
    expect(result.format).toBe('pdf');
    if (result.format !== 'pdf') throw new Error('unreachable');
    expect(result.jobId).toMatch(/^pending-[0-9a-f-]+$/);
  });
});

// ---------------------------------------------------------------------------
// Sanity: audit_log table is present
// ---------------------------------------------------------------------------

describe('infrastructure', () => {
  it('audit_log table exists', async () => {
    const rawDb = unscopedDb();
    const result = await rawDb.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'audit_log'
    `);
    const names = (result as unknown as Array<{ table_name: string }>).map((r) => r.table_name);
    expect(names).toContain('audit_log');
  });
});
