/**
 * broadcastService — Phase 4 Epic 3 INF Arc (a) Task A9.
 *
 * Brand Owner authors broadcast announcements; on send(), the targeted user
 * set is resolved and notificationCenter.sendBulk fans `broadcast.received`
 * notifications. Acknowledgement rows are written when users explicitly
 * acknowledge — never pre-populated.
 *
 * Status state machine:
 *   draft     → scheduled (via update with scheduledFor) | sent (via send) | cancelled (via cancel)
 *   scheduled → sent (via send) | cancelled (via cancel)
 *   sent      → terminal (immutable; cancel + update both throw)
 *   cancelled → terminal
 *
 * Audit rows on every mutation including ack. ReasonCode mandatory on cancel.
 */

import { sql, eq, and, desc, lt, or, inArray } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { notificationCenter, type SendNotificationInput } from './notification-center.service.js';
import {
  broadcastAnnouncements,
  broadcastAcknowledgements,
  type BroadcastAnnouncement,
  type BroadcastAcknowledgement,
  type BroadcastUrgency,
} from '../db/schema/broadcasts.js';
import { users, type UserRole } from '../db/schema/auth.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BroadcastTargetScope =
  | { scope: 'brand' }
  | { scope: 'cluster_ids'; values: string[] }
  | { scope: 'location_ids'; values: string[] }
  | { scope: 'role_keys'; values: UserRole[] };

export interface ComposeBroadcastInput {
  title: string;
  body: string;
  urgency?: BroadcastUrgency;
  targetScope: BroadcastTargetScope;
  scheduledFor?: Date | null;
  ackRequired?: boolean;
}

export interface UpdateBroadcastInput {
  title?: string;
  body?: string;
  urgency?: BroadcastUrgency;
  targetScope?: BroadcastTargetScope;
  scheduledFor?: Date | null;
  ackRequired?: boolean;
}

export interface SendBroadcastResult {
  broadcast: BroadcastAnnouncement;
  targetedUserIds: string[];
}

export interface ListAcksResult {
  ackCount: number;
  pendingCount: number;
  acks: Array<{ userId: string; acknowledgedAt: Date }>;
}

export interface ListSentInput {
  limit?: number;
  cursor?: string | null;
}

export interface ListSentResult {
  items: BroadcastAnnouncement[];
  nextCursor: string | null;
}

interface MutationOpts {
  actorUserId: string;
  reasonCode?: string;
}

interface CancelOpts {
  actorUserId: string;
  reasonCode: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_RE.test(value)) {
    throw new ValidationError({
      code: 'validation.invalid_uuid',
      message: `${label} must be a UUID; got "${value}"`,
    });
  }
}

function validateTargetScope(scope: BroadcastTargetScope): void {
  if (scope.scope === 'brand') return;
  if (scope.scope === 'cluster_ids' || scope.scope === 'location_ids' || scope.scope === 'role_keys') {
    if (!Array.isArray(scope.values) || scope.values.length === 0) {
      throw new ValidationError({
        code: 'broadcast.target_scope_empty',
        message: `targetScope.values must be a non-empty array for scope "${scope.scope}"`,
      });
    }
    return;
  }
  throw new ValidationError({
    code: 'broadcast.target_scope_invalid',
    message: `Unknown targetScope.scope: ${(scope as { scope: string }).scope}`,
  });
}

function requireReasonCode(label: string, reasonCode: string | null | undefined): string {
  if (!reasonCode || reasonCode.trim().length === 0) {
    throw new ValidationError({
      code: 'broadcast.reason_code_required',
      message: `Reason code required on ${label}`,
    });
  }
  return reasonCode;
}

async function returning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

function encodeCursor(sentAt: Date, id: string): string {
  return `${sentAt.toISOString()}|${id}`;
}

function decodeCursor(cursor: string | null | undefined): { sentAt: Date; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf('|');
  if (idx < 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || id.length === 0) return null;
  return { sentAt: d, id };
}

async function loadBroadcast(db: BrandedDb, id: string): Promise<BroadcastAnnouncement> {
  const rows = (await db.scopedFrom(
    broadcastAnnouncements,
    eq(broadcastAnnouncements.id, id),
  )) as unknown as BroadcastAnnouncement[];
  const row = rows[0];
  if (!row) {
    throw new NotFoundError({
      code: 'not_found.broadcast',
      message: `Broadcast ${id} not found`,
    });
  }
  return row;
}

/**
 * Resolve the target user set per `targetScope`. Brand-scoped + active=true.
 */
async function resolveTargetedUsers(
  db: BrandedDb,
  scope: BroadcastTargetScope,
): Promise<string[]> {
  if (scope.scope === 'brand') {
    const rows = (await db.scopedFrom(users, eq(users.active, true))) as unknown as Array<{
      id: string;
    }>;
    return rows.map((r) => r.id);
  }
  if (scope.scope === 'cluster_ids') {
    if (scope.values.length === 0) return [];
    const rows = (await db.scopedFrom(
      users,
      and(eq(users.active, true), inArray(users.clusterId, scope.values))!,
    )) as unknown as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }
  if (scope.scope === 'location_ids') {
    if (scope.values.length === 0) return [];
    const rows = (await db.scopedFrom(
      users,
      and(eq(users.active, true), inArray(users.locationId, scope.values))!,
    )) as unknown as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }
  // role_keys
  if (scope.values.length === 0) return [];
  const rows = (await db.scopedFrom(
    users,
    and(eq(users.active, true), inArray(users.role, scope.values))!,
  )) as unknown as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

/**
 * Determine whether a single user matches the targetScope. Used by
 * `listForUser` (the reverse direction of resolveTargetedUsers).
 */
async function userMatchesScope(
  db: BrandedDb,
  userId: string,
  scope: BroadcastTargetScope,
): Promise<boolean> {
  const rows = (await db.scopedFrom(users, eq(users.id, userId))) as unknown as Array<{
    role: string;
    clusterId: string | null;
    locationId: string | null;
    active: boolean;
  }>;
  const u = rows[0];
  if (!u || !u.active) return false;
  if (scope.scope === 'brand') return true;
  if (scope.scope === 'cluster_ids') return u.clusterId !== null && scope.values.includes(u.clusterId);
  if (scope.scope === 'location_ids')
    return u.locationId !== null && scope.values.includes(u.locationId);
  // role_keys
  return scope.values.includes(u.role as UserRole);
}

// ---------------------------------------------------------------------------
// broadcastService
// ---------------------------------------------------------------------------

export const broadcastService = {
  /**
   * Compose a broadcast in 'draft' (or 'scheduled' if scheduledFor is set —
   * the row stays editable until send()). Audit row written.
   */
  async compose(
    db: BrandedDb,
    input: ComposeBroadcastInput,
    opts: MutationOpts,
  ): Promise<BroadcastAnnouncement> {
    assertUuid('actorUserId', opts.actorUserId);
    validateTargetScope(input.targetScope);

    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError({
        code: 'broadcast.title_required',
        message: 'Broadcast title is required',
      });
    }
    if (!input.body || input.body.trim().length === 0) {
      throw new ValidationError({
        code: 'broadcast.body_required',
        message: 'Broadcast body is required',
      });
    }

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const inserted = await returning<BroadcastAnnouncement>(
        tx
          .scopedInsert(broadcastAnnouncements, {
            title: input.title,
            body: input.body,
            urgency: input.urgency ?? 'info',
            targetScope: input.targetScope as unknown,
            scheduledFor: input.scheduledFor ?? null,
            sentAt: null,
            ackRequired: input.ackRequired ?? false,
            status: 'draft',
            createdByUserId: opts.actorUserId,
          } as unknown as Parameters<typeof tx.scopedInsert<typeof broadcastAnnouncements>>[1])
          .returning(),
      );
      const row = inserted[0]!;

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'broadcast_announcements',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as unknown as Record<string, unknown>,
        reason: opts.reasonCode ?? null,
        context: { event: 'compose_broadcast', urgency: row.urgency },
      });

      return row;
    });
  },

  /**
   * Update a draft/scheduled broadcast. Throws if status='sent' | 'cancelled'.
   * Audit row written.
   */
  async update(
    db: BrandedDb,
    broadcastId: string,
    changes: UpdateBroadcastInput,
    opts: MutationOpts,
  ): Promise<BroadcastAnnouncement> {
    assertUuid('broadcastId', broadcastId);
    if (changes.targetScope !== undefined) validateTargetScope(changes.targetScope);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await loadBroadcast(tx, broadcastId);
      if (before.status === 'sent') {
        throw new ValidationError({
          code: 'broadcast.already_sent',
          message: 'Cannot update a broadcast that has already been sent',
        });
      }
      if (before.status === 'cancelled') {
        throw new ValidationError({
          code: 'broadcast.cancelled',
          message: 'Cannot update a cancelled broadcast',
        });
      }

      const updateValues: Record<string, unknown> = {};
      if (changes.title !== undefined) updateValues['title'] = changes.title;
      if (changes.body !== undefined) updateValues['body'] = changes.body;
      if (changes.urgency !== undefined) updateValues['urgency'] = changes.urgency;
      if (changes.targetScope !== undefined) updateValues['targetScope'] = changes.targetScope;
      if (changes.scheduledFor !== undefined) updateValues['scheduledFor'] = changes.scheduledFor;
      if (changes.ackRequired !== undefined) updateValues['ackRequired'] = changes.ackRequired;

      if (Object.keys(updateValues).length === 0) {
        return before;
      }

      // Status-guarded UPDATE: include `status IN ('draft','scheduled')` so a
      // concurrent send/cancel is caught (DL-016).
      const updatedRows = await tx
        .scopedUpdate(broadcastAnnouncements)
        .set(updateValues as Parameters<ReturnType<typeof tx.scopedUpdate>['set']>[0])
        .where(
          and(
            eq(broadcastAnnouncements.id, broadcastId),
            or(
              eq(broadcastAnnouncements.status, 'draft'),
              eq(broadcastAnnouncements.status, 'scheduled'),
            )!,
          )!,
        )
        .returning();
      const after = (updatedRows as unknown as BroadcastAnnouncement[])[0];
      if (!after) {
        throw new ValidationError({
          code: 'broadcast.concurrent_update',
          message: 'Broadcast was modified concurrently; please retry',
        });
      }

      const changedFields = auditLogService.computeChangedFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'broadcast_announcements',
        rowId: after.id,
        actorUserId: opts.actorUserId,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        changedFields,
        reason: opts.reasonCode ?? null,
        context: { event: 'update_broadcast' },
      });

      return after;
    });
  },

  /**
   * Send a draft/scheduled broadcast. Status-guarded UPDATE flips status='sent'
   * and stamps sent_at. Targeted users are computed from `targetScope` and
   * each receives a `broadcast.received` notification via sendBulk.
   */
  async send(
    db: BrandedDb,
    broadcastId: string,
    opts: MutationOpts,
  ): Promise<SendBroadcastResult> {
    assertUuid('broadcastId', broadcastId);

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await loadBroadcast(tx, broadcastId);
      if (before.status !== 'draft' && before.status !== 'scheduled') {
        throw new ValidationError({
          code: 'broadcast.invalid_send_status',
          message: `Cannot send broadcast in status "${before.status}"`,
        });
      }

      const sentAt = new Date();
      const updatedRows = await tx
        .scopedUpdate(broadcastAnnouncements)
        .set({ status: 'sent', sentAt })
        .where(
          and(
            eq(broadcastAnnouncements.id, broadcastId),
            or(
              eq(broadcastAnnouncements.status, 'draft'),
              eq(broadcastAnnouncements.status, 'scheduled'),
            )!,
          )!,
        )
        .returning();
      const after = (updatedRows as unknown as BroadcastAnnouncement[])[0];
      if (!after) {
        throw new ValidationError({
          code: 'broadcast.concurrent_send',
          message: 'Broadcast was modified concurrently; please retry',
        });
      }

      // Resolve targets inside the txn for snapshot consistency.
      const scope = before.targetScope as unknown as BroadcastTargetScope;
      const targetedUserIds = await resolveTargetedUsers(tx, scope);

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'broadcast_announcements',
        rowId: after.id,
        actorUserId: opts.actorUserId,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        changedFields: ['status', 'sentAt'],
        reason: opts.reasonCode ?? null,
        context: {
          event: 'send_broadcast',
          targetCount: targetedUserIds.length,
          scope: scope.scope,
        },
      });

      return { after, targetedUserIds };
    });

    // Post-commit fan-out via notificationCenter.sendBulk.
    if (result.targetedUserIds.length > 0) {
      const payloads: SendNotificationInput[] = result.targetedUserIds.map((userId) => ({
        userId,
        type: 'broadcast.received',
        payload: {
          broadcastId: result.after.id,
          title: result.after.title,
          body: result.after.body.slice(0, 200),
          urgency: result.after.urgency,
          ackRequired: result.after.ackRequired,
        },
      }));
      await notificationCenter.sendBulk(db, payloads, { actorUserId: opts.actorUserId });
    }

    return { broadcast: result.after, targetedUserIds: result.targetedUserIds };
  },

  /**
   * Cancel a draft or scheduled broadcast. ReasonCode mandatory.
   */
  async cancel(
    db: BrandedDb,
    broadcastId: string,
    opts: CancelOpts,
  ): Promise<BroadcastAnnouncement> {
    assertUuid('broadcastId', broadcastId);
    requireReasonCode('cancel', opts.reasonCode);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await loadBroadcast(tx, broadcastId);
      if (before.status !== 'draft' && before.status !== 'scheduled') {
        throw new ValidationError({
          code: 'broadcast.invalid_cancel_status',
          message: `Cannot cancel broadcast in status "${before.status}"`,
        });
      }

      const updatedRows = await tx
        .scopedUpdate(broadcastAnnouncements)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(broadcastAnnouncements.id, broadcastId),
            or(
              eq(broadcastAnnouncements.status, 'draft'),
              eq(broadcastAnnouncements.status, 'scheduled'),
            )!,
          )!,
        )
        .returning();
      const after = (updatedRows as unknown as BroadcastAnnouncement[])[0];
      if (!after) {
        throw new ValidationError({
          code: 'broadcast.concurrent_cancel',
          message: 'Broadcast was modified concurrently; please retry',
        });
      }

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'broadcast_announcements',
        rowId: after.id,
        actorUserId: opts.actorUserId,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        changedFields: ['status'],
        reason: opts.reasonCode,
        context: { event: 'cancel_broadcast' },
      });

      return after;
    });
  },

  /**
   * User acknowledges a sent broadcast. Idempotent via ON CONFLICT DO NOTHING
   * on (broadcast_id, user_id) — second ack returns the existing row.
   *
   * Throws when the broadcast is not in 'sent' status (cannot ack a draft).
   */
  async acknowledge(
    db: BrandedDb,
    broadcastId: string,
    opts: MutationOpts,
  ): Promise<BroadcastAcknowledgement> {
    assertUuid('broadcastId', broadcastId);
    assertUuid('actorUserId', opts.actorUserId);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const broadcast = await loadBroadcast(tx, broadcastId);
      if (broadcast.status !== 'sent') {
        throw new ValidationError({
          code: 'broadcast.not_sent',
          message: `Cannot acknowledge a broadcast in status "${broadcast.status}"`,
        });
      }

      // Idempotent INSERT — return the existing row on conflict so the caller
      // can safely retry without seeing a 409.
      const result = await tx.raw.execute(sql`
        INSERT INTO broadcast_acknowledgements (
          brand_id, broadcast_id, user_id, acknowledged_at
        ) VALUES (
          ${tx.brandId}, ${broadcastId}, ${opts.actorUserId}, NOW()
        )
        ON CONFLICT (broadcast_id, user_id) DO UPDATE
          SET acknowledged_at = broadcast_acknowledgements.acknowledged_at
        RETURNING
          id,
          brand_id          AS "brandId",
          broadcast_id      AS "broadcastId",
          user_id           AS "userId",
          acknowledged_at   AS "acknowledgedAt",
          created_at        AS "createdAt",
          updated_at        AS "updatedAt",
          created_by        AS "createdBy",
          updated_by        AS "updatedBy"
      `);
      const rows = result as unknown as BroadcastAcknowledgement[];
      const ack = rows[0]!;

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'broadcast_acknowledgements',
        rowId: ack.id,
        actorUserId: opts.actorUserId,
        after: ack as unknown as Record<string, unknown>,
        reason: opts.reasonCode ?? null,
        context: { event: 'acknowledge_broadcast', broadcastId },
      });

      return ack;
    });
  },

  /**
   * Broadcasts (status='sent') targeted to `userId`. Resolves targetScope per
   * row in JS since the predicate varies (cluster vs location vs role).
   *
   * MVP-acceptable; post-MVP a SQL view or materialized membership table
   * could push this filter into the database.
   */
  async listForUser(
    db: BrandedDb,
    opts: { userId: string; since?: Date },
  ): Promise<BroadcastAnnouncement[]> {
    assertUuid('userId', opts.userId);

    const conds = [eq(broadcastAnnouncements.status, 'sent')];
    // Note: `since` filters on sentAt (not createdAt) since users care about
    // the moment a broadcast was published.
    const rows = (await db
      .scopedFrom(broadcastAnnouncements, and(...conds))
      .orderBy(desc(broadcastAnnouncements.sentAt))) as unknown as BroadcastAnnouncement[];

    const filtered: BroadcastAnnouncement[] = [];
    for (const r of rows) {
      if (opts.since && r.sentAt && r.sentAt < opts.since) continue;
      const matches = await userMatchesScope(
        db,
        opts.userId,
        r.targetScope as unknown as BroadcastTargetScope,
      );
      if (matches) filtered.push(r);
    }
    return filtered;
  },

  /**
   * BO-facing list of all sent broadcasts in the brand. Cursor pagination on
   * (sent_at, id) DESC.
   */
  async listSent(
    db: BrandedDb,
    opts: ListSentInput = {},
  ): Promise<ListSentResult> {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const decoded = decodeCursor(opts.cursor);

    const conds = [eq(broadcastAnnouncements.status, 'sent')];
    if (decoded) {
      conds.push(
        or(
          lt(broadcastAnnouncements.sentAt, decoded.sentAt),
          and(
            eq(broadcastAnnouncements.sentAt, decoded.sentAt),
            lt(broadcastAnnouncements.id, decoded.id),
          )!,
        )! as unknown as ReturnType<typeof eq>,
      );
    }

    const rows = (await db
      .scopedFrom(broadcastAnnouncements, and(...conds))
      .orderBy(desc(broadcastAnnouncements.sentAt), desc(broadcastAnnouncements.id))
      .limit(limit + 1)) as unknown as BroadcastAnnouncement[];

    let items = rows;
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1]!;
      // last.sentAt is non-null because status='sent' rows always carry sent_at.
      nextCursor = encodeCursor(last.sentAt!, last.id);
    }

    return { items, nextCursor };
  },

  /**
   * Count + list of acknowledgements + computed `pendingCount` for one
   * broadcast. `pendingCount = total targeted users - ackCount`.
   */
  async listAcks(db: BrandedDb, broadcastId: string): Promise<ListAcksResult> {
    assertUuid('broadcastId', broadcastId);

    const broadcast = await loadBroadcast(db, broadcastId);
    const targeted = await resolveTargetedUsers(
      db,
      broadcast.targetScope as unknown as BroadcastTargetScope,
    );

    const ackRows = (await db.scopedFrom(
      broadcastAcknowledgements,
      eq(broadcastAcknowledgements.broadcastId, broadcastId),
    )) as unknown as BroadcastAcknowledgement[];

    const acks = ackRows.map((r) => ({
      userId: r.userId,
      acknowledgedAt: r.acknowledgedAt,
    }));
    acks.sort((a, b) => b.acknowledgedAt.getTime() - a.acknowledgedAt.getTime());

    const ackCount = acks.length;
    const pendingCount = Math.max(targeted.length - ackCount, 0);

    return { ackCount, pendingCount, acks };
  },
};

export type { BroadcastAnnouncement, BroadcastAcknowledgement, BroadcastUrgency };
