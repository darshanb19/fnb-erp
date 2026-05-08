/**
 * issue-tracker.test.ts — Phase 4 Epic 3 INF Arc (a) Task A9.
 *
 * Integration tests for issueTrackerService.create / update / comment / list /
 * get. Attachment flows live in issue-tracker-attachments.test.ts.
 *
 * Realtime publishers + storage helpers are mocked because the test env points
 * at a non-running Supabase URL. notificationCenter runs end-to-end and writes
 * notifications rows into the test DB so fan-out behaviour is observable.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';
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
  issueTickets,
  issueTicketComments,
} from '../../src/db/schema/issue-tickets.js';
import { brands } from '../../src/db/schema/brand.js';
import { brandedDb } from '../../src/db/branded-db.js';
import { ValidationError } from '../../src/errors/index.js';

// vi.mock is hoisted; the mock registers before any subsequent import resolves.
vi.mock('../../src/realtime/publishers.js', () => ({
  publishApprovalRequest: vi.fn(async () => undefined),
  publishNotification: vi.fn(async () => undefined),
  publishIssueTicketUpdate: vi.fn(async () => undefined),
}));

import { issueTrackerService } from '../../src/services/issue-tracker.service.js';
import { publishIssueTicketUpdate } from '../../src/realtime/publishers.js';

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

afterEach(async () => {
  await truncateTestTables();
  vi.mocked(publishIssueTicketUpdate).mockClear();
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
  scope?: { clusterId?: string; locationId?: string },
): Promise<{ id: string; brandId: string; role: Role }> {
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
    })
    .returning();
  if (!u) throw new Error('Failed to create test user');
  return { id: u.id, brandId: u.brandId, role: u.role as Role };
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('issueTrackerService.create', () => {
  it('happy path — generates ISS-YYYY-NNN reference + writes audit row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);

    const ticket = await issueTrackerService.create(
      db,
      {
        originatorUserId: originator.id,
        title: 'Cooler is leaking',
        description: 'Drip onto floor; mopped twice.',
      },
      { actorUserId: originator.id },
    );

    expect(ticket.reference).toMatch(/^ISS-\d{4}-\d{3}$/);
    expect(ticket.status).toBe('open');
    expect(ticket.priority).toBe('medium');
    expect(ticket.originatorUserId).toBe(originator.id);
    expect(ticket.assigneeUserId).toBeNull();

    const rawDb = unscopedDb();
    const auditRows = await rawDb.select().from(auditLog).where(eq(auditLog.rowId, ticket.id));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows.find((r) => r.action === 'insert')).toBeDefined();
  });

  it('with assigneeUserId — emits issue.assigned notification to assignee', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const assignee = await createUser(testBrandId, 'kitchen_manager');

    const ticket = await issueTrackerService.create(
      db,
      {
        originatorUserId: originator.id,
        title: 'Faulty mixer',
        description: 'Belt slips.',
        assigneeUserId: assignee.id,
      },
      { actorUserId: originator.id },
    );

    expect(ticket.assigneeUserId).toBe(assignee.id);

    const rawDb = unscopedDb();
    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, assignee.id), eq(notifications.type, 'issue.assigned')));
    expect(notifs.length).toBe(1);
    expect((notifs[0]!.payload as Record<string, unknown>)['ticketId']).toBe(ticket.id);
  });

  it('without assignee — sends NO notifications', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);

    await issueTrackerService.create(
      db,
      {
        originatorUserId: originator.id,
        title: 'No assignee',
        description: 'Nobody owns this yet.',
      },
      { actorUserId: originator.id },
    );

    const rawDb = unscopedDb();
    const notifs = await rawDb.select().from(notifications);
    expect(notifs.length).toBe(0);
  });

  it('with priority + linkedEntity — stored on row', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);

    const ticket = await issueTrackerService.create(
      db,
      {
        originatorUserId: originator.id,
        title: 'Bad GR',
        description: 'Damaged carton.',
        priority: 'high',
        linkedEntityType: 'gr',
        linkedEntityRef: 'GR-2026-0017',
      },
      { actorUserId: originator.id },
    );

    expect(ticket.priority).toBe('high');
    expect(ticket.linkedEntityType).toBe('gr');
    expect(ticket.linkedEntityRef).toBe('GR-2026-0017');
  });

  it('two tickets in same year increment SEQ', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);

    const a = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 'A', description: 'a' },
      { actorUserId: originator.id },
    );
    const b = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 'B', description: 'b' },
      { actorUserId: originator.id },
    );

    const seqA = parseInt(a.reference.split('-')[2]!, 10);
    const seqB = parseInt(b.reference.split('-')[2]!, 10);
    expect(seqB).toBe(seqA + 1);
  });
});

// ---------------------------------------------------------------------------
// update — non-status fields
// ---------------------------------------------------------------------------

describe('issueTrackerService.update — title/description/priority', () => {
  it('writes audit row with before/after when title changes', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);

    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 'Old', description: 'd' },
      { actorUserId: originator.id },
    );

    const updated = await issueTrackerService.update(
      db,
      ticket.id,
      { title: 'New' },
      { actorUserId: originator.id },
    );

    expect(updated.title).toBe('New');
    const rawDb = unscopedDb();
    const auditRows = await rawDb
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.rowId, ticket.id), eq(auditLog.action, 'update')));
    expect(auditRows.length).toBe(1);
    expect((auditRows[0]!.before as Record<string, unknown>)['title']).toBe('Old');
    expect((auditRows[0]!.after as Record<string, unknown>)['title']).toBe('New');
  });
});

// ---------------------------------------------------------------------------
// update — status transitions
// ---------------------------------------------------------------------------

describe('issueTrackerService.update — status transitions', () => {
  async function createOpen(): Promise<{
    db: ReturnType<typeof getTestBrandedDb>['db'];
    testBrandId: string;
    ticketId: string;
    originatorId: string;
  }> {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd' },
      { actorUserId: originator.id },
    );
    return { db, testBrandId, ticketId: ticket.id, originatorId: originator.id };
  }

  it('open → in_progress succeeds', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    const updated = await issueTrackerService.update(
      db,
      ticketId,
      { status: 'in_progress' },
      { actorUserId: originatorId },
    );
    expect(updated.status).toBe('in_progress');
  });

  it('open → closed throws (must go through resolved first)', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    await expect(
      issueTrackerService.update(
        db,
        ticketId,
        { status: 'closed' },
        { actorUserId: originatorId },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('closed → in_progress throws', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    await issueTrackerService.update(db, ticketId, { status: 'closed' }, { actorUserId: originatorId });
    await expect(
      issueTrackerService.update(db, ticketId, { status: 'in_progress' }, { actorUserId: originatorId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('closed → open (reopen) is allowed', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    await issueTrackerService.update(db, ticketId, { status: 'closed' }, { actorUserId: originatorId });
    const reopened = await issueTrackerService.update(db, ticketId, { status: 'open' }, { actorUserId: originatorId });
    expect(reopened.status).toBe('open');
  });

  it('any → resolved stamps resolved_at', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    const resolved = await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });

  it('resolved → closed by originator succeeds + closed_at set', async () => {
    const { db, ticketId, originatorId } = await createOpen();
    await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    const closed = await issueTrackerService.update(
      db,
      ticketId,
      { status: 'closed' },
      { actorUserId: originatorId },
    );
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeInstanceOf(Date);
  });

  it('resolved → closed by brand_owner (not originator) succeeds', async () => {
    const { db, testBrandId, ticketId, originatorId } = await createOpen();
    const bo = await createUser(testBrandId, 'brand_owner');
    await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    const closed = await issueTrackerService.update(
      db,
      ticketId,
      { status: 'closed' },
      { actorUserId: bo.id },
    );
    expect(closed.status).toBe('closed');
  });

  it('resolved → closed by other CM (not originator, not BO) throws', async () => {
    const { db, testBrandId, ticketId, originatorId } = await createOpen();
    const cm = await createUser(testBrandId, 'cluster_manager');
    await issueTrackerService.update(db, ticketId, { status: 'resolved' }, { actorUserId: originatorId });
    await expect(
      issueTrackerService.update(db, ticketId, { status: 'closed' }, { actorUserId: cm.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('status change emits issue.status_changed to assignee + originator (excluding actor)', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const assignee = await createUser(testBrandId, 'kitchen_manager');

    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd', assigneeUserId: assignee.id },
      { actorUserId: originator.id },
    );

    const rawDb = unscopedDb();
    // Reset notifications baseline (issue.assigned was emitted on create).
    await rawDb.delete(notifications);

    // Actor = assignee. Recipients should be {originator}; assignee is excluded as actor.
    await issueTrackerService.update(
      db,
      ticket.id,
      { status: 'in_progress' },
      { actorUserId: assignee.id },
    );

    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'issue.status_changed'));
    const userIds = notifs.map((n) => n.userId).sort();
    expect(userIds).toEqual([originator.id]);
  });

  it('assignee change emits issue.assigned to NEW assignee only', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const oldAssignee = await createUser(testBrandId, 'kitchen_manager');
    const newAssignee = await createUser(testBrandId, 'store_manager');

    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd', assigneeUserId: oldAssignee.id },
      { actorUserId: originator.id },
    );

    const rawDb = unscopedDb();
    await rawDb.delete(notifications);

    await issueTrackerService.update(
      db,
      ticket.id,
      { assigneeUserId: newAssignee.id },
      { actorUserId: originator.id },
    );

    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'issue.assigned'));
    expect(notifs.length).toBe(1);
    expect(notifs[0]!.userId).toBe(newAssignee.id);
  });
});

// ---------------------------------------------------------------------------
// comment
// ---------------------------------------------------------------------------

describe('issueTrackerService.comment', () => {
  it('writes comment row + audit + Realtime publish', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd' },
      { actorUserId: originator.id },
    );

    vi.mocked(publishIssueTicketUpdate).mockClear();

    const comment = await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: originator.id, body: 'A note.' },
      { actorUserId: originator.id },
    );

    expect(comment.body).toBe('A note.');

    const rawDb = unscopedDb();
    const auditRows = await rawDb.select().from(auditLog).where(eq(auditLog.rowId, comment.id));
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]!.action).toBe('insert');

    expect(publishIssueTicketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: ticket.id, eventType: 'comment' }),
    );
  });

  it('fan-out — notifies assignee + originator + prior commenters minus author', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const assignee = await createUser(testBrandId, 'kitchen_manager');
    const otherCommenter = await createUser(testBrandId, 'pos_staff');

    const ticket = await issueTrackerService.create(
      db,
      {
        originatorUserId: originator.id,
        title: 't',
        description: 'd',
        assigneeUserId: assignee.id,
      },
      { actorUserId: originator.id },
    );

    // First otherCommenter posts. Recipients should be {originator, assignee}.
    await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: otherCommenter.id, body: 'first' },
      { actorUserId: otherCommenter.id },
    );

    const rawDb = unscopedDb();
    // Reset to focus on the second comment fan-out.
    await rawDb.delete(notifications);

    // Assignee posts. Recipients should be {originator, otherCommenter} (assignee=author excluded).
    await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: assignee.id, body: 'second' },
      { actorUserId: assignee.id },
    );

    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'issue.commented'));
    const userIds = notifs.map((n) => n.userId).sort();
    expect(userIds).toEqual([originator.id, otherCommenter.id].sort());
  });

  it('comment by sole user (originator only) does not notify themselves', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd' },
      { actorUserId: originator.id },
    );

    const rawDb = unscopedDb();
    await rawDb.delete(notifications);

    await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: originator.id, body: 'self note' },
      { actorUserId: originator.id },
    );

    const notifs = await rawDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'issue.commented'));
    expect(notifs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// list — RBAC scope
// ---------------------------------------------------------------------------

describe('issueTrackerService.list — scope filtering', () => {
  it("scope='own' returns only tickets where actor is assignee or originator", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u1 = await createUser(testBrandId);
    const u2 = await createUser(testBrandId, 'kitchen_manager');
    const u3 = await createUser(testBrandId, 'store_manager');

    const t1 = await issueTrackerService.create(
      db,
      { originatorUserId: u1.id, title: 'a', description: 'd', assigneeUserId: u2.id },
      { actorUserId: u1.id },
    );
    const t2 = await issueTrackerService.create(
      db,
      { originatorUserId: u3.id, title: 'b', description: 'd' },
      { actorUserId: u3.id },
    );
    const t3 = await issueTrackerService.create(
      db,
      { originatorUserId: u2.id, title: 'c', description: 'd' },
      { actorUserId: u2.id },
    );

    const own = await issueTrackerService.list(db, {
      scope: { kind: 'own', userId: u2.id },
    });
    const ids = own.items.map((t) => t.id).sort();
    expect(ids).toEqual([t1.id, t3.id].sort());
    expect(ids).not.toContain(t2.id);
  });

  it("scope='cluster' isolates by user's cluster_id (cross-brand defense-in-depth)", async () => {
    const { db, testBrandId } = getTestBrandedDb();
    // Allocate two distinct cluster ids in JS — schema does not require them to
    // exist in clusters table for this filter (FK is on user.cluster_id, not
    // cross-checked at the issue layer).
    const clusterA = '00000000-0000-0000-0000-00000000aaaa';
    const clusterB = '00000000-0000-0000-0000-00000000bbbb';

    const userA = await createUser(testBrandId, 'cluster_manager', { clusterId: clusterA });
    const userB = await createUser(testBrandId, 'cluster_manager', { clusterId: clusterB });

    const tA = await issueTrackerService.create(
      db,
      { originatorUserId: userA.id, title: 'a', description: 'd' },
      { actorUserId: userA.id },
    );
    const tB = await issueTrackerService.create(
      db,
      { originatorUserId: userB.id, title: 'b', description: 'd' },
      { actorUserId: userB.id },
    );

    const onlyA = await issueTrackerService.list(db, {
      scope: { kind: 'cluster', clusterId: clusterA },
    });
    const ids = onlyA.items.map((t) => t.id);
    expect(ids).toContain(tA.id);
    expect(ids).not.toContain(tB.id);

    // Cross-brand defense-in-depth: a separate brand cannot see brand-A tickets.
    const rawDb = unscopedDb();
    const [otherBrand] = await rawDb
      .insert(brands)
      .values({ legalName: 'Other Brand', country: 'IN' })
      .returning();
    const otherDb = brandedDb(otherBrand!.id);
    const otherList = await issueTrackerService.list(otherDb, {
      scope: { kind: 'cluster', clusterId: clusterA },
    });
    expect(otherList.items.length).toBe(0);
  });

  it('filters status + priority narrow the result set', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const u = await createUser(testBrandId);
    const t1 = await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 'low-open', description: 'd', priority: 'low' },
      { actorUserId: u.id },
    );
    await issueTrackerService.create(
      db,
      { originatorUserId: u.id, title: 'high-open', description: 'd', priority: 'high' },
      { actorUserId: u.id },
    );

    const filtered = await issueTrackerService.list(db, {
      scope: { kind: 'brand' },
      filters: { priority: 'low' },
    });
    expect(filtered.items.map((t) => t.id)).toEqual([t1.id]);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe('issueTrackerService.get', () => {
  it('returns ticket + comments + (empty) attachments', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const originator = await createUser(testBrandId);
    const ticket = await issueTrackerService.create(
      db,
      { originatorUserId: originator.id, title: 't', description: 'd' },
      { actorUserId: originator.id },
    );
    await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: originator.id, body: 'first' },
      { actorUserId: originator.id },
    );
    await issueTrackerService.comment(
      db,
      { ticketId: ticket.id, authorUserId: originator.id, body: 'second' },
      { actorUserId: originator.id },
    );

    const detail = await issueTrackerService.get(db, ticket.id);
    expect(detail.ticket.id).toBe(ticket.id);
    expect(detail.comments.length).toBe(2);
    expect(detail.comments[0]!.body).toBe('first');
    expect(detail.comments[1]!.body).toBe('second');
    expect(detail.attachments).toEqual([]);
  });
});
