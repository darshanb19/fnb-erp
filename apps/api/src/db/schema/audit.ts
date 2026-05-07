import { uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';

/**
 * audit_log — the canonical activity timeline.
 * Per architecture §7.2 + DL-013 (application-layer primary).
 *
 * NOTE — Carve-out scope: architecture §5.1 maps audit.ts to Epic 3, but Arc (a)
 * service-layer tests in Tasks A5/A7/A8/A9 assert audit-log writes, so the table
 * must exist by Epic 1. Epic 3 layers on the consumer-side query API (CC-AUDIT-LINK)
 * and the trigger backstop function audit_critical_table_trigger().
 *
 * Append-only enforcement:
 * - Migration revokes UPDATE/DELETE from non-superuser roles.
 * - CI lint blocks any future migration that grants UPDATE/DELETE on audit_log.
 */
export const auditLog = brandScopedTable('audit_log', {
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id'), // nullable — trigger-emitted rows from direct-DB writes
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),
  action: text('action').notNull(), // 'insert' | 'update' | 'delete' | 'business_action'
  changedFields: jsonb('changed_fields'), // string[] | null
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'), // human-supplied; null on routine CRUD + trigger rows
  trnReference: text('trn_reference'), // null when not part of a TRN-bearing txn
  context: jsonb('context'), // { screen?: string, source?: string, ... }
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
