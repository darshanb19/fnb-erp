/**
 * issue_tickets + issue_ticket_comments + issue_ticket_attachments —
 * Phase 4 Epic 3 INF Arc (a) Task A3.
 *
 * BRAND-SCOPED. Issue Tracker per FR22 with the full DL-039 surface
 * (ticket CRUD + status transitions + priority + assignee + linked-entity
 * reference + comments thread + file attachments).
 *
 * `reference` is `ISS-YYYY-SEQ` — auto-generated per (brand_id, year) by a
 * Postgres sequence created in migration 0009 (Task A5). The unique
 * constraint here is global per-brand to keep the user-facing reference
 * collision-free; the seq is brand+year-scoped because brands operate
 * independently and a year carries calendar meaning for tickets.
 *
 * Realtime channel #5 (`issue_tracker_threads` per DL-010) publishes on
 * `issue_ticket_comments` insert; consumed by the comments thread in
 * Arc (c) Task C8b.
 *
 * `storagePath` on attachments follows DL-017 per-brand bucket convention:
 * `${entityType}/${entityId}/${filename}`. The signed-URL flow (Express
 * issues PUT URL → browser uploads direct to Storage → PATCH confirms)
 * lands in Task A6.
 */

import { pgEnum, text, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const issuePriorityEnum = pgEnum('issue_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const issueStatusEnum = pgEnum('issue_status', [
  'open',
  'in_progress',
  'pending_info',
  'resolved',
  'closed',
]);

// ---------------------------------------------------------------------------
// issue_tickets
// ---------------------------------------------------------------------------

export const issueTickets = brandScopedTable('issue_tickets', {
  /**
   * `ISS-YYYY-SEQ` — auto-generated via per-(brand_id, year) sequence
   * created in migration 0009 (Task A5).
   */
  reference: text('reference').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: issuePriorityEnum('priority').notNull().default('medium'),
  status: issueStatusEnum('status').notNull().default('open'),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id),
  originatorUserId: uuid('originator_user_id')
    .notNull()
    .references(() => users.id),
  /** e.g., 'po', 'gr', 'production_order', 'requisition'. */
  linkedEntityType: text('linked_entity_type'),
  /** TRN or business-key reference. */
  linkedEntityRef: text('linked_entity_ref'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// issue_ticket_comments
// ---------------------------------------------------------------------------

export const issueTicketComments = brandScopedTable('issue_ticket_comments', {
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => issueTickets.id),
  authorUserId: uuid('author_user_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
});

// ---------------------------------------------------------------------------
// issue_ticket_attachments
// ---------------------------------------------------------------------------

export const issueTicketAttachments = brandScopedTable(
  'issue_ticket_attachments',
  {
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => issueTickets.id),
    /** Per DL-017: `<entityType>/<entityId>/<filename>` inside the per-brand bucket. */
    storagePath: text('storage_path').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueTicket = typeof issueTickets.$inferSelect;
export type NewIssueTicket = typeof issueTickets.$inferInsert;
export type IssueTicketComment = typeof issueTicketComments.$inferSelect;
export type NewIssueTicketComment = typeof issueTicketComments.$inferInsert;
export type IssueTicketAttachment = typeof issueTicketAttachments.$inferSelect;
export type NewIssueTicketAttachment = typeof issueTicketAttachments.$inferInsert;
export type IssuePriority = (typeof issuePriorityEnum.enumValues)[number];
export type IssueStatus = (typeof issueStatusEnum.enumValues)[number];
