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
