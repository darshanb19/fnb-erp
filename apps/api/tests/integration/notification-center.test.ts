/**
 * notification-center.test.ts — Phase 4 Epic 3 INF Arc (a) Task A8.
 *
 * Integration tests for notificationCenter:
 *   send / sendBulk / list / markSeen / markAllSeen /
 *   getPreferences / savePreferences / getDigestPreview.
 *
 * Realtime publishers are mocked because the test env points at a non-running
 * Supabase URL.
 *
 * DL-035 invariant: every notification_type_config row in MVP seeds with
 * email_mode='none'. The test in `infrastructure` describe asserts this so
 * regressions show up loud.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema/auth.js';
import { auditLog } from '../../src/db/schema/audit.js';
import {
  notifications,
  notificationPreferences,
  notificationTypeConfig,
} from '../../src/db/schema/notifications.js';
import { brands } from '../../src/db/schema/brand.js';
import { brandedDb } from '../../src/db/branded-db.js';
import { ValidationError } from '../../src/errors/index.js';

vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

import { notificationCenter } from '../../src/services/notification-center.service.js';

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

async function createUser(brandId: string, email?: string): Promise<{ id: string }> {
  const rawDb = unscopedDb();
  const [u] = await rawDb
    .insert(users)
    .values({
      brandId,
      email: email ?? `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      fullName: 'Test User',
      role: 'pos_staff',
      approvalStatus: 'approved',
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id };
}

// ---------------------------------------------------------------------------
// DL-035 invariant guard (runs once)
// ---------------------------------------------------------------------------

describe('notificationCenter DL-035 invariant', () => {
  it('every notification_type_config row has email_mode=none in MVP', async () => {
    const rawDb = unscopedDb();
    const rows = await rawDb.execute(sql`
      SELECT type FROM notification_type_config WHERE email_mode != 'none'
    `);
    const offenders = rows as unknown as Array<{ type: string }>;
    expect(offenders.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

describe('notificationCenter.send', () => {
  it('inserts a notifications row when type_config exists, with digestEligible=false (MVP)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const row = await notificationCenter.send(db, {
      userId: u.id,
      type: 'approval.requested',
      payload: { foo: 'bar' },
    });

    expect(row).not.toBeNull();
    expect(row!.userId).toBe(u.id);
    expect(row!.type).toBe('approval.requested');
    expect(row!.digestEligible).toBe(false);
    expect((row!.payload as Record<string, unknown>)['foo']).toBe('bar');
  });

  it('throws ValidationError "Unknown notification type" when no type_config row exists', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    await expect(
      notificationCenter.send(db, {
        userId: u.id,
        type: 'no.such.type.xyz',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns null and inserts NOTHING when per-user inAppOverride=false', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    // Seed a preference row turning the in-app channel off.
    const rawDb = unscopedDb();
    await rawDb.insert(notificationPreferences).values({
      brandId: testBrandId,
      userId: u.id,
      type: 'broadcast.received',
      inAppOverride: false,
    });

    const row = await notificationCenter.send(db, {
      userId: u.id,
      type: 'broadcast.received',
      payload: { headline: 'hello' },
    });

    expect(row).toBeNull();

    const inserted = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, u.id));
    expect(inserted.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sendBulk
// ---------------------------------------------------------------------------

describe('notificationCenter.sendBulk', () => {
  it('inserts N rows in one transaction', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u1 = await createUser(testBrandId);
    const u2 = await createUser(testBrandId);
    const u3 = await createUser(testBrandId);

    const rows = await notificationCenter.sendBulk(
      db,
      [
        { userId: u1.id, type: 'approval.requested', payload: { i: 1 } },
        { userId: u2.id, type: 'approval.requested', payload: { i: 2 } },
        { userId: u3.id, type: 'approval.requested', payload: { i: 3 } },
      ],
      { actorUserId: u1.id },
    );

    expect(rows.length).toBe(3);
    const rawDb = unscopedDb();
    const all = await rawDb.select().from(notifications);
    expect(all.length).toBe(3);
  });

  it('rolls back ALL inserts if any row fails (partial-failure invariant)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u1 = await createUser(testBrandId);

    await expect(
      notificationCenter.sendBulk(
        db,
        [
          { userId: u1.id, type: 'approval.requested', payload: { ok: true } },
          { userId: u1.id, type: 'no.such.type.xyz', payload: {} },
        ],
        { actorUserId: u1.id },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const rawDb = unscopedDb();
    const all = await rawDb.select().from(notifications);
    expect(all.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('notificationCenter.list', () => {
  it('returns the user notifications newest first', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const r1 = await notificationCenter.send(db, { userId: u.id, type: 'approval.requested', payload: { i: 1 } });
    // Tiny gap so ordering is unambiguous.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const r2 = await notificationCenter.send(db, { userId: u.id, type: 'approval.decided', payload: { i: 2 } });

    const result = await notificationCenter.list(db, { userId: u.id });
    expect(result.items.length).toBe(2);
    expect(result.items[0]!.id).toBe(r2!.id);
    expect(result.items[1]!.id).toBe(r1!.id);
    expect(result.nextCursor).toBeNull();
  });

  it('with unseenOnly=true filters in_app_seen_at IS NULL', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const seen = await notificationCenter.send(db, { userId: u.id, type: 'approval.requested', payload: { i: 1 } });
    await notificationCenter.send(db, { userId: u.id, type: 'approval.decided', payload: { i: 2 } });

    await notificationCenter.markSeen(db, { notificationId: seen!.id, userId: u.id });

    const all = await notificationCenter.list(db, { userId: u.id });
    expect(all.items.length).toBe(2);

    const onlyUnseen = await notificationCenter.list(db, { userId: u.id, unseenOnly: true });
    expect(onlyUnseen.items.length).toBe(1);
    expect(onlyUnseen.items[0]!.type).toBe('approval.decided');
  });

  it('cursor pagination steps through pages without duplicates', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    // Insert 5 notifications with deterministic order.
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await notificationCenter.send(db, {
        userId: u.id,
        type: 'approval.requested',
        payload: { i },
      });
      ids.push(r!.id);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // Newest-first ordering: last inserted comes first.
    const expectedOrder = [...ids].reverse();

    const page1 = await notificationCenter.list(db, { userId: u.id, limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.items.map((r) => r.id)).toEqual([expectedOrder[0], expectedOrder[1]]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await notificationCenter.list(db, { userId: u.id, limit: 2, cursor: page1.nextCursor });
    expect(page2.items.length).toBe(2);
    expect(page2.items.map((r) => r.id)).toEqual([expectedOrder[2], expectedOrder[3]]);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await notificationCenter.list(db, { userId: u.id, limit: 2, cursor: page2.nextCursor });
    expect(page3.items.length).toBe(1);
    expect(page3.items[0]!.id).toBe(expectedOrder[4]);
    expect(page3.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// markSeen / markAllSeen
// ---------------------------------------------------------------------------

describe('notificationCenter.markSeen + markAllSeen', () => {
  it('markSeen sets in_app_seen_at', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const r = await notificationCenter.send(db, { userId: u.id, type: 'approval.requested', payload: {} });
    expect(r!.inAppSeenAt).toBeNull();

    await notificationCenter.markSeen(db, { notificationId: r!.id, userId: u.id });

    const rawDb = unscopedDb();
    const after = await rawDb.select().from(notifications).where(eq(notifications.id, r!.id));
    expect(after[0]!.inAppSeenAt).not.toBeNull();
  });

  it('markSeen is brand-scoped: cannot mark another brand notification', async () => {
    const { db: dbA, testBrandId: brandA } = getTestBrandedDb();
    const u = await createUser(brandA);
    const r = await notificationCenter.send(dbA, { userId: u.id, type: 'approval.requested', payload: {} });

    // Build a BrandedDb scoped to a *different* brand (needs a real second brand).
    const rawDb = unscopedDb();
    const [brandB] = await rawDb
      .insert(brands)
      .values({ legalName: 'Other Brand', country: 'IN' })
      .returning();
    const dbB = brandedDb(brandB!.id);

    // Attempt the markSeen from brand B — should silently update zero rows.
    await notificationCenter.markSeen(dbB, { notificationId: r!.id, userId: u.id });

    const after = await rawDb.select().from(notifications).where(eq(notifications.id, r!.id));
    expect(after[0]!.inAppSeenAt).toBeNull();

    // Cleanup: drop brandB so afterEach truncate doesn't choke on the FK.
    await rawDb.execute(sql`DELETE FROM brands WHERE id = ${brandB!.id}`);
  });

  it('markAllSeen returns count and sets timestamps for unseen rows only', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const a = await notificationCenter.send(db, { userId: u.id, type: 'approval.requested', payload: { i: 1 } });
    await notificationCenter.send(db, { userId: u.id, type: 'approval.decided', payload: { i: 2 } });
    await notificationCenter.send(db, { userId: u.id, type: 'broadcast.received', payload: { i: 3 } });

    // Pre-seen one of the three.
    await notificationCenter.markSeen(db, { notificationId: a!.id, userId: u.id });

    const count = await notificationCenter.markAllSeen(db, { userId: u.id });
    expect(count).toBe(2);

    const rawDb = unscopedDb();
    const all = await rawDb.select().from(notifications).where(eq(notifications.userId, u.id));
    for (const r of all) {
      expect(r.inAppSeenAt).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// getPreferences / savePreferences
// ---------------------------------------------------------------------------

describe('notificationCenter.getPreferences + savePreferences', () => {
  it('getPreferences returns one row per type_config row, overrides null when absent', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    const rawDb = unscopedDb();
    const allTypes = await rawDb.select().from(notificationTypeConfig);

    const prefs = await notificationCenter.getPreferences(db, { userId: u.id });
    expect(prefs.length).toBe(allTypes.length);
    for (const p of prefs) {
      expect(p.inAppOverride).toBeNull();
      expect(p.emailOverride).toBeNull();
    }
  });

  it('savePreferences upserts; second call updates rather than duplicates; audit row written', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const actor = await createUser(testBrandId);

    const first = await notificationCenter.savePreferences(
      db,
      {
        userId: u.id,
        type: 'approval.requested',
        prefs: { inAppOverride: false, quietHoursStart: '22:00:00', quietHoursEnd: '07:00:00' },
      },
      { actorUserId: actor.id },
    );

    const second = await notificationCenter.savePreferences(
      db,
      {
        userId: u.id,
        type: 'approval.requested',
        prefs: { inAppOverride: true, quietHoursStart: '23:00:00', quietHoursEnd: '06:00:00' },
      },
      { actorUserId: actor.id },
    );

    expect(second.id).toBe(first.id);
    expect(second.inAppOverride).toBe(true);

    const rawDb = unscopedDb();
    const all = await rawDb
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, u.id));
    expect(all.length).toBe(1);

    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.tableName, 'notification_preferences'));
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    const insertAudit = auditRows.find((r) => r.action === 'insert');
    const updateAudit = auditRows.find((r) => r.action === 'update');
    expect(insertAudit).toBeDefined();
    expect(updateAudit).toBeDefined();
  });

  it('savePreferences throws when type does not exist', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    await expect(
      notificationCenter.savePreferences(
        db,
        { userId: u.id, type: 'no.such.type', prefs: { inAppOverride: false } },
        { actorUserId: u.id },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// getDigestPreview
// ---------------------------------------------------------------------------

describe('notificationCenter.getDigestPreview', () => {
  it('returns empty in MVP per DL-035 invariant', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);

    // Send a few — none are digest_eligible because every type seeds emailMode='none'.
    await notificationCenter.send(db, { userId: u.id, type: 'approval.requested', payload: {} });
    await notificationCenter.send(db, { userId: u.id, type: 'approval.decided', payload: {} });

    const preview = await notificationCenter.getDigestPreview(db, { userId: u.id });
    expect(preview.startedAt).toBeNull();
    expect(preview.items).toEqual([]);
  });
});
