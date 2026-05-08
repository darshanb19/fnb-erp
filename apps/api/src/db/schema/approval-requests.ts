/**
 * approval_requests + approval_request_steps — Phase 4 Epic 3 INF Arc (a) Task A1.
 *
 * BRAND-SCOPED. One request row per pending approval; one step row per
 * chain step with a per-step decision audit trail.
 *
 * Routing engine (Task A7 approvalEngine.ts) picks the active chain matching
 * `entity_type` + `entity_value` band, writes the request row, and creates
 * one approval_request_steps row per chain step. Step 0 is routed to its
 * approver immediately; subsequent steps unblock as prior steps approve.
 *
 * Status-guarded UPDATE pattern per DL-016: decisions UPDATE the step row
 * only when its current decision is 'pending'; the same UPDATE advances the
 * request row's `currentStep` and (on chain completion) sets `status` and
 * `decidedAt`.
 *
 * `payload` on the request row carries entity-type-specific summary data
 * the inbox card needs to render without a back-channel fetch (e.g., PO
 * supplier name + line-item count for FR41 cards).
 */

import { pgEnum, text, integer, numeric, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';
import { approvalChains, approvalChainEntityTypeEnum } from './approval-chains.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const approvalRequestStatusEnum = pgEnum('approval_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'delegated',
]);

export const approvalStepDecisionEnum = pgEnum('approval_step_decision', [
  'pending',
  'approved',
  'rejected',
  'delegated',
]);

// ---------------------------------------------------------------------------
// approval_requests
// ---------------------------------------------------------------------------

export const approvalRequests = brandScopedTable('approval_requests', {
  entityType: approvalChainEntityTypeEnum('entity_type').notNull(),
  /** TRN or business-key reference for the entity awaiting approval. */
  entityRef: text('entity_ref').notNull(),
  /** Numeric value used for value-band matching; nullable for non-monetary entities. */
  entityValue: numeric('entity_value', { precision: 14, scale: 2 }),
  requestingUserId: uuid('requesting_user_id')
    .notNull()
    .references(() => users.id),
  chainId: uuid('chain_id')
    .notNull()
    .references(() => approvalChains.id),
  currentStep: integer('current_step').notNull().default(0),
  status: approvalRequestStatusEnum('status').notNull().default('pending'),
  /** Human-readable routing rationale, e.g. "PO value > ₹50,000 → Brand Owner". */
  routingReason: text('routing_reason').notNull(),
  /** Entity-type-specific summary for inbox card rendering. */
  payload: jsonb('payload'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// approval_request_steps
// ---------------------------------------------------------------------------

export const approvalRequestSteps = brandScopedTable('approval_request_steps', {
  requestId: uuid('request_id')
    .notNull()
    .references(() => approvalRequests.id),
  stepIndex: integer('step_index').notNull(),
  approverUserId: uuid('approver_user_id')
    .notNull()
    .references(() => users.id),
  decision: approvalStepDecisionEnum('decision').notNull().default('pending'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  comment: text('comment'),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  escalationTargetUserId: uuid('escalation_target_user_id').references(() => users.id),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type ApprovalRequestStep = typeof approvalRequestSteps.$inferSelect;
export type NewApprovalRequestStep = typeof approvalRequestSteps.$inferInsert;
export type ApprovalRequestStatus =
  (typeof approvalRequestStatusEnum.enumValues)[number];
export type ApprovalStepDecision =
  (typeof approvalStepDecisionEnum.enumValues)[number];
