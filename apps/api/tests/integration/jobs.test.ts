/**
 * jobs.test.ts — Phase 4 Epic 3 INF Arc (a) Task A10.
 *
 * Coverage:
 *   - notification-digest.runDailyDigest exits with 0/0 in the MVP DB state
 *     (every notification_type_config row seeds emailMode='none'), and does
 *     NOT throw when the notifications table is empty.
 *
 * The escalation job-handler tests live alongside the rest of the engine
 * coverage in `approval-engine.test.ts` so they share the same setup
 * fixtures (seeded chain, BO + delegate users, etc.).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, truncateTestTables } from './setup.js';
import { unscopedDb } from '../../src/db/client.js';
import { notificationTypeConfig } from '../../src/db/schema/notifications.js';
import { runDailyDigest } from '../../src/jobs/notification-digest.js';

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

describe('notification-digest.runDailyDigest', () => {
  it('returns {usersProcessed: 0, emailsEnqueued: 0} in MVP state (every type seeds emailMode=none)', async () => {
    // Sanity check: the seeded type_config rows all have emailMode='none' per DL-035.
    const rawDb = unscopedDb();
    const digestRows = await rawDb
      .select()
      .from(notificationTypeConfig)
      .where(eq(notificationTypeConfig.emailMode, 'digest'));
    expect(digestRows.length).toBe(0);

    const result = await runDailyDigest();
    expect(result).toEqual({ usersProcessed: 0, emailsEnqueued: 0 });
  });

  it('does not throw when the notifications table is empty', async () => {
    await expect(runDailyDigest()).resolves.toEqual({
      usersProcessed: 0,
      emailsEnqueued: 0,
    });
  });
});
