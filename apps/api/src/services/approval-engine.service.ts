/**
 * approvalEngine — Phase 4 Epic 3 INF Arc (a) Task A7.
 *
 * Routes approval requests through configurable per-brand chains (FR16, DL-036)
 * and decides / delegates / lists pending steps for approvers.
 *
 * Service-shape conventions (mirrors userService / permissionOverrideService):
 *   - Methods take `(db: BrandedDb, input, opts)`. brandId is injected via db.
 *   - Mutations wrap in `withTransaction` so audit rows commit atomically.
 *   - Status-guarded UPDATEs (DL-016) protect step transitions from races: the
 *     UPDATE ... WHERE decision = 'pending' RETURNING id pattern returns 0 rows
 *     iff a concurrent caller already decided the step.
 *   - Reason codes are mandatory on reject + delegate per FR15c-style discipline
 *     (engine-level, not just permission overrides).
 *
 * Notification dispatch:
 *   The full notificationCenter.send() lives in Task A8; until then this service
 *   imports a thin internal stub (see ./notification-center.service.ts) which
 *   inserts the row + Realtime-publishes. Once A8 lands, the stub upgrades in
 *   place and engine call sites stay unchanged.
 *
 * Escalation:
 *   pg-boss `scheduleEscalation` is wired in Task A10 — see TODO markers below.
 *
 * Realtime publishing happens AFTER the DB transaction commits (publishing
 * inside the txn risks broadcasting state subscribers can't yet see).
 */

import { sql, eq, and, asc, type SQL } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { notificationCenter } from './notification-center.service.js';
import { publishApprovalRequest } from '../realtime/publishers.js';
import {
  approvalChains,
  type ApprovalChain,
  type ApprovalChainStatus,
  type ApprovalChainEntityType,
  type ApprovalChainStep,
} from '../db/schema/approval-chains.js';
import {
  approvalRequests,
  approvalRequestSteps,
  type ApprovalRequest,
  type ApprovalRequestStep,
  type ApprovalStepDecision,
} from '../db/schema/approval-requests.js';
import { users, type UserRole } from '../db/schema/auth.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateApprovalRequestInput {
  entityType: ApprovalChainEntityType;
  entityRef: string;
  entityValue: number | null;
  requestingUserId: string;
  routingReason?: string;
  payload?: Record<string, unknown> | null;
}

export type DecisionOutcome = 'approved' | 'rejected';

export interface DecideInput {
  requestId: string;
  approverUserId: string;
  decision: DecisionOutcome;
  comment?: string | null;
  reasonCode?: string | null;
}

export interface DelegateInput {
  requestId: string;
  approverUserId: string;
  targetUserId: string;
  reasonCode: string;
  comment?: string | null;
}

export interface PendingApprovalRow {
  step: ApprovalRequestStep;
  request: ApprovalRequest;
}

export interface ApprovalStatusView {
  request: ApprovalRequest;
  steps: ApprovalRequestStep[];
}

export interface ConfigureChainInput {
  /** When set, UPDATE the chain with this id; otherwise CREATE a new chain. */
  id?: string;
  entityType: ApprovalChainEntityType;
  name: string;
  description?: string | null;
  steps: ApprovalChainStep[];
  /** Defaults to 'draft' on create. Transitions enforced on update. */
  status?: ApprovalChainStatus;
  reasonCode?: string | null;
}

export interface ListChainsOpts {
  entityType?: ApprovalChainEntityType;
  status?: ApprovalChainStatus;
}

interface MutationOpts {
  actorUserId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
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

function requireReasonCode(label: string, reasonCode: string | null | undefined): string {
  if (!reasonCode || reasonCode.trim().length === 0) {
    throw new ValidationError({
      code: 'approval.reason_code_required',
      message: `Reason code required on ${label}`,
    });
  }
  return reasonCode;
}

/**
 * Pull the steps array off a chain row (jsonb column). Stored shape matches
 * ApprovalChainStep[]; we cast through unknown because Drizzle types `steps`
 * as `unknown` when the column is jsonb without an explicit `$type<>()`.
 */
function chainSteps(chain: ApprovalChain): ApprovalChainStep[] {
  return (chain.steps as unknown as ApprovalChainStep[]) ?? [];
}

/**
 * Find the active chain whose entity_type matches AND whose step 0 value-band
 * accepts `entityValue`. Returns null if no chain qualifies.
 */
function selectChain(
  chains: ApprovalChain[],
  entityType: ApprovalChainEntityType,
  entityValue: number | null,
): ApprovalChain | null {
  for (const chain of chains) {
    if (chain.entityType !== entityType) continue;
    if (chain.status !== 'active') continue;
    const steps = chainSteps(chain);
    const step0 = steps[0];
    if (!step0) continue;
    if (entityValue !== null) {
      if (step0.valueBandMin !== undefined && entityValue < step0.valueBandMin) continue;
      if (step0.valueBandMax !== undefined && entityValue > step0.valueBandMax) continue;
    } else {
      // Non-monetary entities only match chains whose step 0 has no value band.
      if (step0.valueBandMin !== undefined || step0.valueBandMax !== undefined) continue;
    }
    return chain;
  }
  return null;
}

/**
 * Resolve an approver user by role within the brand.
 *
 * Picks the earliest-created active user whose role matches (effectively
 * `ORDER BY created_at ASC LIMIT 1`). Brands typically have one user per
 * BO/Cluster Manager seat at MVP scale; tie-breaking by created_at ASC is
 * stable and deterministic.
 *
 * TODO (post-MVP): when a brand grows multiple users sharing a role (e.g.
 * several Cluster Managers), this silently routes 100% of requests to the
 * oldest seat. Options to consider:
 *   - Round-robin / least-loaded assignment based on outstanding pending steps.
 *   - Surface a warning at chain-configure time when `> 1 active user with role`
 *     and let the BO designate a primary, or fan-out via approval groups.
 *   - Per-step approver lists rather than a single role string.
 * For MVP single-tenant scale this is sufficient and explicit.
 *
 * Throws NotFoundError if no active user with the role exists in the brand.
 */
async function resolveApproverByRole(
  db: BrandedDb,
  role: string,
): Promise<string> {
  const rows = await db.scopedFrom(
    users,
    and(eq(users.role, role as UserRole), eq(users.active, true)),
  ) as unknown as { id: string; createdAt: Date }[];
  if (rows.length === 0) {
    throw new NotFoundError({
      code: 'approval.no_approver_for_role',
      message: `No active user with role "${role}" in brand ${db.brandId} to receive approval`,
    });
  }
  // Earliest created first. See post-MVP TODO above re: multi-seat handling.
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return rows[0]!.id;
}

/**
 * Compose a human-readable routing reason when the caller didn't supply one.
 */
function defaultRoutingReason(
  entityType: ApprovalChainEntityType,
  entityValue: number | null,
  step0Role: string,
): string {
  if (entityValue !== null) {
    return `${entityType} value ${entityValue} → ${step0Role}`;
  }
  return `${entityType} → ${step0Role}`;
}

async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

// ---------------------------------------------------------------------------
// approvalEngine
// ---------------------------------------------------------------------------

export const approvalEngine = {
  /**
   * Create an approval request and route step 0.
   *
   * Side effects (atomic in a single transaction):
   *   - INSERT approval_requests (status='pending', currentStep=0)
   *   - INSERT approval_request_steps (stepIndex=0, decision='pending', approver=role-resolved user)
   *   - audit_log row for the request insert
   *
   * Post-transaction:
   *   - Notify the step-0 approver (approval.requested)
   *   - Realtime publish on channel #1 (approval_requests)
   */
  async createApprovalRequest(
    db: BrandedDb,
    input: CreateApprovalRequestInput,
    opts: MutationOpts,
  ): Promise<ApprovalRequest> {
    assertUuid('requestingUserId', input.requestingUserId);

    // Load all chains for the brand. Selection happens in-process.
    const chains = (await db.scopedFrom(
      approvalChains,
      eq(approvalChains.entityType, input.entityType),
    )) as unknown as ApprovalChain[];

    if (chains.filter((c) => c.status === 'active').length === 0) {
      throw new ValidationError({
        code: 'approval.no_active_chain',
        message: `No active approval chain configured for entity_type "${input.entityType}"`,
      });
    }

    const chain = selectChain(chains, input.entityType, input.entityValue);
    if (!chain) {
      throw new ValidationError({
        code: 'approval.below_threshold',
        message:
          `entity_value ${input.entityValue ?? 'null'} is below threshold for any active ${input.entityType} chain`,
      });
    }

    const steps = chainSteps(chain);
    const step0 = steps[0]!;
    const approverUserId = await resolveApproverByRole(db, step0.role);

    const routingReason =
      input.routingReason ?? defaultRoutingReason(input.entityType, input.entityValue, step0.role);

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      const reqRows = await insertReturning<ApprovalRequest>(
        tx.scopedInsert(approvalRequests, {
          entityType: input.entityType,
          entityRef: input.entityRef,
          entityValue: input.entityValue !== null ? String(input.entityValue) : null,
          requestingUserId: input.requestingUserId,
          chainId: chain.id,
          currentStep: 0,
          status: 'pending',
          routingReason,
          payload: (input.payload ?? null) as unknown,
          decidedAt: null,
        } as unknown as Parameters<typeof tx.scopedInsert<typeof approvalRequests>>[1]).returning(),
      );
      const req = reqRows[0]!;

      await insertReturning<ApprovalRequestStep>(
        tx.scopedInsert(approvalRequestSteps, {
          requestId: req.id,
          stepIndex: 0,
          approverUserId,
          decision: 'pending',
        } as unknown as Parameters<typeof tx.scopedInsert<typeof approvalRequestSteps>>[1]).returning(),
      );

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'approval_requests',
        rowId: req.id,
        actorUserId: input.requestingUserId,
        after: req as unknown as Record<string, unknown>,
        trnReference: input.entityRef,
        reason: routingReason,
        context: {
          event: 'create_approval_request',
          chainId: chain.id,
          step0Role: step0.role,
          approverUserId,
        },
      });

      return { req, approverUserId };
    });

    // TODO Task A10: scheduleEscalation(result.req.id, 0, step0.escalationTimeoutMinutes)

    // Post-commit notify + publish.
    await notificationCenter.send(db, {
      userId: result.approverUserId,
      type: 'approval.requested',
      payload: {
        requestId: result.req.id,
        entityType: input.entityType,
        entityRef: input.entityRef,
        stepIndex: 0,
      },
    });

    await publishApprovalRequest({
      requestId: result.req.id,
      approverId: result.approverUserId,
      brandId: db.brandId,
      entityType: input.entityType,
    });

    return result.req;
  },

  /**
   * Decide on the current step. DL-016 status-guarded UPDATE.
   *
   * approve + more steps remain → insert next step row, advance currentStep.
   * approve + last step          → request status='approved', decidedAt=NOW.
   * reject                        → request status='rejected', decidedAt=NOW.
   * reject without reasonCode     → ValidationError.
   *
   * Post-transaction notify + publish.
   */
  async decide(
    db: BrandedDb,
    input: DecideInput,
    opts: MutationOpts,
  ): Promise<ApprovalRequest> {
    assertUuid('requestId', input.requestId);
    assertUuid('approverUserId', input.approverUserId);

    if (input.decision === 'rejected') {
      requireReasonCode('reject', input.reasonCode);
    }

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      // Load request + chain.
      const reqRows = (await tx.scopedFrom(
        approvalRequests,
        eq(approvalRequests.id, input.requestId),
      )) as unknown as ApprovalRequest[];
      const before = reqRows[0];
      if (!before) {
        throw new NotFoundError({
          code: 'not_found.approval_request',
          message: `Approval request ${input.requestId} not found`,
        });
      }
      if (before.status !== 'pending') {
        throw new ValidationError({
          code: 'approval.request_not_pending',
          message: `Cannot decide on request in status "${before.status}"`,
        });
      }

      // Status-guarded UPDATE on the current step (DL-016).
      // The guard fires zero rows iff (a) the step was already decided by a
      // concurrent caller, or (b) approverUserId mismatches the assigned
      // approver — both rejections are surfaced as ValidationError.
      const decidedAtIso = new Date().toISOString();
      const stepUpdate = await tx.raw.execute(sql`
        UPDATE approval_request_steps
        SET decision = ${input.decision}::approval_step_decision,
            decided_at = ${decidedAtIso}::timestamptz,
            comment = ${input.comment ?? null},
            updated_at = NOW()
        WHERE brand_id = ${db.brandId}
          AND request_id = ${input.requestId}
          AND step_index = ${before.currentStep}
          AND approver_user_id = ${input.approverUserId}
          AND decision = 'pending'
        RETURNING id, step_index AS "stepIndex"
      `);
      const stepUpdateRows = stepUpdate as unknown as Array<{ id: string; stepIndex: number }>;
      if (stepUpdateRows.length === 0) {
        throw new ValidationError({
          code: 'approval.step_already_decided',
          message:
            `Step ${before.currentStep} for request ${input.requestId} is not pending or you are not the assigned approver`,
        });
      }
      const decidedStepRow = stepUpdateRows[0]!;

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'approval_request_steps',
        rowId: decidedStepRow.id,
        actorUserId: input.approverUserId,
        changedFields: ['decision', 'decidedAt', 'comment'],
        reason: input.reasonCode ?? null,
        context: {
          event: 'decide_step',
          decision: input.decision,
          stepIndex: before.currentStep,
          requestId: input.requestId,
        },
      });

      // Branch on decision + remaining-steps.
      const chainRows = (await tx.scopedFrom(
        approvalChains,
        eq(approvalChains.id, before.chainId),
      )) as unknown as ApprovalChain[];
      const chain = chainRows[0]!;
      const steps = chainSteps(chain);

      let after: ApprovalRequest;
      let notifyTarget: { userId: string; type: 'approval.requested' | 'approval.decided' };

      if (input.decision === 'rejected') {
        const decidedAt = new Date(decidedAtIso);
        const rejectedRows = await tx
          .scopedUpdate(approvalRequests)
          .set({ status: 'rejected', decidedAt })
          .where(eq(approvalRequests.id, input.requestId))
          .returning();
        after = (rejectedRows as unknown as ApprovalRequest[])[0]!;

        await auditLogService.record(tx, {
          action: 'update',
          tableName: 'approval_requests',
          rowId: input.requestId,
          actorUserId: input.approverUserId,
          before: before as unknown as Record<string, unknown>,
          after: after as unknown as Record<string, unknown>,
          changedFields: ['status', 'decidedAt'],
          reason: input.reasonCode ?? null,
          context: { event: 'reject_request' },
        });

        notifyTarget = { userId: before.requestingUserId, type: 'approval.decided' };
      } else {
        // approved
        const nextStepIndex = before.currentStep + 1;
        const nextStep = steps[nextStepIndex];

        if (!nextStep) {
          // Terminal approval.
          const decidedAt = new Date(decidedAtIso);
          const approvedRows = await tx
            .scopedUpdate(approvalRequests)
            .set({ status: 'approved', decidedAt })
            .where(eq(approvalRequests.id, input.requestId))
            .returning();
          after = (approvedRows as unknown as ApprovalRequest[])[0]!;

          await auditLogService.record(tx, {
            action: 'update',
            tableName: 'approval_requests',
            rowId: input.requestId,
            actorUserId: input.approverUserId,
            before: before as unknown as Record<string, unknown>,
            after: after as unknown as Record<string, unknown>,
            changedFields: ['status', 'decidedAt'],
            reason: input.reasonCode ?? null,
            context: { event: 'approve_request' },
          });

          notifyTarget = { userId: before.requestingUserId, type: 'approval.decided' };
        } else {
          // Advance: open next step row + bump currentStep.
          const nextApproverUserId = await resolveApproverByRole(tx, nextStep.role);

          await insertReturning<ApprovalRequestStep>(
            tx.scopedInsert(approvalRequestSteps, {
              requestId: input.requestId,
              stepIndex: nextStepIndex,
              approverUserId: nextApproverUserId,
              decision: 'pending',
            } as unknown as Parameters<typeof tx.scopedInsert<typeof approvalRequestSteps>>[1]).returning(),
          );

          const advancedRows = await tx
            .scopedUpdate(approvalRequests)
            .set({ currentStep: nextStepIndex })
            .where(eq(approvalRequests.id, input.requestId))
            .returning();
          after = (advancedRows as unknown as ApprovalRequest[])[0]!;

          await auditLogService.record(tx, {
            action: 'update',
            tableName: 'approval_requests',
            rowId: input.requestId,
            actorUserId: input.approverUserId,
            before: before as unknown as Record<string, unknown>,
            after: after as unknown as Record<string, unknown>,
            changedFields: ['currentStep'],
            reason: input.reasonCode ?? null,
            context: {
              event: 'advance_step',
              fromStep: before.currentStep,
              toStep: nextStepIndex,
              nextApproverUserId,
            },
          });

          // TODO Task A10: scheduleEscalation(input.requestId, nextStepIndex, nextStep.escalationTimeoutMinutes)

          notifyTarget = { userId: nextApproverUserId, type: 'approval.requested' };
        }
      }

      return { after, notifyTarget };
    });

    // Post-commit side effects.
    await notificationCenter.send(db, {
      userId: result.notifyTarget.userId,
      type: result.notifyTarget.type,
      payload: {
        requestId: result.after.id,
        entityType: result.after.entityType,
        entityRef: result.after.entityRef,
        status: result.after.status,
        decision: input.decision,
      },
    });

    await publishApprovalRequest({
      requestId: result.after.id,
      approverId: result.notifyTarget.userId,
      brandId: db.brandId,
      entityType: result.after.entityType,
    });

    return result.after;
  },

  /**
   * Delegate the current step to another user.
   *
   * Status-guarded UPDATE flips the current step to decision='delegated' +
   * escalation_target_user_id=targetUserId, then opens a new step row at the
   * SAME stepIndex with the delegate as approver and decision='pending'.
   *
   * The request's currentStep stays the same (the chain index hasn't moved);
   * the approver_user_id changes via the new step row.
   *
   * reasonCode mandatory.
   */
  async delegate(
    db: BrandedDb,
    input: DelegateInput,
    opts: MutationOpts,
  ): Promise<ApprovalRequestStep> {
    assertUuid('requestId', input.requestId);
    assertUuid('approverUserId', input.approverUserId);
    assertUuid('targetUserId', input.targetUserId);
    requireReasonCode('delegate', input.reasonCode);

    const result = await withTransaction(db, opts.actorUserId, async (tx) => {
      const reqRows = (await tx.scopedFrom(
        approvalRequests,
        eq(approvalRequests.id, input.requestId),
      )) as unknown as ApprovalRequest[];
      const req = reqRows[0];
      if (!req) {
        throw new NotFoundError({
          code: 'not_found.approval_request',
          message: `Approval request ${input.requestId} not found`,
        });
      }
      if (req.status !== 'pending') {
        throw new ValidationError({
          code: 'approval.request_not_pending',
          message: `Cannot delegate on request in status "${req.status}"`,
        });
      }

      const decidedAtIso = new Date().toISOString();
      const stepUpdate = await tx.raw.execute(sql`
        UPDATE approval_request_steps
        SET decision = 'delegated'::approval_step_decision,
            decided_at = ${decidedAtIso}::timestamptz,
            comment = ${input.comment ?? null},
            escalation_target_user_id = ${input.targetUserId},
            updated_at = NOW()
        WHERE brand_id = ${db.brandId}
          AND request_id = ${input.requestId}
          AND step_index = ${req.currentStep}
          AND approver_user_id = ${input.approverUserId}
          AND decision = 'pending'
        RETURNING id
      `);
      const stepUpdateRows = stepUpdate as unknown as Array<{ id: string }>;
      if (stepUpdateRows.length === 0) {
        throw new ValidationError({
          code: 'approval.step_already_decided',
          message:
            `Step ${req.currentStep} for request ${input.requestId} is not pending or you are not the assigned approver`,
        });
      }
      const oldStepId = stepUpdateRows[0]!.id;

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'approval_request_steps',
        rowId: oldStepId,
        actorUserId: input.approverUserId,
        changedFields: ['decision', 'decidedAt', 'escalationTargetUserId'],
        reason: input.reasonCode,
        context: {
          event: 'delegate_step',
          stepIndex: req.currentStep,
          targetUserId: input.targetUserId,
        },
      });

      const newStepRows = await insertReturning<ApprovalRequestStep>(
        tx.scopedInsert(approvalRequestSteps, {
          requestId: input.requestId,
          stepIndex: req.currentStep,
          approverUserId: input.targetUserId,
          decision: 'pending',
        } as unknown as Parameters<typeof tx.scopedInsert<typeof approvalRequestSteps>>[1]).returning(),
      );
      const newStep = newStepRows[0]!;

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'approval_request_steps',
        rowId: newStep.id,
        actorUserId: input.approverUserId,
        after: newStep as unknown as Record<string, unknown>,
        reason: input.reasonCode,
        context: {
          event: 'delegate_step_open',
          stepIndex: req.currentStep,
          delegateFrom: input.approverUserId,
        },
      });

      return { req, newStep };
    });

    await notificationCenter.send(db, {
      userId: input.targetUserId,
      type: 'approval.delegated',
      payload: {
        requestId: input.requestId,
        entityType: result.req.entityType,
        entityRef: result.req.entityRef,
        stepIndex: result.req.currentStep,
        delegateFrom: input.approverUserId,
      },
    });

    await publishApprovalRequest({
      requestId: input.requestId,
      approverId: input.targetUserId,
      brandId: db.brandId,
      entityType: result.req.entityType,
    });

    return result.newStep;
  },

  /**
   * List pending approval steps assigned to `approverUserId`, joined with the
   * parent request row so consumers (SI-INF-001 inbox) render cards without
   * a follow-up fetch.
   */
  async getPendingApprovals(
    db: BrandedDb,
    approverUserId: string,
  ): Promise<PendingApprovalRow[]> {
    const rows = await db.raw
      .select({
        step: approvalRequestSteps,
        request: approvalRequests,
      })
      .from(approvalRequestSteps)
      .innerJoin(approvalRequests, eq(approvalRequestSteps.requestId, approvalRequests.id))
      .where(
        and(
          eq(approvalRequestSteps.brandId, db.brandId),
          eq(approvalRequests.brandId, db.brandId),
          eq(approvalRequestSteps.approverUserId, approverUserId),
          eq(approvalRequestSteps.decision, 'pending'),
        ),
      )
      .orderBy(asc(approvalRequests.createdAt));

    return rows as unknown as PendingApprovalRow[];
  },

  /**
   * Return the request row + all its step rows (ordered by stepIndex ASC,
   * then created_at ASC for delegate-replay rows that share an index).
   */
  async getApprovalStatus(
    db: BrandedDb,
    requestId: string,
  ): Promise<ApprovalStatusView> {
    assertUuid('requestId', requestId);
    const reqRows = (await db.scopedFrom(
      approvalRequests,
      eq(approvalRequests.id, requestId),
    )) as unknown as ApprovalRequest[];
    const request = reqRows[0];
    if (!request) {
      throw new NotFoundError({
        code: 'not_found.approval_request',
        message: `Approval request ${requestId} not found`,
      });
    }
    const stepRows = await db.raw
      .select()
      .from(approvalRequestSteps)
      .where(
        and(
          eq(approvalRequestSteps.brandId, db.brandId),
          eq(approvalRequestSteps.requestId, requestId),
        ),
      )
      .orderBy(asc(approvalRequestSteps.stepIndex), asc(approvalRequestSteps.createdAt));

    return { request, steps: stepRows as unknown as ApprovalRequestStep[] };
  },

  /**
   * Create or update an approval chain.
   *
   * Status transitions enforced (DL-036):
   *   - Create → starts in 'draft' unless caller specifies 'active' explicitly.
   *   - draft → active   : permitted; requires non-empty steps array.
   *   - active → inactive: permitted (retire the chain).
   *   - inactive → *     : forbidden — clone to a new draft instead.
   *
   * Audit row written on every mutation. lastModifiedBy + lastModifiedAt
   * track BO-driven edits per DL-036.
   */
  async configureChain(
    db: BrandedDb,
    input: ConfigureChainInput,
    opts: MutationOpts,
  ): Promise<ApprovalChain> {
    assertUuid('actorUserId', opts.actorUserId);

    if (input.id !== undefined) {
      assertUuid('id', input.id);
      return updateChain(db, input as ConfigureChainInput & { id: string }, opts);
    }
    return createChain(db, input, opts);
  },

  /**
   * List chains for the brand, optionally filtered by entity_type / status.
   */
  async listChains(
    db: BrandedDb,
    opts?: ListChainsOpts,
  ): Promise<ApprovalChain[]> {
    const conditions: SQL[] = [];
    if (opts?.entityType) conditions.push(eq(approvalChains.entityType, opts.entityType));
    if (opts?.status) conditions.push(eq(approvalChains.status, opts.status));
    const condition = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
    const rows = (await db.scopedFrom(approvalChains, condition)) as unknown as ApprovalChain[];
    rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return rows;
  },
};

// ---------------------------------------------------------------------------
// Chain CRUD helpers (private)
// ---------------------------------------------------------------------------

async function createChain(
  db: BrandedDb,
  input: ConfigureChainInput,
  opts: MutationOpts,
): Promise<ApprovalChain> {
  const targetStatus: ApprovalChainStatus = input.status ?? 'draft';
  if (targetStatus === 'active' && input.steps.length === 0) {
    throw new ValidationError({
      code: 'approval.chain_steps_required',
      message: 'Cannot activate a chain with no steps',
    });
  }

  return withTransaction(db, opts.actorUserId, async (tx) => {
    const rows = await insertReturning<ApprovalChain>(
      tx.scopedInsert(approvalChains, {
        entityType: input.entityType,
        name: input.name,
        description: input.description ?? null,
        steps: input.steps as unknown,
        status: targetStatus,
        createdBy: opts.actorUserId,
        lastModifiedBy: opts.actorUserId,
        lastModifiedAt: new Date(),
      } as unknown as Parameters<typeof tx.scopedInsert<typeof approvalChains>>[1]).returning(),
    );
    const row = rows[0]!;

    await auditLogService.record(tx, {
      action: 'insert',
      tableName: 'approval_chains',
      rowId: row.id,
      actorUserId: opts.actorUserId,
      after: row as unknown as Record<string, unknown>,
      reason: input.reasonCode ?? null,
      context: { event: 'create_chain', entityType: input.entityType, status: targetStatus },
    });

    return row;
  });
}

async function updateChain(
  db: BrandedDb,
  input: ConfigureChainInput & { id: string },
  opts: MutationOpts,
): Promise<ApprovalChain> {
  return withTransaction(db, opts.actorUserId, async (tx) => {
    const beforeRows = (await tx.scopedFrom(
      approvalChains,
      eq(approvalChains.id, input.id),
    )) as unknown as ApprovalChain[];
    const before = beforeRows[0];
    if (!before) {
      throw new NotFoundError({
        code: 'not_found.approval_chain',
        message: `Approval chain ${input.id} not found`,
      });
    }

    const targetStatus: ApprovalChainStatus = input.status ?? before.status;
    validateStatusTransition(before.status, targetStatus);

    if (targetStatus === 'active' && input.steps.length === 0) {
      throw new ValidationError({
        code: 'approval.chain_steps_required',
        message: 'Cannot activate a chain with no steps',
      });
    }

    const now = new Date();
    const updateValues: Record<string, unknown> = {
      entityType: input.entityType,
      name: input.name,
      description: input.description ?? null,
      steps: input.steps as unknown,
      status: targetStatus,
      lastModifiedBy: opts.actorUserId,
      lastModifiedAt: now,
    };

    const updatedRows = await tx
      .scopedUpdate(approvalChains)
      .set(updateValues as Parameters<ReturnType<typeof tx.scopedUpdate>['set']>[0])
      .where(eq(approvalChains.id, input.id))
      .returning();
    const after = (updatedRows as unknown as ApprovalChain[])[0]!;

    const changedFields = auditLogService.computeChangedFields(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
    );

    await auditLogService.record(tx, {
      action: 'update',
      tableName: 'approval_chains',
      rowId: input.id,
      actorUserId: opts.actorUserId,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      changedFields,
      reason: input.reasonCode ?? null,
      context: { event: 'update_chain', fromStatus: before.status, toStatus: targetStatus },
    });

    return after;
  });
}

function validateStatusTransition(
  from: ApprovalChainStatus,
  to: ApprovalChainStatus,
): void {
  if (from === to) return;
  // draft → active OR draft → inactive (discard a draft) — both allowed.
  if (from === 'draft' && (to === 'active' || to === 'inactive')) return;
  // active → inactive — allowed (retire a chain).
  if (from === 'active' && to === 'inactive') return;
  // active → draft is forbidden (would lose the audit story; clone to new draft instead).
  // inactive → * is forbidden in MVP; clone to a new draft.
  throw new ValidationError({
    code: 'approval.invalid_status_transition',
    message: `Cannot transition approval chain from "${from}" to "${to}"; clone to a new draft instead`,
  });
}

// Re-export type aliases for ergonomic consumer imports.
export type { ApprovalChain, ApprovalChainStep, ApprovalRequest, ApprovalRequestStep };
