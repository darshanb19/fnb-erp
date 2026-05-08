/**
 * auditService — Phase 4 Epic 3 INF Arc (a) Task A8 (READ side).
 *
 * Sibling to `audit-log.service.ts`. The naming split is deliberate:
 *   - `audit-log.service.ts` = WRITE side (DL-013). Service code calls
 *     auditLogService.record() inside transactions to append rows.
 *   - `audit.service.ts`     = READ side (this file). Consumed by
 *     SI-INF-005 (audit timeline page) + SI-INF-006 (entity timeline embed
 *     on USR-002 view-mode per DL-038) + the export endpoints.
 *
 * Scope-aware filtering (per spec §4):
 *   - 'unrestricted'  → BO sees the entire brand.
 *   - 'brand'         → FM sees the entire brand.
 *   - 'cluster'       → CM sees rows whose actor user shares the same cluster_id.
 *   - 'own'           → POS Staff sees only their own rows.
 *
 * Cursor pagination on (occurred_at, id). The audit_log table sorts by
 * `occurred_at` (the architecture-§7.2 column) for the timeline UI; `id` is
 * the monotonic tiebreaker.
 *
 * Export:
 *   - 'csv' / 'excel' → synchronous string return. Excel ships as CSV-with-BOM
 *     in MVP (Tier 2 acceptance per inventory). Fields are RFC-4180 escaped
 *     (commas, quotes, newlines wrapped in double-quotes; embedded quotes
 *     doubled).
 *   - 'pdf' → stub returns `{ format: 'pdf', jobId: 'pending-<uuid>' }`. Real
 *     pg-boss enqueue + PDF rendering is deferred to Epic 4 INV per DL-019;
 *     Task A10 wires the pg-boss boot.
 */

import { sql, and, eq, gte, lte, desc, lt, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { BrandedDb } from '../db/branded-db.js';
import { auditLog, type AuditLogRow } from '../db/schema/audit.js';
import { users } from '../db/schema/auth.js';
import { ValidationError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditScopeKind = 'unrestricted' | 'brand' | 'cluster' | 'own';

export interface AuditScope {
  kind: AuditScopeKind;
  /** Required when kind='own'. Ignored otherwise. */
  currentUserId?: string;
  /**
   * Required when kind='cluster'. The viewer's cluster id. The query joins
   * audit_log → users on actor_user_id and filters users.cluster_id = this.
   */
  currentUserClusterId?: string;
}

export interface AuditFilters {
  entityType?: string;
  entityRef?: string;
  actorUserId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  scope?: AuditScope;
}

export interface ListEventsInput {
  filters?: AuditFilters;
  limit?: number;
  /** Cursor: stringified `<occurred_at_iso>|<id>` returned by previous page. */
  cursor?: string | null;
}

export interface ListEventsResult {
  items: AuditLogRow[];
  nextCursor: string | null;
}

export interface EntityTimelineInput {
  entityType: string;
  entityRef: string;
}

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportSliceInput {
  filters?: AuditFilters;
  format: ExportFormat;
}

export type ExportSliceResult =
  | { format: 'csv' | 'excel'; data: string }
  | { format: 'pdf'; jobId: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const MAX_EXPORT_ROWS = 50_000;

function encodeCursor(occurredAt: Date, id: string): string {
  return `${occurredAt.toISOString()}|${id}`;
}

function decodeCursor(cursor: string | null | undefined): { occurredAt: Date; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf('|');
  if (idx < 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || id.length === 0) return null;
  return { occurredAt: d, id };
}

/** RFC-4180 single-field escape — quote if contains `,` `"` `\n` `\r`. */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const CSV_HEADER = [
  'id',
  'brand_id',
  'occurred_at',
  'actor_user_id',
  'table_name',
  'row_id',
  'action',
  'changed_fields',
  'reason',
  'trn_reference',
  'context',
  'before',
  'after',
] as const;

function rowsToCsv(rows: AuditLogRow[]): string {
  const lines: string[] = [];
  // BOM for Excel UTF-8 compatibility.
  lines.push('﻿' + CSV_HEADER.join(','));
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.brandId,
        r.occurredAt instanceof Date ? r.occurredAt.toISOString() : r.occurredAt,
        r.actorUserId ?? '',
        r.tableName,
        r.rowId,
        r.action,
        r.changedFields,
        r.reason ?? '',
        r.trnReference ?? '',
        r.context,
        r.before,
        r.after,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// auditService
// ---------------------------------------------------------------------------

export const auditService = {
  /**
   * List audit_log rows for the current brand, optionally filtered, with
   * cursor pagination on (occurred_at DESC, id DESC).
   *
   * Scope filtering:
   *   - 'unrestricted' / 'brand' / undefined → brand_id filter only.
   *   - 'cluster' → JOIN users ON actor_user_id; filter users.cluster_id.
   *   - 'own'     → actor_user_id = currentUserId.
   */
  async listEvents(db: BrandedDb, input: ListEventsInput): Promise<ListEventsResult> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const filters = input.filters ?? {};
    const decoded = decodeCursor(input.cursor);

    const rows = await runQuery(db, filters, decoded, limit + 1);

    let items = rows;
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const last = items[items.length - 1]!;
      const occurredAt = last.occurredAt instanceof Date ? last.occurredAt : new Date(last.occurredAt as unknown as string);
      nextCursor = encodeCursor(occurredAt, last.id);
    }

    return { items, nextCursor };
  },

  /**
   * Chronological audit rows for one entity. Used by SI-INF-006 (entity
   * timeline embed on USR-002 view-mode per DL-038).
   *
   * Matches when `table_name = entityType` AND
   * (`trn_reference = entityRef` OR `row_id = entityRef`). The OR covers two
   * audit-write conventions in the codebase: TRN-bearing service mutations
   * record `trn_reference`, while plain CRUD records `row_id`.
   */
  async getEntityTimeline(
    db: BrandedDb,
    input: EntityTimelineInput,
  ): Promise<AuditLogRow[]> {
    const rows = (await db.scopedFrom(
      auditLog,
      and(
        eq(auditLog.tableName, input.entityType),
        or(eq(auditLog.trnReference, input.entityRef), eq(auditLog.rowId, input.entityRef)),
      ),
    )) as unknown as AuditLogRow[];

    rows.sort((a, b) => {
      const at = a.occurredAt instanceof Date ? a.occurredAt.getTime() : new Date(a.occurredAt as unknown as string).getTime();
      const bt = b.occurredAt instanceof Date ? b.occurredAt.getTime() : new Date(b.occurredAt as unknown as string).getTime();
      return at - bt;
    });

    return rows;
  },

  /**
   * Export a slice of audit_log filtered by `filters`.
   *
   * - `csv` / `excel` → synchronous: fetch rows (cap MAX_EXPORT_ROWS),
   *   build CSV-with-BOM, return as string. Excel-as-CSV is acceptable per
   *   the inventory Tier 2 acceptance for SI-INF-005; a real .xlsx
   *   binary path is post-MVP.
   * - `pdf` → stub: returns `{ format: 'pdf', jobId: 'pending-<uuid>' }`.
   *   Real pg-boss enqueue + PDF rendering is deferred to Epic 4 INV per
   *   DL-019. Task A10 wires the pg-boss boot.
   */
  async exportSlice(db: BrandedDb, input: ExportSliceInput): Promise<ExportSliceResult> {
    if (input.format === 'pdf') {
      // TODO Task A10 + Epic 4 INV (DL-019): enqueue pg-boss job
      // 'audit_export_pdf' with payload { brandId: db.brandId, filters }.
      return { format: 'pdf', jobId: `pending-${randomUUID()}` };
    }

    const filters = input.filters ?? {};
    const rows = await runQuery(db, filters, null, MAX_EXPORT_ROWS);
    const csv = rowsToCsv(rows);

    if (input.format === 'csv') return { format: 'csv', data: csv };
    if (input.format === 'excel') return { format: 'excel', data: csv };

    // exhaustiveness guard
    throw new ValidationError({
      code: 'audit.invalid_export_format',
      message: `Unsupported export format: "${String((input as { format: string }).format)}"`,
    });
  },
};

// ---------------------------------------------------------------------------
// Shared query runner (used by listEvents + exportSlice CSV path)
// ---------------------------------------------------------------------------

async function runQuery(
  db: BrandedDb,
  filters: AuditFilters,
  cursor: { occurredAt: Date; id: string } | null,
  limit: number,
): Promise<AuditLogRow[]> {
  // Scope handling. Cluster scope needs a JOIN, so it takes a different path.
  const scope = filters.scope;

  if (scope?.kind === 'cluster') {
    if (!scope.currentUserClusterId) {
      throw new ValidationError({
        code: 'audit.scope_missing_cluster',
        message: "scope.kind='cluster' requires currentUserClusterId",
      });
    }
    const conds = baseConditions(db.brandId, filters);
    conds.push(eq(users.clusterId, scope.currentUserClusterId));
    if (cursor) conds.push(cursorCond(cursor));

    const rows = await db.raw
      .select({
        id: auditLog.id,
        brandId: auditLog.brandId,
        occurredAt: auditLog.occurredAt,
        actorUserId: auditLog.actorUserId,
        tableName: auditLog.tableName,
        rowId: auditLog.rowId,
        action: auditLog.action,
        changedFields: auditLog.changedFields,
        before: auditLog.before,
        after: auditLog.after,
        reason: auditLog.reason,
        trnReference: auditLog.trnReference,
        context: auditLog.context,
        createdAt: auditLog.createdAt,
        updatedAt: auditLog.updatedAt,
        createdBy: auditLog.createdBy,
        updatedBy: auditLog.updatedBy,
      })
      .from(auditLog)
      .innerJoin(users, eq(users.id, auditLog.actorUserId))
      .where(and(...conds))
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
      .limit(limit);

    return rows as unknown as AuditLogRow[];
  }

  // Non-cluster paths use scopedFrom (single-table query).
  const conds = baseConditions(db.brandId, filters);
  if (scope?.kind === 'own') {
    if (!scope.currentUserId) {
      throw new ValidationError({
        code: 'audit.scope_missing_user',
        message: "scope.kind='own' requires currentUserId",
      });
    }
    conds.push(eq(auditLog.actorUserId, scope.currentUserId));
  }
  // 'brand' / 'unrestricted' / undefined: brand_id filter is already applied
  // by scopedFrom; no additional condition.

  if (cursor) conds.push(cursorCond(cursor));

  // Drop the redundant brand condition (scopedFrom adds it). baseConditions
  // doesn't include it.
  const rows = (await db
    .scopedFrom(auditLog, conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(limit)) as unknown as AuditLogRow[];

  return rows;
}

function baseConditions(brandId: string, filters: AuditFilters) {
  const conds: ReturnType<typeof eq>[] = [];
  // Defense-in-depth: explicit brand_id filter. The non-cluster paths use
  // scopedFrom which already injects this; the cluster path (innerJoin users)
  // bypasses scopedFrom and depends on this filter to prevent cross-brand
  // leakage when RLS is bypassed (superuser local dev / service-role Mumbai).
  conds.push(eq(auditLog.brandId, brandId));
  if (filters.entityType) conds.push(eq(auditLog.tableName, filters.entityType));
  if (filters.entityRef) {
    // Match either trn_reference OR row_id (same convention as getEntityTimeline).
    const orCond = or(
      eq(auditLog.trnReference, filters.entityRef),
      eq(auditLog.rowId, filters.entityRef),
    )!;
    conds.push(orCond as unknown as ReturnType<typeof eq>);
  }
  if (filters.actorUserId) conds.push(eq(auditLog.actorUserId, filters.actorUserId));
  if (filters.action) conds.push(eq(auditLog.action, filters.action));
  if (filters.startDate) conds.push(gte(auditLog.occurredAt, filters.startDate) as unknown as ReturnType<typeof eq>);
  if (filters.endDate) conds.push(lte(auditLog.occurredAt, filters.endDate) as unknown as ReturnType<typeof eq>);
  return conds;
}

function cursorCond(cursor: { occurredAt: Date; id: string }): ReturnType<typeof eq> {
  // Strict (occurredAt, id) < (cursor.occurredAt, cursor.id) for newest-first paging.
  return or(
    lt(auditLog.occurredAt, cursor.occurredAt),
    and(eq(auditLog.occurredAt, cursor.occurredAt), lt(auditLog.id, cursor.id))!,
  )! as unknown as ReturnType<typeof eq>;
}

// Re-export the row type for ergonomic consumer imports.
export type { AuditLogRow };
