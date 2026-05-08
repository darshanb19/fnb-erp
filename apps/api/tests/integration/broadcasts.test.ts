/**
 * broadcasts.test.ts — Phase 4 Epic 3 INF Arc (a) Task A9.
 *
 * Integration tests for broadcastService.compose / update / send / cancel /
 * acknowledge / listForUser / listSent / listAcks.
 *
 * Realtime publishers mocked. notificationCenter is real (writes notifications
 * rows + uses notification_type_config seed); fan-out is observed by querying
 * the notifications table.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq, and, sql } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { notifications } from '../../src/db/schema/notifications.js';
import {
  broadcastAnnouncements,
  broadcastAcknowledgements,
} from '../../src/db/schema/broadcasts.js';
import { brands } from '../../src/db/schema/brand.js';
import { brandedDb } from '../../src/db/branded-db.js';
import { ValidationError, NotFoundError } from '../../src/errors/index.js';

vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

import { broadcastService } from '../../src/services/broadcast.service.js';

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

type Role =
  | 'brand_owner'
  | 'cluster_manager'
  | 'kitchen_manager'
  | 'store_manager'
  | 'procurement_manager'
  | 'finance_manager'
  | 'dispatch_staff'
  | 'pos_staff'
  | 'superadmin';

async function createUser(
  brandId: string,
  role: Role = 'pos_staff',
  scope?: { clusterId?: string; locationId?: string; active?: boolean },
): Promise<{ id: string; role: Role }> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      fullName: `Test ${role}`,
      role,
      approvalStatus: 'approved',
      clusterId: scope?.clusterId ?? null,
      locationId: scope?.locationId ?? null,
      active: scope?.active ?? true,
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id, role: u.role as Role };
}

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

describe('broadcastService.compose', () => {
  it('inserts row with status=draft + writes audit row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const b = await broadcastService.compose(
      db,
      { title: 'Hello', body: 'World', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    expect(b.status).toBe('draft');
    expect(b.createdByUserId).toBe(bo.id);
    expect(b.urgency).toBe('info');
    expect(b.ackRequired).toBe(false);

    const rawDb = unscopedDb();
    const auditRows = await rawDb.select().from(auditLog).where(eq(auditLog.rowId, b.id));
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]!.action).toBe('insert');
  });

  it('with scheduledFor — status remains draft (schedule transition is a separate step)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const b = await broadcastService.compose(
      db,
      {
        title: 'Future',
        body: 'Tomorrow',
        targetScope: { scope: 'brand' },
        scheduledFor: future,
      },
      { actorUserId: bo.id },
    );
    expect(b.status).toBe('draft');
    expect(b.scheduledFor).toBeInstanceOf(Date);
  });

  it('rejects empty values array on cluster_ids scope', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    await expect(
      broadcastService.compose(
        db,
        {
          title: 't',
          body: 'b',
          targetScope: { scope: 'cluster_ids', values: [] },
        },
        { actorUserId: bo.id },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('broadcastService.update', () => {
  it('updates title/body before send + audit row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const b = await broadcastService.compose(
      db,
      { title: 'Old', body: 'Old body', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );

    const updated = await broadcastService.update(
      db,
      b.id,
      { title: 'New', body: 'New body' },
      { actorUserId: bo.id },
    );
    expect(updated.title).toBe('New');
    expect(updated.body).toBe('New body');

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.rowId, b.id), eq(auditLog.action, 'update')));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
  });

  it('throws when status=sent', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    await createUser(testBrandId); // a target so send() has something to fan out to
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });

    await expect(
      broadcastService.update(db, b.id, { title: 'too late' }, { actorUserId: bo.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// send — fan-out
// ---------------------------------------------------------------------------

describe('broadcastService.send — fan-out', () => {
  it("scope='brand' notifies all active users", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const u1 = await createUser(testBrandId, 'pos_staff');
    const u2 = await createUser(testBrandId, 'kitchen_manager');

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    const result = await broadcastService.send(db, b.id, { actorUserId: bo.id });

    expect(result.broadcast.status).toBe('sent');
    expect(result.broadcast.sentAt).toBeInstanceOf(Date);
    const sortedTargets = [...result.targetedUserIds].sort();
    expect(sortedTargets).toEqual([bo.id, u1.id, u2.id].sort());

    const rawDb = unscopedDb();
    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'broadcast.received'));
    expect(notifs.length).toBe(3);
  });

  it("scope='cluster_ids' notifies only users in those clusters", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const clusterA = '00000000-0000-0000-0000-00000000aaaa';
    const clusterB = '00000000-0000-0000-0000-00000000bbbb';
    const userA = await createUser(testBrandId, 'cluster_manager', { clusterId: clusterA });
    const userB = await createUser(testBrandId, 'cluster_manager', { clusterId: clusterB });

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'cluster_ids', values: [clusterA] } },
      { actorUserId: bo.id },
    );
    const result = await broadcastService.send(db, b.id, { actorUserId: bo.id });

    expect(result.targetedUserIds).toContain(userA.id);
    expect(result.targetedUserIds).not.toContain(userB.id);
    expect(result.targetedUserIds).not.toContain(bo.id);
  });

  it("scope='location_ids' notifies only users at those locations", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    // Allocate two distinct location ids in JS — schema does not require them
    // to exist in the locations table for this fan-out filter (the predicate
    // is on users.location_id only). Mirrors the cluster test fixture pattern.
    const locA = '00000000-0000-0000-0000-0000000000aa';
    const locB = '00000000-0000-0000-0000-0000000000bb';
    const userA = await createUser(testBrandId, 'store_manager', { locationId: locA });
    const userB = await createUser(testBrandId, 'store_manager', { locationId: locB });
    const userNoLoc = await createUser(testBrandId, 'pos_staff');

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'location_ids', values: [locA] } },
      { actorUserId: bo.id },
    );
    const result = await broadcastService.send(db, b.id, { actorUserId: bo.id });

    expect(result.targetedUserIds).toContain(userA.id);
    expect(result.targetedUserIds).not.toContain(userB.id);
    expect(result.targetedUserIds).not.toContain(userNoLoc.id);
    expect(result.targetedUserIds).not.toContain(bo.id);
  });

  it("scope='role_keys' notifies only users with those roles", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const km = await createUser(testBrandId, 'kitchen_manager');
    await createUser(testBrandId, 'pos_staff'); // should be excluded

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'role_keys', values: ['kitchen_manager'] } },
      { actorUserId: bo.id },
    );
    const result = await broadcastService.send(db, b.id, { actorUserId: bo.id });

    expect(result.targetedUserIds).toEqual([km.id]);
  });

  it('throws when status is already sent', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });
    await expect(
      broadcastService.send(db, b.id, { actorUserId: bo.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('DL-035 — broadcast.received notifications have digestEligible=false', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    await createUser(testBrandId, 'pos_staff');
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });

    const rawDb = unscopedDb();
    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'broadcast.received'));
    expect(notifs.length).toBeGreaterThan(0);
    for (const n of notifs) {
      expect(n.digestEligible).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe('broadcastService.cancel', () => {
  it('cancels a draft + audit row with reason', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    const cancelled = await broadcastService.cancel(db, b.id, {
      actorUserId: bo.id,
      reasonCode: 'duplicate-of-prior-broadcast',
    });
    expect(cancelled.status).toBe('cancelled');

    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.rowId, b.id), eq(auditLog.action, 'update')));
    expect(auditRows.find((r) => r.reason === 'duplicate-of-prior-broadcast')).toBeDefined();
  });

  it('throws when reasonCode missing', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await expect(
      broadcastService.cancel(db, b.id, {
        actorUserId: bo.id,
        reasonCode: '',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when status=sent', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });
    await expect(
      broadcastService.cancel(db, b.id, { actorUserId: bo.id, reasonCode: 'too-late' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// acknowledge
// ---------------------------------------------------------------------------

describe('broadcastService.acknowledge', () => {
  it('happy — writes ack row + audit row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const u = await createUser(testBrandId);
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' }, ackRequired: true },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });

    const ack = await broadcastService.acknowledge(db, b.id, { actorUserId: u.id });
    expect(ack.userId).toBe(u.id);
    expect(ack.broadcastId).toBe(b.id);

    const rawDb = unscopedDb();
    const ackRows = await rawDb
      .select()
      .from(broadcastAcknowledgements)
      .where(eq(broadcastAcknowledgements.broadcastId, b.id));
    expect(ackRows.length).toBe(1);

    const auditRows = await rawDb.select().from(auditLog).where(eq(auditLog.rowId, ack.id));
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]!.action).toBe('business_action');
  });

  it('idempotent — second ack from same user returns existing row, no duplicate', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const u = await createUser(testBrandId);
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });

    const a1 = await broadcastService.acknowledge(db, b.id, { actorUserId: u.id });
    const a2 = await broadcastService.acknowledge(db, b.id, { actorUserId: u.id });
    expect(a2.id).toBe(a1.id);

    const rawDb = unscopedDb();
    const ackRows = await rawDb
      .select()
      .from(broadcastAcknowledgements)
      .where(eq(broadcastAcknowledgements.broadcastId, b.id));
    expect(ackRows.length).toBe(1);
  });

  it('throws when broadcast is in draft (cannot ack unsent)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const u = await createUser(testBrandId);
    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await expect(
      broadcastService.acknowledge(db, b.id, { actorUserId: u.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// listAcks
// ---------------------------------------------------------------------------

describe('broadcastService.listAcks', () => {
  it('returns ackCount, pendingCount, list of acks', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const u1 = await createUser(testBrandId);
    const u2 = await createUser(testBrandId, 'kitchen_manager');

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b.id, { actorUserId: bo.id });

    await broadcastService.acknowledge(db, b.id, { actorUserId: u1.id });

    const result = await broadcastService.listAcks(db, b.id);
    // total targeted = bo + u1 + u2 = 3
    expect(result.ackCount).toBe(1);
    expect(result.pendingCount).toBe(2);
    expect(result.acks.length).toBe(1);
    expect(result.acks[0]!.userId).toBe(u1.id);

    // Suppress unused warnings for u2 (just exists to swell the targeted count)
    void u2;
  });
});

// ---------------------------------------------------------------------------
// listForUser
// ---------------------------------------------------------------------------

describe('broadcastService.listForUser', () => {
  it('returns broadcasts targeted to user, sorted DESC by sentAt', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const km = await createUser(testBrandId, 'kitchen_manager');

    // Brand-scoped — KM matches.
    const bA = await broadcastService.compose(
      db,
      { title: 'A', body: 'a', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, bA.id, { actorUserId: bo.id });

    // Wait a tick so sentAt timestamps differ.
    await new Promise((r) => setTimeout(r, 10));

    // role_keys on store_manager — KM does NOT match.
    const bSM = await broadcastService.compose(
      db,
      { title: 'SM', body: 'sm', targetScope: { scope: 'role_keys', values: ['store_manager'] } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, bSM.id, { actorUserId: bo.id });

    await new Promise((r) => setTimeout(r, 10));

    // role_keys including kitchen_manager — KM matches.
    const bKM = await broadcastService.compose(
      db,
      { title: 'KM', body: 'km', targetScope: { scope: 'role_keys', values: ['kitchen_manager'] } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, bKM.id, { actorUserId: bo.id });

    const list = await broadcastService.listForUser(db, { userId: km.id });
    const ids = list.map((b) => b.id);
    expect(ids).toEqual([bKM.id, bA.id]); // newest first; SM excluded
  });
});

// ---------------------------------------------------------------------------
// listSent
// ---------------------------------------------------------------------------

describe('broadcastService.listSent', () => {
  it('returns sent broadcasts only, newest first', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const b1 = await broadcastService.compose(
      db,
      { title: '1', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b1.id, { actorUserId: bo.id });

    await new Promise((r) => setTimeout(r, 10));

    const b2 = await broadcastService.compose(
      db,
      { title: '2', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, b2.id, { actorUserId: bo.id });

    // Draft must NOT show up.
    await broadcastService.compose(
      db,
      { title: 'draft', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );

    const result = await broadcastService.listSent(db);
    const ids = result.items.map((r) => r.id);
    expect(ids).toEqual([b2.id, b1.id]);
  });
});

// ---------------------------------------------------------------------------
// status row matches schema enum
// ---------------------------------------------------------------------------

describe('broadcastService schema sanity', () => {
  it('status enum accepts draft/sent/cancelled (smoke test)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const b = await broadcastService.compose(
      db,
      { title: 't', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );

    const rawDb = unscopedDb();
    const [row] = await rawDb
      .select()
      .from(broadcastAnnouncements)
      .where(eq(broadcastAnnouncements.id, b.id));
    expect(['draft', 'scheduled', 'sent', 'cancelled']).toContain(row!.status);
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe('broadcastService.getById', () => {
  it('returns a draft broadcast', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const composed = await broadcastService.compose(
      db,
      { title: 'Draft title', body: 'Draft body', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    expect(composed.status).toBe('draft');

    const fetched = await broadcastService.getById(db, composed.id);
    expect(fetched.id).toBe(composed.id);
    expect(fetched.status).toBe('draft');
    expect(fetched.title).toBe('Draft title');
  });

  it('returns a sent broadcast', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    await createUser(testBrandId, 'pos_staff');

    const composed = await broadcastService.compose(
      db,
      { title: 'Sent title', body: 'Sent body', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.send(db, composed.id, { actorUserId: bo.id });

    const fetched = await broadcastService.getById(db, composed.id);
    expect(fetched.id).toBe(composed.id);
    expect(fetched.status).toBe('sent');
    expect(fetched.sentAt).not.toBeNull();
  });

  it('returns a cancelled broadcast', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const composed = await broadcastService.compose(
      db,
      { title: 'Cancel title', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );
    await broadcastService.cancel(db, composed.id, {
      actorUserId: bo.id,
      reasonCode: 'OBSOLETE',
    });

    const fetched = await broadcastService.getById(db, composed.id);
    expect(fetched.id).toBe(composed.id);
    expect(fetched.status).toBe('cancelled');
  });

  it('returns a scheduled broadcast', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const created = await broadcastService.compose(
      db,
      {
        title: 'Scheduled',
        body: 'soon',
        targetScope: { scope: 'brand' },
        scheduledFor: future,
      },
      { actorUserId: bo.id },
    );
    // Manually set status='scheduled' since compose creates draft.
    await db.raw.execute(sql`
      UPDATE broadcast_announcements SET status = 'scheduled' WHERE id = ${created.id}
    `);
    const fetched = await broadcastService.getById(db, created.id);
    expect(fetched.status).toBe('scheduled');
    expect(fetched.scheduledFor).toBeInstanceOf(Date);
  });

  it('throws NotFoundError on missing id', async () => {
    const { db } = getTestBrandedDb();
    await expect(
      broadcastService.getById(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cross-brand isolation: cannot fetch broadcast from another brand', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const bo = await createUser(testBrandId, 'brand_owner');

    const composed = await broadcastService.compose(
      db,
      { title: 'Brand A draft', body: 'b', targetScope: { scope: 'brand' } },
      { actorUserId: bo.id },
    );

    const rawDb = unscopedDb();
    const [otherBrand] = await rawDb
      .insert(brands)
      .values({ legalName: 'Other Brand', country: 'IN' })
      .returning();
    const otherDb = brandedDb(otherBrand!.id);

    await expect(
      broadcastService.getById(otherDb, composed.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
