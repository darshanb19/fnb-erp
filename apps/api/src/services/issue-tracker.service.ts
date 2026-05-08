/**
 * issueTrackerService — Phase 4 Epic 3 INF Arc (a) Task A9.
 *
 * Issue Tracker per FR22 — ticket CRUD with status transitions, comment thread,
 * file attachments. Produces realtime updates on channel #5 and notifications
 * via notificationCenter.
 *
 * Service-shape conventions (mirrors approvalEngine / notificationCenter):
 *   - Methods take `(db: BrandedDb, input, opts)`. brandId injected via db.
 *   - Mutations wrap in `withTransaction` so audit + business INSERTs commit
 *     atomically.
 *   - Status-guarded UPDATEs (DL-016) on every status transition.
 *   - Reason codes optional on update; the param is plumbed through to audit.
 *
 * Status-transition matrix (DL-016 + spec §4 Task A6 Definition of Done):
 *   open         → in_progress | pending_info | resolved
 *   in_progress  → pending_info | resolved | open
 *   pending_info → in_progress | resolved | open
 *   resolved     → closed (originator OR brand_owner only) | open
 *   closed       → open (reopen)
 * All other transitions → ValidationError.
 *
 * Realtime publish (channel #5) fires AFTER commit. Comment fan-out resolves
 * recipients via DISTINCT(assignee + originator + every prior commenter)
 * MINUS the author, both on `issue_tickets` and `issue_ticket_comments` —
 * both queries are brand-scoped (defense-in-depth even though FK + RLS already
 * isolate).
 *
 * Reference (`ISS-YYYY-SEQ`): generated via the Postgres function
 * `issue_ticket_next_reference(brand_id, year)` from migration 0009. The
 * function CREATEs the per-(brand, year) sequence on first use and uses
 * `nextval` thereafter — cross-process safe.
 *
 * Attachments use signed URLs from `storage/signed-url.ts` (DL-017). MIME
 * allowlist + 10 MB size cap enforced before issuing the upload URL.
 */

import { sql, eq, and, asc, desc, lt, or } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { notificationCenter } from './notification-center.service.js';
import { publishIssueTicketUpdate } from '../realtime/publishers.js';
import { getSignedUploadUrl, getSignedDownloadUrl } from '../storage/signed-url.js';
import {
  issueTickets,
  issueTicketComments,
  issueTicketAttachments,
  type IssueTicket,
  type IssueTicketComment,
  type IssueTicketAttachment,
  type IssuePriority,
  type IssueStatus,
} from '../db/schema/issue-tickets.js';
import { users } from '../db/schema/auth.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTicketInput {
  originatorUserId: string;
  title: string;
  description: string;
  priority?: IssuePriority;
  assigneeUserId?: string;
  linkedEntityType?: string;
  linkedEntityRef?: string;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  /** null clears the assignee. */
  assigneeUserId?: string | null;
  linkedEntityType?: string | null;
  linkedEntityRef?: string | null;
}

export interface CommentInput {
  ticketId: string;
  authorUserId: string;
  body: string;
}

export interface RequestAttachmentUploadInput {
  ticketId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: string;
}

export interface ConfirmAttachmentInput {
  ticketId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: string;
}

export type TicketListScope =
  | { kind: 'brand' }
  | { kind: 'cluster'; clusterId: string }
  | { kind: 'location'; locationId: string }
  | { kind: 'own'; userId: string };

export interface TicketListInput {
  scope: TicketListScope;
  filters?: {
    status?: IssueStatus;
    priority?: IssuePriority;
    assigneeUserId?: string;
  };
  limit?: number;
  cursor?: string | null;
}

export interface TicketListResult {
  items: IssueTicket[];
  nextCursor: string | null;
}

export interface TicketDetail {
  ticket: IssueTicket;
  comments: IssueTicketComment[];
  attachments: IssueTicketAttachment[];
}

export interface AttachmentDownloadInput {
  ticketId: string;
  attachmentId: string;
}

export interface AttachmentDownloadResult {
  url: string;
  expiresAt: Date;
  filename: string;
  mimeType: string;
}

interface MutationOpts {
  actorUserId: string;
  reasonCode?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'text/plain',
];

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

const ALLOWED_TRANSITIONS: Record<IssueStatus, ReadonlySet<IssueStatus>> = {
  open: new Set<IssueStatus>(['in_progress', 'pending_info', 'resolved']),
  in_progress: new Set<IssueStatus>(['pending_info', 'resolved', 'open']),
  pending_info: new Set<IssueStatus>(['in_progress', 'resolved', 'open']),
  resolved: new Set<IssueStatus>(['closed', 'open']),
  closed: new Set<IssueStatus>(['open']),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_RE.test(value)) {
    throw new ValidationError({
      code: 'validation.invalid_uuid',
      message: `${label} must be a UUID; got "${value}"`,
    });
  }
}

async function returning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

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

function validateTransition(from: IssueStatus, to: IssueStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.has(to)) {
    throw new ValidationError({
      code: 'issue.invalid_status_transition',
      message: `Cannot transition issue from "${from}" to "${to}"`,
    });
  }
}

async function loadTicket(db: BrandedDb, ticketId: string): Promise<IssueTicket> {
  const rows = (await db.scopedFrom(
    issueTickets,
    eq(issueTickets.id, ticketId),
  )) as unknown as IssueTicket[];
  const row = rows[0];
  if (!row) {
    throw new NotFoundError({
      code: 'not_found.issue_ticket',
      message: `Issue ticket ${ticketId} not found`,
    });
  }
  return row;
}

async function loadUserRole(db: BrandedDb, userId: string): Promise<string | null> {
  const rows = (await db.scopedFrom(users, eq(users.id, userId))) as unknown as Array<{
    role: string;
  }>;
  return rows[0]?.role ?? null;
}

// ---------------------------------------------------------------------------
// issueTrackerService
// ---------------------------------------------------------------------------

export const issueTrackerService = {
  /**
   * Create a ticket. Atomic: reference generation + ticket INSERT + audit row
   * commit together. Realtime + assignee notification fire post-commit.
   */
  async create(
    db: BrandedDb,
    input: CreateTicketInput,
    opts: MutationOpts,
  ): Promise<IssueTicket> {
    assertUuid('originatorUserId', input.originatorUserId);
    if (input.assigneeUserId !== undefined) assertUuid('assigneeUserId', input.assigneeUserId);

    const year = new Date().getFullYear();

    const ticket = await withTransaction(db, opts.actorUserId, async (tx) => {
      const refResult = await tx.raw.execute(sql`
        SELECT issue_ticket_next_reference(${tx.brandId}::uuid, ${year}::int) AS reference
      `);
      const refRows = refResult as unknown as Array<{ reference: string }>;
      const reference = refRows[0]?.reference;
      if (!reference) {
        throw new Error('issue_ticket_next_reference returned no row');
      }

      const inserted = await returning<IssueTicket>(
        tx
          .scopedInsert(issueTickets, {
            reference,
            title: input.title,
            description: input.description,
            priority: input.priority ?? 'medium',
            status: 'open',
            assigneeUserId: input.assigneeUserId ?? null,
            originatorUserId: input.originatorUserId,
            linkedEntityType: input.linkedEntityType ?? null,
            linkedEntityRef: input.linkedEntityRef ?? null,
            resolvedAt: null,
            closedAt: null,
          } as unknown as Parameters<typeof tx.scopedInsert<typeof issueTickets>>[1])
          .returning(),
      );
      const row = inserted[0]!;

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'issue_tickets',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as unknown as Record<string, unknown>,
        trnReference: row.reference,
        reason: opts.reasonCode ?? null,
        context: { event: 'create_ticket' },
      });

      return row;
    });

    // Post-commit notify + realtime.
    if (ticket.assigneeUserId && ticket.assigneeUserId !== opts.actorUserId) {
      await notificationCenter.send(db, {
        userId: ticket.assigneeUserId,
        type: 'issue.assigned',
        payload: {
          ticketId: ticket.id,
          reference: ticket.reference,
          title: ticket.title,
        },
      });
    }

    await publishIssueTicketUpdate({
      ticketId: ticket.id,
      eventType: ticket.assigneeUserId ? 'assignment' : 'status',
      brandId: db.brandId,
    });

    return ticket;
  },

  /**
   * Update a ticket. Status-guarded UPDATE per DL-016 protects status field.
   * Resolved → closed restricted to ticket originator OR brand_owner.
   *
   * Notifications:
   *   - Status change → status_changed to assignee + originator (de-duped, excluding actor).
   *   - Assignee change → assigned to NEW assignee.
   */
  async update(
    db: BrandedDb,
    ticketId: string,
    changes: UpdateTicketInput,
    opts: MutationOpts,
  ): Promise<IssueTicket> {
    assertUuid('ticketId', ticketId);
    assertUuid('actorUserId', opts.actorUserId);

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await loadTicket(tx, ticketId);

      // Status transition validation BEFORE the UPDATE so the error message is precise.
      const targetStatus: IssueStatus = changes.status ?? before.status;
      if (changes.status !== undefined) {
        validateTransition(before.status, targetStatus);
        // Resolved → closed: originator OR brand_owner only.
        if (before.status === 'resolved' && targetStatus === 'closed') {
          if (opts.actorUserId !== before.originatorUserId) {
            const role = await loadUserRole(tx, opts.actorUserId);
            if (role !== 'brand_owner') {
              throw new ValidationError({
                code: 'issue.close_forbidden',
                message:
                  'Only the ticket originator or a brand_owner may close a resolved ticket',
              });
            }
          }
        }
      }

      // Build UPDATE values. Resolved/closed timestamp stamps on transition.
      const updateValues: Record<string, unknown> = {};
      if (changes.title !== undefined) updateValues['title'] = changes.title;
      if (changes.description !== undefined) updateValues['description'] = changes.description;
      if (changes.priority !== undefined) updateValues['priority'] = changes.priority;
      if (changes.status !== undefined) {
        updateValues['status'] = changes.status;
        if (changes.status === 'resolved' && before.status !== 'resolved') {
          updateValues['resolvedAt'] = new Date();
        }
        if (changes.status === 'closed' && before.status !== 'closed') {
          updateValues['closedAt'] = new Date();
        }
      }
      if (changes.assigneeUserId !== undefined) updateValues['assigneeUserId'] = changes.assigneeUserId;
      if (changes.linkedEntityType !== undefined) updateValues['linkedEntityType'] = changes.linkedEntityType;
      if (changes.linkedEntityRef !== undefined) updateValues['linkedEntityRef'] = changes.linkedEntityRef;

      if (Object.keys(updateValues).length === 0) {
        // No-op update; return the row unchanged.
        return { before, after: before, statusChanged: false, assigneeChanged: false };
      }

      // Status-guarded UPDATE: include `status = before.status` in the WHERE so a
      // concurrent transition is caught here (DL-016).
      const updatedRows = await tx
        .scopedUpdate(issueTickets)
        .set(updateValues as Parameters<ReturnType<typeof tx.scopedUpdate>['set']>[0])
        .where(and(eq(issueTickets.id, ticketId), eq(issueTickets.status, before.status))!)
        .returning();
      const after = (updatedRows as unknown as IssueTicket[])[0];
      if (!after) {
        throw new ValidationError({
          code: 'issue.concurrent_update',
          message: 'Ticket was modified concurrently; please retry',
        });
      }

      const changedFields = auditLogService.computeChangedFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'issue_tickets',
        rowId: after.id,
        actorUserId: opts.actorUserId,
        before: before as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        changedFields,
        reason: opts.reasonCode ?? null,
        trnReference: after.reference,
        context: { event: 'update_ticket' },
      });

      return {
        before,
        after,
        statusChanged: changes.status !== undefined && changes.status !== before.status,
        assigneeChanged:
          changes.assigneeUserId !== undefined && changes.assigneeUserId !== before.assigneeUserId,
      };
    });

    // Post-commit notifications + realtime.
    const { before, after, statusChanged, assigneeChanged } = result;

    if (statusChanged) {
      const recipients = new Set<string>();
      if (after.assigneeUserId) recipients.add(after.assigneeUserId);
      recipients.add(after.originatorUserId);
      recipients.delete(opts.actorUserId);
      for (const userId of recipients) {
        await notificationCenter.send(db, {
          userId,
          type: 'issue.status_changed',
          payload: {
            ticketId: after.id,
            reference: after.reference,
            fromStatus: before.status,
            toStatus: after.status,
          },
        });
      }
    }

    if (assigneeChanged && after.assigneeUserId && after.assigneeUserId !== opts.actorUserId) {
      await notificationCenter.send(db, {
        userId: after.assigneeUserId,
        type: 'issue.assigned',
        payload: {
          ticketId: after.id,
          reference: after.reference,
          title: after.title,
        },
      });
    }

    if (statusChanged || assigneeChanged) {
      await publishIssueTicketUpdate({
        ticketId: after.id,
        eventType: statusChanged ? 'status' : 'assignment',
        brandId: db.brandId,
      });
    }

    return after;
  },

  /**
   * Append a comment to a ticket. Fan-out notifies assignee + originator +
   * every prior commenter (de-duped) MINUS the author.
   */
  async comment(
    db: BrandedDb,
    input: CommentInput,
    opts: MutationOpts,
  ): Promise<IssueTicketComment> {
    assertUuid('ticketId', input.ticketId);
    assertUuid('authorUserId', input.authorUserId);
    if (!input.body || input.body.trim().length === 0) {
      throw new ValidationError({
        code: 'issue.comment_body_required',
        message: 'Comment body cannot be empty',
      });
    }

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      // Verify the ticket exists in this brand. loadTicket throws NotFoundError otherwise.
      const ticket = await loadTicket(tx, input.ticketId);

      const inserted = await returning<IssueTicketComment>(
        tx
          .scopedInsert(issueTicketComments, {
            ticketId: input.ticketId,
            authorUserId: input.authorUserId,
            body: input.body,
          } as unknown as Parameters<typeof tx.scopedInsert<typeof issueTicketComments>>[1])
          .returning(),
      );
      const comment = inserted[0]!;

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'issue_ticket_comments',
        rowId: comment.id,
        actorUserId: opts.actorUserId,
        after: comment as unknown as Record<string, unknown>,
        trnReference: ticket.reference,
        context: { event: 'create_comment', ticketId: input.ticketId },
      });

      // Resolve recipient set inside the txn so the audit row + the recipient
      // computation see a consistent snapshot. Exclude the author (who just
      // commented) and any nulls.
      const recipientResult = await tx.raw.execute(sql`
        SELECT DISTINCT user_id FROM (
          SELECT assignee_user_id  AS user_id FROM issue_tickets         WHERE id = ${input.ticketId} AND brand_id = ${tx.brandId}
          UNION
          SELECT originator_user_id           FROM issue_tickets         WHERE id = ${input.ticketId} AND brand_id = ${tx.brandId}
          UNION
          SELECT author_user_id               FROM issue_ticket_comments WHERE ticket_id = ${input.ticketId} AND brand_id = ${tx.brandId}
        ) recipients
        WHERE user_id IS NOT NULL AND user_id != ${input.authorUserId}::uuid
      `);
      const recipientRows = recipientResult as unknown as Array<{ user_id: string }>;
      const recipients = recipientRows.map((r) => r.user_id);

      return { comment, ticket, recipients };
    });

    // Post-commit fan-out + realtime.
    for (const userId of result.recipients) {
      await notificationCenter.send(db, {
        userId,
        type: 'issue.commented',
        payload: {
          ticketId: input.ticketId,
          reference: result.ticket.reference,
          body: input.body.slice(0, 200),
        },
      });
    }

    await publishIssueTicketUpdate({
      ticketId: input.ticketId,
      eventType: 'comment',
      brandId: db.brandId,
    });

    return result.comment;
  },

  /**
   * Validate the proposed attachment + issue a signed upload URL. The browser
   * uploads direct-to-Storage and then calls confirmAttachment to record the
   * row (two-step flow per DL-017).
   */
  async requestAttachmentUpload(
    db: BrandedDb,
    input: RequestAttachmentUploadInput,
  ): Promise<{ uploadUrl: string; storagePath: string; expiresAt: Date }> {
    assertUuid('ticketId', input.ticketId);
    assertUuid('uploaderUserId', input.uploaderUserId);

    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new ValidationError({
        code: 'issue.attachment_mime_disallowed',
        message: `MIME type "${input.mimeType}" is not allowed for issue attachments`,
      });
    }
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new ValidationError({
        code: 'issue.attachment_size_invalid',
        message: 'sizeBytes must be a positive number',
      });
    }
    if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError({
        code: 'issue.attachment_size_exceeded',
        message: `Attachment size ${input.sizeBytes} bytes exceeds the 10 MB limit`,
      });
    }

    // Verify the ticket exists in this brand before issuing a URL. Cross-brand
    // lookups are blocked here so an attacker can't probe by guessing UUIDs.
    await loadTicket(db, input.ticketId);

    const signed = await getSignedUploadUrl({
      brandId: db.brandId,
      entityType: 'issue-tickets',
      entityId: input.ticketId,
      filename: input.filename,
    });

    return {
      uploadUrl: signed.url,
      storagePath: signed.storagePath,
      expiresAt: signed.expiresAt,
    };
  },

  /**
   * Record the attachment row after the browser successfully PUT the file.
   * Audit + realtime publish; no notification in MVP (low signal-to-noise).
   */
  async confirmAttachment(
    db: BrandedDb,
    input: ConfirmAttachmentInput,
    opts: MutationOpts,
  ): Promise<IssueTicketAttachment> {
    assertUuid('ticketId', input.ticketId);
    assertUuid('uploaderUserId', input.uploaderUserId);

    const attachment = await withTransaction(db, opts.actorUserId, async (tx) => {
      const ticket = await loadTicket(tx, input.ticketId);

      const inserted = await returning<IssueTicketAttachment>(
        tx
          .scopedInsert(issueTicketAttachments, {
            ticketId: input.ticketId,
            storagePath: input.storagePath,
            filename: input.filename,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            uploadedByUserId: input.uploaderUserId,
          } as unknown as Parameters<typeof tx.scopedInsert<typeof issueTicketAttachments>>[1])
          .returning(),
      );
      const row = inserted[0]!;

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'issue_ticket_attachments',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as unknown as Record<string, unknown>,
        trnReference: ticket.reference,
        context: { event: 'create_attachment', ticketId: input.ticketId },
      });

      return row;
    });

    await publishIssueTicketUpdate({
      ticketId: input.ticketId,
      eventType: 'attachment',
      brandId: db.brandId,
    });

    return attachment;
  },

  /**
   * List tickets visible to the caller. Scope rules:
   *   - 'brand'    → all tickets in this brand (BO).
   *   - 'cluster'  → tickets where assignee or originator belongs to the cluster.
   *   - 'location' → tickets where assignee or originator works at the location.
   *   - 'own'      → tickets where the user is assignee or originator.
   * Cursor pagination on (createdAt, id) DESC.
   */
  async list(db: BrandedDb, input: TicketListInput): Promise<TicketListResult> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const decoded = decodeCursor(input.cursor);
    const filters = input.filters ?? {};

    const conds: ReturnType<typeof eq>[] = [eq(issueTickets.brandId, db.brandId)];
    if (filters.status) conds.push(eq(issueTickets.status, filters.status));
    if (filters.priority) conds.push(eq(issueTickets.priority, filters.priority));
    if (filters.assigneeUserId) conds.push(eq(issueTickets.assigneeUserId, filters.assigneeUserId));
    if (decoded) {
      conds.push(
        or(
          lt(issueTickets.createdAt, decoded.createdAt),
          and(eq(issueTickets.createdAt, decoded.createdAt), lt(issueTickets.id, decoded.id))!,
        )! as unknown as ReturnType<typeof eq>,
      );
    }

    let rows: IssueTicket[];

    if (input.scope.kind === 'own') {
      const userId = input.scope.userId;
      conds.push(
        or(
          eq(issueTickets.assigneeUserId, userId),
          eq(issueTickets.originatorUserId, userId),
        )! as unknown as ReturnType<typeof eq>,
      );
      rows = (await db.raw
        .select()
        .from(issueTickets)
        .where(and(...conds))
        .orderBy(desc(issueTickets.createdAt), desc(issueTickets.id))
        .limit(limit + 1)) as unknown as IssueTicket[];
    } else if (input.scope.kind === 'brand') {
      rows = (await db.raw
        .select()
        .from(issueTickets)
        .where(and(...conds))
        .orderBy(desc(issueTickets.createdAt), desc(issueTickets.id))
        .limit(limit + 1)) as unknown as IssueTicket[];
    } else {
      // cluster | location: JOIN users twice (assignee + originator) and
      // accept rows where EITHER user matches the scope value. Implemented
      // via two LEFT JOINs + OR predicate in the WHERE clause.
      const scopeKind = input.scope.kind;
      const scopeValue =
        scopeKind === 'cluster' ? input.scope.clusterId : input.scope.locationId;
      const userColumn = scopeKind === 'cluster' ? 'cluster_id' : 'location_id';

      // Drizzle's chainable join+filter API gets verbose for two LEFT JOINs
      // with aliases AND a conditional column-name in the join predicate
      // (cluster_id vs location_id). Filter clauses are inlined as raw sql
      // fragments below for legibility — `conds` (the Drizzle predicate) is
      // unused on this code path.
      const filterSql = filters.status
        ? sql`AND it.status = ${filters.status}::issue_status `
        : sql``;
      const filterPriorSql = filters.priority
        ? sql`AND it.priority = ${filters.priority}::issue_priority `
        : sql``;
      const filterAssigneeSql = filters.assigneeUserId
        ? sql`AND it.assignee_user_id = ${filters.assigneeUserId} `
        : sql``;
      const cursorSql = decoded
        ? sql`AND (it.created_at < ${decoded.createdAt} OR (it.created_at = ${decoded.createdAt} AND it.id < ${decoded.id})) `
        : sql``;

      const rawQuery = sql`
        SELECT it.*
        FROM issue_tickets it
        LEFT JOIN users a ON a.id = it.assignee_user_id   AND a.brand_id = ${db.brandId}
        LEFT JOIN users o ON o.id = it.originator_user_id AND o.brand_id = ${db.brandId}
        WHERE it.brand_id = ${db.brandId}
          AND (a.${sql.raw(userColumn)} = ${scopeValue} OR o.${sql.raw(userColumn)} = ${scopeValue})
          ${filterSql}
          ${filterPriorSql}
          ${filterAssigneeSql}
          ${cursorSql}
        ORDER BY it.created_at DESC, it.id DESC
        LIMIT ${limit + 1}
      `;
      const result = await db.raw.execute(rawQuery);
      rows = mapRawIssueTickets(result as unknown as Array<Record<string, unknown>>);
    }

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
   * Fetch a ticket plus its comments + attachments. Comments ASC by created_at;
   * attachments ASC by created_at. 404 when the ticket does not exist in brand.
   */
  async get(db: BrandedDb, ticketId: string): Promise<TicketDetail> {
    assertUuid('ticketId', ticketId);
    const ticket = await loadTicket(db, ticketId);

    const comments = (await db
      .scopedFrom(issueTicketComments, eq(issueTicketComments.ticketId, ticketId))
      .orderBy(asc(issueTicketComments.createdAt))) as unknown as IssueTicketComment[];

    const attachments = (await db
      .scopedFrom(issueTicketAttachments, eq(issueTicketAttachments.ticketId, ticketId))
      .orderBy(asc(issueTicketAttachments.createdAt))) as unknown as IssueTicketAttachment[];

    return { ticket, comments, attachments };
  },

  /**
   * Issue a signed download URL for an attachment. Verifies the attachment row
   * lives in the same brand AND on the named ticket before signing.
   */
  async getAttachmentDownloadUrl(
    db: BrandedDb,
    input: AttachmentDownloadInput,
  ): Promise<AttachmentDownloadResult> {
    assertUuid('ticketId', input.ticketId);
    assertUuid('attachmentId', input.attachmentId);

    const rows = (await db.scopedFrom(
      issueTicketAttachments,
      and(
        eq(issueTicketAttachments.id, input.attachmentId),
        eq(issueTicketAttachments.ticketId, input.ticketId),
      )!,
    )) as unknown as IssueTicketAttachment[];
    const attachment = rows[0];
    if (!attachment) {
      throw new NotFoundError({
        code: 'not_found.issue_attachment',
        message: `Attachment ${input.attachmentId} not found on ticket ${input.ticketId}`,
      });
    }

    const signed = await getSignedDownloadUrl({
      brandId: db.brandId,
      storagePath: attachment.storagePath,
    });

    return {
      url: signed.url,
      expiresAt: signed.expiresAt,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    };
  },
};

// ---------------------------------------------------------------------------
// Helper: map raw `issue_tickets it.*` snake_case rows to IssueTicket camelCase
// ---------------------------------------------------------------------------

function mapRawIssueTickets(rows: Array<Record<string, unknown>>): IssueTicket[] {
  return rows.map((r) => ({
    id: r['id'] as string,
    brandId: r['brand_id'] as string,
    reference: r['reference'] as string,
    title: r['title'] as string,
    description: r['description'] as string,
    priority: r['priority'] as IssuePriority,
    status: r['status'] as IssueStatus,
    assigneeUserId: r['assignee_user_id'] as string | null,
    originatorUserId: r['originator_user_id'] as string,
    linkedEntityType: r['linked_entity_type'] as string | null,
    linkedEntityRef: r['linked_entity_ref'] as string | null,
    resolvedAt: r['resolved_at'] as Date | null,
    closedAt: r['closed_at'] as Date | null,
    createdAt: r['created_at'] as Date,
    updatedAt: r['updated_at'] as Date,
    createdBy: r['created_by'] as string | null,
    updatedBy: r['updated_by'] as string | null,
  })) as unknown as IssueTicket[];
}

export type { IssueTicket, IssueTicketComment, IssueTicketAttachment, IssueStatus, IssuePriority };
