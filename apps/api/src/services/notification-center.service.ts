/**
 * notificationCenter — Phase 4 Epic 3 INF Arc (a) Task A7 stub.
 *
 * Minimal in-process stub so engine call sites in approvalEngine /
 * issueTrackerService / broadcastService have a stable contract NOW.
 *
 * Task A8 replaces the body with the real dispatch path:
 *   - Look up notification_type_config (in_app + email_mode + digest_window)
 *   - Look up per-user notification_preferences override
 *   - INSERT a notifications row when in-app is enabled
 *   - Enqueue email job(s) when email_mode is 'immediate' or 'digest'
 *     (DL-035: no rows are 'immediate' / 'digest' in MVP, so this stays cold)
 *   - Realtime publish on channel #2
 *
 * For Arc (a) Task A7 the stub INSERTs a notifications row directly via
 * scopedInsert and Realtime-publishes. That gives the engine end-to-end
 * delivery for tests + unblocks approval flows without prejudicing the A8
 * design (the A8 code path is a strict superset).
 */

import type { BrandedDb } from '../db/branded-db.js';
import { notifications, type Notification } from '../db/schema/notifications.js';
import { publishNotification } from '../realtime/publishers.js';

export interface SendNotificationInput {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

export const notificationCenter = {
  /**
   * Send (insert + Realtime-publish) a notification to one user.
   *
   * Stub semantics (Task A7): always inserts an in-app row. Task A8 layers
   * the type_config / preference / digest / email logic on top.
   */
  async send(db: BrandedDb, input: SendNotificationInput): Promise<Notification> {
    const rows = await insertReturning<Notification>(
      db.scopedInsert(notifications, {
        userId: input.userId,
        type: input.type,
        payload: input.payload as unknown,
        digestEligible: false,
        escalationEligible: false,
      } as unknown as Parameters<typeof db.scopedInsert<typeof notifications>>[1]).returning(),
    );
    const row = rows[0]!;

    await publishNotification({
      notificationId: row.id,
      userId: input.userId,
      brandId: db.brandId,
      type: input.type,
    });

    return row;
  },
};
