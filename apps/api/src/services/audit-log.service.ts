/**
 * auditLogService — DL-013 application-layer audit primary.
 *
 * Writes append-only rows to audit_log for every domain mutation.
 * Called by service-layer methods (orgService, productService, etc.)
 * inside their transactions so the audit row is committed atomically
 * with the mutation it records.
 *
 * Append-only contract: service code only calls record() (INSERT).
 * No update or delete helpers are provided here. The DB migration
 * enforces this at the role/grant layer (Epic 2+).
 *
 * Per architecture §7.2 + DL-013.
 */

import { auditLog, type NewAuditLogRow } from '../db/schema/audit.js';
import type { BrandedDb } from '../db/branded-db.js';
import type { ScopedInsertRow } from '../db/branded-db.js';

export type AuditAction = 'insert' | 'update' | 'delete' | 'business_action';

export interface AuditRecordInput {
  action: AuditAction;
  tableName: string;
  rowId: string;
  /** Null when the caller has no user context (system seed, trigger rows, etc.). */
  actorUserId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  /** Human-supplied justification; null on routine CRUD. */
  reason?: string | null;
  /** Null when the mutation is not part of a TRN-bearing transaction. */
  trnReference?: string | null;
  /** Optional screen / source context for the UI audit timeline. */
  context?: Record<string, unknown> | null;
}

export const auditLogService = {
  /**
   * Write one audit row, scoped to the caller's brand.
   * Must be called inside an active transaction so the audit row commits
   * atomically with the mutation it records.
   */
  async record(db: BrandedDb, input: AuditRecordInput): Promise<void> {
    // Cast to ScopedInsertRow<typeof auditLog> (which is Omit<NewAuditLogRow, 'brandId'>).
    // The cast is needed because TypeScript cannot distribute InferInsertModel through
    // the BrandScopedTableResult generic deeply enough to confirm `actorUserId` is a
    // valid key. The cast is safe: the shape matches NewAuditLogRow exactly minus brandId.
    const row: ScopedInsertRow<typeof auditLog> = {
      action: input.action,
      tableName: input.tableName,
      rowId: input.rowId,
      actorUserId: input.actorUserId ?? null,
      before: (input.before ?? null) as NewAuditLogRow['before'],
      after: (input.after ?? null) as NewAuditLogRow['after'],
      changedFields: (input.changedFields ?? null) as NewAuditLogRow['changedFields'],
      reason: input.reason ?? null,
      trnReference: input.trnReference ?? null,
      context: (input.context ?? null) as NewAuditLogRow['context'],
    } as ScopedInsertRow<typeof auditLog>;
    await db.scopedInsert(auditLog, row);
  },

  /**
   * Compute the sorted set of field keys that differ between `before` and `after`.
   * Helper for service code building an 'update' audit record.
   *
   * Uses Object.is() semantics (same as ===, except NaN === NaN and +0 !== -0).
   * Does NOT deep-compare nested objects — callers that store JSON blobs should
   * check their own equality logic if needed.
   */
  computeChangedFields<T extends Record<string, unknown>>(before: T, after: T): string[] {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    const changed: string[] = [];
    for (const k of keys) {
      if (!Object.is(before[k], after[k])) changed.push(k);
    }
    return changed.sort();
  },
};
