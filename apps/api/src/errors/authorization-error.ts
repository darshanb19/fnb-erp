/**
 * AuthorizationError — HTTP 403 (or 401 when token is missing/invalid)
 *
 * Raised when a user is authenticated but not permitted to perform an action,
 * or when authentication itself fails (missing/invalid/expired token).
 * Default code prefix: `auth.`
 *
 * The httpStatus is intentionally overrideable at construction time:
 * - Token missing/invalid/expired → 401
 * - Valid token, insufficient permission → 403
 *
 * Architecture §6.5
 */

import { AppError } from './base-error.js';

export interface AuthorizationErrorOptions {
  code: string;
  message: string;
  httpStatus?: 401 | 403;
  details?: Record<string, unknown>;
}

export class AuthorizationError extends AppError {
  override readonly httpStatus: 401 | 403;

  constructor({ code, message, httpStatus = 403, details }: AuthorizationErrorOptions) {
    super({ code, message, details });
    this.httpStatus = httpStatus;
  }
}
