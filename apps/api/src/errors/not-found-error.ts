/**
 * NotFoundError — HTTP 404
 *
 * Raised when a requested resource does not exist or is not accessible
 * within the current brand scope.
 * Default code prefix: `not_found.`
 *
 * Architecture §6.5
 */

import { AppError, type AppErrorOptions } from './base-error.js';

export class NotFoundError extends AppError {
  override readonly httpStatus = 404 as const;

  constructor(options: AppErrorOptions) {
    super(options);
  }
}
