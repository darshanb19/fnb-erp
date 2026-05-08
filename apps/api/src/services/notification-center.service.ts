/**
 * notificationCenter — Phase 4 Epic 3 INF Arc (a) Task A8 (full).
 *
 * Replaces the A7 stub with the real dispatch path:
 *   - Look up `notification_type_config` (in_app + email_mode + digest_window).
 *     Throws ValidationError("Unknown notification type") when no row matches.
 *   - Look up per-user `notification_preferences` override row (may be null).
 *   - Compute effective in-app: `pref.inAppOverride ?? typeConfig.inApp`.
 *   - When effective in-app=true: scopedInsert(notifications, ...) with
 *     `digestEligible = (typeConfig.emailMode === 'digest')` and Realtime
 *     publish channel #2.
 *   - When effective in-app=false: returns null and inserts NOTHING.
 *
 * DL-035 invariant: in MVP every type_config row seeds with email_mode='none'.
 * That makes `digestEligible` always false in MVP and the email enqueue path
 * is intentionally cold. Re-enabling email post-MVP is a one-row UPDATE per
 * type plus Resend / DKIM / SPF provisioning. Branches named here so the
 * post-MVP author has a clean shopping list:
 *   - emailMode='immediate' → enqueue 'send_email' pg-boss job.
 *   - emailMode='digest'    → digest_eligible=true is picked up by the daily
 *                              pg_cron handler (Task A10).
 *   - emailMode='none'      → no email work.
 *
 * Return type: `Notification | null`. A7 callers (approvalEngine.{create, decide,
 * delegate}) treat the return as non-null because in MVP every type seeds with
 * in_app=true and no users have overrides. The `| null` is the precise contract
 * for post-MVP code paths once per-user overrides go live; A7 sites continue to
 * work without modification.
 *
 * Realtime publish runs AFTER the row commit so subscribers can refetch + see
 * the row immediately.
 */

import { sql, eq, and, desc, lt, or, isNull } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import {
  notifications,
  notificationTypeConfig,
  notificationPreferences,
  type Notification,
  type NotificationTypeConfig,
  type NotificationPreference,
  type EmailMode,
  type DigestWindow,
} from '../db/schema/notifications.js';
import { publishNotification } from '../realtime/publishers.js';
import { ValidationError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendNotificationInput {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface ListNotificationsInput {
  userId: string;
  unseenOnly?: boolean;
  limit?: number;
  /** Cursor: stringified `<created_at_iso>|<id>` returned by previous page. */
  cursor?: string | null;
}

export interface ListNotificationsResult {
  items: Notification[];
  nextCursor: string | null;
}

export interface MarkSeenInput {
  notificationId: string;
  userId: string;
}

export interface MarkAllSeenInput {
  userId: string;
}

export interface PreferenceRow {
  type: string;
  /** type_config baseline. */
  inApp: boolean;
  emailMode: EmailMode;
  digestWindow: DigestWindow | null;
  /** Per-user overrides (null when no preferences row exists for this type). */
  inAppOverride: boolean | null;
  emailOverride: boolean | null;
  digestBatchOverride: boolean | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface SavePreferencesPatch {
  inAppOverride?: boolean | null;
  emailOverride?: boolean | null;
  digestBatchOverride?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface SavePreferencesInput {
  userId: string;
  type: string;
  prefs: SavePreferencesPatch;
}

export interface DigestPreviewItem {
  type: string;
  count: number;
  /** A representative payload from the most recent eligible notification of this type. */
  sample: Record<string, unknown>;
}

export interface DigestPreviewResult {
  /** The cutoff used as the digest window start (oldest unseen digest_eligible). */
  startedAt: string | null;
  items: DigestPreviewItem[];
}

interface MutationOpts {
  actorUserId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Drizzle `.returning()` chain → typed rows. */
async function returning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

/** Encode a `(createdAt, id)` cursor as `iso|uuid`. */
function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

/** Decode a cursor; returns null on malformed input (caller treats as page 1). */
function decodeCursor(cursor: string | null | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf('|');
  if (idx < 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || id.length === 0) return null;
  return { createdAt: d, id };
}

/** Look up the typeConfig row; throws ValidationError when missing. */
async function loadTypeConfig(db: BrandedDb, type: string): Promise<NotificationTypeConfig> {
  const rows = (await db.raw
    .select()
    .from(notificationTypeConfig)
    .where(eq(notificationTypeConfig.type, type))) as unknown as NotificationTypeConfig[];
  const row = rows[0];
  if (!row) {
    throw new ValidationError({
      code: 'notification.unknown_type',
      message: `Unknown notification type: "${type}"`,
    });
  }
  return row;
}

/** Per-user preference row for a single type, or null if none. */
async function loadPreference(
  db: BrandedDb,
  userId: string,
  type: string,
): Promise<NotificationPreference | null> {
  const rows = (await db.scopedFrom(
    notificationPreferences,
    and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)),
  )) as unknown as NotificationPreference[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Core dispatch — extracted so sendBulk can reuse inside a single transaction
// ---------------------------------------------------------------------------

async function sendOnDb(
  db: BrandedDb,
  input: SendNotificationInput,
): Promise<Notification | null> {
  const config = await loadTypeConfig(db, input.type);
  const pref = await loadPreference(db, input.userId, input.type);
  const inAppEffective = pref?.inAppOverride ?? config.inApp;

  if (!inAppEffective) {
    // No row inserted, no Realtime publish. Caller (engine) sees null.
    // DL-035 invariant: every MVP type seeds in_app=true so this branch is
    // exercised only when a user explicitly opts out via preferences.
    return null;
  }

  const digestEligible = config.emailMode === 'digest';

  const rows = await returning<Notification>(
    db.scopedInsert(notifications, {
      userId: input.userId,
      type: input.type,
      payload: input.payload as unknown,
      digestEligible,
      escalationEligible: false,
    } as unknown as Parameters<typeof db.scopedInsert<typeof notifications>>[1]).returning(),
  );
  const row = rows[0]!;

  // DL-035 post-MVP email branches (intentionally cold in MVP):
  //   if (config.emailMode === 'immediate') enqueue('send_email', { notificationId: row.id });
  //   if (config.emailMode === 'digest')    /* row.digestEligible=true; daily pg_cron handler picks it up */;
  //   if (config.emailMode === 'none')      /* no-op */;

  return row;
}

// ---------------------------------------------------------------------------
// notificationCenter
// ---------------------------------------------------------------------------

export const notificationCenter = {
  /**
   * Send (insert + Realtime-publish) a notification to one user.
   *
   * Returns the inserted Notification row, or null when the effective in-app
   * dispatch is disabled (per-user override turning it off). In MVP every
   * type_config row has in_app=true and no users have overrides, so callers
   * (approvalEngine, issueTrackerService, broadcastService) safely treat the
   * return as non-null.
   *
   * Throws ValidationError when `type` has no notification_type_config row.
   */
  async send(db: BrandedDb, input: SendNotificationInput): Promise<Notification | null> {
    const row = await sendOnDb(db, input);
    if (!row) return null;

    await publishNotification({
      notificationId: row.id,
      userId: input.userId,
      brandId: db.brandId,
      type: input.type,
    });

    return row;
  },

  /**
   * Send N notifications atomically. All inserts happen inside one transaction,
   * so a partial failure rolls every row back. Realtime publishes fire AFTER
   * commit — failure of one publish does not roll the txn back.
   *
   * Filters out null returns from the response (rows that were suppressed by
   * the in-app override). In MVP every type seeds in_app=true so the result
   * length matches `payloads.length` unless a user has set overrides.
   */
  async sendBulk(
    db: BrandedDb,
    payloads: SendNotificationInput[],
    opts: MutationOpts,
  ): Promise<Notification[]> {
    if (payloads.length === 0) return [];

    const inserted = await withTransaction(db, opts.actorUserId, async (tx) => {
      const out: Notification[] = [];
      for (const p of payloads) {
        const row = await sendOnDb(tx, p);
        if (row) out.push(row);
      }
      return out;
    });

    // Post-commit publishes.
    for (const row of inserted) {
      await publishNotification({
        notificationId: row.id,
        userId: row.userId,
        brandId: db.brandId,
        type: row.type,
      });
    }

    return inserted;
  },

  /**
   * List a user's notifications, newest first, with cursor pagination on
   * (created_at, id). Default limit 50, max 200.
   *
   * Returns nextCursor=null when the page is the last.
   */
  async list(db: BrandedDb, input: ListNotificationsInput): Promise<ListNotificationsResult> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const decoded = decodeCursor(input.cursor);

    // Build conjunctive condition with optional cursor + unseenOnly clauses.
    const conds = [eq(notifications.userId, input.userId)];
    if (input.unseenOnly === true) {
      conds.push(isNull(notifications.inAppSeenAt));
    }
    if (decoded) {
      // Strict less-than on (createdAt, id) tuple to step past the last page.
      // Tuple comparison: (a, b) < (a0, b0) ⇔ a < a0 OR (a = a0 AND b < b0).
      conds.push(
        or(
          lt(notifications.createdAt, decoded.createdAt),
          and(eq(notifications.createdAt, decoded.createdAt), lt(notifications.id, decoded.id))!,
        )!,
      );
    }

    const rows = (await db
      .scopedFrom(notifications, and(...conds))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1)) as unknown as Notification[];

    let items = rows;
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1]!;
      nextCursor = encodeCursor(last.createdAt, last.id);
    }

    return { items, nextCursor };
  },

  /**
   * Mark a single notification as seen. Brand-scoped + user-scoped: a caller
   * cannot mark another brand's row or another user's row.
   *
   * Idempotent: re-marking just refreshes the timestamp (NOW()).
   */
  async markSeen(db: BrandedDb, input: MarkSeenInput): Promise<void> {
    await db
      .scopedUpdate(notifications)
      .set({ inAppSeenAt: new Date() })
      .where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, input.userId)));
  },

  /**
   * Mark every unseen notification for `userId` as seen. Returns rowcount.
   */
  async markAllSeen(db: BrandedDb, input: MarkAllSeenInput): Promise<number> {
    const rows = await db
      .scopedUpdate(notifications)
      .set({ inAppSeenAt: new Date() })
      .where(and(eq(notifications.userId, input.userId), isNull(notifications.inAppSeenAt)))
      .returning({ id: notifications.id });
    return (rows as unknown as Array<{ id: string }>).length;
  },

  /**
   * Per-user preference rows merged with the type_config baseline. Returns one
   * row per type_config row; per-user override fields are null when no
   * notification_preferences row exists for that (user, type) pair.
   *
   * LEFT JOIN on type_config ⨝ preferences, brand-scoped on the preferences
   * side (preferences is brand-scoped; type_config is global).
   */
  async getPreferences(
    db: BrandedDb,
    args: { userId: string },
  ): Promise<PreferenceRow[]> {
    const rows = await db.raw
      .select({
        type: notificationTypeConfig.type,
        inApp: notificationTypeConfig.inApp,
        emailMode: notificationTypeConfig.emailMode,
        digestWindow: notificationTypeConfig.digestWindow,
        inAppOverride: notificationPreferences.inAppOverride,
        emailOverride: notificationPreferences.emailOverride,
        digestBatchOverride: notificationPreferences.digestBatchOverride,
        quietHoursStart: notificationPreferences.quietHoursStart,
        quietHoursEnd: notificationPreferences.quietHoursEnd,
      })
      .from(notificationTypeConfig)
      .leftJoin(
        notificationPreferences,
        and(
          eq(notificationPreferences.type, notificationTypeConfig.type),
          eq(notificationPreferences.userId, args.userId),
          eq(notificationPreferences.brandId, db.brandId),
        ),
      )
      .orderBy(notificationTypeConfig.type);

    return rows as unknown as PreferenceRow[];
  },

  /**
   * UPSERT a single (userId, type) preference row. Audit row written inside
   * the same transaction per DL-013.
   *
   * The unique constraint is on `(user_id, type)` (see migration 0009). The
   * raw INSERT ... ON CONFLICT DO UPDATE form is used because Drizzle's
   * onConflictDoUpdate ergonomics with brand-scoped composite uniques are
   * awkward. brand_id is injected at insert time and matches on the conflict
   * (single-tenant MVP — one user_id can never live in two brands today, but
   * the unique constraint stays narrow because the user_id column is itself
   * the identity).
   */
  async savePreferences(
    db: BrandedDb,
    input: SavePreferencesInput,
    opts: MutationOpts,
  ): Promise<NotificationPreference> {
    // Validate type exists. Failing fast keeps the audit row clean.
    await loadTypeConfig(db, input.type);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Capture before state for audit.
      const before = await loadPreference(tx, input.userId, input.type);

      // The raw postgres-js driver returns snake_case keys on RETURNING *. We
      // alias each column to its camelCase JS name so the result row matches
      // the Drizzle-inferred NotificationPreference shape directly.
      const result = await tx.raw.execute(sql`
        INSERT INTO notification_preferences (
          brand_id, user_id, type,
          in_app_override, email_override, digest_batch_override,
          quiet_hours_start, quiet_hours_end
        ) VALUES (
          ${tx.brandId}, ${input.userId}, ${input.type},
          ${input.prefs.inAppOverride ?? null},
          ${input.prefs.emailOverride ?? null},
          ${input.prefs.digestBatchOverride ?? null},
          ${input.prefs.quietHoursStart ?? null}::time,
          ${input.prefs.quietHoursEnd ?? null}::time
        )
        ON CONFLICT (user_id, type) DO UPDATE SET
          in_app_override       = EXCLUDED.in_app_override,
          email_override        = EXCLUDED.email_override,
          digest_batch_override = EXCLUDED.digest_batch_override,
          quiet_hours_start     = EXCLUDED.quiet_hours_start,
          quiet_hours_end       = EXCLUDED.quiet_hours_end,
          updated_at            = NOW()
        RETURNING
          id,
          brand_id              AS "brandId",
          user_id               AS "userId",
          type,
          in_app_override       AS "inAppOverride",
          email_override        AS "emailOverride",
          digest_batch_override AS "digestBatchOverride",
          quiet_hours_start     AS "quietHoursStart",
          quiet_hours_end       AS "quietHoursEnd",
          created_at            AS "createdAt",
          updated_at            AS "updatedAt",
          created_by            AS "createdBy",
          updated_by            AS "updatedBy"
      `);
      const rows = result as unknown as NotificationPreference[];
      const after = rows[0]!;

      const action = before ? 'update' : 'insert';
      const changedFields = before
        ? auditLogService.computeChangedFields(
            before as unknown as Record<string, unknown>,
            after as unknown as Record<string, unknown>,
          )
        : null;

      await auditLogService.record(tx, {
        action,
        tableName: 'notification_preferences',
        rowId: after.id,
        actorUserId: opts.actorUserId,
        before: (before as unknown as Record<string, unknown>) ?? null,
        after: after as unknown as Record<string, unknown>,
        changedFields,
        context: { event: 'save_notification_preference', type: input.type, userId: input.userId },
      });

      return after;
    });
  },

  /**
   * Aggregate digest_eligible notifications into a per-type preview for SI-INF-004.
   *
   * Iterates digest_eligible rows since the user's last delivered digest (or
   * forever, if none exists). Buckets by type; each bucket carries count +
   * the most recent eligible payload as `sample`.
   *
   * MVP / DL-035 invariant: every type_config row seeds emailMode='none' →
   * `digest_eligible` rows are never produced → this method always returns
   * `{ startedAt: null, items: [] }`. The implementation is correct for the
   * post-MVP code path; the empty-result invariant holds today because no
   * row's email_mode is 'digest'. Re-enabling email post-MVP unblocks this.
   */
  async getDigestPreview(
    db: BrandedDb,
    args: { userId: string },
  ): Promise<DigestPreviewResult> {
    // Strict simple aggregation — no "last delivered digest" cursor in MVP
    // because no digest has ever been sent. Post-MVP this would also filter
    // by `created_at >= lastDigestAt`. Today the eligible set is empty.
    const rows = (await db.scopedFrom(
      notifications,
      and(eq(notifications.userId, args.userId), eq(notifications.digestEligible, true)),
    )) as unknown as Notification[];

    if (rows.length === 0) {
      return { startedAt: null, items: [] };
    }

    rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const startedAt = rows[0]!.createdAt.toISOString();

    const grouped = new Map<string, DigestPreviewItem>();
    for (const r of rows) {
      const existing = grouped.get(r.type);
      if (existing) {
        existing.count += 1;
        // Keep the newest payload as sample.
        existing.sample = r.payload as Record<string, unknown>;
      } else {
        grouped.set(r.type, {
          type: r.type,
          count: 1,
          sample: r.payload as Record<string, unknown>,
        });
      }
    }

    return {
      startedAt,
      items: Array.from(grouped.values()).sort((a, b) => a.type.localeCompare(b.type)),
    };
  },
};
