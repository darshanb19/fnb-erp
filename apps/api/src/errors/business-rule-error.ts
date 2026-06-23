/**
 * BusinessRuleError and subclasses — HTTP 422
 *
 * Raised when an operation is structurally valid but violates a domain business rule.
 * Default code prefix: `business.`
 *
 * Concrete subclasses:
 * - ScopeMutationError          — vendor scope narrowing/widening blocked (§2.7, DL-023)
 * - ParentRelinkAttemptError    — org parent re-link blocked on immutable key (DL-022)
 * - EnablementViolationError    — inventory enablement check failed (Epic 4 stock movements)
 * - InsufficientStockError      — on-hand quantity below requested amount (Epic 4 INV)
 * - FlowDirectionError          — stock movement violates directional flow rule (Epic 4 INV)
 * - ClusterBoundaryError        — stock movement crosses cluster boundary (Epic 4 INV)
 *
 * Architecture §6.5
 */

import { AppError, type AppErrorOptions } from './base-error.js';

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class BusinessRuleError extends AppError {
  override readonly httpStatus = 422 as const;

  constructor(options: AppErrorOptions) {
    super(options);
  }
}

// ---------------------------------------------------------------------------
// ScopeMutationError — vendor scope narrowing/widening (§2.7, DL-023)
// ---------------------------------------------------------------------------

/**
 * Raised when a vendor scope mutation is attempted that violates §2.7 constraints.
 * E.g. narrowing to a subset without the required override flag,
 * or widening scope post-approval.
 */
export class ScopeMutationError extends BusinessRuleError {
  constructor(options: AppErrorOptions) {
    super(options);
  }
}

// ---------------------------------------------------------------------------
// ParentRelinkAttemptError — immutable parent key (DL-022)
// ---------------------------------------------------------------------------

/**
 * Raised when code attempts to re-parent an org node on a key declared immutable
 * post-creation (e.g. clusterId, regionId after first save).
 *
 * Constructor: `new ParentRelinkAttemptError('clusterId')`
 * Emits: `Cannot re-parent: clusterId is immutable per DL-022`
 */
export class ParentRelinkAttemptError extends BusinessRuleError {
  constructor(lockedKey: string) {
    super({
      code: 'org.parent_relink_blocked',
      message: `Cannot re-parent: ${lockedKey} is immutable per DL-022`,
      details: { lockedKey },
    });
  }
}

// ---------------------------------------------------------------------------
// EnablementViolationError — inventory enablement check stub (Epic 4)
// ---------------------------------------------------------------------------

/**
 * Raised when `inventoryService.checkEnablement()` determines the stock movement
 * is not permitted for the given location/item combination.
 *
 * Placeholder for Epic 4 stock movements. Exists here so service-layer code
 * in later tasks can import and throw it without a circular dependency.
 */
export class EnablementViolationError extends BusinessRuleError {
  constructor(options: AppErrorOptions) {
    super(options);
  }
}

// ---------------------------------------------------------------------------
// InsufficientStockError — on-hand quantity below requested (Epic 4 INV)
// ---------------------------------------------------------------------------

export interface InsufficientStockErrorOptions {
  itemId: string;
  departmentId: string;
  requested: number;
  available: number;
}

/**
 * Raised when the requested stock quantity exceeds the available on-hand quantity
 * for the given item / department combination.
 */
export class InsufficientStockError extends BusinessRuleError {
  constructor({ itemId, departmentId, requested, available }: InsufficientStockErrorOptions) {
    super({
      code: 'business.insufficient_stock',
      message: `Insufficient stock for item ${itemId} in department ${departmentId}: requested ${requested}, available ${available}`,
      details: { itemId, departmentId, requested, available },
    });
  }
}

// ---------------------------------------------------------------------------
// FlowDirectionError — directional flow rule violation (Epic 4 INV)
// ---------------------------------------------------------------------------

export interface FlowDirectionErrorOptions {
  from: string;
  to: string;
  reason: string;
}

/**
 * Raised when a stock movement from one location/department to another violates
 * a configured directional flow rule (e.g. cross-cluster transfers are blocked).
 */
export class FlowDirectionError extends BusinessRuleError {
  constructor({ from, to, reason }: FlowDirectionErrorOptions) {
    super({
      code: 'business.flow_direction_violation',
      message: `Flow direction violation from ${from} to ${to}: ${reason}`,
      details: { from, to, reason },
    });
  }
}

// ---------------------------------------------------------------------------
// ClusterBoundaryError — cross-cluster movement blocked (Epic 4 INV)
// ---------------------------------------------------------------------------

export interface ClusterBoundaryErrorOptions {
  clusterId: string;
}

/**
 * Raised when a stock movement would cross a cluster boundary that is declared
 * closed for direct transfers.
 */
export class ClusterBoundaryError extends BusinessRuleError {
  constructor({ clusterId }: ClusterBoundaryErrorOptions) {
    super({
      code: 'business.cluster_boundary_violation',
      message: `Stock movement crosses closed cluster boundary for cluster ${clusterId}`,
      details: { clusterId },
    });
  }
}

// ---------------------------------------------------------------------------
// TransferLifecycleError — Transfer lifecycle transition guard (Epic 4 W3)
// ---------------------------------------------------------------------------

/**
 * Raised when a stock transfer lifecycle action is attempted on a transfer
 * that is not in the expected state (e.g. cancelling a post-approval transfer
 * requires a compensating document per FR117).
 */
export class TransferLifecycleError extends BusinessRuleError {
  constructor(opts: { transferId: string; currentStatus: string; attemptedAction: string }) {
    super({
      code: 'business.transfer_lifecycle_violation',
      message: `Cannot ${opts.attemptedAction} transfer ${opts.transferId}: current status is '${opts.currentStatus}'. Post-approval cancellation requires a compensating document (FR117).`,
      details: opts,
    });
  }
}

// ---------------------------------------------------------------------------
// GoodsReceiptLifecycleError — GR lifecycle transition guard (Epic 4 W2)
// ---------------------------------------------------------------------------

/**
 * Raised when a Goods Receipt lifecycle action is attempted on a GR that is
 * not in the expected state (e.g. confirming an already-confirmed GR).
 * HTTP 422 (BusinessRuleError base) — semantically a business rule violation
 * (the document has already transitioned past the expected state).
 */
export class GoodsReceiptLifecycleError extends BusinessRuleError {
  constructor(opts: { grId: string; currentStatus: string; attemptedAction: string }) {
    super({
      code: 'business.gr_lifecycle_violation',
      message: `Cannot ${opts.attemptedAction} GR ${opts.grId}: current status is '${opts.currentStatus}'`,
      details: opts,
    });
  }
}

// ---------------------------------------------------------------------------
// AdjustmentLifecycleError — Adjustment lifecycle transition guard (Epic 4 W4)
// ---------------------------------------------------------------------------

/**
 * Raised when an inventory adjustment lifecycle action is attempted on an adjustment
 * that is not in the expected state (e.g. cancelling a confirmed adjustment).
 */
export class AdjustmentLifecycleError extends BusinessRuleError {
  constructor(opts: { adjId: string; currentStatus: string; attemptedAction: string; message?: string }) {
    super({
      code: 'business.adjustment_lifecycle_violation',
      message: opts.message ?? `Cannot ${opts.attemptedAction} adjustment ${opts.adjId}: current status is '${opts.currentStatus}'`,
      details: opts,
    });
  }
}

// ---------------------------------------------------------------------------
// ClosingInventoryLifecycleError — Closing inventory lifecycle guard (Epic 4 W4)
// ---------------------------------------------------------------------------

/**
 * Raised when a closing inventory lifecycle action is attempted on a document
 * that is not in the expected state.
 */
export class ClosingInventoryLifecycleError extends BusinessRuleError {
  constructor(opts: { ciId: string; currentStatus: string; attemptedAction: string; message?: string }) {
    super({
      code: 'business.closing_lifecycle_violation',
      message: opts.message ?? `Cannot ${opts.attemptedAction} closing inventory ${opts.ciId}: current status is '${opts.currentStatus}'`,
      details: opts,
    });
  }
}
