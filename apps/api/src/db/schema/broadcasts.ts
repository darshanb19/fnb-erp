/**
 * broadcast_announcements + broadcast_acknowledgements —
 * Phase 4 Epic 3 INF Arc (a) Task A4.
 *
 * BRAND-SCOPED. Brand Owner authors broadcast announcements that fan out
 * to a target user set via `notificationCenter.sendBulk()` (Task A6).
 *
 * `target_scope` jsonb shape — exactly one of:
 *   { scope: 'brand' }
 *   { scope: 'cluster_ids', values: string[] }
 *   { scope: 'location_ids', values: string[] }
 *   { scope: 'role_keys', values: UserRole[] }
 *
 * `broadcast_acknowledgements` rows are written ONLY when a user
 * acknowledges — never pre-populated. Composite uniqueness on
 * (broadcast_id, user_id) prevents double-ack and is enforced via raw
 * SQL in migration 0009 (Task A5); the schema declares a composite index
 * here for query performance.
 *
 * Sent broadcasts are immutable: `broadcastService.compose/schedule/send`
 * (Task A6) returns 409 on PATCH if `status='sent'`.
 */

import { pgEnum, text, boolean, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const broadcastUrgencyEnum = pgEnum('broadcast_urgency', [
  'info',
  'important',
  'critical',
]);

export const broadcastStatusEnum = pgEnum('broadcast_status', [
  'draft',
  'scheduled',
  'sent',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// broadcast_announcements
// ---------------------------------------------------------------------------

export const broadcastAnnouncements = brandScopedTable('broadcast_announcements', {
  title: text('title').notNull(),
  /** Markdown allowed. */
  body: text('body').notNull(),
  urgency: broadcastUrgencyEnum('urgency').notNull().default('info'),
  targetScope: jsonb('target_scope').notNull(),
  /** Null = immediate on send. */
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  ackRequired: boolean('ack_required').notNull().default(false),
  status: broadcastStatusEnum('status').notNull().default('draft'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
});

// ---------------------------------------------------------------------------
// broadcast_acknowledgements
// ---------------------------------------------------------------------------

export const broadcastAcknowledgements = brandScopedTable(
  'broadcast_acknowledgements',
  {
    broadcastId: uuid('broadcast_id')
      .notNull()
      .references(() => broadcastAnnouncements.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  {
    indexes: {
      broadcastUser: ['broadcastId', 'userId'],
    },
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BroadcastAnnouncement = typeof broadcastAnnouncements.$inferSelect;
export type NewBroadcastAnnouncement = typeof broadcastAnnouncements.$inferInsert;
export type BroadcastAcknowledgement = typeof broadcastAcknowledgements.$inferSelect;
export type NewBroadcastAcknowledgement = typeof broadcastAcknowledgements.$inferInsert;
export type BroadcastUrgency = (typeof broadcastUrgencyEnum.enumValues)[number];
export type BroadcastStatus = (typeof broadcastStatusEnum.enumValues)[number];
