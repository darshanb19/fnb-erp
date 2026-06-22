/**
 * Errors barrel — re-exports all application error classes.
 *
 * Import pattern in service/middleware code:
 *   import { ValidationError, NotFoundError, AuthorizationError } from '../errors/index.js';
 */

export { AppError } from './base-error.js';
export type { ErrorEnvelope, AppErrorOptions } from './base-error.js';

export { ValidationError } from './validation-error.js';
export { NotFoundError } from './not-found-error.js';
export { AuthorizationError } from './authorization-error.js';
export type { AuthorizationErrorOptions } from './authorization-error.js';
export {
  BusinessRuleError,
  ScopeMutationError,
  ParentRelinkAttemptError,
  EnablementViolationError,
  InsufficientStockError,
  FlowDirectionError,
  ClusterBoundaryError,
  GoodsReceiptLifecycleError,
  TransferLifecycleError,
} from './business-rule-error.js';
export type {
  InsufficientStockErrorOptions,
  FlowDirectionErrorOptions,
  ClusterBoundaryErrorOptions,
} from './business-rule-error.js';
