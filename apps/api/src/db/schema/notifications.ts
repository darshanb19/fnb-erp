/**
 * notifications + notification_type_config + notification_preferences —
 * Phase 4 Epic 3 INF Arc (a) Task A2.
 *
 * `notifications` and `notification_preferences` are BRAND-SCOPED.
 * `notification_type_config` is GLOBAL (non-brand-scoped) — same documented
 * exception pattern as the `permissions` table from Epic 2 Arc (a) Task A3.
 * Dispatch policy is a single global table because the rules are identical
 * across brands (single-tenant MVP) and the table is read-mostly.
 *
 * MVP per DL-035: every type_config row seeds with `email_mode='none'`. The
 * `notificationCenter.send()` code path looks up `email_mode`, branches
 * accordingly, and never enqueues email jobs in MVP because no row says
 * `'immediate'` or `'digest'`. Re-enabling email post-MVP is a one-row
 * UPDATE per type plus Resend / DKIM / SPF provisioning.
 *
 * Realtime channel #2 publishes on every `notifications` row insert
 * (Task A6 publishers; consumed by the in-app inbox banner via
 * `useNotifications()` in Arc (c)).
 *
 * `notification_preferences` uniqueness on (user_id, type) is enforced via
 * raw SQL in migration 0009 (Task A5). The schema declares a composite
 * index here for query performance; the UNIQUE constraint lands in the
 * migration alongside the table-create.
 */

import { pgEnum, pgTable, text, boolean, time, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const emailModeEnum = pgEnum('notification_email_mode', [
  'none',
  'immediate',
  'digest',
]);

export const digestWindowEnum = pgEnum('notification_digest_window', ['daily']);

// ---------------------------------------------------------------------------
// notification_type_config (GLOBAL — non-brand-scoped)
// ---------------------------------------------------------------------------

export const notificationTypeConfig = pgTable('notification_type_config', {
  /** e.g., 'approval.requested', 'broadcast.received'. */
  type: text('type').primaryKey(),
  inApp: boolean('in_app').notNull().default(true),
  emailMode: emailModeEnum('email_mode').notNull().default('none'),
  /** Null unless emailMode='digest'. */
  digestWindow: digestWindowEnum('digest_window'),
  description: text('description').notNull(),
});

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export const notifications = brandScopedTable('notifications', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type')
    .notNull()
    .references(() => notificationTypeConfig.type),
  /** Type-specific data shape; UI renders from this. */
  payload: jsonb('payload').notNull(),
  inAppSeenAt: timestamp('in_app_seen_at', { withTimezone: true }),
  digestEligible: boolean('digest_eligible').notNull().default(false),
  escalationEligible: boolean('escalation_eligible').notNull().default(false),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// notification_preferences
// ---------------------------------------------------------------------------

export const notificationPreferences = brandScopedTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type')
      .notNull()
      .references(() => notificationTypeConfig.type),
    /** Null = use type_config default. */
    inAppOverride: boolean('in_app_override'),
    /** Stored but ignored MVP per DL-035. */
    emailOverride: boolean('email_override'),
    digestBatchOverride: boolean('digest_batch_override'),
    quietHoursStart: time('quiet_hours_start'),
    quietHoursEnd: time('quiet_hours_end'),
  },
  {
    indexes: {
      userType: ['userId', 'type'],
    },
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationTypeConfig = typeof notificationTypeConfig.$inferSelect;
export type NewNotificationTypeConfig = typeof notificationTypeConfig.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type EmailMode = (typeof emailModeEnum.enumValues)[number];
export type DigestWindow = (typeof digestWindowEnum.enumValues)[number];
