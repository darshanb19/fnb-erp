/**
 * approval-escalation — Phase 4 Epic 3 INF Arc (a) Task A10.
 *
 * pg-boss queue + handler that escalates a pending approval step when its
 * step-level `escalationTimeoutMinutes` elapses without a decision.
 *
 * Wiring:
 *   - approvalEngine.{createApprovalRequest, decide} call `scheduleEscalation`
 *     post-commit on every step insert. The engine looks up the active boss
 *     instance via `getBossInstance()` (jobs/index.ts) and silently no-ops in
 *     the test environment where `startJobs()` was never called.
 *   - pg-boss fires `handleEscalation` after `startAfter` seconds.
 *
 * Handler semantics (matches DL-016 status-guarded UPDATE pattern):
 *   - If `fallbackDelegateUserId` is null → no-op (original approver retains
 *     responsibility; escalation is informational only). The step row is left
 *     untouched.
 *   - Otherwise:
 *     1. Status-guarded UPDATE on the step row: only proceed when decision
 *        is still 'pending'. Concurrent caller decision wins; escalation
 *        no-ops cleanly.
 *     2. Open a NEW step row at the SAME stepIndex with the fallback as
 *        approver and decision='pending'.
 *     3. Insert a notification of type 'approval.escalated' to the fallback.
 *     4. Audit row written for both the UPDATE and the new INSERT.
 *
 * Out-of-request execution:
 *   The handler runs OUTSIDE Express. There is no req.user / BrandedDb in
 *   scope. We use unscopedDb() inside a transaction with explicit brand_id
 *   guards in every WHERE clause (defense-in-depth: the handler is service-
 *   role-equivalent, but RLS-style scoping in SQL is the project invariant).
 *   For the notification, we synthesise a brandedDb(brandId) scoped client
 *   so the existing notificationCenter.send / auditLogService.record paths
 *   work without modification.
 */

import type { PgBoss, Job } from 'pg-boss';
import { sql } from 'drizzle-orm';
import { unscopedDb, type DrizzleClient } from '../db/client.js';
import { brandedDb } from '../db/branded-db.js';
import { notificationCenter } from '../services/notification-center.service.js';
import { auditLogService } from '../services/audit-log.service.js';

export const APPROVAL_ESCALATION_QUEUE = 'approval.escalation';

export interface ApprovalEscalationJob {
  stepId: string;
  brandId: string;
  fallbackDelegateUserId?: string | null;
}

/**
 * Enqueue an escalation job. Called by approvalEngine after every step insert.
 *
 * `startAfter` is in seconds per pg-boss v12 SendOptions; we convert from
 * minutes (the chain-step timeout unit). Zero or negative values fire
 * immediately.
 */
export async function scheduleEscalation(
  boss: PgBoss,
  args: ApprovalEscalationJob,
  timeoutMinutes: number,
): Promise<void> {
  await boss.send(APPROVAL_ESCALATION_QUEUE, args, {
    startAfter: Math.max(0, Math.floor(timeoutMinutes * 60)),
  });
}

/**
 * Internal worker body — exported separately from the pg-boss handler shape
 * so tests can call it synchronously with a hand-built `Job` shape.
 */
export async function processEscalationJob(
  data: ApprovalEscalationJob,
): Promise<void> {
  const { stepId, brandId, fallbackDelegateUserId } = data;

  if (!fallbackDelegateUserId) {
    // No fallback configured — original approver retains responsibility.
    return;
  }

  const raw = unscopedDb();

  // Single transaction: status-guarded UPDATE + new step INSERT + audit rows.
  // Notification + Realtime publish run after the txn commits.
  const result = await raw.transaction(async (tx) => {
    // Status-guarded UPDATE per DL-016. The brand_id is part of the WHERE so a
    // misrouted job can never leak across brands.
    const updated = await tx.execute(sql`
      UPDATE approval_request_steps
      SET decision = 'delegated'::approval_step_decision,
          escalated_at = NOW(),
          escalation_target_user_id = ${fallbackDelegateUserId},
          updated_at = NOW()
      WHERE id = ${stepId}
        AND brand_id = ${brandId}
        AND decision = 'pending'
      RETURNING id,
                request_id      AS "requestId",
                step_index      AS "stepIndex",
                approver_user_id AS "approverUserId"
    `);
    const updatedRows = updated as unknown as Array<{
      id: string;
      requestId: string;
      stepIndex: number;
      approverUserId: string;
    }>;
    if (updatedRows.length === 0) {
      // Step already decided / delegated by a concurrent caller — escalation no-ops.
      return null;
    }
    const oldStep = updatedRows[0]!;

    // Open the new step row at the SAME stepIndex with the fallback as approver.
    const inserted = await tx.execute(sql`
      INSERT INTO approval_request_steps (
        brand_id, request_id, step_index, approver_user_id, decision
      ) VALUES (
        ${brandId}, ${oldStep.requestId}, ${oldStep.stepIndex},
        ${fallbackDelegateUserId}, 'pending'::approval_step_decision
      )
      RETURNING id,
                request_id       AS "requestId",
                step_index       AS "stepIndex",
                approver_user_id AS "approverUserId"
    `);
    const insertedRows = inserted as unknown as Array<{
      id: string;
      requestId: string;
      stepIndex: number;
      approverUserId: string;
    }>;
    const newStep = insertedRows[0]!;

    // Audit rows. The handler has no Express-supplied actor, so audit rows
    // record `actor_user_id = null` (system action). We piggy-back on the
    // existing auditLogService by synthesising a tx-scoped BrandedDb that
    // shares the transaction client.
    // The Drizzle PgTransaction structurally satisfies DrizzleClient — same
    // bridge cast withTransaction uses internally.
    const txBranded = brandedDb(brandId, {
      underlyingClient: tx as unknown as DrizzleClient,
    });

    await auditLogService.record(txBranded, {
      action: 'business_action',
      tableName: 'approval_request_steps',
      rowId: oldStep.id,
      actorUserId: null,
      changedFields: ['decision', 'escalatedAt', 'escalationTargetUserId'],
      reason: 'auto_escalation_timeout',
      context: {
        event: 'escalate_step',
        stepIndex: oldStep.stepIndex,
        fromUserId: oldStep.approverUserId,
        toUserId: fallbackDelegateUserId,
        requestId: oldStep.requestId,
      },
    });

    await auditLogService.record(txBranded, {
      action: 'insert',
      tableName: 'approval_request_steps',
      rowId: newStep.id,
      actorUserId: null,
      after: newStep as unknown as Record<string, unknown>,
      reason: 'auto_escalation_timeout',
      context: {
        event: 'escalate_step_open',
        stepIndex: newStep.stepIndex,
        delegateFrom: oldStep.approverUserId,
      },
    });

    return { oldStep, newStep };
  });

  if (!result) return;

  // Post-commit notify the fallback delegate. notificationCenter.send creates
  // its own brandedDb-scoped row and Realtime-publishes.
  const postCommitDb = brandedDb(brandId);
  await notificationCenter.send(postCommitDb, {
    userId: fallbackDelegateUserId,
    type: 'approval.escalated',
    payload: {
      requestId: result.oldStep.requestId,
      stepIndex: result.oldStep.stepIndex,
      escalatedFromUserId: result.oldStep.approverUserId,
    },
  });
}

/**
 * pg-boss v12 work handler: receives Job<T>[] (batch).
 *
 * If any job in the batch throws, the entire batch is retried by pg-boss.
 * The status-guarded UPDATE in processEscalationJob makes this idempotent:
 * a re-run on an already-delegated step finds zero rows via the WHERE
 * decision='pending' guard and bails. The notification, however, is NOT
 * idempotent — a retry produces a duplicate `approval.escalated` notification
 * to the fallback. This is acceptable known-minor on transient retries.
 */
export async function handleEscalation(
  jobs: Job<ApprovalEscalationJob>[],
): Promise<void> {
  for (const job of jobs) {
    await processEscalationJob(job.data);
  }
}
