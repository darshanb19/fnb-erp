/**
 * notification-digest — Phase 4 Epic 3 INF Arc (a) Task A10.
 *
 * Daily digest aggregator. Scheduled to run via pg_cron at 18:00 IST in
 * production; in dev/test the function is callable directly.
 *
 * MVP per DL-035: every notification_type_config row seeds with
 * email_mode='none', so no row has digest_eligible=true at write time, so
 * this handler has nothing to aggregate. The handler exits with an empty
 * tally on first probe and returns 0/0.
 *
 * Same code path activates post-domain-registration without modification —
 * flip email_mode='digest' on the relevant type_config rows and the next
 * 18:00 IST run picks them up.
 *
 * The pg_cron schedule registration is intentionally NOT in a migration: the
 * spec ships this as a stub. Registration will land alongside the post-MVP
 * email enable + Resend / DKIM / SPF provisioning.
 */

import { eq } from 'drizzle-orm';
import { unscopedDb } from '../db/client.js';
import { notificationTypeConfig } from '../db/schema/notifications.js';

export interface DigestRunResult {
  usersProcessed: number;
  emailsEnqueued: number;
}

export async function runDailyDigest(): Promise<DigestRunResult> {
  const digestTypes = await unscopedDb()
    .select()
    .from(notificationTypeConfig)
    .where(eq(notificationTypeConfig.emailMode, 'digest'));

  if (digestTypes.length === 0) {
    // MVP path — every type seeds emailMode='none', so we never enter the
    // aggregation branch below until a brand opts into digest emails.
    return { usersProcessed: 0, emailsEnqueued: 0 };
  }

  // Post-MVP aggregation outline (deferred until any type_config row has
  // emailMode='digest'):
  //
  //   1. SELECT user_id, type, payload, created_at
  //      FROM notifications
  //      WHERE digest_eligible = true
  //        AND (last_digest_sent_at IS NULL OR created_at > last_digest_sent_at)
  //   2. Group by user_id; build per-user digest payloads.
  //   3. For each user, enqueue 'send_email' pg-boss job with the consolidated
  //      digest body (HTML rendered from the user's payload set).
  //   4. UPDATE the user's last_digest_sent_at marker (table TBD post-MVP).
  //
  // Implementation deferred — DL-035 invariant says this branch never fires
  // in MVP. A regression test (jobs.test.ts) asserts the early-return holds.

  return { usersProcessed: 0, emailsEnqueued: 0 };
}
